#!/usr/bin/env node
/**
 * Mac 系统磁盘定时监控、日志轮转与缓存清理守护脚本 (Mac Disk Guardian)
 * 每 5 分钟由 launchd 自动巡检一次 APFS 数据卷 (/System/Volumes/Data) 可用空间与使用率：
 * 【硬性安全边界（防 macOS TCC 弹窗阻塞）】：
 * - 本脚本由 launchd 直接调用 `/opt/homebrew/bin/node` 执行，严禁访问或扫描 `~/Downloads`、`~/Documents`、`~/Desktop` 等 macOS TCC 受保护目录！
 * - 仅允许读写与清理 `~/.gemini/`、`~/Library/`、`~/.npm/`、`/tmp/`、`/private/var/folders/` 等免 TCC 授权的系统/应用缓存目录。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const HOME = os.homedir();
const LOG_FILE = path.join(HOME, '.gemini/antigravity/mac_disk_guardian.log');
const STDOUT_LOG_FILE = path.join(HOME, '.gemini/antigravity/mac_disk_guardian_stdout.log');
const STDERR_LOG_FILE = path.join(HOME, '.gemini/antigravity/mac_disk_guardian_stderr.log');
const STATE_FILE = path.join(HOME, '.gemini/antigravity/mac_disk_guardian_state.json');

const THRESHOLD_GB = 25.0;
const MAX_USAGE_PCT = 85.0;
const WAL_CHECKPOINT_THRESHOLD_BYTES = 1024 * 1024; // 1 MB
const FEISHU_CHAT_ID = 'oc_your_feishu_chat_id';
const NOTIFY_EMAIL = 'notify@example.com';

// 仅管理非 TCC 保护目录 (~/.gemini 与 ~/Library/Logs) 下的日志文件，绝不触碰 ~/Downloads
const MANAGED_LOG_FILES = [
  { filePath: LOG_FILE, maxBytes: 512 * 1024, keepBytes: 256 * 1024 },
  { filePath: STDOUT_LOG_FILE, maxBytes: 512 * 1024, keepBytes: 256 * 1024 },
  { filePath: STDERR_LOG_FILE, maxBytes: 512 * 1024, keepBytes: 256 * 1024 },
  {
    filePath: path.join(HOME, 'Library/Logs/openclaw/gateway.log'),
    maxBytes: 5 * 1024 * 1024,
    keepBytes: 2 * 1024 * 1024,
  },
];

function getRootDiskStats() {
  const targetMount = fs.existsSync('/System/Volumes/Data') ? '/System/Volumes/Data' : '/';
  const out = execSync(`df -k "${targetMount}"`, { encoding: 'utf8' });
  const lines = out.trim().split('\n');
  const parts = lines[lines.length - 1].trim().split(/\s+/);
  const totalKb = Number(parts[1] || 0);
  const availKb = Number(parts[3] || 0);
  const totalGb = Number((totalKb / 1024 / 1024).toFixed(2));
  const availGb = Number((availKb / 1024 / 1024).toFixed(2));
  const usedGb = Number(Math.max(0, totalGb - availGb).toFixed(2));
  const usedPct = totalGb > 0 ? Number(((usedGb / totalGb) * 100).toFixed(1)) : 0;
  const capacityStr = `${usedPct}%`;
  return { totalGb, usedGb, availGb, usedPct, capacityStr };
}

function truncateFileIfExceeds(filePath, maxBytes, keepBytes) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const st = fs.statSync(filePath);
    if (st.size <= maxBytes) return false;
    const fd = fs.openSync(filePath, 'r');
    let tailBuf;
    try {
      const readLen = Math.min(st.size, keepBytes);
      const offset = Math.max(0, st.size - readLen);
      tailBuf = Buffer.allocUnsafe(readLen);
      fs.readSync(fd, tailBuf, 0, readLen, offset);
    } finally {
      try { fs.closeSync(fd); } catch {}
    }
    const text = tailBuf.toString('utf8');
    const firstNewline = text.indexOf('\n');
    const cleanTail = firstNewline >= 0 ? text.slice(firstNewline + 1) : text;
    fs.writeFileSync(filePath, cleanTail, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function rotateDaemonLogs() {
  const rotated = [];
  for (const item of MANAGED_LOG_FILES) {
    if (truncateFileIfExceeds(item.filePath, item.maxBytes, item.keepBytes)) {
      rotated.push(path.basename(item.filePath));
    }
  }
  return rotated;
}

function appendLog(line) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    truncateFileIfExceeds(LOG_FILE, 512 * 1024, 256 * 1024);
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`, 'utf8');
  } catch {}
}

// 仅收敛 ~/.gemini 下的 SQLite WAL，严禁在 launchd 中触碰 ~/Downloads
function checkpointNonTccSqliteWals(minWalBytes = WAL_CHECKPOINT_THRESHOLD_BYTES) {
  const pluginDb = path.join(HOME, '.gemini/config/plugins/agy-evo-os/memory/.memory-store/memory.sqlite');
  const results = [];
  let reclaimedBytes = 0;
  for (const dbFile of [pluginDb]) {
    if (!fs.existsSync(dbFile)) continue;
    const walFile = `${dbFile}-wal`;
    try {
      const walSizeBefore = fs.existsSync(walFile) ? fs.statSync(walFile).size : 0;
      if (walSizeBefore < minWalBytes) continue;
      const db = new DatabaseSync(dbFile);
      try {
        db.exec('PRAGMA busy_timeout = 5000;');
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } finally {
        try { db.close(); } catch {}
      }
      const walSizeAfter = fs.existsSync(walFile) ? fs.statSync(walFile).size : 0;
      const saved = Math.max(0, walSizeBefore - walSizeAfter);
      reclaimedBytes += saved;
      results.push({
        target: 'agy-evo-os-plugin',
        walSizeBefore,
        walSizeAfter,
        reclaimedBytes: saved,
      });
    } catch {}
  }
  return { count: results.length, reclaimedBytes, details: results };
}

function runSafeCleanup() {
  const actions = [];
  // 严禁在 launchd 清理命令中扫描 ~/Downloads、~/Documents 或 ~/Desktop
  const cmds = [
    {
      name: '清理 Xcode/系统签名超时克隆残留 (code_sign_clone)',
      cmd: 'find /private/var/folders -name "*code_sign_clone*" -mmin +30 -exec rm -rf {} + 2>/dev/null || true',
    },
    {
      name: '清理 /tmp 超过60分钟的临时渲染与中转文件',
      cmd: 'find /tmp -maxdepth 2 \\( -name "SoloLab_transit_*.mp4" -o -name "prov_*.db*" -o -name "frames_*" \\) -mmin +60 -exec rm -rf {} + 2>/dev/null || true',
    },
    {
      name: '清理 npm / pip / Homebrew 临时下载缓存',
      cmd: 'rm -rf ~/.npm/_cacache/tmp/* ~/Library/Caches/pip/http-v2/* 2>/dev/null || true',
    },
  ];

  for (const item of cmds) {
    try {
      execSync(item.cmd, { stdio: 'ignore', timeout: 30000 });
      actions.push(item.name);
    } catch {}
  }
  const walRes = checkpointNonTccSqliteWals(1);
  if (walRes.count > 0) {
    actions.push(`收敛 ~/.gemini 插件 SQLite WAL 日志`);
  }
  return actions;
}

function sendFeishuAlert(text) {
  return new Promise((resolve) => {
    try {
      const body = JSON.stringify({ chatId: FEISHU_CHAT_ID, text });
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 18910,
          path: '/send-feishu',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 5000,
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve(true));
        }
      );
      req.on('error', () => resolve(false));
      req.write(body);
      req.end();
    } catch {
      resolve(false);
    }
  });
}

function sendEmailAlert(subject, bodyText) {
  try {
    const mail = [
      `To: ${NOTIFY_EMAIL}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      bodyText,
    ].join('\n');
    execSync('/usr/sbin/sendmail -t -oi', { input: mail, timeout: 8000 });
  } catch {}
}

async function main() {
  const rotatedLogs = rotateDaemonLogs();
  const walCheck = checkpointNonTccSqliteWals(WAL_CHECKPOINT_THRESHOLD_BYTES);
  const before = getRootDiskStats();
  const forceTest = process.argv.includes('--status');

  let state = {};
  try {
    if (fs.existsSync(STATE_FILE)) state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {}

  const isLowDisk = before.usedPct >= MAX_USAGE_PCT || before.availGb < THRESHOLD_GB;

  if (isLowDisk) {
    const actions = runSafeCleanup();
    const after = getRootDiskStats();
    const freedGb = Number(Math.max(0, after.availGb - before.availGb).toFixed(2));
    const msg = `⚠️ [Mac 磁盘自动巡检与清理通知]\n检测到磁盘使用率达 ${before.capacityStr}（可用空间：${before.availGb} GB，触发阈值：使用率>=${MAX_USAGE_PCT}% 或 可用<${THRESHOLD_GB}GB）。\n已自动执行无损缓存清理，释放 ${freedGb} GB 空间，当前可用空间：${after.availGb} GB（真实占用率 ${after.capacityStr}）。`;
    appendLog(
      `ALERT_CLEANUP: beforeAvail=${before.availGb}GB(${before.capacityStr}) afterAvail=${after.availGb}GB(${after.capacityStr}) freed=${freedGb}GB actions=${actions.length}`
    );
    await sendFeishuAlert(msg);
    sendEmailAlert(`[Mac磁盘守护] 自动清理完成 (当前可用 ${after.availGb} GB / 占用 ${after.capacityStr})`, msg);
    state = {
      lastCheckAt: new Date().toISOString(),
      status: 'cleaned',
      beforeAvailGb: before.availGb,
      afterAvailGb: after.availGb,
      freedGb,
      usedGb: after.usedGb,
      totalGb: after.totalGb,
      usedPct: after.usedPct,
      capacityStr: after.capacityStr,
      maxUsagePct: MAX_USAGE_PCT,
      thresholdGb: THRESHOLD_GB,
      rotatedLogs,
      walCheckpointed: walCheck.count,
    };
  } else {
    appendLog(
      `OK: avail=${before.availGb}GB used=${before.usedGb}GB/${before.totalGb}GB capacity=${before.capacityStr}` +
        (walCheck.count > 0 ? ` walCheckpointed=${walCheck.count}` : '') +
        (rotatedLogs.length > 0 ? ` rotatedLogs=${rotatedLogs.join(',')}` : '')
    );
    state = {
      lastCheckAt: new Date().toISOString(),
      status: 'healthy',
      availGb: before.availGb,
      usedGb: before.usedGb,
      totalGb: before.totalGb,
      usedPct: before.usedPct,
      capacityStr: before.capacityStr,
      maxUsagePct: MAX_USAGE_PCT,
      thresholdGb: THRESHOLD_GB,
      rotatedLogs,
      walCheckpointed: walCheck.count,
    };
  }

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch {}

  if (forceTest) {
    console.log(JSON.stringify(state, null, 2));
  }
}

main().catch((err) => {
  appendLog(`ERROR: ${err.message}`);
});
