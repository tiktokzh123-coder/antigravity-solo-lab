#!/usr/bin/env node
/**
 * feishu-voice-engine.mjs
 * -----------------------
 * 飞书实时双向语音引擎 (ASR + Neural TTS + 原生 Opus 语音气泡 + 一键拨号卡片 + 电话加急振铃 + HTTPS 隧道)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEDIA_DIR = path.join(__dirname, 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

const GCP_ADC_PATH = process.env.GCP_ADC_PATH || '~/workspace/media-synthesis-pipeline/gcp_adc.json';
const EDGE_TTS_BIN = process.env.EDGE_TTS_BIN || path.join(os.homedir(), '.local/bin/edge-tts');
const CLOUDFLARED_BIN = process.env.CLOUDFLARED_BIN || path.join(__dirname, 'bin/cloudflared');
const EXEC_ENV = {
  ...process.env,
  PATH: `/opt/homebrew/bin:/usr/local/bin:${path.join(os.homedir(), '.local/bin')}:${process.env.PATH || '/usr/bin:/bin'}`,
};

let cachedVertexToken = '';
let cachedVertexProjectId = 'your-gcp-project-id';
let cachedVertexExpireAtMs = 0;
let activeTunnelProcess = null;

export const voiceCallRuntime = {
  publicTunnelUrl: '',
  lanUrl: '',
  localUrl: '',
  tunnelStartedAt: null,
  autoVoiceReplyEnabled: true,
  defaultVoiceName: process.env.FEISHU_TTS_VOICE || 'zh-CN-XiaoxiaoNeural',
  totalAsrTranscriptions: 0,
  totalTtsSyntheses: 0,
  totalVoiceBubblesSent: 0,
  totalVoiceCallTurns: 0,
  totalUrgentPhoneCalls: 0,
  recentCallTurns: [],
};

export function detectLanIpAddress() {
  const nets = os.networkInterfaces();
  for (const name of ['en0', 'en1', 'eth0', ...Object.keys(nets)]) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

export async function getVertexAccessToken() {
  if (cachedVertexToken && Date.now() < cachedVertexExpireAtMs - 60000) {
    return { token: cachedVertexToken, projectId: cachedVertexProjectId };
  }
  if (!fs.existsSync(GCP_ADC_PATH)) throw new Error(`未找到 GCP ADC 凭证文件: ${GCP_ADC_PATH}`);
  const adc = JSON.parse(fs.readFileSync(GCP_ADC_PATH, 'utf8'));
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: adc.client_id,
      client_secret: adc.client_secret,
      refresh_token: adc.refresh_token,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`OAuth2 刷新失败: HTTP ${resp.status}`);
  const data = await resp.json();
  cachedVertexToken = data.access_token || '';
  cachedVertexProjectId = adc.quota_project_id || 'your-gcp-project-id';
  cachedVertexExpireAtMs = Date.now() + Number(data.expires_in || 3500) * 1000;
  return { token: cachedVertexToken, projectId: cachedVertexProjectId };
}

export function cleanTextForSpeech(rawText, { maxChars = 420 } = {}) {
  if (!rawText) return '';
  let text = String(rawText)
    .replace(/```[\s\S]*?```/g, '（代码片段已省略）')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s)]+/g, '')
    .replace(/\/Users\/[^/]+\/[^\s`'")\]]+/g, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    .replace(/【📌[\s\S]*$/g, '')
    .replace(/[*#_~>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}……详细内容已同步发送至您的飞书屏幕。`;
  }
  return text || 'SoloLab 总控台已收到您的指令，正在处理中。';
}

export async function transcribeAudioFile(audioFilePath, { larkClient = null, logFn = null } = {}) {
  if (!audioFilePath || !fs.existsSync(audioFilePath)) {
    return { ok: false, text: '', engine: 'none', error: '音频文件不存在' };
  }
  const id = crypto.randomUUID().slice(0, 8);
  const tmpMp3Path = path.join(os.tmpdir(), `asr_${id}.mp3`);
  const tmpPcmPath = path.join(os.tmpdir(), `asr_${id}.pcm`);

  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', audioFilePath, '-ar', '16000', '-ac', '1', '-b:a', '32k', tmpMp3Path],
      { timeout: 15000, env: EXEC_ENV }
    );

    if (fs.existsSync(tmpMp3Path) && fs.statSync(tmpMp3Path).size > 200) {
      try {
        const { token, projectId } = await getVertexAccessToken();
        const b64Audio = fs.readFileSync(tmpMp3Path).toString('base64');
        for (const model of ['gemini-3-flash-preview', 'gemini-4-argon', 'gemini-3.5-flash-lite']) {
          const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${model}:generateContent`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'x-goog-user-project': projectId,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  { inlineData: { mimeType: 'audio/mp3', data: b64Audio } },
                  { text: '请将这段人类语音精准转写为中文文本（若有英文专有名词请保留），只输出转写后的纯文本本身，不要添加任何解释或引号；若完全是静音或纯噪音无说话声，请只输出 EMPTY。' },
                ],
              }],
              generationConfig: { temperature: 0.0 },
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (resp.ok) {
            const data = await resp.json();
            const rawTranscript = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
            if (rawTranscript && rawTranscript !== 'EMPTY') {
              voiceCallRuntime.totalAsrTranscriptions++;
              return { ok: true, text: rawTranscript, engine: `vertex-${model}` };
            }
          }
        }
      } catch (err) {
        if (logFn) logFn('WARN', 'Vertex AI 语音转写尝试异常，切换飞书 STT 兜底', { error: err.message });
      }
    }

    if (larkClient) {
      try {
        execFileSync(
          'ffmpeg',
          ['-y', '-v', 'error', '-i', audioFilePath, '-f', 's16le', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', tmpPcmPath],
          { timeout: 10000, env: EXEC_ENV }
        );
        if (fs.existsSync(tmpPcmPath)) {
          const pcmBase64 = fs.readFileSync(tmpPcmPath).toString('base64');
          const sttRes = await larkClient.speechToText.v1.speech.fileRecognize({
            data: {
              speech: { speech: pcmBase64 },
              config: { file_id: crypto.randomUUID().slice(0, 16), format: 'pcm', engine_type: '16k_auto' },
            },
          });
          const recognized = (sttRes?.data?.recognition_text || sttRes?.recognition_text || '').trim();
          if (recognized) {
            voiceCallRuntime.totalAsrTranscriptions++;
            return { ok: true, text: recognized, engine: 'feishu-pcm-stt' };
          }
        }
      } catch {}
    }
    return { ok: false, text: '', engine: 'none', error: '未能从音频中识别出有效语音文本' };
  } catch (err) {
    return { ok: false, text: '', engine: 'none', error: err.message };
  } finally {
    try { if (fs.existsSync(tmpMp3Path)) fs.unlinkSync(tmpMp3Path); } catch {}
    try { if (fs.existsSync(tmpPcmPath)) fs.unlinkSync(tmpPcmPath); } catch {}
  }
}

export async function synthesizeVoiceToOpus(
  rawText,
  { voice = voiceCallRuntime.defaultVoiceName, keepFilesInMediaDir = true } = {}
) {
  const spokenText = cleanTextForSpeech(rawText);
  const id = `${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const tmpRawAudio = path.join(os.tmpdir(), `tts_raw_${id}.mp3`);
  const tmpAiffAudio = path.join(os.tmpdir(), `tts_fallback_${id}.aiff`);
  const outDir = keepFilesInMediaDir ? MEDIA_DIR : os.tmpdir();
  const opusPath = path.join(outDir, `feishu_voice_${id}.opus`);
  const mp3Path = path.join(outDir, `feishu_voice_${id}.mp3`);

  let ttsEngine = 'edge-tts';
  let rawSourcePath = tmpRawAudio;

  try {
    if (fs.existsSync(EDGE_TTS_BIN)) {
      try {
        execFileSync(
          EDGE_TTS_BIN,
          ['--voice', voice || 'zh-CN-XiaoxiaoNeural', '--rate=+8%', '--text', spokenText, '--write-media', tmpRawAudio],
          { timeout: 15000, env: EXEC_ENV }
        );
      } catch {
        ttsEngine = 'macos-tingting';
      }
    } else {
      ttsEngine = 'macos-tingting';
    }

    if (!fs.existsSync(tmpRawAudio) || fs.statSync(tmpRawAudio).size < 256) {
      ttsEngine = 'macos-tingting';
      execFileSync('/usr/bin/say', ['-v', 'Tingting', '-r', '195', '-o', tmpAiffAudio, spokenText], {
        timeout: 12000,
        env: EXEC_ENV,
      });
      rawSourcePath = tmpAiffAudio;
    }

    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', rawSourcePath, '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'voip', opusPath],
      { timeout: 12000, env: EXEC_ENV }
    );
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', rawSourcePath, '-c:a', 'libmp3lame', '-ar', '24000', '-ac', '1', '-b:a', '48k', mp3Path],
      { timeout: 12000, env: EXEC_ENV }
    );

    let durationMs = Math.max(1500, Math.round(spokenText.length * 220));
    try {
      const probeRaw = execFileSync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name', '-of', 'json', opusPath],
        { encoding: 'utf8', timeout: 8000, env: EXEC_ENV }
      );
      const sec = Number(JSON.parse(probeRaw || '{}')?.format?.duration || 0);
      if (sec > 0 && !Number.isNaN(sec)) durationMs = Math.max(1000, Math.round(sec * 1000));
    } catch {}

    voiceCallRuntime.totalTtsSyntheses++;
    return {
      ok: true,
      spokenText,
      ttsEngine,
      opusPath,
      mp3Path,
      mp3FileName: path.basename(mp3Path),
      opusFileName: path.basename(opusPath),
      durationMs,
    };
  } finally {
    try { if (fs.existsSync(tmpRawAudio)) fs.unlinkSync(tmpRawAudio); } catch {}
    try { if (fs.existsSync(tmpAiffAudio)) fs.unlinkSync(tmpAiffAudio); } catch {}
  }
}

export async function sendFeishuNativeVoiceBubble({
  larkClient,
  chatId,
  openId,
  text,
  opusFilePath = '',
  durationMs = 0,
  voice = voiceCallRuntime.defaultVoiceName,
}) {
  const receiveId = chatId || openId;
  const receiveIdType = chatId ? 'chat_id' : 'open_id';
  if (!receiveId) throw new Error('缺少飞书接收方 chatId 或 openId');

  let finalOpusPath = opusFilePath;
  let finalDurationMs = durationMs;
  let ttsMeta = null;

  if (!finalOpusPath || !fs.existsSync(finalOpusPath)) {
    ttsMeta = await synthesizeVoiceToOpus(text, { voice });
    finalOpusPath = ttsMeta.opusPath;
    finalDurationMs = ttsMeta.durationMs;
  } else if (!finalDurationMs) {
    finalDurationMs = 3000;
  }

  const fileRes = await larkClient.im.file.create({
    data: {
      file_type: 'opus',
      file_name: path.basename(finalOpusPath),
      duration: finalDurationMs,
      file: fs.createReadStream(finalOpusPath),
    },
  });
  const fileKey = fileRes?.file_key || fileRes?.data?.file_key;
  if (!fileKey) throw new Error('上传飞书 Opus 语音文件未返回 file_key');

  const msgRes = await larkClient.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      msg_type: 'audio',
      content: JSON.stringify({ file_key: fileKey, duration: finalDurationMs }),
    },
  });

  voiceCallRuntime.totalVoiceBubblesSent++;
  return {
    ok: true,
    fileKey,
    durationMs: finalDurationMs,
    messageId: msgRes?.data?.message_id || msgRes?.message_id || null,
    ttsEngine: ttsMeta?.ttsEngine || 'prebuilt-opus',
    opusPath: finalOpusPath,
    mp3Path: ttsMeta?.mp3Path || null,
  };
}

export async function generateInstantVoiceCallReply(userSpokenText, { commanderStatus = 'IDLE' } = {}) {
  const cleanInput = String(userSpokenText || '').trim();
  if (!cleanInput) return '您好，SoloLab 语音助手在听，请您直接说指令。';
  try {
    const { token, projectId } = await getVertexAccessToken();
    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3-flash-preview:generateContent`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-user-project': projectId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: `你是 SoloLab 总控台的实时语音电话助手（SoloLab 语音助手，正在通过飞书语音电话与用户对话）。用户刚刚在电话里说：「${cleanInput}」。当前后台总控台状态：${commanderStatus}（后台已同步将用户这句原话派发给 SoloLab 总控台及各业务对话窗口执行）。请用中文口语（1到2句话，60字以内，像真人秘书打电话一样干脆亲切，无Markdown符号，统一称呼“SoloLab 总控台”、“SoloLab 语音助手”、“各业务对话窗口”）立刻回应用户：确认已听清该具体指令并已同步唤醒 SoloLab 总控台与各业务对话窗口处理，结果出来马上向他播报。`,
          }],
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 120 },
      }),
      signal: AbortSignal.timeout(4500),
    });
    if (resp.ok) {
      const data = await resp.json();
      const reply = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (reply) return cleanTextForSpeech(reply, { maxChars: 140 });
    }
  } catch {}
  return `收到！您说的「${cleanInput.slice(0, 28)}」我已经立刻传达给 SoloLab 总控台与各业务对话窗口执行，结果一出来我马上语音播报给您！`;
}

export async function ensureVoiceCallHttpsTunnel({ port = 18910, logFn = null } = {}) {
  const lanIp = detectLanIpAddress();
  voiceCallRuntime.lanUrl = `http://${lanIp}:${port}/voice-call`;
  voiceCallRuntime.localUrl = `http://127.0.0.1:${port}/voice-call`;

  if (voiceCallRuntime.publicTunnelUrl && activeTunnelProcess && !activeTunnelProcess.killed) {
    return voiceCallRuntime.publicTunnelUrl;
  }
  if (!fs.existsSync(CLOUDFLARED_BIN)) return '';

  return await new Promise((resolve) => {
    let resolved = false;
    const finish = (url) => { if (!resolved) { resolved = true; resolve(url); } };
    try {
      const child = spawn(
        CLOUDFLARED_BIN,
        ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'],
        { stdio: ['ignore', 'pipe', 'pipe'], env: EXEC_ENV }
      );
      activeTunnelProcess = child;
      const onChunk = (buf) => {
        const m = buf.toString('utf8').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (m && m[0]) {
          voiceCallRuntime.publicTunnelUrl = m[0];
          voiceCallRuntime.tunnelStartedAt = new Date().toISOString();
          if (logFn) logFn('INFO', 'Cloudflared HTTPS 手机语音通话隧道已就绪', { publicVoiceCallUrl: `${m[0]}/voice-call` });
          finish(m[0]);
        }
      };
      child.stdout.on('data', onChunk);
      child.stderr.on('data', onChunk);
      child.on('exit', () => { activeTunnelProcess = null; finish(''); });
      setTimeout(() => finish(voiceCallRuntime.publicTunnelUrl || ''), 9000);
    } catch {
      finish('');
    }
  });
}
