#!/usr/bin/env node
/**
 * SoloLab 飞书手机端 <-> Antigravity 总控会话工作台 (Swarm Commander) 双向长连接桥接守护进程
 * - 连接模式：@larksuiteoapi/node-sdk 官方 WSClient 长连接（免公网 IP / 免内网穿透 / 免 Webhook 域名）
 * - 上行链路：手机飞书文字/语音/图片/视频 -> 自动回复确认 -> LanguageServer RPC (SendAgentMessage + IDLE 状态 SendUserCascadeMessage 兜底唤醒) 唤醒总控 (00000000-0000-4000-8000-000000000000)
 * - 下行链路：严禁绕过总控直推工作节点原始回执！仅监听总控正式审核回复 (128KB 尾部增量读取) 及 POST /send-feishu 显式批准消息 -> 自动回推用户手机飞书
 * - 本地控制端口：http://127.0.0.1:18910 (/health, /status, /send-feishu)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import * as Lark from '@larksuiteoapi/node-sdk';
import {
  discoverLanguageServerConfig,
  callLanguageServerRpc,
} from '../scripts/cross-project-federation.mjs';
import {
  runAllPermissionAutoGrants,
  applyPlaywrightContextPermissions,
} from './permission-auto-granter.mjs';
import {
  SWARM_WATCHDOG_CONFIG,
  inspectSpecialistTranscriptTail,
  runSwarmWatchdogTick,
  getSwarmWatchdogStatus,
} from './swarm-countdown-watchdog.mjs';
import {
  voiceCallRuntime,
  transcribeAudioFile,
  sendFeishuNativeVoiceBubble,
  generateInstantVoiceCallReply,
  ensureVoiceCallHttpsTunnel,
} from './feishu-voice-engine.mjs';
import {
  handleVoiceCallHttpRoutes,
  sendFeishuVoiceCallCard,
} from './feishu-voice-webapp.mjs';

export const BRIDGE_VERSION = '1.6.0-voice-call';

const HOME = os.homedir();
const PROJECT_ROOT = process.env.FEISHU_BRIDGE_ROOT || path.resolve(os.homedir(), '.gemini/antigravity/feishu-bridge');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const STATE_PATH = path.join(PROJECT_ROOT, '.bridge-state.json');
const LOG_PATH = path.join(PROJECT_ROOT, 'feishu-bridge.log');
const MEDIA_DIR = path.join(PROJECT_ROOT, 'media');
const BRAIN_DIR = path.join(HOME, '.gemini/antigravity/brain');

const BRIDGE_STARTED_AT_MS = Date.now();
const BRIDGE_STARTED_AT_SEC = Math.floor(BRIDGE_STARTED_AT_MS / 1000);
const MAX_PROCESSED_MESSAGE_IDS = 2000;
const MAX_THREAD_SUBSCRIPTIONS = 500;
const BACKFILL_INTERVAL_MS = 60 * 1000;
const OUTBOUND_DEDUP_WINDOW_MS = 15 * 1000;

function loadDotEnv(envFile) {
  const out = {};
  if (!fs.existsSync(envFile)) return out;
  for (const rawLine of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = line.slice(0, eqIdx).trim();
    const v = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    out[k] = v;
    if (!process.env[k]) process.env[k] = v;
  }
  return out;
}

loadDotEnv(ENV_PATH);
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_your_feishu_app_id';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || '';
const COMMANDER_CONVERSATION_ID =
  process.env.COMMANDER_CONVERSATION_ID || '00000000-0000-4000-8000-000000000000';
const BRIDGE_PORT = Number(process.env.FEISHU_BRIDGE_PORT || 18910);

let logWriteCount = 0;
function logBridge(level, msg, extra = null) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`;
  console.log(line);
  try {
    if (++logWriteCount % 200 === 0 && fs.existsSync(LOG_PATH)) {
      const st = fs.statSync(LOG_PATH);
      if (st.size > 2 * 1024 * 1024) {
        const tail = fs.readFileSync(LOG_PATH, 'utf8').slice(-1024 * 1024);
        fs.writeFileSync(LOG_PATH, tail, 'utf8');
      }
    }
    fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
  } catch {}
}

function loadBridgeState() {
  try {
    if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {}
  return {
    lastActiveChatId: null, lastActiveOpenId: null, lastMessageId: null,
    lastInboundAtMs: 0, lastBackfillSec: BRIDGE_STARTED_AT_SEC, lastPushedCommanderStepIdx: -1,
    processedMessageIds: [], threadSubscriptions: {}, stats: {},
  };
}

const bridgeState = loadBridgeState();
if (!bridgeState.activeCommanderConversationId) bridgeState.activeCommanderConversationId = COMMANDER_CONVERSATION_ID;
if (!Array.isArray(bridgeState.processedMessageIds)) bridgeState.processedMessageIds = [];
if (!bridgeState.threadSubscriptions || typeof bridgeState.threadSubscriptions !== 'object') bridgeState.threadSubscriptions = {};
bridgeState.lastBackfillSec = Math.max(Number(bridgeState.lastBackfillSec || 0), BRIDGE_STARTED_AT_SEC);
bridgeState.stats = {
  inboundMessagesCount: 0, forwardedToCommanderCount: 0, outboundRepliesCount: 0,
  commanderApprovedPushesCount: 0, backfilledMessagesCount: 0, threadFollowupsCount: 0,
  dedupedOutboundCount: 0, ...(bridgeState.stats || {}),
};

const processedMessageIdSet = new Set(bridgeState.processedMessageIds);

export function hasProcessedMessage(messageId) {
  if (!messageId) return false;
  return processedMessageIdSet.has(messageId) || (bridgeState.processedMessageIds || []).includes(messageId);
}

export function markMessageProcessed(messageId) {
  if (!messageId) return;
  if (!processedMessageIdSet.has(messageId)) {
    processedMessageIdSet.add(messageId);
    bridgeState.processedMessageIds.push(messageId);
  }
  if (bridgeState.processedMessageIds.length > MAX_PROCESSED_MESSAGE_IDS) {
    const excess = bridgeState.processedMessageIds.splice(
      0,
      bridgeState.processedMessageIds.length - MAX_PROCESSED_MESSAGE_IDS
    );
    for (const oldId of excess) processedMessageIdSet.delete(oldId);
  }
}

export function recordThreadSubscription(keys, { cascadeId, section = '', chatId = '' } = {}) {
  const targetCascadeId = String(cascadeId || '').trim();
  if (!targetCascadeId) return;
  if (!bridgeState.threadSubscriptions || typeof bridgeState.threadSubscriptions !== 'object') {
    bridgeState.threadSubscriptions = {};
  }
  const now = Date.now();
  const validKeys = (Array.isArray(keys) ? keys : [keys])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  for (const key of validKeys) {
    const prev = bridgeState.threadSubscriptions[key] || {};
    bridgeState.threadSubscriptions[key] = {
      cascadeId: targetCascadeId,
      ...(section || prev.section ? { section: section || prev.section } : {}),
      ...(chatId || prev.chatId ? { chatId: chatId || prev.chatId } : {}),
      updatedAt: now,
    };
  }
  const entries = Object.entries(bridgeState.threadSubscriptions);
  if (entries.length > MAX_THREAD_SUBSCRIPTIONS) {
    entries.sort((a, b) => Number(a[1]?.updatedAt || 0) - Number(b[1]?.updatedAt || 0));
    const trimmed = entries.slice(-MAX_THREAD_SUBSCRIPTIONS);
    bridgeState.threadSubscriptions = Object.fromEntries(trimmed);
  }
}

export function lookupThreadSubscription({ threadId = '', rootId = '', parentId = '' } = {}) {
  const subs = bridgeState.threadSubscriptions || {};
  for (const candidateKey of [threadId, rootId, parentId]) {
    const k = String(candidateKey || '').trim();
    if (k && subs[k]?.cascadeId) {
      return { ...subs[k], matchedKey: k };
    }
  }
  return null;
}

function inferContextFromText(text = '') {
  const str = String(text || '');
  const uuidMatch = str.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
  const sectionMatch = str.match(/\[板块:([^\]]+)\]/);
  return {
    cascadeId: uuidMatch ? uuidMatch[1] : '',
    section: sectionMatch ? sectionMatch[1].trim() : '',
  };
}

const recentOutboundFingerprints = new Map();

export function checkAndRecordOutboundDedup(scope, payloadText) {
  const now = Date.now();
  for (const [fp, ts] of recentOutboundFingerprints.entries()) {
    if (now - ts >= OUTBOUND_DEDUP_WINDOW_MS) {
      recentOutboundFingerprints.delete(fp);
    }
  }
  const normalized = `${String(scope || 'default').trim()}|${String(payloadText || '').trim()}`;
  const fingerprint = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
  const prevTs = recentOutboundFingerprints.get(fingerprint);
  if (prevTs !== undefined && now - prevTs < OUTBOUND_DEDUP_WINDOW_MS) {
    bridgeState.stats.dedupedOutboundCount = (bridgeState.stats.dedupedOutboundCount || 0) + 1;
    saveBridgeState();
    logBridge('INFO', '发件箱防刷屏守卫：拦截 15 秒内重复外发通知', {
      fingerprint,
      elapsedMs: now - prevTs,
    });
    return { deduped: true, fingerprint };
  }
  recentOutboundFingerprints.set(fingerprint, now);
  return { deduped: false, fingerprint };
}

function getActiveCommanderId() {
  return bridgeState.activeCommanderConversationId || COMMANDER_CONVERSATION_ID;
}
function saveBridgeState() {
  try {
    bridgeState.processedMessageIds = Array.from(new Set(bridgeState.processedMessageIds || [])).slice(
      -MAX_PROCESSED_MESSAGE_IDS
    );
    const subEntries = Object.entries(bridgeState.threadSubscriptions || {});
    if (subEntries.length > MAX_THREAD_SUBSCRIPTIONS) {
      subEntries.sort((a, b) => Number(a[1]?.updatedAt || 0) - Number(b[1]?.updatedAt || 0));
      bridgeState.threadSubscriptions = Object.fromEntries(subEntries.slice(-MAX_THREAD_SUBSCRIPTIONS));
    }
    fs.writeFileSync(STATE_PATH, JSON.stringify(bridgeState, null, 2) + '\n', 'utf8');
  } catch {}
}

const larkClient = new Lark.Client({
  appId: FEISHU_APP_ID,
  appSecret: FEISHU_APP_SECRET,
  appType: Lark.AppType.SelfBuild,
  domain: Lark.Domain.Feishu,
});

const runtimeStatus = {
  startedAt: new Date(BRIDGE_STARTED_AT_MS).toISOString(),
  appId: FEISHU_APP_ID,
  botName: null,
  botOpenId: null,
  commanderConversationId: COMMANDER_CONVERSATION_ID,
  wsStarted: false,
  lastTokenCheckOk: false,
  lastLsAddress: null,
  lastBackfillAt: null,
  lastError: null,
};

async function verifyFeishuBotIdentity() {
  try {
    const tokenRes = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
      }
    );
    const tokenData = await tokenRes.json();
    if (tokenData.code === 0 && tokenData.tenant_access_token) {
      runtimeStatus.lastTokenCheckOk = true;
      const botRes = await fetch('https://open.feishu.cn/open-apis/bot/v3/info', {
        headers: { Authorization: `Bearer ${tokenData.tenant_access_token}` },
      });
      const botData = await botRes.json();
      if (botData.code === 0 && botData.bot) {
        runtimeStatus.botName = botData.bot.app_name;
        runtimeStatus.botOpenId = botData.bot.open_id;
      }
      logBridge('INFO', '飞书机器人凭证核验通过', {
        botName: runtimeStatus.botName,
        botOpenId: runtimeStatus.botOpenId,
      });
      return tokenData.tenant_access_token;
    }
    runtimeStatus.lastError = tokenData.msg || 'Token check failed';
  } catch (err) {
    runtimeStatus.lastError = err.message;
    logBridge('WARN', '飞书凭证核验异常', { error: err.message });
  }
  return null;
}

export async function sendFeishuText({ chatId, openId, replyToMessageId, text, cascadeId = '', section = '' }) {
  const trimmedText = String(text || '').trim();
  const targetChatId = chatId || bridgeState.lastActiveChatId;
  const targetOpenId = openId || bridgeState.lastActiveOpenId;
  const dedupScope = replyToMessageId
    ? `reply:${replyToMessageId}`
    : `chat:${targetChatId || targetOpenId || 'default'}`;
  const dedup = checkAndRecordOutboundDedup(dedupScope, trimmedText);
  if (dedup.deduped) {
    return { ok: true, deduped: true, fingerprint: dedup.fingerprint };
  }

  const inferred = inferContextFromText(trimmedText);
  const existingSub = replyToMessageId
    ? lookupThreadSubscription({ rootId: replyToMessageId, parentId: replyToMessageId })
    : null;
  const boundCascadeId =
    cascadeId || inferred.cascadeId || existingSub?.cascadeId || getActiveCommanderId();
  const boundSection = section || inferred.section || existingSub?.section || '';

  const content = JSON.stringify({ text: trimmedText });
  if (replyToMessageId) {
    try {
      const res = await larkClient.im.message.reply({
        path: { message_id: replyToMessageId },
        data: { content, msg_type: 'text' },
      });
      const sentData = res?.data || res || {};
      if (sentData.message_id) markMessageProcessed(sentData.message_id);
      recordThreadSubscription(
        [sentData.message_id, sentData.root_id, sentData.parent_id, sentData.thread_id, replyToMessageId],
        { cascadeId: boundCascadeId, section: boundSection, chatId: targetChatId || '' }
      );
      bridgeState.stats.outboundRepliesCount++;
      saveBridgeState();
      return { ok: true, mode: 'reply', fingerprint: dedup.fingerprint, data: res };
    } catch (err) {
      logBridge('WARN', 'reply 消息失败，回退至 create 发送', { error: err.message });
    }
  }
  if (!targetChatId && !targetOpenId) {
    return { ok: false, error: '尚无活跃飞书会话 (chat_id / open_id)，请先从手机飞书给机器人发一条消息建立会话' };
  }
  const receiveIdType = targetChatId ? 'chat_id' : 'open_id';
  const receiveId = targetChatId || targetOpenId;
  const res = await larkClient.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      msg_type: 'text',
      content,
    },
  });
  const sentData = res?.data || res || {};
  if (sentData.message_id) markMessageProcessed(sentData.message_id);
  recordThreadSubscription(
    [sentData.message_id, sentData.root_id, sentData.parent_id, sentData.thread_id],
    { cascadeId: boundCascadeId, section: boundSection, chatId: targetChatId || '' }
  );
  bridgeState.stats.outboundRepliesCount++;
  saveBridgeState();
  return { ok: true, mode: receiveIdType, fingerprint: dedup.fingerprint, data: res };
}

export async function uploadAndSendMediaToFeishu({ chatId, openId, filePath }) {
  if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: `文件不存在: ${filePath}` };
  const targetChatId = chatId || bridgeState.lastActiveChatId;
  const targetOpenId = openId || bridgeState.lastActiveOpenId;
  if (!targetChatId && !targetOpenId) return { ok: false, error: '尚无活跃飞书会话' };
  const mediaDedup = checkAndRecordOutboundDedup(
    `media:${targetChatId || targetOpenId}`,
    path.resolve(filePath)
  );
  if (mediaDedup.deduped) {
    return { ok: true, deduped: true, fingerprint: mediaDedup.fingerprint };
  }
  const receiveIdType = targetChatId ? 'chat_id' : 'open_id';
  const receiveId = targetChatId || targetOpenId;
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
      const imgRes = await larkClient.im.image.create({
        data: {
          image_type: 'message',
          image: fs.createReadStream(filePath),
        },
      });
      const imageKey = imgRes?.image_key || imgRes?.data?.image_key;
      if (imageKey) {
        await larkClient.im.message.create({
          params: { receive_id_type: receiveIdType },
          data: {
            receive_id: receiveId,
            msg_type: 'image',
            content: JSON.stringify({ image_key: imageKey }),
          },
        });
        return { ok: true, mediaType: 'image', imageKey };
      }
    } else if (['.mp4', '.mov', '.m4v'].includes(ext)) {
      // EVO-042+: 使用飞书原生视频消息 (file_type: 'mp4' + msg_type: 'media' + 首帧高清封面 image_key)
      // 自动检测并在超规格 (>1080p / >30fps / >12MB) 时转码为 Level 4.1 +faststart 手机硬解秒开流，防止手机飞书一直转圈加载不出！
      let durationMs = 10000;
      const randSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const tmpCoverPath = path.join(MEDIA_DIR, `cover_${randSuffix}.jpg`);
      const tmpFastMp4Path = path.join(MEDIA_DIR, `fast_${randSuffix}.mp4`);
      let uploadVideoPath = filePath;
      let imageKey = '';
      const execEnv = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}` };
      try {
        const { execFileSync } = await import('node:child_process');
        const probeJsonRaw = execFileSync(
          'ffprobe',
          ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration,size', '-of', 'json', filePath],
          { encoding: 'utf8', timeout: 10000, env: execEnv }
        );
        const probeData = JSON.parse(probeJsonRaw || '{}');
        const durSec = Number(probeData?.format?.duration || 0);
        const fileSize = Number(probeData?.format?.size || fs.statSync(filePath).size || 0);
        const vStream = probeData?.streams?.[0] || {};
        const width = Number(vStream.width || 0);
        const height = Number(vStream.height || 0);
        const fpsParts = String(vStream.r_frame_rate || '30/1').split('/');
        const fps = fpsParts.length === 2 ? Number(fpsParts[0]) / Math.max(1, Number(fpsParts[1])) : Number(fpsParts[0] || 30);

        if (durSec > 0 && !Number.isNaN(durSec)) {
          durationMs = Math.max(1000, Math.round(durSec * 1000));
        }

        // 若视频分辨率超过 1080x1920、帧率 > 32fps 或体积 > 12MB，自动生成 H.264 Level 4.1 +faststart 飞书手机秒开版
        if (width > 1088 || height > 1928 || fps > 32 || fileSize > 12 * 1024 * 1024) {
          execFileSync(
            'ffmpeg',
            [
              '-y', '-v', 'error', '-i', filePath,
              '-vf', "scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:flags=lanczos,pad='ceil(iw/2)*2':'ceil(ih/2)*2'",
              '-r', '30',
              '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p',
              '-crf', '23', '-preset', 'fast',
              '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
              '-movflags', '+faststart',
              tmpFastMp4Path,
            ],
            { timeout: 60000, env: execEnv }
          );
          if (fs.existsSync(tmpFastMp4Path) && fs.statSync(tmpFastMp4Path).size > 1024) {
            uploadVideoPath = tmpFastMp4Path;
          }
        }

        execFileSync(
          'ffmpeg',
          ['-y', '-v', 'error', '-ss', '0.5', '-i', uploadVideoPath, '-frames:v', '1', '-q:v', '2', tmpCoverPath],
          { timeout: 10000, env: execEnv }
        );
        if (fs.existsSync(tmpCoverPath)) {
          const imgRes = await larkClient.im.image.create({
            data: {
              image_type: 'message',
              image: fs.createReadStream(tmpCoverPath),
            },
          });
          imageKey = imgRes?.image_key || imgRes?.data?.image_key || '';
          try { fs.unlinkSync(tmpCoverPath); } catch {}
        }
      } catch (probeErr) {
        logBridge('WARN', '提取视频时长或首帧封面警告', { filePath, error: probeErr.message });
      }

      const fileRes = await larkClient.im.file.create({
        data: {
          file_type: 'mp4',
          file_name: path.basename(filePath),
          duration: durationMs,
          file: fs.createReadStream(uploadVideoPath),
        },
      });
      if (uploadVideoPath !== filePath) {
        try { fs.unlinkSync(uploadVideoPath); } catch {}
      }
      const fileKey = fileRes?.file_key || fileRes?.data?.file_key;
      if (fileKey) {
        await larkClient.im.message.create({
          params: { receive_id_type: receiveIdType },
          data: {
            receive_id: receiveId,
            msg_type: 'media',
            content: JSON.stringify({ file_key: fileKey, image_key: imageKey }),
          },
        });
        return { ok: true, mediaType: 'media', fileKey, imageKey, durationMs };
      }
    } else {
      const fileType = ext === '.opus' ? 'opus' : ext === '.pdf' ? 'pdf' : 'stream';
      const fileRes = await larkClient.im.file.create({
        data: {
          file_type: fileType,
          file_name: path.basename(filePath),
          file: fs.createReadStream(filePath),
        },
      });
      const fileKey = fileRes?.file_key || fileRes?.data?.file_key;
      if (fileKey) {
        await larkClient.im.message.create({
          params: { receive_id_type: receiveIdType },
          data: {
            receive_id: receiveId,
            msg_type: 'file',
            content: JSON.stringify({ file_key: fileKey }),
          },
        });
        return { ok: true, mediaType: 'file', fileKey };
      }
    }
  } catch (err) {
    logBridge('WARN', '上传媒体至飞书失败', { filePath, error: err.message });
    return { ok: false, error: err.message };
  }
  return { ok: false, error: '未获取到媒体 key' };
}

async function parseFeishuMessageEvent(data) {
  const message = data?.message || {};
  const sender = data?.sender || {};
  const messageId = message.message_id || '';
  const chatId = message.chat_id || '';
  const chatType = message.chat_type || 'p2p';
  const msgType = message.message_type || message.msg_type || 'text';
  const senderType = sender?.sender_type || '';
  const senderOpenId = sender?.sender_id?.open_id || sender?.id || '';
  const rootId = message.root_id || '';
  const parentId = message.parent_id || '';
  const threadId = message.thread_id || '';
  const rawCreateTime = Number(message.create_time || 0);
  const createTimeMs =
    rawCreateTime > 0 && rawCreateTime < 1e11 ? rawCreateTime * 1000 : rawCreateTime;
  let rawContent = {};
  try {
    rawContent = JSON.parse(message.content || message?.body?.content || '{}');
  } catch {}

  let extractedText = '';
  let savedMediaPath = null;

  if (msgType === 'text') {
    extractedText = String(rawContent.text || '').replace(/@_user_\d+\s*/g, '').trim();
  } else if (msgType === 'post') {
    const blocks = rawContent?.content || [];
    const parts = [];
    for (const row of blocks) {
      if (Array.isArray(row)) {
        for (const el of row) {
          if (el?.text) parts.push(el.text);
        }
      }
    }
    extractedText = parts.join(' ').trim();
  } else if (msgType === 'audio') {
    const fileKey = rawContent.file_key;
    const durationMs = rawContent.duration || 0;
    if (fileKey && messageId) {
      try {
        const audioFile = path.join(MEDIA_DIR, `voice_${messageId}_${fileKey}.ogg`);
        const res = await larkClient.im.messageResource.get({
          path: { message_id: messageId, file_key: fileKey },
          params: { type: 'file' },
        });
        if (res && typeof res.writeFile === 'function') {
          await res.writeFile(audioFile);
          savedMediaPath = audioFile;
        } else if (res?.getReadableStream) {
          const stream = res.getReadableStream();
          await new Promise((resolve, reject) => {
            const ws = fs.createWriteStream(audioFile);
            stream.pipe(ws);
            ws.on('finish', resolve);
            ws.on('error', reject);
          });
          savedMediaPath = audioFile;
        }
        if (savedMediaPath && fs.existsSync(savedMediaPath)) {
          const asrRes = await transcribeAudioFile(savedMediaPath, { larkClient, logFn: logBridge });
          if (asrRes.ok && asrRes.text) {
            extractedText = `[🎙️ 飞书语音消息转写 (${asrRes.engine})]: ${asrRes.text}`;
          }
        }
      } catch (err) {
        logBridge('WARN', '下载飞书语音资源异常', { error: err.message });
      }
    }
    if (!extractedText) {
      extractedText = `[收到飞书语音消息，时长 ${(durationMs / 1000).toFixed(1)}s${savedMediaPath ? `，音频已落盘至 ${savedMediaPath}` : ''}]`;
    }
  } else if (msgType === 'image' || msgType === 'media' || msgType === 'file') {
    const fileKey = rawContent.image_key || rawContent.file_key;
    const ext = msgType === 'image' ? '.png' : path.extname(rawContent.file_name || '') || '.bin';
    if (fileKey && messageId) {
      try {
        const outPath = path.join(MEDIA_DIR, `feishu_${msgType}_${messageId}_${fileKey}${ext}`);
        const res = await larkClient.im.messageResource.get({
          path: { message_id: messageId, file_key: fileKey },
          params: { type: msgType === 'image' ? 'image' : 'file' },
        });
        if (res && typeof res.writeFile === 'function') {
          await res.writeFile(outPath);
          savedMediaPath = outPath;
        }
      } catch (err) {
        logBridge('WARN', '下载飞书媒体文件异常', { error: err.message });
      }
    }
    extractedText = `[收到飞书${msgType}消息${rawContent.file_name ? ` (${rawContent.file_name})` : ''}${savedMediaPath ? `，已保存至 ${savedMediaPath}` : ''}]`;
  } else {
    extractedText = `[收到飞书 ${msgType} 消息]: ${JSON.stringify(rawContent)}`;
  }

  return {
    messageId,
    chatId,
    chatType,
    msgType,
    senderType,
    senderOpenId,
    rootId,
    parentId,
    threadId,
    createTimeMs,
    extractedText,
    savedMediaPath,
  };
}

export async function forwardToCommander({
  extractedText,
  msgType = 'text',
  messageId = '',
  chatId = '',
  senderOpenId = '',
  savedMediaPath = null,
  rootId = '',
  parentId = '',
  threadId = '',
  sourceMode = 'ws_live',
}) {
  const lsConfig = await discoverLanguageServerConfig();
  if (!lsConfig) {
    throw new Error('未探测到本机 Antigravity LanguageServer 进程');
  }
  runtimeStatus.lastLsAddress = lsConfig.address;

  const isThreadedReply = Boolean(rootId || parentId || threadId);
  const subscribedThread = isThreadedReply
    ? lookupThreadSubscription({ threadId, rootId, parentId })
    : null;
  if (subscribedThread?.cascadeId) {
    bridgeState.stats.threadFollowupsCount = (bridgeState.stats.threadFollowupsCount || 0) + 1;
  }
  const threadFollowupHeader = subscribedThread?.cascadeId
    ? `[话题自动跟进: 关联会话 ${subscribedThread.cascadeId}]${subscribedThread.section ? ` (关联板块: ${subscribedThread.section})` : ''}`
    : null;

  const contentLines = [
    threadFollowupHeader,
    `📱 **【飞书手机端实时指令直达总控 (Feishu Mobile Bridge)】**`,
    `- **来源通道**：飞书机器人 \`${runtimeStatus.botName || FEISHU_APP_ID}\` | **消息类型**：\`${msgType}\` | **接收模式**：\`${sourceMode}\``,
    `- **飞书会话 ID**：\`${chatId || 'p2p'}\` | **发送人 OpenID**：\`${senderOpenId || 'user'}\` | **MessageID**：\`${messageId}\``,
    isThreadedReply
      ? `- **话题引用链**：\`thread_id=${threadId || '-'} | root_id=${rootId || '-'} | parent_id=${parentId || '-'}\`${subscribedThread?.cascadeId ? ` -> 绑定会话 \`${subscribedThread.cascadeId}\`` : ''}`
      : null,
    savedMediaPath ? `- **附件本地路径**：\`${savedMediaPath}\`` : null,
    `- **用户飞书原话指令**：`,
    `> ${extractedText}`,
    ``,
    `> 💡 **回推飞书提示**：总控回复后桥接器会自动将结论回推至用户手机飞书；如需主动推送消息或图片/视频，也可直接请求 \`POST http://127.0.0.1:${BRIDGE_PORT}/send-feishu\`。`,
  ]
    .filter(Boolean)
    .join('\n');

  let commanderStatus = 'UNKNOWN';
  let activeCommanderId = getActiveCommanderId();
  // EVO-038: 总控窗口水位自动热轮转 (若 transcript.jsonl > 85MB 或原窗口异常崩溃，自动无缝切换到全新总控接力窗口，永远防撑爆)
  try {
    const cmdTranscriptPath = path.join(BRAIN_DIR, activeCommanderId, '.system_generated/logs/transcript.jsonl');
    if (fs.existsSync(cmdTranscriptPath) && fs.statSync(cmdTranscriptPath).size > 85 * 1024 * 1024) {
      const rot = await rotateOrSwitchCommanderWindow({ createNew: true });
      if (rot?.activeCommanderConversationId) {
        activeCommanderId = rot.activeCommanderConversationId;
        await sendFeishuText({
          chatId,
          openId: senderOpenId,
          text: `🔄 【EVO-038 总控容量水位自动热切换】检测到原总控窗口日志已超 85MB 水位，已为您自动无缝切换至全新零卡顿总控接力窗口：${rot.title} (${activeCommanderId})`,
        }).catch(() => {});
      }
    }
  } catch {}
  runtimeStatus.commanderConversationId = activeCommanderId;

  const inferredCtx = inferContextFromText(extractedText);
  const boundCascadeForThread =
    subscribedThread?.cascadeId || inferredCtx.cascadeId || activeCommanderId;
  const boundSectionForThread =
    subscribedThread?.section || inferredCtx.section || '';
  recordThreadSubscription([threadId, rootId, parentId, messageId], {
    cascadeId: boundCascadeForThread,
    section: boundSectionForThread,
    chatId,
  });

  try {
    const trajRes = await callLanguageServerRpc(lsConfig, 'GetAllCascadeTrajectories', {});
    commanderStatus = trajRes?.trajectorySummaries?.[activeCommanderId]?.status || 'UNKNOWN';
  } catch {}

  let rpcRes = null;
  let wakeMethod = 'SendAgentMessage';
  const titlePrefix = subscribedThread?.cascadeId
    ? `[话题自动跟进: 关联会话 ${subscribedThread.cascadeId}] `
    : '';
  try {
    rpcRes = await callLanguageServerRpc(lsConfig, 'SendAgentMessage', {
      recipient: activeCommanderId,
      senderId: '00000000-0000-4000-8000-000000001891',
      displayTitle: `📱 ${titlePrefix}飞书指令: ${extractedText.slice(0, 36)}`,
      content: contentLines,
    });
  } catch (err) {
    logBridge('WARN', 'SendAgentMessage 调用异常，准备尝试 SendUserCascadeMessage 唤醒', { error: err.message });
  }

  // Bug 3 Fix: 当总控窗口处于 CASCADE_RUN_STATUS_IDLE 时，检查唤醒状态并在仍处于 IDLE 或 SendAgentMessage 失败时追加 SendUserCascadeMessage 确保 100% 唤醒
  if (commanderStatus === 'CASCADE_RUN_STATUS_IDLE' || !rpcRes) {
    let stillIdle = !rpcRes;
    if (rpcRes) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        const checkRes = await callLanguageServerRpc(lsConfig, 'GetAllCascadeTrajectories', {});
        const afterStatus = checkRes?.trajectorySummaries?.[activeCommanderId]?.status || 'UNKNOWN';
        stillIdle = afterStatus === 'CASCADE_RUN_STATUS_IDLE';
      } catch {}
    }
    if (stillIdle) {
      try {
        const cascadeRes = await callLanguageServerRpc(lsConfig, 'SendUserCascadeMessage', {
          cascadeId: activeCommanderId,
          items: [{ text: contentLines }],
          cascadeConfig: {
            plannerConfig: {
              requestedModel: { model: 'MODEL_PLACEHOLDER_M417' },
            },
          },
        });
        rpcRes = cascadeRes || rpcRes;
        wakeMethod = 'SendUserCascadeMessage';
      } catch (err) {
        logBridge('WARN', 'SendUserCascadeMessage 兜底唤醒异常，触发 EVO-038 自动轮转新总控窗口', { error: err.message });
        try {
          const rot = await rotateOrSwitchCommanderWindow({ createNew: true });
          if (rot?.activeCommanderConversationId) {
            activeCommanderId = rot.activeCommanderConversationId;
            rpcRes = await callLanguageServerRpc(lsConfig, 'SendUserCascadeMessage', {
              cascadeId: activeCommanderId,
              items: [{ text: contentLines }],
              cascadeConfig: { plannerConfig: { requestedModel: { model: 'MODEL_PLACEHOLDER_M417' } } },
            });
            wakeMethod = 'AutoRotatedNewCommander';
          }
        } catch {}
      }
    }
  }

  bridgeState.stats.forwardedToCommanderCount++;
  saveBridgeState();
  return {
    ok: true,
    lsAddress: lsConfig.address,
    commanderId: activeCommanderId,
    subscribedCascadeId: subscribedThread?.cascadeId || null,
    commanderStatus,
    wakeMethod,
    rpcRes,
  };
}

export async function rotateOrSwitchCommanderWindow({ targetCommanderId = '', createNew = false, title = '' } = {}) {
  const lsConfig = await discoverLanguageServerConfig();
  if (!lsConfig) throw new Error('未探测到本机 Antigravity LanguageServer 进程');
  let nextId = String(targetCommanderId || '').trim();
  const windowTitle = title || '👑 [总控·V2] 全栈项目总控台 (零卡顿新窗口)';
  if (createNew || !nextId) {
    const startRes = await callLanguageServerRpc(lsConfig, 'StartCascade', {
      source: 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT',
      projectEnvConfig: {
        projectId: 'e95fa3f0-4e99-42b3-9e4a-6e07bd40b7c6',
        defaultProjectEnvironment: {},
      },
    });
    nextId = startRes?.cascadeId || '';
    if (!nextId) throw new Error('StartCascade 未返回 cascadeId');
    try {
      await callLanguageServerRpc(lsConfig, 'UpdateConversationAnnotations', {
        cascadeId: nextId,
        annotations: { title: windowTitle },
        mergeAnnotations: true,
      });
    } catch {}
    const handoverText = [
      `👑 **【SoloLab 总控会话工作台世代轮转接力初始化 (${windowTitle})】**`,
      `- **新总控会话 ID**：\`${nextId}\`（前代总控会话：\`${getActiveCommanderId()}\`）`,
      `- **接力说明**：为彻底消除前代 21,300+ 步大窗口引起的桌面端 \`Lost connection to the language server\` 渲染假死，系统已将飞书长连接（\`:18910\`）与 5 大领域工作会话无缝切换至本轻快总控窗口。`,
      `- **5 大具名领域工作会话 ID**：`,
      `  1. \`🧩 [板块:音频母带与带货涨粉成片] 工作节点\` (\`9f73dc87-9b43-4bff-a3b6-0851e778dc06\`)`,
      `  2. \`🧩 [板块:SoloLab前端工作台UI] 工作节点\` (\`4da7b832-5f16-4d05-a811-1c662b6f9a67\`)`,
      `  3. \`🧩 [板块:手机设备盒子Matrix] 工作节点\` (\`11a2aff6-260b-4737-837b-c623511e931c\`)`,
      `  4. \`🧩 [板块:OneHub模型网关与额度] 工作节点\` (\`7438c3d3-ba2e-4cf3-9a1a-2c0635dded60\`)`,
      `  5. \`🧩 [板块:飞书桥接与全系统权限免弹窗] 工作节点\` (\`42a260a1-395f-43fc-b17b-0fbd560785e2\`)`,
      `请先调用 \`memory_recall_for_task(read_only: true)\` 确认就绪，随时接收用户在电脑端或手机飞书的指令！`,
    ].join('\n');
    try {
      await callLanguageServerRpc(lsConfig, 'SendUserCascadeMessage', {
        cascadeId: nextId,
        items: [{ text: handoverText }],
        cascadeConfig: {
          plannerConfig: {
            requestedModel: { model: 'MODEL_PLACEHOLDER_M417' },
          },
        },
      });
    } catch {}
  }
  bridgeState.activeCommanderConversationId = nextId;
  bridgeState.lastPushedCommanderStepIdx = -1;
  cachedTranscriptMtimeMs = 0;
  cachedTranscriptSize = 0;
  cachedLatestPlannerStep = null;
  runtimeStatus.commanderConversationId = nextId;
  saveBridgeState();
  return { ok: true, activeCommanderConversationId: nextId, title: windowTitle };
}

const TRANSCRIPT_TAIL_BYTES = 128 * 1024;
let cachedTranscriptMtimeMs = 0;
let cachedTranscriptSize = 0;
let cachedLatestPlannerStep = null;

function getCommanderLatestCompletedPlannerStep() {
  const tPath = path.join(BRAIN_DIR, getActiveCommanderId(), '.system_generated/logs/transcript.jsonl');
  if (!fs.existsSync(tPath)) return null;
  let fd = null;
  try {
    const st = fs.statSync(tPath);
    if (st.size === cachedTranscriptSize && st.mtimeMs === cachedTranscriptMtimeMs && cachedLatestPlannerStep) {
      return cachedLatestPlannerStep;
    }
    const readLen = Math.min(st.size, TRANSCRIPT_TAIL_BYTES);
    if (readLen <= 0) return null;
    const offset = Math.max(0, st.size - readLen);
    const buf = Buffer.allocUnsafe(readLen);
    fd = fs.openSync(tPath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, readLen, offset);
    const chunkStr = buf.subarray(0, bytesRead).toString('utf8');
    const rawLines = chunkStr.split('\n');
    const validLines = (offset > 0 ? rawLines.slice(1) : rawLines).filter(Boolean);
    for (let i = validLines.length - 1; i >= 0; i--) {
      try {
        const step = JSON.parse(validLines[i]);
        if (
          step.type === 'PLANNER_RESPONSE' &&
          step.status === 'DONE' &&
          typeof step.content === 'string' &&
          step.content.trim().length > 0 &&
          (!Array.isArray(step.tool_calls) || step.tool_calls.length === 0)
        ) {
          cachedTranscriptSize = st.size;
          cachedTranscriptMtimeMs = st.mtimeMs;
          cachedLatestPlannerStep = {
            stepIndex: step.step_index ?? i,
            content: step.content.trim(),
            createdAt: step.created_at,
          };
          return cachedLatestPlannerStep;
        }
      } catch {}
    }
  } catch {} finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
  return cachedLatestPlannerStep;
}

// Initialize commander step watermark on startup so we only push new replies after a Feishu message
const initStep = getCommanderLatestCompletedPlannerStep();
if (initStep && bridgeState.lastPushedCommanderStepIdx < 0) {
  bridgeState.lastPushedCommanderStepIdx = initStep.stepIndex;
  saveBridgeState();
}

async function pollCommanderApprovedReplies() {
  if (!bridgeState.lastActiveChatId && !bridgeState.lastActiveOpenId) return;

  // Bug 1 Fix (EVO-028): 严禁将未经总控复核的工作节点原始回执 (commanderReports) 直接推送给用户手机飞书！
  // 仅当总控完成法医级审查并在总控对话中输出正式最终回复时，才回推给用户手机飞书。
  if (bridgeState.lastInboundAtMs > 0 && Date.now() - bridgeState.lastInboundAtMs < 30 * 60 * 1000) {
    if (bridgeState.lastManualSendAtMs && bridgeState.lastManualSendAtMs >= bridgeState.lastInboundAtMs) {
      // 总控已在本轮通过 POST /send-feishu 显式回复过，清零待回复水位，严禁重复推送第 2 遍
      bridgeState.lastInboundAtMs = 0;
      const curStep = getCommanderLatestCompletedPlannerStep();
      if (curStep) bridgeState.lastPushedCommanderStepIdx = curStep.stepIndex;
      saveBridgeState();
      return;
    }
    const latestStep = getCommanderLatestCompletedPlannerStep();
    if (latestStep && latestStep.stepIndex > bridgeState.lastPushedCommanderStepIdx) {
      bridgeState.lastPushedCommanderStepIdx = latestStep.stepIndex;
      // 单次来信仅自动回推 1 次，回推后立即归零 lastInboundAtMs 防止后续回合重复刷屏
      const shouldAlsoPushVoiceBubble = Boolean(bridgeState.lastInboundWasVoice || voiceCallRuntime.autoVoiceReplyEnabled);
      bridgeState.lastInboundAtMs = 0;
      bridgeState.lastInboundWasVoice = false;
      bridgeState.stats.commanderApprovedPushesCount =
        (bridgeState.stats.commanderApprovedPushesCount || 0) + 1;
      saveBridgeState();
      const replyText = `👑 【SoloLab 总控回复】\n${latestStep.content.slice(0, 3500)}`;
      await sendFeishuText({ text: replyText }).catch((e) =>
        logBridge('WARN', '推送总控回复至飞书失败', { error: e.message })
      );
      if (shouldAlsoPushVoiceBubble) {
        await sendFeishuNativeVoiceBubble({
          larkClient,
          chatId: bridgeState.lastActiveChatId,
          openId: bridgeState.lastActiveOpenId,
          text: latestStep.content,
        }).catch((e) => logBridge('WARN', '推送总控语音气泡失败', { error: e.message }));
      }

      // Extract any local screenshot/video paths mentioned in the Commander's approved reply and push them
      const pathMatches =
        latestStep.content.match(/\/Users\/[^/]+\/[^\s`'")\]]+\.(?:png|jpg|jpeg|mp4)/gi) || [];
      for (const mediaPath of [...new Set(pathMatches)].slice(0, 3)) {
        if (fs.existsSync(mediaPath)) {
          await uploadAndSendMediaToFeishu({ filePath: mediaPath }).catch(() => {});
        }
      }
    }
  }
}

const BACKFILL_MAX_AGE_MS = 5 * 60 * 1000;
let hasSeededInitialHistory = false;

export async function handleInboundFeishuMessageEvent(data, { sourceMode = 'ws_live' } = {}) {
  const senderType = data?.sender?.sender_type || '';
  if (senderType === 'app' || senderType === 'bot') {
    return { ok: true, skipped: 'bot_sender' };
  }
  const parsed = await parseFeishuMessageEvent(data);
  if (!parsed.messageId) return { ok: false, skipped: 'missing_message_id' };
  if (
    parsed.senderType === 'app' ||
    parsed.senderType === 'bot' ||
    (runtimeStatus.botOpenId && parsed.senderOpenId === runtimeStatus.botOpenId) ||
    parsed.senderOpenId === FEISHU_APP_ID
  ) {
    return { ok: true, skipped: 'bot_sender' };
  }
  if (parsed.createTimeMs > 0 && parsed.createTimeMs < BRIDGE_STARTED_AT_MS) {
    markMessageProcessed(parsed.messageId);
    saveBridgeState();
    return { ok: true, skipped: 'before_bridge_start', messageId: parsed.messageId };
  }
  if (
    sourceMode === 'history_backfill' &&
    (!parsed.createTimeMs ||
      parsed.createTimeMs < BRIDGE_STARTED_AT_MS ||
      Date.now() - parsed.createTimeMs > BACKFILL_MAX_AGE_MS)
  ) {
    markMessageProcessed(parsed.messageId);
    saveBridgeState();
    return { ok: true, skipped: 'stale_backfill_message', messageId: parsed.messageId };
  }
  if (hasProcessedMessage(parsed.messageId)) {
    if (sourceMode === 'ws_live') {
      logBridge('INFO', '忽略重复飞书消息', { messageId: parsed.messageId });
    }
    return { ok: true, skipped: 'already_processed', messageId: parsed.messageId };
  }

  markMessageProcessed(parsed.messageId);
  if (parsed.chatId) bridgeState.lastActiveChatId = parsed.chatId;
  if (parsed.senderOpenId) bridgeState.lastActiveOpenId = parsed.senderOpenId;
  bridgeState.lastMessageId = parsed.messageId;
  bridgeState.lastInboundAtMs = Date.now();
  bridgeState.lastInboundWasVoice = parsed.msgType === 'audio';
  bridgeState.stats.inboundMessagesCount++;
  if (sourceMode === 'history_backfill') {
    bridgeState.stats.backfilledMessagesCount = (bridgeState.stats.backfilledMessagesCount || 0) + 1;
  }

  const curStep = getCommanderLatestCompletedPlannerStep();
  if (curStep) bridgeState.lastPushedCommanderStepIdx = curStep.stepIndex;
  saveBridgeState();

  logBridge('INFO', sourceMode === 'history_backfill' ? '游标补漏拉取到遗漏飞书消息' : '收到手机飞书消息', {
    sourceMode,
    messageId: parsed.messageId,
    msgType: parsed.msgType,
    chatId: parsed.chatId,
    rootId: parsed.rootId || undefined,
    parentId: parsed.parentId || undefined,
    threadId: parsed.threadId || undefined,
    text: parsed.extractedText.slice(0, 120),
  });

  // 支持在飞书直接发送 "/new" 或 "切换新总控窗口" 一键轮转孵化零卡顿新总控窗口
  if (/^(\/new|切换新总控窗口|切换新窗口|新建总控窗口)$/i.test(parsed.extractedText.trim())) {
    const rot = await rotateOrSwitchCommanderWindow({ createNew: true });
    await sendFeishuText({
      chatId: parsed.chatId,
      openId: parsed.senderOpenId,
      replyToMessageId: parsed.messageId,
      cascadeId: rot.activeCommanderConversationId,
      text: `✅ 已为您孵化并切换至全新零卡顿总控窗口：\n${rot.title}\n会话 ID：${rot.activeCommanderConversationId}\n您在电脑端打开该窗口打字将丝滑秒响应，飞书也已同步绑定！`,
    });
    return { ok: true, rotated: true, activeCommanderConversationId: rot.activeCommanderConversationId };
  }

  // 支持在飞书发送 "/call"、"打电话"、"语音通话" 一键弹出实时语音通话舱卡片 + 语音问候
  if (/^(\/call|打电话|语音通话|语音电话|开启语音通话|跟你打电话)$/i.test(parsed.extractedText.trim())) {
    const cardRes = await sendFeishuVoiceCallCard({
      larkClient,
      chatId: parsed.chatId,
      openId: parsed.senderOpenId,
    });
    await sendFeishuNativeVoiceBubble({
      larkClient,
      chatId: parsed.chatId,
      openId: parsed.senderOpenId,
      text: '您好，SoloLab 总控台实时语音舱卡片已经发到您手机上了，点击绿色按钮就能跟我实时免提通话，或者直接在聊天窗发语音条也可以！',
    }).catch(() => {});
    return { ok: true, voiceCallCardSent: true, cardRes };
  }

  // 1. Reply immediately to user's Feishu (if user sent an audio message, also reply with a native voice bubble!)
  await sendFeishuText({
    chatId: parsed.chatId,
    openId: parsed.senderOpenId,
    replyToMessageId: parsed.messageId,
    text:
      parsed.msgType === 'audio'
        ? `🎙️ ${parsed.extractedText}\n✅ 已听懂并送达 SoloLab 总控台，正在调度各业务对话窗口执行并为您准备语音汇报...`
        : '✅ 已送达 SoloLab 总控台，正在调度各业务对话窗口执行...',
  });
  if (parsed.msgType === 'audio') {
    generateInstantVoiceCallReply(parsed.extractedText, { commanderStatus: 'ACTIVE' })
      .then((spokenAck) =>
        sendFeishuNativeVoiceBubble({
          larkClient,
          chatId: parsed.chatId,
          openId: parsed.senderOpenId,
          text: spokenAck,
        })
      )
      .catch(() => {});
  }

  // 2. Forward to Commander conversation via LanguageServer RPC
  const fwdRes = await forwardToCommander({ ...parsed, sourceMode });
  logBridge('INFO', '已转发飞书消息至总控对话', {
    sourceMode,
    commanderId: getActiveCommanderId(),
    subscribedCascadeId: fwdRes.subscribedCascadeId || undefined,
    lsAddress: fwdRes.lsAddress,
  });
  return { ok: true, forwarded: true, fwdRes };
}

let isBackfillingHistory = false;

export async function backfillChatHistoryLoop() {
  if (isBackfillingHistory) return { ok: true, skipped: 'already_running' };
  const chatId = bridgeState.lastActiveChatId;
  if (!chatId) return { ok: true, skipped: 'no_active_chat' };

  isBackfillingHistory = true;
  const nowMs = Date.now();
  const untilSec = Math.floor(nowMs / 1000);

  try {
    if (!hasSeededInitialHistory) {
      let seededCount = 0;
      const seedRes = await larkClient.im.message.list({
        params: { container_id_type: 'chat', container_id: chatId, sort_type: 'ByCreateTimeDesc', page_size: 50 },
      });
      const seedData = seedRes?.data || seedRes || {};
      for (const item of Array.isArray(seedData.items) ? seedData.items : []) {
        if (item?.message_id) { markMessageProcessed(item.message_id); seededCount++; }
      }
      hasSeededInitialHistory = true;
      bridgeState.lastBackfillSec = Math.floor(Date.now() / 1000);
      runtimeStatus.lastBackfillAt = new Date(bridgeState.lastBackfillSec * 1000).toISOString();
      saveBridgeState();
      logBridge('INFO', '首次启动历史消息静默已读锚定完成', { chatId, seededCount, lastBackfillSec: bridgeState.lastBackfillSec });
      return { ok: true, seededInitialHistory: true, chatId, seededCount, lastBackfillSec: bridgeState.lastBackfillSec };
    }

    const minAllowedSec = Math.max(BRIDGE_STARTED_AT_SEC, Math.floor((nowMs - BACKFILL_MAX_AGE_MS) / 1000));
    const sinceSec = Math.max(Number(bridgeState.lastBackfillSec || minAllowedSec), minAllowedSec);
    const startSec = Math.max(minAllowedSec, sinceSec - 5);

    let recoveredCount = 0;
    let scannedCount = 0;
    let pageToken = undefined;
    const seenTokens = new Set();
    do {
      const res = await larkClient.im.message.list({
        params: {
          container_id_type: 'chat', container_id: chatId,
          start_time: String(startSec), end_time: String(untilSec),
          sort_type: 'ByCreateTimeAsc', page_size: 50,
          ...(pageToken ? { page_token: pageToken } : {}),
        },
      });
      const pageData = res?.data || res || {};
      for (const item of Array.isArray(pageData.items) ? pageData.items : []) {
        scannedCount++;
        const msgId = item?.message_id || '';
        if (!msgId || item?.deleted || (item.chat_id && item.chat_id !== chatId)) continue;
        const senderType = item?.sender?.sender_type || '';
        const senderId = item?.sender?.id || '';
        if (senderType === 'app' || senderType === 'bot' || (runtimeStatus.botOpenId && senderId === runtimeStatus.botOpenId) || senderId === FEISHU_APP_ID) {
          markMessageProcessed(msgId); continue;
        }
        const rawCreate = Number(item?.create_time || 0);
        const msgCreateMs = rawCreate > 0 && rawCreate < 1e11 ? rawCreate * 1000 : rawCreate;
        if (!msgCreateMs || msgCreateMs < BRIDGE_STARTED_AT_MS || Date.now() - msgCreateMs > BACKFILL_MAX_AGE_MS) {
          markMessageProcessed(msgId); continue;
        }
        if (hasProcessedMessage(msgId)) continue;
        const adaptedEvent = {
          message: {
            message_id: msgId, chat_id: item.chat_id || chatId, chat_type: item.chat_type || 'p2p',
            message_type: item.msg_type || item.message_type || 'text',
            content: item?.body?.content || item?.content || '{}',
            root_id: item.root_id || '', parent_id: item.parent_id || '', thread_id: item.thread_id || '',
            create_time: String(msgCreateMs),
          },
          sender: { sender_type: senderType || 'user', sender_id: { open_id: senderId || bridgeState.lastActiveOpenId || '' } },
        };
        const r = await handleInboundFeishuMessageEvent(adaptedEvent, { sourceMode: 'history_backfill' });
        if (r?.forwarded || r?.rotated || r?.voiceCallCardSent) recoveredCount++;
      }
      const hasMore = Boolean(pageData.has_more);
      const nextToken = pageData.page_token;
      if (hasMore && (!nextToken || seenTokens.has(nextToken))) break;
      pageToken = hasMore ? nextToken : undefined;
      if (pageToken) seenTokens.add(pageToken);
    } while (pageToken);

    bridgeState.lastBackfillSec = Math.floor(Date.now() / 1000);
    runtimeStatus.lastBackfillAt = new Date(bridgeState.lastBackfillSec * 1000).toISOString();
    saveBridgeState();
    return { ok: true, chatId, startSec, untilSec, scannedCount, recoveredCount };
  } catch (err) {
    logBridge('WARN', '60秒历史消息游标补漏扫描异常', { chatId, error: err.message });
    return { ok: false, error: err.message };
  } finally {
    isBackfillingHistory = false;
  }
}

const eventDispatcher = new Lark.EventDispatcher({}).register({
  'im.message.receive_v1': async (data) => {
    try {
      await handleInboundFeishuMessageEvent(data, { sourceMode: 'ws_live' });
    } catch (err) {
      logBridge('ERROR', '处理飞书消息事件异常', { error: err.message });
    }
  },
});

export function startBridgeServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${BRIDGE_PORT}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const handledByVoice = await handleVoiceCallHttpRoutes(req, res, url, {
      larkClient,
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
      bridgeState,
      runtimeStatus,
      getCommanderLatestCompletedPlannerStep,
      forwardToCommander,
      sendFeishuText,
      saveBridgeState,
      logBridge,
    });
    if (handledByVoice) return;

    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/status')) {
      const ls = await discoverLanguageServerConfig().catch(() => null);
      const wdStatus = await getSwarmWatchdogStatus({ refreshIfOlderThanMs: 15000 }).catch(() => null);
      res.writeHead(200);
      res.end(
        JSON.stringify(
          {
            ok: true,
            version: BRIDGE_VERSION,
            runtimeStatus: {
              ...runtimeStatus,
              lsConnected: Boolean(ls),
              lastLsAddress: ls?.address || runtimeStatus.lastLsAddress,
            },
            voiceCallSuite: voiceCallRuntime,
            bridgeState: {
              lastActiveChatId: bridgeState.lastActiveChatId,
              lastActiveOpenId: bridgeState.lastActiveOpenId,
              lastMessageId: bridgeState.lastMessageId,
              lastBackfillSec: bridgeState.lastBackfillSec,
              processedMessageIdsCount: (bridgeState.processedMessageIds || []).length,
              threadSubscriptionsCount: Object.keys(bridgeState.threadSubscriptions || {}).length,
              stats: bridgeState.stats,
            },
            swarmWatchdogSummary: wdStatus
              ? {
                  evoRule: wdStatus.evoRule,
                  scanIntervalSeconds: SWARM_WATCHDOG_CONFIG.scanIntervalSeconds,
                  lastScanAt: wdStatus.lastScanAt,
                  monitoredSpecialistsCount: wdStatus.monitoredSpecialistsCount,
                  pendingSpecialistsCount: wdStatus.pendingSpecialistsCount,
                  runningBgTasksCount: wdStatus.runningBgTasksCount,
                  totalWakeupsSent: wdStatus.totalWakeupsSent,
                }
              : null,
          },
          null,
          2
        )
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/swarm-watchdog-status') {
      try {
        const convId = url.searchParams.get('convId') || '';
        const statusData = await getSwarmWatchdogStatus({ refreshIfOlderThanMs: 1500, logFn: logBridge });
        if (convId) statusData.singleTranscriptInspection = inspectSpecialistTranscriptTail(convId);
        res.writeHead(200);
        res.end(JSON.stringify(statusData, null, 2));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/swarm-watchdog-tick') {
      try {
        const tickRes = await runSwarmWatchdogTick({ dryRun: false, logFn: logBridge });
        res.writeHead(200);
        res.end(JSON.stringify(tickRes, null, 2));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/switch-commander') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const rot = await rotateOrSwitchCommanderWindow({
            targetCommanderId: payload.commanderConversationId || payload.cascadeId || '',
            createNew: Boolean(payload.createNew),
            title: payload.title || '',
          });
          res.writeHead(200);
          res.end(JSON.stringify(rot));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/send-feishu') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const out = {};
          if (payload.text) {
            bridgeState.lastManualSendAtMs = Date.now();
            bridgeState.lastInboundAtMs = 0;
            const curStep = getCommanderLatestCompletedPlannerStep();
            if (curStep) bridgeState.lastPushedCommanderStepIdx = curStep.stepIndex;
            saveBridgeState();
            out.textResult = await sendFeishuText({
              chatId: payload.chatId,
              openId: payload.openId,
              replyToMessageId: payload.replyToMessageId,
              cascadeId: payload.cascadeId || payload.commanderConversationId || '',
              section: payload.section || '',
              text: payload.text,
            });
          }
          if (payload.alsoSendVoice && payload.text) {
            out.voiceResult = await sendFeishuNativeVoiceBubble({
              larkClient,
              chatId: payload.chatId || bridgeState.lastActiveChatId,
              openId: payload.openId || bridgeState.lastActiveOpenId,
              text: payload.text,
            }).catch((e) => ({ ok: false, error: e.message }));
          }
          const singleFile = payload.filePath || payload.imagePath || payload.videoPath;
          const fileList = Array.isArray(payload.files) ? payload.files : singleFile ? [singleFile] : [];
          if (fileList.length > 0) {
            out.mediaResults = [];
            for (const fp of fileList) {
              if (!fp) continue;
              const mr = await uploadAndSendMediaToFeishu({
                chatId: payload.chatId,
                openId: payload.openId,
                filePath: fp,
              });
              out.mediaResults.push(mr);
            }
            out.mediaResult = out.mediaResults[0] || null;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, ...out }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
  });

  server.listen(BRIDGE_PORT, '0.0.0.0', () => {
    logBridge('INFO', `飞书总控桥接与实时语音通话服务已启动: http://127.0.0.1:${BRIDGE_PORT}/voice-call`);
  });
  return server;
}

export async function startFeishuCommanderBridge() {
  try {
    runAllPermissionAutoGrants();
    await applyPlaywrightContextPermissions(null);
  } catch {}
  await verifyFeishuBotIdentity();
  const ls = await discoverLanguageServerConfig();
  runtimeStatus.lastLsAddress = ls?.address || null;

  startBridgeServer();
  ensureVoiceCallHttpsTunnel({ port: BRIDGE_PORT, logFn: logBridge }).catch(() => {});

  const wsClient = new Lark.WSClient({
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    domain: Lark.Domain.Feishu,
    loggerLevel: Lark.LoggerLevel.info,
  });

  wsClient.start({ eventDispatcher });
  runtimeStatus.wsStarted = true;
  logBridge('INFO', 'Lark.WSClient 长连接已启动，正在监听 im.message.receive_v1 事件', {
    appId: FEISHU_APP_ID,
    commanderConversationId: COMMANDER_CONVERSATION_ID,
  });

  setInterval(() => pollCommanderApprovedReplies().catch(() => {}), 3500);
  backfillChatHistoryLoop().catch(() => {});
  setInterval(() => backfillChatHistoryLoop().catch(() => {}), BACKFILL_INTERVAL_MS);
  runSwarmWatchdogTick({ dryRun: true, logFn: logBridge }).catch(() => {});
  setInterval(() => runSwarmWatchdogTick({ dryRun: false, logFn: logBridge }).catch(() => {}), SWARM_WATCHDOG_CONFIG.scanIntervalSeconds * 1000);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startFeishuCommanderBridge().catch((err) => {
    logBridge('ERROR', '桥接器启动异常', { error: err.message });
    process.exit(1);
  });
}
