#!/usr/bin/env node
/**
 * feishu-voice-webapp.mjs
 * -----------------------
 * 飞书内置实时全双工语音通话舱 WebApp (`/voice-call`) 与双向语音流 API 路由处理器
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  voiceCallRuntime,
  transcribeAudioFile,
  synthesizeVoiceToOpus,
  sendFeishuNativeVoiceBubble,
  generateInstantVoiceCallReply,
} from './feishu-voice-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEDIA_DIR = path.join(__dirname, 'media');
const CABIN_HTML_PATH = path.join(__dirname, 'public/voice-call-cabin.html');

let lastVoicePolledCommanderStepIdx = -1;

export async function triggerFeishuUrgentPhoneCall({
  appId,
  appSecret,
  larkClient,
  chatId,
  openId,
  messageId = '',
  urgentText = '',
}) {
  if (!openId) throw new Error('发起飞书电话加急需要目标用户的 openId');
  let targetMsgId = messageId;
  if (!targetMsgId) {
    const receiveId = chatId || openId;
    const receiveIdType = chatId ? 'chat_id' : 'open_id';
    const msgRes = await larkClient.im.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({
          text: urgentText || '📲 【SoloLab 总控台紧急电话呼叫】请接听或打开飞书查看最新重要进展！',
        }),
      },
    });
    targetMsgId = msgRes?.data?.message_id || msgRes?.message_id || '';
  }
  if (!targetMsgId) throw new Error('未能创建加急关联消息 message_id');

  const tokenResp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    signal: AbortSignal.timeout(8000),
  });
  const tokenData = await tokenResp.json();
  const urgentResp = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(targetMsgId)}/urgent_phone?user_id_type=open_id`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenData.tenant_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id_list: [openId] }),
      signal: AbortSignal.timeout(10000),
    }
  );
  const urgentData = await urgentResp.json();
  voiceCallRuntime.totalUrgentPhoneCalls++;

  if (urgentData.code === 0) {
    return { ok: true, messageId: targetMsgId, openId, invalidUserList: urgentData?.data?.invalid_user_id_list || [] };
  }
  return {
    ok: false,
    code: urgentData.code,
    msg: urgentData.msg,
    messageId: targetMsgId,
    scopeGrantUrl: `https://open.feishu.cn/app/${appId}/auth?q=im:message.urgent,im:message.urgent:phone`,
    hint: '已在飞书发出紧急呼叫提醒；如需开启运营商手机振铃，请在飞书开放平台勾选 im:message.urgent:phone 权限。',
  };
}

export async function sendFeishuVoiceCallCard({
  larkClient,
  chatId,
  openId,
  title = '📞 SoloLab 总控台 · 实时语音舱一键拨号台',
}) {
  const receiveId = chatId || openId;
  const receiveIdType = chatId ? 'chat_id' : 'open_id';
  if (!receiveId) throw new Error('缺少飞书接收方 chatId 或 openId');

  const primaryCallUrl = voiceCallRuntime.publicTunnelUrl
    ? `${voiceCallRuntime.publicTunnelUrl}/voice-call`
    : voiceCallRuntime.lanUrl || voiceCallRuntime.localUrl;

  const cardPayload = {
    config: { wide_screen_mode: true, enable_forward: true },
    header: { template: 'turquoise', title: { tag: 'plain_text', content: title } },
    elements: [
      {
        tag: 'markdown',
        content: [
          '🎙️ **像打微信/飞书电话一样，随时边走边说指挥 SoloLab 总控台与各业务对话窗口！**',
          '',
          '✅ **方式 1 · 全双工实时语音电话舱（强烈推荐）**：点击下方绿色按钮，手机直连 SoloLab 总控台 · 实时语音舱，支持 **免提连续说话、自动断句识别、真人语音秒回、随时插话打断**，说的每句话自动联动 SoloLab 总控台派单！',
          '✅ **方式 2 · 飞书聊天窗直接发语音条**：直接在本聊天窗按住麦克风发语音，SoloLab 语音助手不仅 100% 听懂执行，还会**自动用真人语音条（气泡）+ 文字双通道回复您**！',
          '✅ **方式 3 · 紧急手机电话振铃 (`urgent_phone`)**：SoloLab 总控台遇重大节点可向您发起飞书电话加急振铃。',
          '',
          `🔗 **全球 HTTPS 手机直连**：[点击进入实时语音通话舱](${primaryCallUrl})`,
          voiceCallRuntime.lanUrl ? `🏠 **同 Wi-Fi 局域网秒开**：[局域网直连 (${voiceCallRuntime.lanUrl})](${voiceCallRuntime.lanUrl})` : '',
        ].filter(Boolean).join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📞 一键接通实时语音电话 (手机5G/Wi-Fi通用)' },
            type: 'primary',
            url: primaryCallUrl,
          },
          ...(voiceCallRuntime.lanUrl
            ? [{ tag: 'button', text: { tag: 'plain_text', content: '🏠 局域网极速通话舱' }, type: 'default', url: voiceCallRuntime.lanUrl }]
            : []),
        ],
      },
    ],
  };

  const res = await larkClient.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: { receive_id: receiveId, msg_type: 'interactive', content: JSON.stringify(cardPayload) },
  });

  return {
    ok: true,
    messageId: res?.data?.message_id || res?.message_id || null,
    primaryCallUrl,
    publicTunnelUrl: voiceCallRuntime.publicTunnelUrl,
    lanUrl: voiceCallRuntime.lanUrl,
  };
}

function readJsonBody(req, maxBytes = 18 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('请求体超过最大限制'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error(`JSON 解析失败: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

export async function handleVoiceCallHttpRoutes(req, res, url, ctx) {
  const {
    larkClient,
    appId,
    appSecret,
    bridgeState,
    runtimeStatus,
    getCommanderLatestCompletedPlannerStep,
    forwardToCommander,
    sendFeishuText,
    saveBridgeState,
    logBridge,
  } = ctx;

  // 1. GET /voice-call -> 渲染实时全双工语音通话舱 WebApp
  if (req.method === 'GET' && url.pathname === '/voice-call') {
    const rawHtml = fs.readFileSync(CABIN_HTML_PATH, 'utf8');
    const html = rawHtml.replace('{{BOT_NAME}}', 'SoloLab 总控台');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(html);
    return true;
  }

  // 2. GET /api/voice-call/audio/:filename -> 提供合成好的 MP3/Opus 音频流供通话舱秒播
  if (req.method === 'GET' && url.pathname.startsWith('/api/voice-call/audio/')) {
    const fileName = path.basename(decodeURIComponent(url.pathname.replace('/api/voice-call/audio/', '')));
    const filePath = path.join(MEDIA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end(JSON.stringify({ ok: false, error: 'Audio file not found' }));
      return true;
    }
    const ext = path.extname(fileName).toLowerCase();
    res.setHeader('Content-Type', ext === '.opus' ? 'audio/ogg' : 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // 3. GET /api/voice-call/poll -> 轮询 SoloLab 总控台最新完成的回复并自动转成真人语音播报
  if (req.method === 'GET' && url.pathname === '/api/voice-call/poll') {
    const sinceStep = Number(url.searchParams.get('sinceStep') ?? -1);
    const latest = getCommanderLatestCompletedPlannerStep();
    if (!latest) {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, hasNewCommanderReply: false, latestStepIndex: -1 }));
      return true;
    }
    if (lastVoicePolledCommanderStepIdx < 0) {
      lastVoicePolledCommanderStepIdx = latest.stepIndex;
    }
    if (sinceStep >= 0 && latest.stepIndex > sinceStep) {
      lastVoicePolledCommanderStepIdx = latest.stepIndex;
      const tts = await synthesizeVoiceToOpus(latest.content);
      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          hasNewCommanderReply: true,
          stepIndex: latest.stepIndex,
          spokenSummary: tts.spokenText,
          audioUrl: `/api/voice-call/audio/${encodeURIComponent(tts.mp3FileName)}`,
          durationMs: tts.durationMs,
        })
      );
      return true;
    }
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, hasNewCommanderReply: false, latestStepIndex: latest.stepIndex }));
    return true;
  }

  // 4. POST /api/voice-call/turn -> 处理实时语音通话舱的一轮对话（支持上传录音或快捷文本）
  if (req.method === 'POST' && url.pathname === '/api/voice-call/turn') {
    try {
      const body = await readJsonBody(req);
      let userText = String(body.text || '').trim();
      let asrEngine = 'text-direct';

      if (!userText && body.audioBase64) {
        const ext = String(body.mimeType || '').includes('mp4') ? '.m4a' : '.webm';
        const tmpAudio = path.join(os.tmpdir(), `vc_in_${Date.now()}_${crypto.randomUUID().slice(0, 6)}${ext}`);
        try {
          fs.writeFileSync(tmpAudio, Buffer.from(body.audioBase64, 'base64'));
          const asrRes = await transcribeAudioFile(tmpAudio, { larkClient, logFn: logBridge });
          userText = asrRes.text || '';
          asrEngine = asrRes.engine || 'unknown';
        } finally {
          try { if (fs.existsSync(tmpAudio)) fs.unlinkSync(tmpAudio); } catch {}
        }
      }

      if (!userText) {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: false, error: '未识别到有效语音内容' }));
        return true;
      }

      bridgeState.lastInboundAtMs = Date.now();
      const curStep = getCommanderLatestCompletedPlannerStep();
      if (curStep) bridgeState.lastPushedCommanderStepIdx = curStep.stepIndex;
      saveBridgeState();

      const [instantReplyText, fwdRes] = await Promise.all([
        generateInstantVoiceCallReply(userText, { commanderStatus: 'ACTIVE' }),
        forwardToCommander({
          extractedText: `[📞 飞书实时语音通话指令]: ${userText}`,
          msgType: 'voice_call_live',
          messageId: `vcall_${Date.now()}`,
          chatId: bridgeState.lastActiveChatId || '',
          senderOpenId: bridgeState.lastActiveOpenId || '',
          sourceMode: 'voice_call_webapp',
        }).catch((err) => ({ ok: false, error: err.message })),
      ]);

      const tts = await synthesizeVoiceToOpus(instantReplyText);

      let feishuBubbleRes = null;
      if (body.syncFeishuBubble && (bridgeState.lastActiveChatId || bridgeState.lastActiveOpenId)) {
        feishuBubbleRes = await sendFeishuNativeVoiceBubble({
          larkClient,
          chatId: bridgeState.lastActiveChatId,
          openId: bridgeState.lastActiveOpenId,
          text: instantReplyText,
          opusFilePath: tts.opusPath,
          durationMs: tts.durationMs,
        }).catch((e) => ({ ok: false, error: e.message }));
      }

      voiceCallRuntime.totalVoiceCallTurns++;
      voiceCallRuntime.recentCallTurns.unshift({
        at: new Date().toISOString(),
        userTranscript: userText,
        asrEngine,
        replyText: instantReplyText,
        ttsEngine: tts.ttsEngine,
        durationMs: tts.durationMs,
      });
      if (voiceCallRuntime.recentCallTurns.length > 20) voiceCallRuntime.recentCallTurns.length = 20;

      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          userTranscript: userText,
          asrEngine,
          replyText: instantReplyText,
          ttsEngine: tts.ttsEngine,
          durationMs: tts.durationMs,
          audioUrl: `/api/voice-call/audio/${encodeURIComponent(tts.mp3FileName)}`,
          forwardedToCommander: fwdRes?.ok || false,
          feishuBubbleRes,
        })
      );
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return true;
  }

  // 5. POST /send-feishu-voice -> 直接合成并发送飞书原生 Opus 语音条 (`msg_type: "audio"`)
  if (req.method === 'POST' && url.pathname === '/send-feishu-voice') {
    try {
      const payload = await readJsonBody(req);
      const text = String(payload.text || '').trim();
      if (!text && !payload.opusFilePath) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '缺少 text 或 opusFilePath 参数' }));
        return true;
      }
      const voiceRes = await sendFeishuNativeVoiceBubble({
        larkClient,
        chatId: payload.chatId || bridgeState.lastActiveChatId,
        openId: payload.openId || bridgeState.lastActiveOpenId,
        text,
        opusFilePath: payload.opusFilePath || '',
        durationMs: Number(payload.durationMs || 0),
        voice: payload.voice || voiceCallRuntime.defaultVoiceName,
      });
      if (payload.alsoSendText && text) {
        await sendFeishuText({
          chatId: payload.chatId || bridgeState.lastActiveChatId,
          openId: payload.openId || bridgeState.lastActiveOpenId,
          text,
        }).catch(() => {});
      }
      res.writeHead(200);
      res.end(JSON.stringify(voiceRes));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return true;
  }

  // 6. POST /send-voice-call-card -> 向用户手机飞书推送「📞 SoloLab 总控台 · 实时语音舱一键拨号台」
  if (req.method === 'POST' && url.pathname === '/send-voice-call-card') {
    try {
      const payload = await readJsonBody(req);
      const cardRes = await sendFeishuVoiceCallCard({
        larkClient,
        chatId: payload.chatId || bridgeState.lastActiveChatId,
        openId: payload.openId || bridgeState.lastActiveOpenId,
        title: payload.title || '📞 SoloLab 总控台 · 实时语音舱一键拨号台',
      });
      let greetingVoiceRes = null;
      if (payload.withVoiceGreeting !== false) {
        greetingVoiceRes = await sendFeishuNativeVoiceBubble({
          larkClient,
          chatId: payload.chatId || bridgeState.lastActiveChatId,
          openId: payload.openId || bridgeState.lastActiveOpenId,
          text:
            payload.greetingText ||
            '您好！飞书实时语音电话功能已经为您配置好了。您可以直接点开上方的实时语音舱卡片跟我像打电话一样免提对讲，也可以直接在飞书里按住麦克风给我发语音条，SoloLab 语音助手都会用真人语音秒回您！',
        }).catch((e) => ({ ok: false, error: e.message }));
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, cardRes, greetingVoiceRes }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return true;
  }

  // 7. POST /urgent-phone-call -> 触发飞书官方电话加急手机振铃 (`PATCH .../urgent_phone`)
  if (req.method === 'POST' && url.pathname === '/urgent-phone-call') {
    try {
      const payload = await readJsonBody(req);
      const urgentRes = await triggerFeishuUrgentPhoneCall({
        appId,
        appSecret,
        larkClient,
        chatId: payload.chatId || bridgeState.lastActiveChatId,
        openId: payload.openId || bridgeState.lastActiveOpenId,
        messageId: payload.messageId || '',
        urgentText: payload.text || '',
      });
      res.writeHead(200);
      res.end(JSON.stringify(urgentRes));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return true;
  }

  return false;
}
