#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import http from 'node:http'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
import { syncIncrementalIndex } from './memory-graph-engine.mjs'; const HOME = os.homedir();
const AGY_PROJECTS_DIR = path.join(HOME, '.gemini/config/projects');
const BRAIN_DIR = path.join(HOME, '.gemini/antigravity/brain');
const SOURCE_OS_DIR = path.join(HOME, 'Downloads/universal-fullstack-evo-os');
const GLOBAL_PLUGIN_DIR = path.join(HOME, '.gemini/config/plugins/agy-evo-os');
const PLUGIN_DATA_DIR = path.join(HOME, '.gemini/antigravity/plugin_data/agy-evo-os');
const SWARM_REGISTRY_PATH = path.join(PLUGIN_DATA_DIR, 'swarm-registry.json');
const GLOBAL_DISPATCH_LEDGER_PATH = path.join(PLUGIN_DATA_DIR, 'dispatch-ledger.json');
const KNOWN_CANONICAL_REPOS = {
  'demo-app-mvp': path.join(HOME, 'Documents/demo-app/2026-10-12/task-2/demo-app-mvp'),
  'demo-app-handoff': path.join(HOME, 'Documents/demo-app/2026-10-15/gpt-6-astra-16-02-http/outputs/demo-app-handoff'),
  'edge-container-cluster': path.join(HOME, 'Downloads/edge-container-cluster'),
  'media-synthesis-pipeline': path.join(HOME, 'Downloads/media-synthesis-pipeline'),
  'studio-frontend-ui': path.join(HOME, 'Downloads/studio-frontend-ui'),
  'cloud-orchestrator-hub': path.join(HOME, 'Downloads/cloud-orchestrator-hub'),
  'backend-takeover': path.join(HOME, 'Documents/ChatGPT/demo-app/backend-takeover'),
  'dreamina-mvp': path.join(HOME, 'Downloads/未命名文件夹 3/dreamina-mvp'), 'newcore': path.join(HOME, 'code/newcore'),
  'saas-v2': path.join(HOME, 'code/saas-v2'), '提示词工程': path.join(HOME, 'code/提示词工程'), };
export function readSwarmRegistry() {
  try {
    if (fs.existsSync(SWARM_REGISTRY_PATH)) return JSON.parse(fs.readFileSync(SWARM_REGISTRY_PATH, 'utf8'));
  } catch {}
  return { version: '3.2.0', specialists: {}, commanderReports: [], updatedAt: null };
}
function updateSwarmRegistry(mutatorFn) {
  fs.mkdirSync(PLUGIN_DATA_DIR, { recursive: true });
  const lockDir = `${SWARM_REGISTRY_PATH}.lock`;
  let locked = false;
  for (let i = 0; i < 40; i++) {
    try { fs.mkdirSync(lockDir); locked = true; break; } catch {
      try { if (Date.now() - fs.statSync(lockDir).mtimeMs > 5000) fs.rmSync(lockDir, { recursive: true, force: true }); } catch {}
      try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15); } catch {}
    }
  }
  try {
    const reg = readSwarmRegistry();
    reg.specialists = reg.specialists || {}; reg.commanderReports = Array.isArray(reg.commanderReports) ? reg.commanderReports : [];
    mutatorFn(reg); reg.updatedAt = new Date().toISOString();
    const tmp = `${SWARM_REGISTRY_PATH}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
    fs.writeFileSync(tmp, JSON.stringify(reg, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, SWARM_REGISTRY_PATH);
    return reg;
  } finally { if (locked) { try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch {} } }
}
export function normalizePathInput(inputPath) {
  if (!inputPath) return ''; let s = String(inputPath).trim(); if (s.startsWith('file://')) {
    try { s = decodeURIComponent(s.replace(/^file:\/\//, '')); } catch { s = s.replace(/^file:\/\//, ''); }
  }
  if (s === '~') s = HOME;
  else if (s.startsWith('~/') || s.startsWith('~\\')) s = path.join(HOME, s.slice(2));
  if (s.length > 1) s = s.replace(/[\/\\]+$/, ''); return s; }
export function isContainerOrMotherDir(dirPath, allowSelfTest = false) { const norm = normalizePathInput(dirPath);
  if (!norm) return true; const resolved = path.resolve(norm); let real = resolved;
  try { if (fs.existsSync(resolved)) real = fs.realpathSync(resolved); } catch {}
  if (allowSelfTest && (resolved === SOURCE_OS_DIR || real === SOURCE_OS_DIR)) return false;
  const protectedDirs = new Set([
    '/', HOME, path.join(HOME, 'Downloads'), path.join(HOME, 'Downloads', '未命名文件夹 3'),
    path.join(HOME, 'Documents'), path.join(HOME, 'code'), path.join(HOME, 'Desktop'),
    SOURCE_OS_DIR, GLOBAL_PLUGIN_DIR, ]);
  return protectedDirs.has(resolved) || protectedDirs.has(real); }
export function hasRealProjectFiles(dirPath) { try {
    if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return false;
    const entries = fs.readdirSync(dirPath).filter((e) => e !== 'memory' && !e.startsWith('.'));
    return entries.length > 0; } catch { return false; } }
export function resolveCanonicalProjectRoot(inputPath) { const trimmed = normalizePathInput(inputPath);
  if (!trimmed) return ''; const base = path.basename(trimmed); const abs = path.resolve(trimmed);
  if (!path.isAbsolute(trimmed) && !trimmed.includes('/') && !trimmed.includes('\\')) {
    if (KNOWN_CANONICAL_REPOS[base] && hasRealProjectFiles(KNOWN_CANONICAL_REPOS[base])) return KNOWN_CANONICAL_REPOS[base];
    for (const parent of [path.join(HOME, 'Downloads'), path.join(HOME, 'code')]) {
      const candidate = path.join(parent, base); if (hasRealProjectFiles(candidate)) return candidate; } }
  if (hasRealProjectFiles(abs)) { try { return fs.realpathSync(abs); } catch { return abs; } }
  if (KNOWN_CANONICAL_REPOS[base] && hasRealProjectFiles(KNOWN_CANONICAL_REPOS[base])) return KNOWN_CANONICAL_REPOS[base];
  for (const parent of [path.join(HOME, 'Downloads'), path.join(HOME, 'code')]) {
    const candidate = path.join(parent, base); if (hasRealProjectFiles(candidate)) return candidate; }
  return abs; }
export function inferProjectRoleTag(folderOrPath, windowTitle = '') { const s = `${folderOrPath} ${windowTitle}`;
  if (/SoloLab-EdgeNode|backend-takeover|安卓测试|LinkSee|手机伪装/i.test(s)) return 'EDGE_DEVICE_CTRL (手机云机与EdgeNode板卡控制端 :8899)';
  if (/media-synthesis-pipeline|Muse Video/i.test(s)) return 'VIDEO_ONEHUB_API (Muse视频生成与AI网关端 :8000)';
  if (/demo-app|studio-frontend-ui|Greeting and Opening/i.test(s)) return 'FRONTEND_STUDIO_SSOT (前端创作工坊界面真源)';
  if (/demo-app-mvp|mvp-mac-isolated|全栈项目主对话/i.test(s)) return 'BACKEND_WORKBENCH_CORE (主后端与本地工作台服务 :8813)';
  if (/炸裂|RuView/i.test(s)) return 'IOT_ROUTER_RADAR (路由器感知与边缘分析端)';
  if (/newcore|提示词工程/i.test(s)) return 'NEWCORE_PROMPT_ENG (Newcore与提示词工程端)';
  if (/saas-v2|Agent AI|Dify/i.test(s)) return 'SAAS_V2_AGENT_BRAIN (SaaS-v2业务大脑与多智能体端)';
  if (/dreamina/i.test(s)) return 'DREAMINA_CREATIVE_MVP (即梦AI视觉创作端)';
  return 'FULLSTACK_MODULE (通用全栈工程模块)'; }

export const ORCHESTRATOR_SLEEP_REGEX = /(?:^|[;&|({!`\n]|\b(?:do|then|else|elif|if|while|until|time|exec|nohup|command|env)\s)\s*(?:\S*\/)?sleep\b/;
export const ORCHESTRATOR_MAX_SYNC_TIMEOUT_MS = 30000;
export const MAX_ACTIVE_WORKER_WINDOWS = 4;
export const TRANSIENT_ERROR_REGEX = /\b(?:408|429|50[0-4])\b|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EPIPE|UND_ERR|socket hang up|fetch failed|network error|overloaded|rate limit/i;

export function checkOrchestratorNoWaitGuard(commandLine, timeoutMs, options = {}) {
  let cmdStr = '';
  let waitMs = timeoutMs;
  let runInBackground = Boolean(options?.runInBackground ?? options?.isDaemon);
  if (commandLine && typeof commandLine === 'object') {
    cmdStr = String(commandLine.commandLine ?? commandLine.command ?? '');
    if (waitMs === undefined) waitMs = commandLine.timeoutMs ?? commandLine.WaitMsBeforeAsync ?? commandLine.timeout_ms;
    if (commandLine.run_in_background !== undefined || commandLine.IsDaemon !== undefined) {
      runInBackground = Boolean(commandLine.run_in_background ?? commandLine.IsDaemon);
    }
  } else {
    cmdStr = String(commandLine ?? '');
  }
  const sleeps = Boolean(cmdStr) && ORCHESTRATOR_SLEEP_REGEX.test(cmdStr);
  const numericTimeout = typeof waitMs === 'number' && Number.isFinite(waitMs) ? waitMs : undefined;
  const exceedsTimeout = numericTimeout !== undefined && numericTimeout > ORCHESTRATOR_MAX_SYNC_TIMEOUT_MS;
  if (sleeps || exceedsTimeout) {
    const detail = sleeps
      ? '检测到阻塞式 sleep 等待命令'
      : `同步等待超时 (${numericTimeout}ms) 超过 ${ORCHESTRATOR_MAX_SYNC_TIMEOUT_MS}ms 上限`;
    return {
      ok: false,
      allowed: false,
      blocked: true,
      code: sleeps ? 'ORCHESTRATOR_SLEEP_BLOCKED' : 'ORCHESTRATOR_TIMEOUT_EXCEEDED',
      sleeps,
      exceedsTimeout,
      maxTimeoutMs: ORCHESTRATOR_MAX_SYNC_TIMEOUT_MS,
      reason: `⛔ [NoWait 慢命令硬拦截] ${detail}：总控路由会话严禁原地同步等待；子任务结果、后续通知与后台作业结束均会自动异步作为消息回传，请立即派单并结束当前回合（或将 timeoutMs 设为 ≤30000 / 后台异步运行）。`,
    };
  }
  if (numericTimeout === undefined && !runInBackground && options?.requireExplicitTimeout) {
    return {
      ok: false,
      allowed: false,
      blocked: true,
      code: 'ORCHESTRATOR_DEFAULT_WAIT_BLOCKED',
      sleeps: false,
      exceedsTimeout: false,
      maxTimeoutMs: ORCHESTRATOR_MAX_SYNC_TIMEOUT_MS,
      reason: `⛔ [NoWait 默认等待拦截] 未指定 timeoutMs（最高 ${ORCHESTRATOR_MAX_SYNC_TIMEOUT_MS}ms）或后台运行模式，总控路由会话严禁持有过长同步等待锁。`,
    };
  }
  return {
    ok: true,
    allowed: true,
    blocked: false,
    code: 'OK',
    sleeps: false,
    exceedsTimeout: false,
    maxTimeoutMs: ORCHESTRATOR_MAX_SYNC_TIMEOUT_MS,
    reason: null,
  };
}

export function sanitizeRoutingBrief(text, maxWords = 60) {
  if (text === null || text === undefined) return '';
  const limit = typeof maxWords === 'number' && maxWords > 0 ? Math.floor(maxWords) : 60;
  let cleaned = String(text)
    .replace(/```[\s\S]*?```/g, '[代码片段已省略]')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!cleaned) return '';
  const suffix = ` … [已按 ${limit} 词极简派单原则截断脑补细节：仅保留原始诉求与关键约束，请工作窗口自主读取源码完成设计与实现]`;
  const spaceWords = cleaned.split(/\s+/).filter(Boolean);
  if (spaceWords.length > limit) {
    return spaceWords.slice(0, limit).join(' ') + suffix;
  }
  const mixedTokens = [...cleaned.matchAll(/[A-Za-z0-9_./:@-]+|[\u4e00-\u9fa5]{1,2}/g)];
  if (mixedTokens.length > limit) {
    const lastToken = mixedTokens[limit - 1];
    const cutIdx = (lastToken.index || 0) + lastToken[0].length;
    return cleaned.slice(0, cutIdx).trimEnd() + suffix;
  }
  return cleaned;
}

export class WorkerSlots {
  constructor(runningFn = () => [], maxFn = () => MAX_ACTIVE_WORKER_WINDOWS) {
    this.running = typeof runningFn === 'function' ? runningFn : () => [];
    this.max = typeof maxFn === 'function' ? maxFn : () => MAX_ACTIVE_WORKER_WINDOWS;
    this.starting = new Map();
  }
  used() {
    return new Set([...this.running(), ...this.starting.keys()]).size;
  }
  launches() {
    const wakes = [...this.starting].flatMap(([id, by]) => (by !== 'launch' ? [id] : []));
    return Math.max(0, this.max() - new Set([...this.running(), ...wakes]).size);
  }
  canReserve(ticketId, by = 'wake') {
    if (this.starting.has(ticketId)) return true;
    return this.used() < this.max() + (by === 'person' ? 1 : 0);
  }
  reserve(ticketId, by = 'wake') {
    if (this.starting.has(ticketId)) return true;
    const limit = this.max() + (by === 'person' ? 1 : 0);
    if (this.used() >= limit) {
      const err = new Error(`No worker slot is free (used=${this.used()}, limit=${limit}, by=${by})`);
      err.code = 'NO_WORKER_SLOT_FREE';
      throw err;
    }
    this.starting.set(ticketId, by);
    return true;
  }
  free(ticketId) {
    this.starting.delete(ticketId);
  }
}

const _globalStartingReservations = new Map();
export function evaluateWorkerSlotAvailability(topology, opts = {}) {
  const maxWorkers = typeof opts.maxWorkers === 'number' && opts.maxWorkers > 0 ? opts.maxWorkers : MAX_ACTIVE_WORKER_WINDOWS;
  const senderCid = String(opts.senderConversationId || '').trim();
  const targetCid = String(opts.targetConversationId || '').trim();
  const isPriorityPerson = Boolean(opts.fromPerson ?? opts.from_person ?? opts.priorityWake ?? opts.priority_wake ?? (opts.by === 'person'));
  const by = isPriorityPerson ? 'person' : (opts.by || 'wake');
  const mainConvs = Array.isArray(topology?.mainConversations) ? topology.mainConversations : [];
  const runningWorkers = mainConvs.filter((c) => {
    if (c.status !== 'CASCADE_RUN_STATUS_RUNNING') return false;
    if (senderCid && (c.conversationId === senderCid || c.conversationId.startsWith(senderCid) || senderCid.startsWith(c.conversationId))) {
      return false;
    }
    return true;
  });
  const slots = new WorkerSlots(
    () => runningWorkers.map((c) => c.conversationId),
    () => maxWorkers
  );
  for (const [k, v] of _globalStartingReservations.entries()) {
    slots.starting.set(k, v);
  }
  const effectiveMax = maxWorkers + (by === 'person' ? 1 : 0);
  const usedSlots = slots.used();
  const available = targetCid && slots.starting.has(targetCid) ? true : usedSlots < effectiveMax;
  return {
    available,
    by,
    usedSlots,
    maxActiveWorkerWindows: maxWorkers,
    effectiveMaxSlots: effectiveMax,
    extraPersonSlotGranted: by === 'person',
    availableLaunchSlots: slots.launches(),
    runningWorkerConversations: runningWorkers.map((c) => ({
      conversationId: c.conversationId,
      windowTitle: c.windowTitle,
      specialistModule: c.specialistModule || null,
    })),
  };
}

export const deliveryMessageId = (requestId) => `agy-evo-os:${String(requestId || '').trim()}`;
const _inMemoryDeliveredIds = new Map();
export function hasDeliveredRequest(sessionId, requestId, recentLedgerHistory = []) {
  if (!sessionId || !requestId) return false;
  const msgId = deliveryMessageId(requestId);
  const memSet = _inMemoryDeliveredIds.get(sessionId);
  if (memSet && memSet.has(msgId)) return true;
  return recentLedgerHistory.some(
    (h) => h.targetCid === sessionId && (h.xmsgId === requestId || h.deliveryId === msgId)
  );
}
export function markDeliveredRequest(sessionId, requestId) {
  if (!sessionId || !requestId) return;
  const msgId = deliveryMessageId(requestId);
  if (!_inMemoryDeliveredIds.has(sessionId)) _inMemoryDeliveredIds.set(sessionId, new Set());
  _inMemoryDeliveredIds.get(sessionId).add(msgId);
}

export function isTransientRpcError(error) {
  if (!error) return false;
  const status = error?.status ?? error?.statusCode;
  if (typeof status === 'number') return status === 408 || status === 429 || (status >= 500 && status <= 504);
  const text = error instanceof Error ? `${error.name} ${error.message} ${String(error.code ?? '')}` : String(error);
  return TRANSIENT_ERROR_REGEX.test(text);
}
export { isTransientRpcError as transient };

export async function discoverLanguageServerConfig(opts = {}) {
  const ignoreEnvCache = Boolean(opts?.ignoreEnvCache);
  if (!ignoreEnvCache && process.env.ANTIGRAVITY_LS_ADDRESS && process.env.ANTIGRAVITY_CSRF_TOKEN) {
    if (await probeLsPort(process.env.ANTIGRAVITY_LS_ADDRESS, process.env.ANTIGRAVITY_CSRF_TOKEN)) {
      return { address: process.env.ANTIGRAVITY_LS_ADDRESS, csrfToken: process.env.ANTIGRAVITY_CSRF_TOKEN, source: 'env' };
    }
  }
  try {
    const psOut = execFileSync('ps', ['aux'], { encoding: 'utf8', timeout: 3000 });
    const lines = psOut.split('\n').filter((l) => l.includes('language_server') && l.includes('--csrf_token'));
    for (const line of lines) { const pid = line.trim().split(/\s+/)[1];
      const csrfMatch = line.match(/--csrf_token\s+([A-Za-z0-9_-]+)/);
      const bridgeMatch = line.match(/--host_bridge_url=http:\/\/127\.0\.0\.1:(\d+)/);
      if (!csrfMatch || !pid) continue; const csrfToken = csrfMatch[1]; const candidatePorts = new Set();
      if (bridgeMatch) { const bp = Number(bridgeMatch[1]); candidatePorts.add(bp + 2); candidatePorts.add(bp + 1); }
      try {
        const lsofOut = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-a', '-p', pid], { encoding: 'utf8', timeout: 3000 });
        for (const lLine of lsofOut.split('\n').slice(1, 10)) {
          const pm = lLine.match(/127\.0\.0\.1:(\d+)\s+\(LISTEN\)/); if (pm) candidatePorts.add(Number(pm[1])); }
      } catch {}
      for (const port of candidatePorts) { const addr = `127.0.0.1:${port}`;
        if (await probeLsPort(addr, csrfToken)) return { address: addr, csrfToken, source: `process_discovery(pid=${pid})` }; } }
  } catch {}
  return null; }
function probeLsPort(address, csrfToken) { return new Promise((resolve) => { const req = http.request(
      `http://${address}/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-codeium-csrf-token': csrfToken }, timeout: 4500 },
      (res) => { res.resume(); resolve(res.statusCode === 200); } ); req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); }); req.write('{}'); req.end(); }); }
function callLanguageServerRpcOnce(lsConfig, method, payload = {}, timeoutMs = 15000) { return new Promise((resolve, reject) => {
    if (!lsConfig?.address || !lsConfig?.csrfToken) { reject(new Error('未探测到可用的 Antigravity LanguageServer 连接配置')); return; }
    const bodyStr = JSON.stringify(payload); const req = http.request(
      `http://${lsConfig.address}/exa.language_server_pb.LanguageServerService/${method}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-codeium-csrf-token': lsConfig.csrfToken,
          'Content-Length': Buffer.byteLength(bodyStr) }, timeout: timeoutMs }, (res) => {
        let data = ''; res.on('data', (c) => (data += c)); res.on('end', () => { if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data || '{}')); } catch { resolve({ raw: data }); }
          } else {
            const httpErr = new Error(`RPC ${method} HTTP ${res.statusCode}: ${data.slice(0, 200)}`);
            httpErr.status = res.statusCode;
            reject(httpErr);
          } }); } );
    req.on('error', reject); req.on('timeout', () => { req.destroy(); const tErr = new Error(`RPC ${method} ETIMEDOUT`); tErr.code = 'ETIMEDOUT'; reject(tErr); });
    req.write(bodyStr); req.end(); }); }
export async function callLanguageServerRpc(lsConfig, method, payload = {}, retryOpts = {}) {
  const maxRetries = typeof retryOpts.maxRetries === 'number' ? retryOpts.maxRetries : 2;
  const baseDelayMs = typeof retryOpts.baseDelayMs === 'number' ? retryOpts.baseDelayMs : 300;
  let activeConfig = lsConfig;
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (!activeConfig?.address || !activeConfig?.csrfToken) {
        const rediscovered = await discoverLanguageServerConfig({ ignoreEnvCache: attempt > 0 });
        if (rediscovered) activeConfig = rediscovered;
      }
      return await callLanguageServerRpcOnce(activeConfig, method, payload, retryOpts.timeoutMs || 15000);
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries || !isTransientRpcError(err)) throw err;
      const delayMs = baseDelayMs * (2 ** attempt);
      await new Promise((r) => setTimeout(r, delayMs));
      try {
        const freshConfig = await discoverLanguageServerConfig({ ignoreEnvCache: true });
        if (freshConfig) {
          activeConfig = freshConfig;
          if (lsConfig && typeof lsConfig === 'object') {
            lsConfig.address = freshConfig.address;
            lsConfig.csrfToken = freshConfig.csrfToken;
            lsConfig.source = freshConfig.source;
          }
        }
      } catch {}
    }
  }
  throw lastError;
}
let _cachedHighModelId = 'MODEL_PLACEHOLDER_M417'; // Gemini 4 Argon (High)
let _cachedClaudeOpusHighId = 'MODEL_PLACEHOLDER_M402'; // Claude Opus 5.5 (High)
let _cachedClaudeSonnetHighId = 'MODEL_PLACEHOLDER_M405'; // Claude Sonnet 5.5 (High)
let _cachedClaudeQuotaFraction = 0.5;
let _cachedHighModelAt = 0;
// EVO-041: 双额度池智能分流与 Claude「一击必中短平快」防烧干路由器（拉黑 GPT-OSS 120B 防偷喝 Claude 共享池额度）
export async function resolvePreferredHighModel(lsConfig, tier = 'HIGH') {
  const normTier = String(tier || 'HIGH').toUpperCase();
  if (normTier === 'MEDIUM') return 'MODEL_PLACEHOLDER_M418';
  if (normTier === 'LOW') return 'MODEL_PLACEHOLDER_M419';
  if (Date.now() - _cachedHighModelAt >= 180000 && lsConfig) {
    try {
      const st = await callLanguageServerRpc(lsConfig, 'GetUserStatus', {});
      const configs = st?.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
      const highPro = configs.find((c) => /gemini/i.test(c.label || '') && !/flash/i.test(c.label || '') && /\(high\)/i.test(c.label || ''));
      if (highPro?.modelOrAlias?.model) _cachedHighModelId = highPro.modelOrAlias.model;
      const claudeOpus = configs.find((c) => /claude\s+opus/i.test(c.label || '') && /\(high\)/i.test(c.label || ''));
      if (claudeOpus?.modelOrAlias?.model) {
        _cachedClaudeOpusHighId = claudeOpus.modelOrAlias.model;
        if (typeof claudeOpus?.quotaInfo?.remainingFraction === 'number') _cachedClaudeQuotaFraction = claudeOpus.quotaInfo.remainingFraction;
      }
      const claudeSonnet = configs.find((c) => /claude\s+sonnet/i.test(c.label || '') && /\(high\)/i.test(c.label || ''));
      if (claudeSonnet?.modelOrAlias?.model) _cachedClaudeSonnetHighId = claudeSonnet.modelOrAlias.model;
      _cachedHighModelAt = Date.now();
    } catch {}
  }
  // 当显式指定 CLAUDE_OPUS_HIGH / CLAUDE_SONNET_HIGH / CLAUDE_SURGICAL 且共享池剩余额度 >= 15% 时启用 Claude 高档打短平快脑力攻坚
  if ((normTier === 'CLAUDE_OPUS_HIGH' || normTier === 'CLAUDE_SURGICAL') && _cachedClaudeQuotaFraction >= 0.15) {
    return _cachedClaudeOpusHighId || 'MODEL_PLACEHOLDER_M402';
  }
  if (normTier === 'CLAUDE_SONNET_HIGH' && _cachedClaudeQuotaFraction >= 0.15) {
    return _cachedClaudeSonnetHighId || 'MODEL_PLACEHOLDER_M405';
  }
  return _cachedHighModelId || 'MODEL_PLACEHOLDER_M417';
}
export function inspectConversationTranscript(convId, windowTitle = '') {
  const tPath = path.join(BRAIN_DIR, convId, '.system_generated/logs/transcript.jsonl');
  const result = {
    hasTranscript: false, isSubagent: false, isPatrol: false, isPeriodicLogger: false, pendingAskQuestion: false,
    pendingAsyncTask: false, lastUserInput: '', touchedSubprojects: [], roleTag: 'GENERAL_DEV', };
  if (!fs.existsSync(tPath)) return result; result.hasTranscript = true; try {
    const raw = fs.readFileSync(tPath, 'utf8'); const headSlice = raw.slice(0, 75000);
    if (headSlice.includes('<original_task>') || headSlice.includes('<subagent_reminder>')) result.isSubagent = true;
    if (/例行跨项目自检与自进化巡逻|evo-patrol-inspector/.test(headSlice)) result.isPatrol = true;
    if (headSlice.includes('你是一个对话过程记录员，擅长周期性的把我们这个项目中的对话内容去进行复盘总结')) result.isPeriodicLogger = true;
    const lines = raw.split('\n').filter(Boolean); const recentLines = lines.slice(-180);
    let lastUserIdx = -1;
    for (let i = recentLines.length - 1; i >= 0; i--) { if (recentLines[i].includes('"type":"USER_INPUT"')) { lastUserIdx = i; break; } }
    const escHome = HOME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pathRegex = new RegExp(`${escHome}\\/(?:未命名文件夹 3|业务大脑 \\(Agent AI:Dify\\)|[A-Za-z0-9_.\\-\\u4e00-\\u9fa5])+(?:\\/(?:未命名文件夹 3|业务大脑 \\(Agent AI:Dify\\)|[A-Za-z0-9_.\\-\\u4e00-\\u9fa5])+)+`, 'g');
    const dirHits = new Map(); for (let idx = 0; idx < recentLines.length; idx++) { const line = recentLines[idx];
      const weight = lastUserIdx >= 0 && idx >= lastUserIdx ? 5 : 1;
      try { const step = JSON.parse(line);
        if (step.type === 'USER_INPUT' && typeof step.content === 'string') {
          const clean = step.content.replace(/<[^>]+>/g, '').trim(); if (clean) result.lastUserInput = clean.slice(0, 120); }
      } catch {}
      const matches = line.match(pathRegex) || [];
      for (const m of matches) {
        if (m.includes('/.gemini/') || m.includes('/Library/') || m.includes('/Applications/')) continue;
        const rel = m.startsWith(HOME + '/') ? m.slice(HOME.length + 1) : '';
        const rSegs = rel.split('/'); let candidate = '';
        if (rSegs[0] === 'Downloads' && rSegs[1] && !rSegs[1].startsWith('.')) {
          candidate = rSegs[1] === '未命名文件夹 3' && rSegs[2] ? path.join(HOME, 'Downloads', rSegs[1], rSegs[2]) : path.join(HOME, 'Downloads', rSegs[1]);
        } else if (rSegs[0] === 'Documents' && rSegs[1] === 'demo-app' && rSegs.length >= 5) {
          candidate = rSegs.includes('demo-app-handoff')
            ? KNOWN_CANONICAL_REPOS['demo-app-handoff']
            : rSegs[4] === 'outputs' ? '' : path.join(HOME, ...rSegs.slice(0, 5));
        } else if (rSegs[0] === 'Documents' && rSegs[1] === 'ChatGPT' && rSegs.length >= 4) {
          candidate = path.join(HOME, ...rSegs.slice(0, 4));
        } else if (rSegs[0] === 'code' && rSegs[1]) {
          candidate = path.join(HOME, 'code', rSegs[1]);
        } else if (rSegs[0] && ['安卓测试', 'nothing'].includes(rSegs[0])) candidate = path.join(HOME, rSegs[0]);
        if (candidate && candidate !== SOURCE_OS_DIR && candidate !== path.join(HOME, 'Downloads/未命名文件夹 3') && !candidate.endsWith('.zip') && !candidate.endsWith('.md')) {
          try { if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) dirHits.set(candidate, (dirHits.get(candidate) || 0) + weight); } catch {}
        } } }
    const tailObjs = lines.slice(-8).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const nowTs = Date.now();
    const tMtimeMs = fs.statSync(tPath).mtimeMs;
    for (const st of tailObjs.slice(-4)) {
      if (st.status === 'RUNNING' || st.status === 'PENDING') {
        const stepAgeMs = st.created_at ? (nowTs - new Date(st.created_at).getTime()) : (nowTs - tMtimeMs);
        if (stepAgeMs < 40 * 1000) {
          result.pendingAsyncTask = true;
        } else {
          // EVO-034: 超过 40 秒仍处于 RUNNING 的后台步骤判定为挂起搁置任务 (stalledAsyncTask)，放行 Gate 6 允许倒计时唤醒！
          result.stalledAsyncTask = true;
        }
      }
    }
    let lastPlannerIdx = -1; for (let i = tailObjs.length - 1; i >= 0; i--) { if (tailObjs[i].type === 'PLANNER_RESPONSE') { lastPlannerIdx = i; break; } }
    if (lastPlannerIdx >= 0) { const plannerStep = tailObjs[lastPlannerIdx];
      const toolCalls = Array.isArray(plannerStep.tool_calls) ? plannerStep.tool_calls : Array.isArray(plannerStep?.planner_response?.tool_calls) ? plannerStep.planner_response.tool_calls : [];
      const afterSteps = tailObjs.slice(lastPlannerIdx + 1); const hasCompletedFollowup = afterSteps.some(
        (s) => (s.type === 'GENERIC' || s.type === 'USER_INPUT' || s.type === 'SYSTEM_MESSAGE') && s.status === 'DONE' );
      if (toolCalls.some((tc) => tc?.name === 'ask_question') && !hasCompletedFollowup) result.pendingAskQuestion = true;
      const plannerAgeMs = plannerStep.created_at ? (nowTs - new Date(plannerStep.created_at).getTime()) : (nowTs - tMtimeMs);
      if (plannerAgeMs < 40 * 1000 && toolCalls.some((tc) => tc?.name === 'run_command') && !hasCompletedFollowup) result.pendingAsyncTask = true; }
    result.touchedSubprojects = [...dirHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([dir, hits]) => ({ dir, basename: path.basename(dir), hits }));
    result.roleTag = inferProjectRoleTag(result.touchedSubprojects[0]?.basename || '', windowTitle); } catch {}
  return result; }
export async function discoverAntigravityProjectsAndConversations() { const uiProjects = []; const seenProjIds = new Set();
  for (const projDir of [path.join(HOME, '.gemini/antigravity/projects'), AGY_PROJECTS_DIR]) {
    if (!fs.existsSync(projDir)) continue;
    for (const f of fs.readdirSync(projDir)) {
      if (!f.endsWith('.json') || f === 'default-cli-project.json') continue; try {
        const d = JSON.parse(fs.readFileSync(path.join(projDir, f), 'utf8'));
        if (!d.id || seenProjIds.has(d.id) || !d.name || d.name.includes('/') || d.name === 'agy-evo-os-patrol') continue;
        seenProjIds.add(d.id); const folders = [];
        for (const r of d?.projectResources?.resources || []) {
          const uri = r?.gitFolder?.folderUri || r?.folderUri || '';
          if (uri.startsWith('file://')) folders.push(decodeURIComponent(uri.replace(/^file:\/\//, '')));
        }
        const firstFolder = folders[0] || ''; let diskStatus = 'ACTIVE_REPO';
        if (!firstFolder || !fs.existsSync(firstFolder)) diskStatus = 'MOVED_OR_MISSING';
        else if (isContainerOrMotherDir(firstFolder, false) || firstFolder.endsWith('/未命名文件夹 3')) diskStatus = 'CONTAINER_DIR';
        else if (!hasRealProjectFiles(firstFolder)) diskStatus = 'EMPTY_DIR';
        uiProjects.push({ id: d.id, uiName: d.name, mountedFolders: folders, diskStatus });
      } catch {} } }
  const lsConfig = await discoverLanguageServerConfig(); let trajectories = {};
  const swarmReg = readSwarmRegistry();
  if (lsConfig) {
    try {
      const res = await callLanguageServerRpc(lsConfig, 'GetAllCascadeTrajectories', {});
      trajectories = { ...(res.trajectorySummaries || {}) };
    } catch {}
    // EVO-031: Antigravity v2.28.2+ 采用按需懒加载架构，GetAllCascadeTrajectories 仅返回当前驻留内存的活跃对话；
    // 自动合并 SearchConversations 与 swarm-registry.json 中的具名工作节点，确保未打开的 IDLE 工作会话窗口 100% 被发现！
    try {
      const searchRes = await callLanguageServerRpc(lsConfig, 'SearchConversations', { query: '' });
      for (const item of searchRes?.results || []) {
        if (item?.cascadeId && !trajectories[item.cascadeId]) {
          trajectories[item.cascadeId] = {
            annotations: { title: item.title || '' },
            summary: item.title || '',
            status: 'CASCADE_RUN_STATUS_IDLE',
            lastModifiedTime: item.lastModifiedTime || '',
            workspaces: item.workspaceName ? [{ workspaceFolderAbsoluteUri: `file://${path.join(HOME, item.workspaceName)}` }] : [],
          };
        }
      }
    } catch {}
  }
  for (const sp of Object.values(swarmReg.specialists || {})) {
    if (sp?.conversationId && !trajectories[sp.conversationId]) {
      trajectories[sp.conversationId] = {
        annotations: { title: sp.specialistTitle || `🧩 [板块:${sp.moduleName}] 工作节点` },
        summary: sp.specialistTitle || '',
        status: 'CASCADE_RUN_STATUS_IDLE',
        lastModifiedTime: sp.updatedAt || sp.createdAt || '',
        workspaces: sp.projectRoot ? [{ workspaceFolderAbsoluteUri: `file://${sp.projectRoot}` }] : [],
      };
    }
  }
  const regByCid = new Map(Object.values(swarmReg.specialists || {}).map((sp) => [sp.conversationId, sp]));
  const rawConversations = []; const subagentConversations = [];
  for (const [cid, info] of Object.entries(trajectories)) {
    const regSp = regByCid.get(cid);
    const rawTitle = (info.annotations?.title || regSp?.specialistTitle || info.summary || '').trim();
    const lastMod = info.lastModifiedTime || info.createdTime || info.trajectoryMetadata?.createdAt || regSp?.updatedAt || '';
    const metaIsSubagent = Boolean(info.trajectoryMetadata?.subagentSpec || info.trajectoryMetadata?.parentConversationId);
    if (metaIsSubagent) {
      const spec = info.trajectoryMetadata?.subagentSpec || {};
      const agentName = spec.agentName || spec.typeName || info.trajectoryMetadata?.agentScript?.name || spec.role || null;
      const role = spec.role || spec.typeName || null;
      const subTitle = rawTitle || (role ? `[Subagent] ${role}` : agentName ? `[Subagent] ${agentName}` : `Subagent ${cid.slice(0, 8)}`);
      subagentConversations.push({
        conversationId: cid, windowTitle: subTitle,
        parentConversationId: info.trajectoryMetadata?.parentConversationId || null,
        agentName, role, status: info.status || 'UNKNOWN', stepCount: info.stepCount || 0, lastModifiedTime: lastMod,
      });
      continue;
    }
    const summary = rawTitle;
    if (!summary || /Routine Self|Routine Patrol|Self-Evolution Patrol/i.test(summary)) continue;
    const foot = inspectConversationTranscript(cid, summary);
    if (foot.isPatrol) continue;
    if (foot.isSubagent) {
      subagentConversations.push({
        conversationId: cid, windowTitle: summary, parentConversationId: null, agentName: null, role: null,
        status: info.status || 'UNKNOWN', stepCount: info.stepCount || 0, lastModifiedTime: lastMod,
      });
      continue;
    }
    const wsFolders = (info.workspaces || []).map((w) => decodeURIComponent((w.workspaceFolderAbsoluteUri || '').replace(/^file:\/\//, ''))).filter(Boolean);
    const matchedUiNames = uiProjects.filter((up) => up.mountedFolders.some((mf) => wsFolders.some((ws) => ws === mf || ws.startsWith(mf + '/')))).map((up) => up.uiName);
    const topSubDir = foot.touchedSubprojects[0]?.dir || wsFolders[0] || '';
    const fallbackUiNames = /SoloLab|demo-app|demo-app|demo-app|demo-app|demo-app/i.test(topSubDir + ' ' + summary)
      ? ['SoloLab', '脚本'] : [foot.touchedSubprojects[0]?.basename || path.basename(wsFolders[0] || '') || '独立项目'];
    const modMatch = summary.match(/\[板块:([^\]]+)\]/);
    rawConversations.push({
      conversationId: cid, windowTitle: summary, specialistModule: regSp?.moduleName || (modMatch ? modMatch[1].trim() : null),
      status: info.status || 'UNKNOWN', stepCount: info.stepCount || 0, lastModifiedTime: lastMod,
      uiProjectNames: matchedUiNames.length > 0 ? matchedUiNames : fallbackUiNames, workspaceFolders: wsFolders,
      roleTag: foot.roleTag, isPeriodicLogger: foot.isPeriodicLogger, pendingAskQuestion: foot.pendingAskQuestion,
      pendingAsyncTask: foot.pendingAsyncTask, activeSubprojects: foot.touchedSubprojects, lastUserInput: foot.lastUserInput, }); }
  rawConversations.sort((a, b) => new Date(b.lastModifiedTime || 0) - new Date(a.lastModifiedTime || 0));
  subagentConversations.sort((a, b) => new Date(b.lastModifiedTime || 0) - new Date(a.lastModifiedTime || 0));
  const mainConversations = []; let loggerIncluded = false; for (const c of rawConversations) {
    if (c.isPeriodicLogger) { if (loggerIncluded) continue; loggerIncluded = true; }
    mainConversations.push(c); }
  const businessDirsMap = new Map(); const SKIP_PARENT_CONTAINERS = new Set([
    path.join(HOME, 'Downloads/未命名文件夹 3'),
    path.join(HOME, 'Documents/demo-app/2026-10-15/gpt-6-astra-16-02-http/outputs'), ]); const registerDir = (dirPath, sourceReason) => {
    if (!dirPath || !fs.existsSync(dirPath)) return; const resolved = path.resolve(dirPath);
    if (isContainerOrMotherDir(resolved, false) || SKIP_PARENT_CONTAINERS.has(resolved)) return;
    try { if (!fs.statSync(resolved).isDirectory() || fs.readdirSync(resolved).length === 0) return; } catch { return; }
    if (businessDirsMap.has(resolved)) return; const exactUiNames = new Set(); const parentUiNames = new Set();
    for (const up of uiProjects) { for (const mf of up.mountedFolders) { if (resolved === mf) exactUiNames.add(up.uiName);
        else if (resolved.startsWith(mf + '/')) parentUiNames.add(up.uiName); } }
    const folderName = path.basename(resolved);
    const uiNamesArr = [...(exactUiNames.size > 0 ? exactUiNames : parentUiNames)].sort((a, b) => a === 'SoloLab' ? -1 : b === 'SoloLab' ? 1 : 0);
    if (uiNamesArr.length === 0) {
      if (/SoloLab|demo-app|demo-app|demo-app|demo-app|demo-app/i.test(resolved)) uiNamesArr.push('SoloLab', '脚本');
      else uiNamesArr.push(folderName); }
    const linkedConvs = mainConversations
      .map((c) => {
        const spHit = c.activeSubprojects.find((sp) => sp.dir === resolved)?.hits || 0;
        const wsBonus = c.workspaceFolders.includes(resolved) ? 50 : 0; return { conv: c, score: spHit + wsBonus }; })
      .filter((x) => x.score >= 5).sort((a, b) => b.score - a.score).slice(0, 4).map((x) => ({ ...x.conv, touchScore: x.score }));
    const hasMemory = fs.existsSync(path.join(resolved, 'memory', 'PRODUCT_PROGRESS.md')) || fs.existsSync(path.join(resolved, 'memory', 'CODE_GRAPH_3D.html'));
    const uiLabel = uiNamesArr.slice(0, 2).join('/') || folderName;
    const convLabel = linkedConvs[0] ? `💬 ${linkedConvs[0].windowTitle}` : '💬 独立项目窗口';
    businessDirsMap.set(resolved, { projectRoot: resolved, folderName,
      projectRoleTag: inferProjectRoleTag(resolved, linkedConvs[0]?.windowTitle || ''),
      uiProjectNames: uiNamesArr, linkedConversations: linkedConvs.map((c) => ({
        conversationId: c.conversationId, windowTitle: c.windowTitle, status: c.status, roleTag: c.roleTag,
        stepCount: c.stepCount, touchScore: c.touchScore, })), hasMemoryInitialized: hasMemory,
      discoverySource: sourceReason, displayLabel: `【软件项目: ${uiLabel}】${convLabel} · 📂 ${folderName}`, }); };
  for (const kd of Object.values(KNOWN_CANONICAL_REPOS)) registerDir(kd, 'active_ecosystem');
  for (const conv of mainConversations.slice(0, 25)) {
    for (const sp of conv.activeSubprojects) registerDir(sp.dir, `conversation:${conv.windowTitle}`); }
  for (const up of uiProjects) { for (const mf of up.mountedFolders) registerDir(mf, `ui_project:${up.uiName}`); }
  for (const parentContainer of [path.join(HOME, 'code'), path.join(HOME, 'Downloads')]) {
    try { if (!fs.existsSync(parentContainer)) continue;
      for (const entry of fs.readdirSync(parentContainer, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue; const sub = path.join(parentContainer, entry.name);
        if (parentContainer.endsWith('/code') || fs.existsSync(path.join(sub, 'memory', 'PRODUCT_PROGRESS.md'))) {
          registerDir(sub, `workspace_scan:${path.basename(parentContainer)}`); } }
    } catch {} }
  return {
    lsConnected: Boolean(lsConfig), lsAddress: lsConfig?.address || null,
    uiProjects, mainConversations: mainConversations.slice(0, 25),
    subagentConversations: subagentConversations.slice(0, 40),
    businessProjects: [...businessDirsMap.values()], }; }
export function appendCrossProjectMemory(rawOpts = {}) {
  const targetProjectRoot = rawOpts.targetProjectRoot || rawOpts.targetProject || rawOpts.toProjectRoot || rawOpts.to_project_root || '';
  const sourceProject = rawOpts.sourceProject || rawOpts.fromProject || rawOpts.from_project || '跨窗口协同';
  const sourceConversationTitle = rawOpts.sourceConversationTitle || '';
  const category = rawOpts.category || rawOpts.severity || 'API_CONTRACT'; const title = rawOpts.title || '';
  const impactScope = rawOpts.impactScope || rawOpts.impact_scope || ''; const content =
    rawOpts.content || rawOpts.summary ||
    (rawOpts.actionRequired || rawOpts.action_required
      ? `${impactScope ? `影响范围: ${impactScope} — ` : ''}待办动作: ${rawOpts.actionRequired || rawOpts.action_required}`
      : ''); const relatedFiles =
    Array.isArray(rawOpts.relatedFiles) && rawOpts.relatedFiles.length > 0
      ? rawOpts.relatedFiles
      : Array.isArray(rawOpts.affectedFiles) && rawOpts.affectedFiles.length > 0
        ? rawOpts.affectedFiles
        : impactScope
          ? impactScope.split(',').map((s) => s.trim()).filter(Boolean)
          : []; const status = rawOpts.status || 'PENDING';
  const allowEngineSelfTest = Boolean(rawOpts.allowEngineSelfTest ?? rawOpts.allow_engine_self_test);
  const dryRun = Boolean(rawOpts.dryRun ?? rawOpts.dry_run);
  const resolvedTarget = resolveCanonicalProjectRoot(targetProjectRoot);
  if (isContainerOrMotherDir(resolvedTarget, allowEngineSelfTest)) { return { ok: false,
      error: `⚠️ 路径隔离拦截：target_project_root (${resolvedTarget}) 是容器目录或母版库，请传入具体业务项目目录！`, }; }
  if (!allowEngineSelfTest && !hasRealProjectFiles(resolvedTarget)) { return { ok: false,
      error: `⚠️ 空壳目录拦截：target_project_root (${resolvedTarget}) 不存在或无真实业务源码文件，已阻止创建孤儿 memory/！`, }; }
  if (!title.trim() || !content.trim()) { return { ok: false, error: '⚠️ 参数缺失：跨项目记忆的 title 与 content 不能为空！' }; }
  const memDir = path.join(resolvedTarget, 'memory'); const sessionsDir = path.join(memDir, 'sessions');
  const inboxPath = path.join(memDir, 'CROSS_INBOX.md');
  const normKey = `${path.basename(String(sourceProject))}|${category}|${title.trim().toLowerCase()}|${content
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
    .toLowerCase()}`;
  const hash10 = crypto.createHash('sha256').update(normKey).digest('hex').slice(0, 10).toUpperCase();
  const xmsgId = `XMSG-${hash10}`;
  if (dryRun) {
    return { ok: true, dryRun: true, xmsgId, msgId: xmsgId, created: false, inserted: false, deduplicated: false,
      archivedCount: 0, inboxPath, targetProjectRoot: resolvedTarget, sqliteSynced: false, nodeCount: 0 };
  }
  fs.mkdirSync(sessionsDir, { recursive: true });
  const tplDir = fs.existsSync(path.join(GLOBAL_PLUGIN_DIR, 'memory-templates'))
    ? path.join(GLOBAL_PLUGIN_DIR, 'memory-templates')
    : path.join(SOURCE_OS_DIR, 'memory-templates');
  for (const fn of ['USER_PROFILE.md', 'PRODUCT_PROGRESS.md', 'CODE_MAP.md', 'ARCHITECTURE_DECISIONS.md', 'EVOLUTION_LEDGER.md', 'CONVERSATION_INDEX.md']) {
    const dst = path.join(memDir, fn); const src = path.join(tplDir, fn);
    if (!fs.existsSync(dst) && fs.existsSync(src)) { try { fs.copyFileSync(src, dst); } catch {} }
  }
  const nowIso = new Date().toISOString(); const headerTpl = [
    `# 📬 跨项目与多对话协同记忆收件箱 (\`CROSS_INBOX.md\`)`, ``,
    `> **收件箱定位**：接收来自其他关联项目或兄弟对话窗口（前端/后端/手机控制端）投递的接口契约变更、哈希锁同步、踩坑预警与跨对话派单任务。`,
    `> - 每条记录具有唯一内容指纹 ID（\`XMSG-xxxxxxxxxx\`），重复投递自动就地幂等合并；`,
    `> - 状态流转：\`STATUS: PENDING\`（待消费，第 0 步 \`memory_recall_for_task\` 自动置顶召回） -> \`STATUS: ACKED\` / \`STATUS: MERGED\` / \`STATUS: FAILED\`。`,
    ``, `---`, ``,
  ].join('\n'); let existingRaw = fs.existsSync(inboxPath) ? fs.readFileSync(inboxPath, 'utf8') : headerTpl;
  const relFilesStr = Array.isArray(relatedFiles) && relatedFiles.length > 0 ? relatedFiles.join(', ') : '全局关联';
  const srcLabel = sourceConversationTitle ? `${sourceProject} (${sourceConversationTitle})` : sourceProject;
  const entryBlock = [
    `### [${xmsgId}] ${title.trim()}`, `- **来源项目 / 对话**：\`${srcLabel}\``, `- **记忆类别**：\`${category}\``,
    `- **状态**：\`STATUS: ${status}\``, `- **投递时间**：\`${nowIso}\``, `- **关联实体 / 文件**：\`${relFilesStr}\``,
    `- **核心内容**：`, content.trim(), ``, ].join('\n'); let deduplicated = false;
  const initSections = existingRaw.split(/(?=^### \[XMSG-[A-Z0-9_-]+\])/m);
  const headPart = initSections[0] || headerTpl; const itemSections = initSections.slice(1);
  const existIdx = itemSections.findIndex((s) => s.startsWith(`### [${xmsgId}]`)); if (existIdx >= 0) {
    itemSections[existIdx] = entryBlock + '\n'; deduplicated = true; } else { itemSections.push(entryBlock + '\n'); }
  existingRaw = headPart.trimEnd() + '\n\n' + itemSections.map((s) => s.trim()).join('\n\n') + '\n';
  let archivedCount = 0; if (itemSections.length > 25) { const keep = []; const toArchive = [];
    for (const sec of itemSections) {
      if (/STATUS:\s*(?:ACKED|MERGED)/i.test(sec) && itemSections.length - toArchive.length > 20) {
        toArchive.push(sec); } else { keep.push(sec); } }
    if (toArchive.length > 0) {
      const archivePath = path.join(sessionsDir, 'CROSS_INBOX_ARCHIVE.md');
      fs.appendFileSync(archivePath, `\n<!-- Archived at ${nowIso} -->\n` + toArchive.join('\n'), 'utf8');
      existingRaw = headPart.trimEnd() + '\n\n' + keep.map((s) => s.trim()).join('\n\n') + '\n';
      archivedCount = toArchive.length; } }
  fs.writeFileSync(inboxPath, existingRaw, 'utf8'); let syncStats = null; try {
    syncStats = syncIncrementalIndex(resolvedTarget, false, false); } catch {}
  return { ok: true,
    xmsgId, msgId: xmsgId, created: !deduplicated, inserted: !deduplicated, deduplicated,
    archivedCount,
    inboxPath, targetProjectRoot: resolvedTarget, sqliteSynced: Boolean(syncStats), nodeCount: syncStats?.nodeCount || 0, }; }
export function ackCrossProjectMemory(rawOpts = {}) {
  const rawTarget = rawOpts.projectRoot || rawOpts.project_root || rawOpts.targetProjectRoot || rawOpts.target_project_root || '';
  const resolvedTarget = resolveCanonicalProjectRoot(rawTarget);
  const rawXmsgId = String(rawOpts.xmsgId || rawOpts.xmsg_id || rawOpts.msgId || rawOpts.msg_id || '').trim();
  const status = String(rawOpts.status || 'ACKED').trim().toUpperCase();
  const allowEngineSelfTest = Boolean(rawOpts.allowEngineSelfTest ?? rawOpts.allow_engine_self_test);
  const dryRun = Boolean(rawOpts.dryRun ?? rawOpts.dry_run);
  if (!allowEngineSelfTest && !hasRealProjectFiles(resolvedTarget)) {
    return { ok: false, error: `⚠️ 空壳目录拦截：target_project_root (${resolvedTarget}) 不存在或无真实业务源码文件！` };
  }
  if (!rawXmsgId) {
    return { ok: false, error: '⚠️ 参数缺失：xmsg_id 不能为空（例如 XMSG-3785050D56）！' };
  }
  const cleanId = rawXmsgId.toUpperCase().startsWith('XMSG-') ? rawXmsgId.toUpperCase() : `XMSG-${rawXmsgId.toUpperCase()}`;
  const inboxPath = path.join(resolvedTarget, 'memory', 'CROSS_INBOX.md');
  if (!fs.existsSync(inboxPath)) {
    return { ok: false, error: `收件箱文件不存在: ${inboxPath}` };
  }
  if (dryRun) {
    return { ok: true, dryRun: true, xmsgId: cleanId, status, targetProjectRoot: resolvedTarget, updated: false };
  }
  const rawContent = fs.readFileSync(inboxPath, 'utf8');
  const sections = rawContent.split(/(?=^### \[XMSG-[A-Z0-9_-]+\])/m);
  const headPart = sections[0];
  const itemSections = sections.slice(1);
  let found = false;
  let previousStatus = null;
  for (let i = 0; i < itemSections.length; i++) {
    if (itemSections[i].startsWith(`### [${cleanId}]`)) {
      found = true;
      const statusMatch = itemSections[i].match(/- \*\*状态\*\*：`STATUS: ([A-Z_]+)`/i);
      previousStatus = statusMatch ? statusMatch[1] : null;
      itemSections[i] = itemSections[i].replace(
        /- \*\*状态\*\*：`STATUS: [A-Z_]+`/i,
        `- **状态**：\`STATUS: ${status}\``
      );
      break;
    }
  }
  if (!found) {
    return { ok: false, error: `未在收件箱中找到 ID 为 ${cleanId} 的消息条目！`, inboxPath };
  }
  const updatedRaw = headPart.trimEnd() + '\n\n' + itemSections.map((s) => s.trim()).join('\n\n') + '\n';
  fs.writeFileSync(inboxPath, updatedRaw, 'utf8');
  let syncStats = null;
  try {
    syncStats = syncIncrementalIndex(resolvedTarget, false, false);
  } catch {}
  return {
    ok: true,
    xmsgId: cleanId,
    previousStatus,
    status,
    inboxPath,
    targetProjectRoot: resolvedTarget,
    updated: true,
    sqliteSynced: Boolean(syncStats),
    nodeCount: syncStats?.nodeCount || 0,
  };
}
export async function dispatchTaskToConversation(rawOpts = {}) {
  const targetConversationId = rawOpts.targetConversationId || rawOpts.targetCascadeId || rawOpts.targetConversationIdOrTitle || rawOpts.target_conversation || '';
  const targetConversationTitle = rawOpts.targetConversationTitle || rawOpts.targetConversationIdOrTitle || rawOpts.target_conversation || '';
  const targetUiProject = rawOpts.targetUiProject || '';
  const targetProjectRoot = resolveCanonicalProjectRoot(rawOpts.targetProjectRoot || rawOpts.targetProject || rawOpts.toProjectRoot || rawOpts.to_project_root || '');
  const senderTitle = rawOpts.senderTitle || rawOpts.fromProject || rawOpts.from_project || '';
  const taskTitle = rawOpts.taskTitle || rawOpts.title || '';
  const impactScope = rawOpts.impactScope || rawOpts.impact_scope || ''; const taskInstructions =
    rawOpts.taskInstructions || rawOpts.taskMessage ||
    (rawOpts.actionRequired || rawOpts.action_required
      ? `${impactScope ? `影响范围: ${impactScope} — ` : ''}${rawOpts.actionRequired || rawOpts.action_required}`
      : ''); const relatedFiles =
    Array.isArray(rawOpts.relatedFiles) && rawOpts.relatedFiles.length > 0
      ? rawOpts.relatedFiles
      : Array.isArray(rawOpts.affectedFiles) && rawOpts.affectedFiles.length > 0
        ? rawOpts.affectedFiles
        : impactScope
          ? impactScope.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
  const autoWake = rawOpts.autoWake !== undefined || rawOpts.auto_wake !== undefined ? Boolean(rawOpts.autoWake ?? rawOpts.auto_wake) : true;
  const dryRun = Boolean(rawOpts.dryRun ?? rawOpts.dry_run);
  const allowEngineSelfTest = Boolean(rawOpts.allowEngineSelfTest ?? rawOpts.allow_engine_self_test);
  const topology = await discoverAntigravityProjectsAndConversations(); const candidates = topology.mainConversations;
  const runningConv = candidates.find((c) => c.status === 'CASCADE_RUN_STATUS_RUNNING');
  const senderConversationId =
    rawOpts.senderConversationId || rawOpts.senderCascadeId || rawOpts.senderId || rawOpts.sender_id || process.env.CONVERSATION_ID || runningConv?.conversationId || '';
  const sameCid = (a, b) => Boolean(a && b) && (a === b || a.startsWith(b) || b.startsWith(a) || (a.length >= 8 && b.length >= 8 && a.slice(0, 8) === b.slice(0, 8)));
  const directSelfRequest =
    sameCid(targetConversationId, senderConversationId) ||
    (Boolean(targetConversationTitle && senderTitle) &&
      targetConversationTitle.trim().toLowerCase() === senderTitle.trim().toLowerCase());
  let matchedConv = null; let matchReason = ''; if (targetConversationId) {
    matchedConv = candidates.find((c) => c.conversationId === targetConversationId || c.conversationId.startsWith(targetConversationId));
    if (matchedConv) matchReason = `精确匹配 conversationId (${matchedConv.conversationId})`; }
  if (!matchedConv && targetConversationTitle) { const q = targetConversationTitle.toLowerCase();
    matchedConv = candidates.find((c) => c.windowTitle.toLowerCase().includes(q));
    if (matchedConv) matchReason = `匹配对话窗口标题 "${matchedConv.windowTitle}"`; }
  if (!matchedConv && !directSelfRequest && targetProjectRoot) {
    const absTarget = resolveCanonicalProjectRoot(targetProjectRoot); const scored = candidates
      .filter((c) => !senderConversationId || !c.conversationId.startsWith(senderConversationId))
      .map((c) => {
        const hit = c.activeSubprojects.find((sp) => sp.dir === absTarget);
        const wsHit = c.workspaceFolders.includes(absTarget) ? 20 : 0;
        return { conv: c, score: (hit ? hit.hits : 0) + wsHit }; })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score); if (scored.length > 0) { matchedConv = scored[0].conv;
      matchReason = `按目标目录活跃足迹频率最高匹配 "${matchedConv.windowTitle}" (触碰权重=${scored[0].score})`; } }
  if (!matchedConv && !directSelfRequest && targetUiProject) { const q = targetUiProject.toLowerCase();
    matchedConv = candidates.find(
      (c) => (!senderConversationId || !c.conversationId.startsWith(senderConversationId)) && c.uiProjectNames.some((u) => u.toLowerCase().includes(q))
    );
    if (matchedConv) matchReason = `按反重力软件项目名 [${targetUiProject}] 匹配 "${matchedConv.windowTitle}"`; }
  const resolvedProjectRoot = targetProjectRoot
    ? resolveCanonicalProjectRoot(targetProjectRoot)
    : matchedConv?.activeSubprojects?.[0]?.dir || ''; if (!resolvedProjectRoot) { return {
      ok: false, error: '无法确定目标业务项目目录，请提供 target_project_root 或有效的 target_conversation_title',
      availableConversations: candidates.slice(0, 10).map((c) => ({
        conversationId: c.conversationId, windowTitle: c.windowTitle, uiProjectNames: c.uiProjectNames,
        status: c.status, roleTag: c.roleTag, topSubproject: c.activeSubprojects[0]?.dir || null, })), }; }
  const globalLedgerPath = GLOBAL_DISPATCH_LEDGER_PATH;
  const localLedgerPath = path.join(resolvedProjectRoot, 'memory', '.memory-store', 'dispatch-ledger.json');
  let ledger = { history: [] }; try {
    const p = fs.existsSync(globalLedgerPath) ? globalLedgerPath : localLedgerPath;
    if (fs.existsSync(p)) ledger = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { ledger = { history: [] }; }
  const nowMs = Date.now(); const recentHistory = (ledger.history || []).filter((h) => nowMs - h.timestampMs < 600000);
  const isSelf = directSelfRequest || (Boolean(matchedConv) && (sameCid(matchedConv.conversationId, senderConversationId) || (Boolean(senderTitle) && matchedConv.windowTitle.toLowerCase() === senderTitle.trim().toLowerCase())));
  const pingPongDetected = Boolean(matchedConv) && recentHistory.some((h) => (senderConversationId && sameCid(h.senderCid, matchedConv.conversationId) && sameCid(h.targetCid, senderConversationId)) || (senderTitle && h.targetTitle === senderTitle && h.senderTitle === matchedConv.windowTitle));
  const recentTargetDispatches = matchedConv ? recentHistory.filter((h) => h.targetCid === matchedConv.conversationId).length : 0;
  const recentCooldownHit = Boolean(matchedConv) && recentHistory.some((h) => h.targetCid === matchedConv.conversationId && nowMs - h.timestampMs < 60000);
  const slotStatus = evaluateWorkerSlotAvailability(topology, {
    senderConversationId,
    targetConversationId: matchedConv?.conversationId || '',
    fromPerson: rawOpts.fromPerson ?? rawOpts.from_person,
    priorityWake: rawOpts.priorityWake ?? rawOpts.priority_wake,
    by: rawOpts.by,
    maxWorkers: rawOpts.maxActiveWorkers ?? rawOpts.max_active_workers,
  });
  const preflightGates = { gate1_noSelfDispatch: Boolean(matchedConv) && !isSelf,
    gate2_noPingPongAndMaxDepth: Boolean(matchedConv) && !pingPongDetected && recentTargetDispatches < 3,
    gate3_cooldownPassed: !recentCooldownHit, gate4_targetIsIdle: matchedConv ? matchedConv.status === 'CASCADE_RUN_STATUS_IDLE' : false,
    gate5_noPendingAskQuestion: matchedConv ? !matchedConv.pendingAskQuestion : true, gate6_noPendingAsyncTask: matchedConv ? !matchedConv.pendingAsyncTask : true,
    gate7_workerSlotAvailable: slotStatus.available, };
  const sanitizedBrief = sanitizeRoutingBrief(taskInstructions, rawOpts.maxBriefWords ?? rawOpts.max_brief_words ?? 60);
  if (isSelf) { return { ok: false, dispatched: false, mode: 'BLOCKED_SELF_DISPATCH', matchReason, reason: '拦截自环派单 (gate1_noSelfDispatch = false)',
      targetConversation: matchedConv ? { conversationId: matchedConv.conversationId, windowTitle: matchedConv.windowTitle, status: matchedConv.status, roleTag: matchedConv.roleTag } : null,
      preflightGates, gates: preflightGates, workerSlots: slotStatus, sanitizedBrief, inboxDelivery: null, }; }
  const inboxRes = appendCrossProjectMemory({
    targetProjectRoot: resolvedProjectRoot, sourceProject: senderTitle || senderConversationId || '协同发起方',
    sourceConversationTitle: senderTitle, category: 'TASK_HANDOFF', title: taskTitle || '跨对话协同派单任务',
    content: taskInstructions, relatedFiles, status: 'PENDING', allowEngineSelfTest, dryRun });
  if (!inboxRes.ok) return inboxRes;
  const requestId = String(rawOpts.requestId || rawOpts.request_id || inboxRes.xmsgId);
  if (matchedConv && !rawOpts.forceRedeliver && hasDeliveredRequest(matchedConv.conversationId, requestId, recentHistory)) {
    return {
      ok: true, dispatched: false, deduplicatedDelivery: true, deliveryId: deliveryMessageId(requestId),
      mode: 'DEDUPLICATED_ALREADY_DELIVERED', matchReason, reason: '相同 requestId/xmsgId 已向目标窗口投递过，幂等跳过重复唤醒',
      targetConversation: { conversationId: matchedConv.conversationId, windowTitle: matchedConv.windowTitle, status: matchedConv.status, roleTag: matchedConv.roleTag },
      preflightGates, gates: preflightGates, workerSlots: slotStatus, sanitizedBrief, inboxDelivery: inboxRes,
    };
  }
  const allGatesPassed = Object.values(preflightGates).every(Boolean); if (!autoWake || dryRun || !allGatesPassed) {
    return { ok: true, dispatched: false, mode: dryRun ? 'DRY_RUN_VALIDATED' : !autoWake ? 'INBOX_ONLY_NO_WAKE' : !slotStatus.available ? 'INBOX_QUEUED_WORKER_SLOT_LIMIT' : 'INBOX_QUEUED_SAFE_DEGRADED',
      matchReason, reason: matchReason, targetConversation: matchedConv ? { conversationId: matchedConv.conversationId, windowTitle: matchedConv.windowTitle, status: matchedConv.status, roleTag: matchedConv.roleTag } : null,
      preflightGates, gates: preflightGates, workerSlots: slotStatus, sanitizedBrief, inboxDelivery: inboxRes, note: allGatesPassed
        ? '已写入目标项目 CROSS_INBOX.md 并通过全部 7 道安全门禁（预演/免唤醒模式未发送 RPC）'
        : !slotStatus.available
          ? `当前并发活跃工作窗口已达上限 (${slotStatus.usedSlots}/${slotStatus.effectiveMaxSlots})，为防止桌面端内存暴涨与 Lost connection 白屏，已安全排入目标项目 CROSS_INBOX.md 队列待命。`
          : '目标窗口不满足实时唤醒门禁（如正忙/处于弹窗等待/冷却期），已安全降级为「仅投递 CROSS_INBOX.md 收件箱」。', }; }
  const briefForWakeup = rawOpts.sanitizeBrief === false ? taskInstructions : sanitizedBrief;
  const lsConfig = await discoverLanguageServerConfig(); const wakeupMessage = [
    `📬 **【AGY Evo-OS 跨对话协同派单唤醒 (${inboxRes.xmsgId})】**`,
    `- **派单来源**：\`${senderTitle || senderConversationId || '兄弟对话窗口'}\``, `- **目标业务目录**：\`${resolvedProjectRoot}\``,
    `- **任务标题**：**${taskTitle}**`, `- **任务简报（完整上下文已落盘至 \`${inboxRes.inboxPath}\`）**：`,
    briefForWakeup, ``, `> 🛡️ **执行、弹窗发信与失败熔断回执守则（EVO-024 / EVO-025 / EVO-026）**：`,
    `> 1. 请先调用 \`memory_recall_for_task(project_root: "${resolvedProjectRoot}")\` 读取收件箱与防坑基因；`,
    `> 2. **【EVO-024 铁律】用户可能在床上休息看不到屏幕：若需调用 \`ask_question\` 弹窗请用户拍板，必须先通过 \`/usr/sbin/sendmail -t -oi\` 向 \`notify@example.com\` 发送「待回答提醒邮件」，再调用 \`ask_question\`！**`,
    `> 3. **成功回执**：任务完成后，将 \`${inboxRes.inboxPath}\` 中的 \`[${inboxRes.xmsgId}]\` 更新为 \`STATUS: ACKED\`，调用 \`swarm_report_to_commander\` 回传总控，并向 \`notify@example.com\` 发送完成通知邮件；`,
    `> 4. **失败兜底与诚实熔断（防静默失败）**：若执行中连续 2 次受阻或报错，严禁死循环重试！请立即将 \`[${inboxRes.xmsgId}]\` 更新为 \`STATUS: FAILED\`，调用 \`swarm_report_to_commander(status: "BLOCKED")\` 向总控回传，并通过 \`/usr/sbin/sendmail -t -oi\` 向 \`notify@example.com\` 发送熔断告警邮件。`,
  ].join('\n');
  _globalStartingReservations.set(matchedConv.conversationId, slotStatus.by);
  try {
    const highModel = await resolvePreferredHighModel(lsConfig, rawOpts.reasoningTier || rawOpts.reasoning_tier || 'HIGH');
    await callLanguageServerRpc(lsConfig, 'LoadTrajectory', { cascadeId: matchedConv.conversationId }).catch(() => {});
    let rpcRes = null;
    try {
      rpcRes = await callLanguageServerRpc(lsConfig, 'SendUserCascadeMessage', {
        cascadeId: matchedConv.conversationId,
        items: [{ text: wakeupMessage }],
        cascadeConfig: { plannerConfig: { requestedModel: { model: highModel } } },
      });
    } catch {
      const validSenderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(senderConversationId || '')
        ? senderConversationId
        : '00000000-0000-4000-8000-000000000000';
      rpcRes = await callLanguageServerRpc(lsConfig, 'SendAgentMessage', {
        recipient: matchedConv.conversationId, senderId: validSenderUuid,
        displayTitle: `📨 跨对话协同派单: ${taskTitle.slice(0, 40)}`, content: wakeupMessage, });
    }
    markDeliveredRequest(matchedConv.conversationId, requestId);
    ledger.history = [...recentHistory.slice(-40), { xmsgId: inboxRes.xmsgId, deliveryId: deliveryMessageId(requestId), senderCid: senderConversationId, senderTitle, targetCid: matchedConv.conversationId, targetTitle: matchedConv.windowTitle, timestampMs: nowMs, isoTime: new Date(nowMs).toISOString() }];
    for (const lp of [localLedgerPath, globalLedgerPath]) { try { fs.mkdirSync(path.dirname(lp), { recursive: true }); fs.writeFileSync(lp, JSON.stringify(ledger, null, 2) + '\n', 'utf8'); } catch {} }
    return { ok: true, dispatched: true, deliveryId: deliveryMessageId(requestId), mode: 'DISPATCHED_AND_WOKEN_UP', matchReason, reason: matchReason,
      targetConversation: { conversationId: matchedConv.conversationId, windowTitle: matchedConv.windowTitle, uiProjectNames: matchedConv.uiProjectNames, previousStatus: matchedConv.status, roleTag: matchedConv.roleTag, modelId: highModel },
      preflightGates, gates: preflightGates, workerSlots: slotStatus, sanitizedBrief, inboxDelivery: inboxRes, rpcResponse: rpcRes, };
  } catch (err) { return { ok: true, dispatched: false, mode: 'INBOX_SAVED_RPC_FALLBACK', matchReason, reason: matchReason,
      preflightGates, gates: preflightGates, workerSlots: slotStatus, sanitizedBrief, inboxDelivery: inboxRes, rpcError: err.message,
      note: '跨项目记忆已安全落盘至目标项目 CROSS_INBOX.md，但实时唤醒 RPC 失败，目标对话将在下次激活时自动读取收件箱。', };
  } finally {
    _globalStartingReservations.delete(matchedConv.conversationId);
  } }
export async function swarmSpawnOrRouteByName(rawOpts = {}) {
  const moduleName = String(rawOpts.moduleName || rawOpts.module_name || '').trim();
  const rawProjectRoot = rawOpts.projectRoot || rawOpts.project_root || '';
  const taskTitle = String(rawOpts.taskTitle || rawOpts.task_title || '').trim();
  const taskPrompt = String(rawOpts.taskPrompt || rawOpts.task_prompt || '').trim();
  const commanderId = String(rawOpts.commanderId || rawOpts.commander_id || process.env.CONVERSATION_ID || '').trim();
  const autoCreateIfMissing = Boolean(rawOpts.autoCreateIfMissing ?? rawOpts.auto_create_if_missing ?? false);
  const autoWake = rawOpts.autoWake !== undefined || rawOpts.auto_wake !== undefined ? Boolean(rawOpts.autoWake ?? rawOpts.auto_wake) : true;
  const dryRun = Boolean(rawOpts.dryRun ?? rawOpts.dry_run ?? false);
  const allowEngineSelfTest = Boolean(rawOpts.allowEngineSelfTest ?? rawOpts.allow_engine_self_test ?? false);
  if (!moduleName || !rawProjectRoot || !taskTitle || !taskPrompt) return { ok: false, error: '⚠️ 参数缺失：module_name、project_root、task_title、task_prompt 均不能为空！' };
  const projectRoot = resolveCanonicalProjectRoot(rawProjectRoot);
  if (isContainerOrMotherDir(projectRoot, allowEngineSelfTest)) return { ok: false, error: `⚠️ 路径隔离拦截：project_root (${projectRoot}) 是容器目录或母版库，必须指定具体业务模块根目录！` };
  if (!allowEngineSelfTest && !hasRealProjectFiles(projectRoot)) return { ok: false, error: `⚠️ 空壳目录拦截：project_root (${projectRoot}) 不存在或无真实业务代码文件！` };
  const specialistTitle = `🧩 [板块:${moduleName}] 工作节点`;
  const topology = await discoverAntigravityProjectsAndConversations();
  const reg = readSwarmRegistry(); const modLower = moduleName.toLowerCase();
  const regEntry = reg.specialists?.[moduleName] || Object.values(reg.specialists || {}).find((s) => String(s.moduleName || '').toLowerCase() === modLower);
  let matchedConv = regEntry?.conversationId ? topology.mainConversations.find((c) => c.conversationId === regEntry.conversationId || c.conversationId.startsWith(regEntry.conversationId)) : null;
  if (!matchedConv) matchedConv = topology.mainConversations.find((c) => (c.specialistModule && c.specialistModule.toLowerCase() === modLower) || c.windowTitle.toLowerCase().includes(`[板块:${modLower}]`) || c.windowTitle.toLowerCase().includes(modLower));
  const effectiveCommanderId = commanderId || topology.mainConversations.find((c) => c.status === 'CASCADE_RUN_STATUS_RUNNING' && !c.specialistModule)?.conversationId || '';
  const sanitizedPrompt = sanitizeRoutingBrief(taskPrompt, rawOpts.maxBriefWords ?? rawOpts.max_brief_words ?? 60);
  const fullInstructions = [
    `👑 **【AGY Swarm Commander 具名领域工作会话任务指派】**`,
    `- **工作会话席位**：\`${specialistTitle}\` | **负责业务目录**：\`${projectRoot}\``,
    `- **总控会话标识**：\`${effectiveCommanderId || '总控调度器窗口'}\` | **任务标题**：**${taskTitle}**`,
    `- **详细指令**：\n${taskPrompt}`,
    `> 🛡️ **【EVO-027 工作节点强制自审与找 Bug 第一道门禁 & EVO-028 防爆上下文铁律】**：`,
    `> 1. **自审看片/看图（严禁盲交）**：凡生成视频、音频、图片或修改 UI/后端逻辑，工作节点在向总控汇报前**必须亲自审验产物并主动找 Bug**！`,
    `> 2. **防上下文溢出（EVO-028）**：严禁对 \`.mp4\` 大体积视频直接调用 \`read_file\`（会触发 \`This conversation grew too large\` 撑爆上下文）；审片必须先用 \`ffmpeg\` 抽取多时间点（如 0.5s/2.5s/4.5s/6.5s）拼成单张 \`.png\` 抽帧预览图 + \`ffprobe\` 音轨检查，再对 \`.png\` 调用 \`read_file\` 逐帧验真！`,
    `> 3. **内容与审美红线**：① 严禁拿无关缓存视频冒充目标主题（如赶海视频必须是真实海滩/礁石抓海鲜，绝不允许出现教堂/室内等离谱画面）；② 严禁塑料蜡像感 AI 假人底图，必须具备真实实拍质感；③ **带货视频只允许「正常背景音乐 BGM + 真实人物旁白」，严禁乱加杂乱卖点音效**（仅赶海标价签视频在抓获弹价格瞬间配 \`收银声.mp3\`）；④ UI 严禁外露内部技术代号（如 MOD-01/motion-studio）或残留过时文案。发现任何问题必须内部返工修好后再上报！`,
    `> 🔄 **领域工作会话闭环守则（EVO-026）**：自审 100% 通过后，请调用 \`swarm_report_to_commander(commander_conversation: "${effectiveCommanderId || '总控'}", from_module_name: "${moduleName}", from_project_root: "${projectRoot}", task_title: "${taskTitle}", status: "DONE", summary: "...", verification_evidence: "含自审抽帧图/截图路径与自查修复的Bug清单")\` 向总控呈交异步回执。`,
  ].join('\n');
  if (matchedConv && autoCreateIfMissing) {
    try {
      const mPath = path.join(BRAIN_DIR, matchedConv.conversationId, '.system_generated/logs/transcript.jsonl');
      if (Boolean(rawOpts.forceNewWindow ?? rawOpts.force_new_window) || (fs.existsSync(mPath) && fs.statSync(mPath).size > 15 * 1024 * 1024)) {
        matchedConv = null; // EVO-038: 工作会话窗口超过 15MB 水位或显式要求新窗时自动退休换新窗
      }
    } catch {}
  }
  if (matchedConv) {
    if (!dryRun) updateSwarmRegistry((r) => { r.specialists[moduleName] = { moduleName, specialistTitle: matchedConv.windowTitle, conversationId: matchedConv.conversationId, projectRoot, commanderId: effectiveCommanderId || regEntry?.commanderId || null, updatedAt: new Date().toISOString(), lastTaskTitle: taskTitle }; });
    const dispatchRes = await dispatchTaskToConversation({ targetConversationId: matchedConv.conversationId, targetConversationTitle: matchedConv.windowTitle, targetProjectRoot: projectRoot, senderConversationId: effectiveCommanderId, senderTitle: '👑 总控调度器 (Swarm Commander)', taskTitle: `[板块:${moduleName}] ${taskTitle}`, taskInstructions: fullInstructions, autoWake, dryRun, allowEngineSelfTest, reasoningTier: rawOpts.reasoningTier || rawOpts.reasoning_tier || 'HIGH', fromPerson: rawOpts.fromPerson ?? rawOpts.from_person, priorityWake: rawOpts.priorityWake ?? rawOpts.priority_wake, sanitizeBrief: false });
    return { ok: dispatchRes.ok, action: 'ROUTED_TO_EXISTING_SPECIALIST', moduleName, specialistTitle: matchedConv.windowTitle, conversationId: matchedConv.conversationId, projectRoot, autoCreated: false, dryRun, sanitizedBrief: sanitizedPrompt, dispatchResult: dispatchRes };
  }
  const inboxRes = appendCrossProjectMemory({ targetProjectRoot: projectRoot, sourceProject: `👑 总控调度器 (${effectiveCommanderId || 'SwarmCommander'})`, category: 'SWARM_SPECIALIST_TASK', title: `[板块:${moduleName}] ${taskTitle}`, content: fullInstructions, status: 'PENDING', allowEngineSelfTest, dryRun });
  if (!inboxRes.ok) return inboxRes;
  if (!autoCreateIfMissing) return { ok: true, action: 'QUEUED_IN_INBOX_AWAITING_SPECIALIST', moduleName, specialistTitle, conversationId: null, projectRoot, autoCreated: false, dryRun, sanitizedBrief: sanitizedPrompt, inboxDelivery: inboxRes, note: '未检索到同名领域工作会话窗口且 auto_create_if_missing=false，已写入目标项目 CROSS_INBOX.md 待命。' };
  const launchSlotStatus = evaluateWorkerSlotAvailability(topology, {
    senderConversationId: effectiveCommanderId,
    fromPerson: rawOpts.fromPerson ?? rawOpts.from_person,
    priorityWake: rawOpts.priorityWake ?? rawOpts.priority_wake,
    by: (rawOpts.fromPerson ?? rawOpts.from_person ?? rawOpts.priorityWake ?? rawOpts.priority_wake) ? 'person' : 'launch',
    maxWorkers: rawOpts.maxActiveWorkers ?? rawOpts.max_active_workers,
  });
  if (!launchSlotStatus.available && !dryRun) {
    return {
      ok: true, action: 'QUEUED_IN_INBOX_WORKER_SLOT_LIMIT', moduleName, specialistTitle, conversationId: null,
      projectRoot, autoCreated: false, dryRun: false, workerSlots: launchSlotStatus, sanitizedBrief: sanitizedPrompt, inboxDelivery: inboxRes,
      note: `当前并发活跃工作窗口已达槽位上限 (${launchSlotStatus.usedSlots}/${launchSlotStatus.effectiveMaxSlots})，为避免同时拉起过多窗口触发 Lost connection 白屏，已将任务排入 ${inboxRes.inboxPath} 队列待命。`,
    };
  }
  const matchedUiProject = (topology.uiProjects || []).find((up) => up.mountedFolders.some((mf) => projectRoot === mf))
    || (topology.uiProjects || []).find((up) => up.mountedFolders.some((mf) => projectRoot.startsWith(mf + '/')));
  if (dryRun) return { ok: true, action: 'DRY_RUN_WOULD_SPAWN_SPECIALIST', moduleName, specialistTitle, conversationId: 'dry-run-cascade-id', projectRoot, autoCreated: false, dryRun: true, workerSlots: launchSlotStatus, sanitizedBrief: sanitizedPrompt, inboxDelivery: inboxRes, rpcPlan: { step1: 'StartCascade', step2: 'UpdateConversationAnnotations', step3: autoWake ? 'SendAgentMessage' : 'SKIP_WAKE', source: 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT', projectId: matchedUiProject?.id || null, workspaceUris: [`file://${projectRoot}`], title: specialistTitle } };
  const lsConfig = await discoverLanguageServerConfig();
  if (!lsConfig) return { ok: true, action: 'INBOX_SAVED_LS_UNAVAILABLE', moduleName, specialistTitle, conversationId: null, projectRoot, autoCreated: false, dryRun: false, workerSlots: launchSlotStatus, sanitizedBrief: sanitizedPrompt, inboxDelivery: inboxRes };
  const reserveKey = `spawn:${moduleName}`;
  _globalStartingReservations.set(reserveKey, launchSlotStatus.by);
  try {
    const highModel = await resolvePreferredHighModel(lsConfig, rawOpts.reasoningTier || rawOpts.reasoning_tier || 'HIGH');
    // EVO-031: StartCascade 中不可同时指定 workspaceUris 与 projectEnvConfig；优先使用 projectEnvConfig 绑定左边栏 Projects 树！
    const startPayload = matchedUiProject?.id
      ? { source: 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT', projectEnvConfig: { projectId: matchedUiProject.id, defaultProjectEnvironment: {} } }
      : { source: 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT', workspaceUris: [`file://${projectRoot}`] };
    const startRes = await callLanguageServerRpc(lsConfig, 'StartCascade', startPayload);
    const newCid = startRes?.cascadeId || null; let initialMessageSent = false;
    if (newCid) {
      try { await callLanguageServerRpc(lsConfig, 'UpdateConversationAnnotations', { cascadeId: newCid, annotations: { title: specialistTitle }, mergeAnnotations: true }); } catch {}
      if (autoWake) {
        try {
          await callLanguageServerRpc(lsConfig, 'SendUserCascadeMessage', {
            cascadeId: newCid,
            items: [{ text: fullInstructions }],
            cascadeConfig: { plannerConfig: { requestedModel: { model: highModel } } },
          });
          initialMessageSent = true;
        } catch {
          try { await callLanguageServerRpc(lsConfig, 'SendAgentMessage', { recipient: newCid, senderId: effectiveCommanderId || '00000000-0000-4000-8000-000000000000', displayTitle: `👑 领域工作会话首任务: ${taskTitle.slice(0, 36)}`, content: fullInstructions }); initialMessageSent = true; } catch {}
        }
        if (initialMessageSent) markDeliveredRequest(newCid, inboxRes.xmsgId);
      }
      const nowIso = new Date().toISOString();
      updateSwarmRegistry((r) => { r.specialists[moduleName] = { moduleName, specialistTitle, conversationId: newCid, projectRoot, commanderId: effectiveCommanderId || null, createdAt: nowIso, updatedAt: nowIso, lastTaskTitle: taskTitle, modelId: highModel }; });
    }
    return { ok: true, action: 'SPAWNED_NEW_SPECIALIST_CONVERSATION', moduleName, specialistTitle, conversationId: newCid, projectRoot, autoCreated: Boolean(newCid), initialMessageSent, modelId: highModel, dryRun: false, workerSlots: launchSlotStatus, sanitizedBrief: sanitizedPrompt, inboxDelivery: inboxRes, rpcResponse: startRes };
  } catch (err) {
    return { ok: true, action: 'INBOX_SAVED_SPAWN_FALLBACK', moduleName, specialistTitle, conversationId: null, projectRoot, autoCreated: false, dryRun: false, workerSlots: launchSlotStatus, sanitizedBrief: sanitizedPrompt, inboxDelivery: inboxRes, rpcError: err.message };
  } finally {
    _globalStartingReservations.delete(reserveKey);
  }
}
export async function swarmReportToCommander(rawOpts = {}) {
  const commanderConversation = String(rawOpts.commanderConversation || rawOpts.commander_conversation || '').trim();
  const fromModuleName = String(rawOpts.fromModuleName || rawOpts.from_module_name || '').trim();
  const rawFromProjectRoot = rawOpts.fromProjectRoot || rawOpts.from_project_root || '';
  const taskTitle = String(rawOpts.taskTitle || rawOpts.task_title || '').trim();
  const rawStatus = String(rawOpts.status || 'DONE').trim().toUpperCase();
  const summary = String(rawOpts.summary || '').trim();
  const verificationEvidence = String(rawOpts.verificationEvidence || rawOpts.verification_evidence || '').trim();
  const mintedLaborAssets = String(rawOpts.mintedLaborAssets || rawOpts.minted_labor_assets || '').trim();
  const dryRun = Boolean(rawOpts.dryRun ?? rawOpts.dry_run ?? false);
  if (!commanderConversation || !fromModuleName || !rawFromProjectRoot || !taskTitle || !summary) return { ok: false, error: '⚠️ 参数缺失：commander_conversation, from_module_name, from_project_root, task_title, summary 均不能为空！' };
  let status = rawStatus;
  const doneAliases = ['DONE', 'COMPLETED', 'COMPLETE', 'SUCCESS', 'SUCCEEDED', 'FINISHED', 'RESOLVED', 'PASS', 'PASSED', 'OK'];
  const blockedAliases = ['BLOCKED', 'BLOCK', 'BLOCKING', 'STUCK', 'FAILED', 'FAILURE', 'ERROR'];
  const decisionAliases = ['NEEDS_DECISION', 'DECISION', 'NEED_DECISION', 'PENDING_DECISION', 'WAITING_DECISION'];
  if (doneAliases.includes(status)) status = 'DONE';
  else if (blockedAliases.includes(status)) status = 'BLOCKED';
  else if (decisionAliases.includes(status)) status = 'NEEDS_DECISION';
  else return { ok: false, error: `⚠️ 非法状态值 (${rawStatus})：status 必须为 DONE | BLOCKED | NEEDS_DECISION 之一（已支持 COMPLETED/SUCCESS/STUCK 等常用别名）！` };
  const fromProjectRoot = resolveCanonicalProjectRoot(rawFromProjectRoot);
  const topology = await discoverAntigravityProjectsAndConversations(); const reg = readSwarmRegistry(); const q = commanderConversation.toLowerCase();
  const allConvs = [...topology.mainConversations, ...topology.subagentConversations];
  let matchedCommander = allConvs.find((c) => c.conversationId === commanderConversation || c.conversationId.startsWith(commanderConversation) || (c.windowTitle && c.windowTitle.toLowerCase().includes(q)));
  if (!matchedCommander && (['总控', '总控调度器窗口', '总控会话工作台', 'commander', 'swarmcommander'].includes(q) || reg.specialists?.[fromModuleName]?.commanderId || reg.masterCommander?.conversationId)) {
    const fallbackCid = reg.specialists?.[fromModuleName]?.commanderId || reg.masterCommander?.conversationId;
    if (fallbackCid) matchedCommander = allConvs.find((c) => c.conversationId === fallbackCid || c.conversationId.startsWith(fallbackCid));
    if (!matchedCommander) matchedCommander = topology.mainConversations.find((c) => /\[总控|Swarm Commander/i.test(c.windowTitle)) || topology.mainConversations.find((c) => !c.specialistModule && !c.isPeriodicLogger) || topology.mainConversations[0] || null;
  }
  const ackHash = crypto.createHash('sha256').update(`${fromModuleName}|${fromProjectRoot}|${taskTitle}|${status}|${summary.slice(0, 160)}`).digest('hex').slice(0, 10).toUpperCase();
  const ackId = `SACK-${ackHash}`; const nowIso = new Date().toISOString();
  const reportEntry = { ackId, channel: 'SWARM_ACK', commanderConversation, resolvedCommanderId: matchedCommander?.conversationId || null, resolvedCommanderTitle: matchedCommander?.windowTitle || null, fromModuleName, fromProjectRoot, taskTitle, status, summary, verificationEvidence: verificationEvidence || '未附带额外证据', mintedLaborAssets: mintedLaborAssets || '无新增资产', reportedAt: nowIso };
  const bypassedGates = ['CONTAINER_DIR_WRITE_GUARD (允许总控挂载容器目录)', 'GATE2_PING_PONG_INTERCEPT (允许工作节点反向回传总控)', 'GATE3_60S_COOLDOWN (任务回执免冷却直达)', 'GATE4_TARGET_IDLE_ONLY (总控运行或空闲均支持异步压栈)'];
  if (dryRun) return { ok: true, dryRun: true, channel: 'SWARM_ACK', ackId, status, fromModuleName, fromProjectRoot, commanderTarget: matchedCommander ? { conversationId: matchedCommander.conversationId, windowTitle: matchedCommander.windowTitle, status: matchedCommander.status } : { rawQuery: commanderConversation }, bypassedGates, reportEntry, messageSent: false };
  updateSwarmRegistry((r) => {
    r.commanderReports = [reportEntry, ...(r.commanderReports || []).filter((item) => item.ackId !== ackId)].slice(0, 50);
    if (r.specialists?.[fromModuleName]) { r.specialists[fromModuleName].lastStatus = status; r.specialists[fromModuleName].lastReportAt = nowIso; }
  });
  const explicitAckIds = Array.isArray(rawOpts.ackXmsgIds || rawOpts.ack_xmsg_ids)
    ? (rawOpts.ackXmsgIds || rawOpts.ack_xmsg_ids).map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  const textToScan = `${taskTitle} ${summary} ${verificationEvidence}`;
  const extractedXmsgs = [...textToScan.matchAll(/XMSG-[A-Z0-9]{8,12}/gi)].map((m) => m[0].toUpperCase());
  const allAckIds = [...new Set([...explicitAckIds, ...extractedXmsgs])];
  const autoAckedMessages = [];
  if (!dryRun && allAckIds.length > 0) {
    for (const xid of allAckIds) {
      try {
        const ackRes = ackCrossProjectMemory({ projectRoot: fromProjectRoot, xmsgId: xid, status: 'ACKED', allowEngineSelfTest: Boolean(rawOpts.allowEngineSelfTest) });
        if (ackRes.ok) autoAckedMessages.push({ xmsgId: xid, ok: true, previousStatus: ackRes.previousStatus });
      } catch {}
    }
  }
  if (!isContainerOrMotherDir(fromProjectRoot, false) && hasRealProjectFiles(fromProjectRoot)) {
    try { appendCrossProjectMemory({ targetProjectRoot: fromProjectRoot, sourceProject: `🧩 [板块:${fromModuleName}] 工作节点`, category: 'SWARM_ACK', title: `[任务回执:${status}] ${taskTitle}`, content: `${summary}\n- 验证证据: ${verificationEvidence || '已验证'}\n- 新增生产力资产: ${mintedLaborAssets || '无'}`, status: status === 'DONE' ? 'ACKED' : 'PENDING' }); } catch {}
  }
  let messageSent = false; let rpcError = null;
  if (matchedCommander && !matchedCommander.pendingAskQuestion) {
    const lsConfig = await discoverLanguageServerConfig();
    if (lsConfig) {
      const msgBody = [`🎖️ **【AGY Swarm 领域工作会话异步回执回传 (${ackId})】**`, `- **汇报工作节点**：\`🧩 [板块:${fromModuleName}] 工作节点\` (\`${fromProjectRoot}\`)`, `- **任务标题**：**${taskTitle}** | **执行状态**：\`${status}\``, `- **核心战果摘要**：\n${summary}`, verificationEvidence ? `- **真机验证证据**：${verificationEvidence}` : null, mintedLaborAssets ? `- **新铸造生产力资产**：${mintedLaborAssets}` : null, autoAckedMessages.length > 0 ? `- **自动核销任务消息**：${autoAckedMessages.map((m) => `\`${m.xmsgId}\``).join(', ')}` : null, `> 🚨 **【EVO-027 总控法医级复核与拦截第二道门禁】**：总控收到此任务回执后，**严禁未经复核直接向用户报喜**！必须亲自查看截图/视频抽帧 PNG（严禁直接对 .mp4 调 read_file 防 EVO-028 撑爆上下文）并主动挑刺找 Bug（查画面是否货对板、有无 AI 塑料假人感、带货音频是否纯净无杂乱音效、UI 有无文案矛盾或模糊）。一旦发现任何瑕疵，**必须当场拦截并打回工作节点重做**，100% 合格后方可向用户汇报！`].filter(Boolean).join('\n');
      try { await callLanguageServerRpc(lsConfig, 'SendAgentMessage', { recipient: matchedCommander.conversationId, senderId: `swarm-specialist-${fromModuleName}`, displayTitle: `🎖️ [板块:${fromModuleName}] 任务回执 (${status}): ${taskTitle.slice(0, 32)}`, content: msgBody }); messageSent = true; } catch (e) { rpcError = e.message; }
    }
  }
  return { ok: true, dryRun: false, channel: 'SWARM_ACK', ackId, status, fromModuleName, fromProjectRoot, commanderTarget: matchedCommander ? { conversationId: matchedCommander.conversationId, windowTitle: matchedCommander.windowTitle, status: matchedCommander.status } : { rawQuery: commanderConversation }, bypassedGates, reportEntry, registryPath: SWARM_REGISTRY_PATH, messageSent, rpcError, autoAckedMessages };
}
export async function getSwarmStatusBoard(rawOpts = {}) {
  const includeSubagents = rawOpts.includeSubagents !== undefined || rawOpts.include_subagents !== undefined ? Boolean(rawOpts.includeSubagents ?? rawOpts.include_subagents) : true;
  const requestedRoots = Array.isArray(rawOpts.projectRoots || rawOpts.project_roots) ? (rawOpts.projectRoots || rawOpts.project_roots).map((r) => resolveCanonicalProjectRoot(r)).filter(Boolean) : [];
  const topology = await discoverAntigravityProjectsAndConversations(); const reg = readSwarmRegistry();
  const specialistWindows = topology.mainConversations.filter((c) => Boolean(c.specialistModule) || /\[板块:/.test(c.windowTitle));
  const commanderCandidate = topology.mainConversations.find((c) => (reg.masterCommander?.conversationId && c.conversationId === reg.masterCommander.conversationId) || /\[总控|Swarm Commander/i.test(c.windowTitle)) || topology.mainConversations.find((c) => !c.specialistModule && !c.isPeriodicLogger) || topology.mainConversations[0] || null;
  const targetDirs = requestedRoots.length > 0 ? requestedRoots : [SOURCE_OS_DIR, ...topology.businessProjects.map((bp) => bp.projectRoot)];
  const projectMultipliers = [...new Set(targetDirs)].filter((d) => fs.existsSync(d)).slice(0, 15).map((dir) => {
    const metricsFile = path.join(dir, 'memory', '.memory-store', 'evolution-metrics.json'); let lf = null;
    try { if (fs.existsSync(metricsFile)) lf = JSON.parse(fs.readFileSync(metricsFile, 'utf8')).currentSnapshot?.laborForceMetrics || null; } catch {}
    return { projectRoot: dir, projectName: path.basename(dir), laborForceMetrics: lf };
  });
  const activeSpecialistsCount = Math.max(Object.keys(reg.specialists || {}).length, specialistWindows.length);
  const workerSlots = evaluateWorkerSlotAvailability(topology, {
    senderConversationId: commanderCandidate?.conversationId || '',
    maxWorkers: rawOpts.maxActiveWorkers ?? rawOpts.max_active_workers,
  });
  return {
    ok: true, architecture: '1_COMMANDER + N_NAMED_MODULE_CONVERSATIONS + M_SUBAGENTS', lsConnected: topology.lsConnected, swarmRegistryPath: SWARM_REGISTRY_PATH,
    commanderWindow: commanderCandidate ? { conversationId: commanderCandidate.conversationId, windowTitle: commanderCandidate.windowTitle, status: commanderCandidate.status, roleTag: commanderCandidate.roleTag } : null,
    workerSlots,
    namedSpecialistWindows: specialistWindows.map((c) => ({ conversationId: c.conversationId, windowTitle: c.windowTitle, moduleName: c.specialistModule, status: c.status, stepCount: c.stepCount, activeSubprojects: c.activeSubprojects })),
    registeredSpecialists: Object.values(reg.specialists || {}), allMainConversations: topology.mainConversations.map((c) => ({ conversationId: c.conversationId, windowTitle: c.windowTitle, specialistModule: c.specialistModule, status: c.status, roleTag: c.roleTag, stepCount: c.stepCount })),
    inSessionSubagents: includeSubagents ? topology.subagentConversations : [], counts: { commanderCount: commanderCandidate ? 1 : 0, mainConversationsCount: topology.mainConversations.length, namedSpecialistsCount: activeSpecialistsCount, subagentsCount: topology.subagentConversations.length, recentReportsCount: (reg.commanderReports || []).length, activeRunningWorkersCount: workerSlots.usedSlots, maxActiveWorkerWindows: workerSlots.maxActiveWorkerWindows },
    recentCommanderReports: (reg.commanderReports || []).slice(0, 15), projectLaborMultipliers: projectMultipliers,
  };
}
if (import.meta.url === `file://${process.argv[1]}`) { const cmd = process.argv[2] || 'discover';
  if (cmd === 'discover') discoverAntigravityProjectsAndConversations().then((res) => console.log(JSON.stringify(res, null, 2)));
  else if (cmd === 'swarm') getSwarmStatusBoard().then((res) => console.log(JSON.stringify(res, null, 2)));
  else if (cmd === 'ack') console.log(JSON.stringify(ackCrossProjectMemory({ projectRoot: process.argv[3], xmsgId: process.argv[4], status: process.argv[5] || 'ACKED' }), null, 2)); }
