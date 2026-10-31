#!/usr/bin/env node
/**
 * AGY 跨窗口与多项目定时自检巡检脚本 (evo-patrol-inspector.mjs)
 * 职责：
 * 1. 检查母版库 (universal-fullstack-evo-os / agy-evo-os-opensource / agy-evo-os) 是否被业务项目串味污染；
 * 2. 增量尾读扫描近期活跃对话窗口日志 (transcript.jsonl)，捕捉未自愈报错或隔离告警（内置静默降噪与回合内自愈消音）；
 * 3. 检查已接入业务项目的独立 memory/、3D 知识图谱与 SQLite 强事务引擎健康度：
 *    - 自动执行 SQLite WAL 截断收敛 (`PRAGMA wal_checkpoint(TRUNCATE)`)；
 *    - 自动检查并自愈 `tickets / effects / outbox_receipts` 孤儿任务与超时死信；
 * 4. 校验全局插件启用状态、14 大 MCP Schema 注册完整性与预检门禁。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { openMemoryDatabase, runInSavepoint } from './memory-graph-engine.mjs';

const HOME = os.homedir();
const SOURCE_OS_DIR = path.join(HOME, 'Downloads/universal-fullstack-evo-os');
const OPENSOURCE_OS_DIR = path.join(HOME, 'Downloads/agy-evo-os-opensource');
const GLOBAL_PLUGIN_DIR = path.join(HOME, '.gemini/config/plugins/agy-evo-os');
const BRAIN_DIR = path.join(HOME, '.gemini/antigravity/brain');
const MCP_SCHEMA_DIR = path.join(HOME, '.gemini/antigravity/mcp/agy-evo-os_memory');
const USER_CONFIG_PATH = path.join(HOME, '.gemini/config/config.json');

const WATERMARK_FILE = path.join(GLOBAL_PLUGIN_DIR, 'memory', '.patrol-watermark.json');
const HEAD_SLICE_BYTES = 16 * 1024;
const TAIL_SLICE_BYTES = 256 * 1024;
const STALE_TICKET_MS = 4 * 3600 * 1000; // 4 小时未更新的活跃工单视为孤儿工单
const STALE_EFFECT_MS = 2 * 3600 * 1000; // 2 小时未完成且重试多次的副作用视为死信
const STALE_OUTBOX_MS = 4 * 3600 * 1000; // 4 小时未结算的待发回执自动过期收敛

function parseArgs(argv) {
  let windowMinutes = 65;
  let strictWindow = false;
  let quietMode = true;
  const excludeConvs = new Set(
    (process.env.CONVERSATION_ID || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  let autoFix = true;
  let ackCurrent = false;
  let includeSubagents = false;
  for (let i = 2; i < argv.length; i++) {
    if ((argv[i] === '--window-minutes' || argv[i] === '--minutes') && argv[i + 1]) {
      windowMinutes = Number(argv[++i]) || 65;
    } else if (argv[i] === '--hours' && argv[i + 1]) {
      windowMinutes = Math.round((Number(argv[++i]) || 1) * 60);
    } else if (argv[i] === '--strict-window') {
      strictWindow = true;
    } else if (argv[i] === '--verbose') {
      quietMode = false;
    } else if (argv[i] === '--quiet') {
      quietMode = true;
    } else if (argv[i] === '--exclude-conv' && argv[i + 1]) {
      for (const id of argv[++i].split(',').map((s) => s.trim()).filter(Boolean)) excludeConvs.add(id);
    } else if (argv[i] === '--no-autofix') autoFix = false;
    else if (argv[i] === '--ack' || argv[i] === '--ack-current') ackCurrent = true;
    else if (argv[i] === '--include-subagents') includeSubagents = true;
  }
  // 配合整点 (0 * * * *) 巡检调度，默认至少覆盖 65 分钟窗口以防漏扫前半小时
  const effectiveWindowMinutes = strictWindow ? windowMinutes : Math.max(windowMinutes, 65);
  return { windowMinutes: effectiveWindowMinutes, quietMode, excludeConvs, autoFix, ackCurrent, includeSubagents };
}

function loadWatermark() {
  try {
    if (fs.existsSync(WATERMARK_FILE)) {
      return JSON.parse(fs.readFileSync(WATERMARK_FILE, 'utf8'));
    }
  } catch {}
  return { ackedStepKeys: [] };
}

function saveWatermark(ackedStepKeys) {
  try {
    fs.mkdirSync(path.dirname(WATERMARK_FILE), { recursive: true });
    fs.writeFileSync(
      WATERMARK_FILE,
      JSON.stringify({ updatedAt: new Date().toISOString(), ackedStepKeys: Array.from(ackedStepKeys).slice(-800) }, null, 2) + '\n',
      'utf8'
    );
  } catch {}
}

function readTranscriptHeadAndTail(transcriptPath, totalSize) {
  let fd = null;
  try {
    fd = fs.openSync(transcriptPath, 'r');
    const headLen = Math.min(totalSize, HEAD_SLICE_BYTES);
    const headBuf = Buffer.allocUnsafe(headLen);
    fs.readSync(fd, headBuf, 0, headLen, 0);
    const headSlice = headBuf.toString('utf8');

    const tailLen = Math.min(totalSize, TAIL_SLICE_BYTES);
    const tailOffset = Math.max(0, totalSize - tailLen);
    const tailBuf = Buffer.allocUnsafe(tailLen);
    fs.readSync(fd, tailBuf, 0, tailLen, tailOffset);
    const tailText = tailBuf.toString('utf8');
    const rawLines = tailText.split('\n');
    const validLines = (tailOffset > 0 ? rawLines.slice(1) : rawLines).filter(Boolean);
    return { headSlice, recentLines: validLines.slice(-80) };
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

function checkMotherTemplatePurity(autoFix) {
  const issues = [];
  const fixed = [];
  const dirsToCheck = [
    path.join(SOURCE_OS_DIR, 'memory'),
    path.join(GLOBAL_PLUGIN_DIR, 'memory'),
    path.join(GLOBAL_PLUGIN_DIR, 'memory-templates'),
    path.join(OPENSOURCE_OS_DIR, 'memory-templates'),
  ];

  for (const memDir of dirsToCheck) {
    if (!fs.existsSync(memDir)) continue;
    const sessDir = path.join(memDir, 'sessions');
    if (fs.existsSync(sessDir)) {
      const straySessions = fs.readdirSync(sessDir).filter((f) => f.startsWith('CONV-') && f.endsWith('.md'));
      if (straySessions.length > 0) {
        issues.push(`发现母版目录 ${memDir}/sessions 存在业务对话切片残留: ${straySessions.join(', ')}`);
        if (autoFix) {
          for (const s of straySessions) {
            fs.rmSync(path.join(sessDir, s), { force: true });
          }
          fixed.push(`已自动清理 ${memDir}/sessions 下的 ${straySessions.length} 个混入切片`);
        }
      }
    }

    const progressFile = path.join(memDir, 'PRODUCT_PROGRESS.md');
    if (fs.existsSync(progressFile)) {
      const content = fs.readFileSync(progressFile, 'utf8');
      if (!content.includes('[待项目首次建档填入') && !content.includes('首次接入新项目或存量项目时')) {
        issues.push(`发现母版文件 ${progressFile} 被具体业务项目覆盖污染`);
      }
    }
  }
  return { ok: issues.length === 0, issues, fixed };
}

function scanRecentConversations(windowMinutes, excludeConvs, ackCurrent = false, includeSubagents = false, quietMode = true) {
  const cutoffMs = Date.now() - windowMinutes * 60 * 1000;
  const activeConversations = [];
  const anomalies = [];
  const wm = loadWatermark();
  const ackedSet = new Set(Array.isArray(wm.ackedStepKeys) ? wm.ackedStepKeys : []);

  if (!fs.existsSync(BRAIN_DIR)) {
    return { activeConversationsCount: 0, activeConversations, anomalies };
  }

  const convDirs = fs.readdirSync(BRAIN_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const d of convDirs) {
    const convId = d.name;
    if (excludeConvs.has(convId)) continue;
    const transcriptPath = path.join(BRAIN_DIR, convId, '.system_generated/logs/transcript.jsonl');
    if (!fs.existsSync(transcriptPath)) continue;

    let stat;
    try {
      stat = fs.statSync(transcriptPath);
    } catch {
      continue;
    }
    if (stat.mtimeMs < cutoffMs || stat.size <= 0) continue;

    const { headSlice, recentLines } = readTranscriptHeadAndTail(transcriptPath, stat.size);
    if (!includeSubagents && (headSlice.includes('<original_task>') || headSlice.includes('<subagent_reminder>'))) {
      continue;
    }

    const parsedSteps = [];
    for (let idx = 0; idx < recentLines.length; idx++) {
      try {
        parsedSteps.push(JSON.parse(recentLines[idx]));
      } catch {}
    }
    if (parsedSteps.length === 0) continue;

    const lastStep = parsedSteps[parsedSteps.length - 1];
    const lastStepIdx = lastStep?.step_index ?? parsedSteps.length - 1;

    let lastUserPrompt = '';
    let errorCount = 0;
    let isolationWarnings = 0;
    const userCorrectionSignals = [];
    const errorDetails = [];

    for (let idx = 0; idx < parsedSteps.length; idx++) {
      const step = parsedSteps[idx];
      const stepIdx = step.step_index ?? idx;
      const stepKey = `${convId}:${stepIdx}:${step.created_at || ''}`;
      if (ackedSet.has(stepKey)) continue;

      const stepTime = step.created_at ? new Date(step.created_at).getTime() : 0;
      const isWithinWindow = stepTime === 0 || stepTime >= cutoffMs;

      if (step.type === 'USER_INPUT' && typeof step.content === 'string') {
        const clean = step.content.replace(/<[^>]+>/g, '').trim();
        if (clean) lastUserPrompt = clean.slice(0, 120);
        const isPatrolCommand = /(例行跨项目自检与自进化巡逻|evo-patrol-inspector|universal-preflight-gate)/.test(clean);
        if (
          isWithinWindow &&
          !isPatrolCommand &&
          /(不对|错了|找不到|没生效|出问题|报错|卡住|原地打转|为什么没|要给我截图|怎么没图|截图呢|有图吗|怎么证明|没有截图|没给图|证据呢|图呢|为什么没有图|打不开|直接打不开|全是源码|看不了|白屏|崩溃|损坏)/.test(
            clean
          )
        ) {
          // 若该用户输入之后，智能体已在后续步骤中正常完成响应且无未闭合报错，则视为已在当前对话内处理完毕（静默消音）
          const postSteps = parsedSteps.slice(idx + 1);
          const handledInTurn =
            postSteps.some((s) => s.type === 'PLANNER_RESPONSE' && s.status === 'DONE') &&
            lastStep?.status === 'DONE';
          if (ackCurrent || handledInTurn) {
            ackedSet.add(stepKey);
          } else {
            userCorrectionSignals.push(clean.slice(0, 100));
          }
        }
      }
      const isUserCancellation = typeof step.content === 'string' && /user cancelled/i.test(step.content);
      if (isWithinWindow && step.status === 'ERROR' && !isUserCancellation) {
        if (ackCurrent) {
          ackedSet.add(stepKey);
        } else {
          errorCount++;
          const errSnippet =
            typeof step.content === 'string' ? step.content.replace(/[\r\n]+/g, ' ').slice(0, 120) : 'Unknown error';
          errorDetails.push(`[step ${stepIdx}] ${errSnippet}`);
        }
      }
      if (
        isWithinWindow &&
        typeof step.content === 'string' &&
        /"isolationWarning"\s*:/.test(step.content) &&
        !step.content.includes('grep')
      ) {
        if (ackCurrent) ackedSet.add(stepKey);
        else isolationWarnings++;
      }
    }

    // 智能自愈研判（Self-Healed Anomaly Detection）
    let selfHealed = false;
    let healedSummary = '';
    if (errorCount > 0 && userCorrectionSignals.length === 0 && isolationWarnings === 0) {
      const lastErrorIdx = parsedSteps.reduce(
        (max, s) =>
          s.status === 'ERROR' && !/user cancelled/i.test(s.content || '') ? Math.max(max, s.step_index || 0) : max,
        -1
      );

      if (lastStep && lastStep.status === 'DONE' && lastStepIdx > lastErrorIdx) {
        const postSteps = parsedSteps.filter((s) => (s.step_index || 0) > lastErrorIdx);
        const hasSuccessfulAction = postSteps.some(
          (s) => s.status === 'DONE' && (s.type === 'PLANNER_RESPONSE' || s.type === 'GENERIC')
        );
        if (hasSuccessfulAction) {
          selfHealed = true;
          healedSummary = `历史报错已在 step ${lastErrorIdx} 后的后续操作 (最高 step ${lastStepIdx}) 中成功重试自愈并正常闭环`;
          for (const s of parsedSteps) {
            if (s.status === 'ERROR') {
              ackedSet.add(`${convId}:${s.step_index ?? '?'}:${s.created_at || ''}`);
            }
          }
        }
      }
    }

    const hasUnresolvedAnomaly =
      (errorCount > 0 && !selfHealed) || userCorrectionSignals.length > 0 || isolationWarnings > 0;

    if (!quietMode || hasUnresolvedAnomaly || selfHealed) {
      activeConversations.push({
        conversationId: convId,
        lastModified: new Date(stat.mtimeMs).toISOString(),
        lastStepIndex: lastStepIdx,
        lastUserPrompt,
        errorCount,
        selfHealed,
        healedSummary: selfHealed ? healedSummary : null,
        errorDetails,
        isolationWarnings,
        userCorrectionSignals,
      });
    }

    if (hasUnresolvedAnomaly) {
      anomalies.push({
        conversationId: convId,
        errorCount,
        selfHealed: false,
        errorDetails,
        isolationWarnings,
        userCorrectionSignals,
        lastUserPrompt,
      });
    }
  }

  saveWatermark(ackedSet);
  return {
    activeConversationsCount: activeConversations.length,
    quietMode,
    activeConversations,
    anomalies,
  };
}

function inspectAndHealProjectSqliteState(projRoot, autoFix) {
  const sqlitePath = path.join(projRoot, 'memory', '.memory-store', 'memory.sqlite');
  const walPath = `${sqlitePath}-wal`;
  const summary = {
    walSizeBytesBefore: 0,
    walSizeBytesAfter: 0,
    walCheckpointed: false,
    ticketsTotal: 0,
    activeTickets: 0,
    orphanTicketsHealed: 0,
    pendingEffects: 0,
    orphanEffectsHealed: 0,
    pendingOutbox: 0,
    staleOutboxHealed: 0,
  };
  if (!fs.existsSync(sqlitePath)) return summary;

  try {
    summary.walSizeBytesBefore = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
  } catch {}

  const db = openMemoryDatabase(projRoot);
  try {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const staleTicketCutoffIso = new Date(nowMs - STALE_TICKET_MS).toISOString();
    const staleOutboxCutoffIso = new Date(nowMs - STALE_OUTBOX_MS).toISOString();
    const staleEffectCutoffMs = nowMs - STALE_EFFECT_MS;

    runInSavepoint(db, () => {
      if (autoFix) {
        const orphanTicketsRes = db
          .prepare(
            `UPDATE tickets
             SET stage = 'expired', updated_at = ?
             WHERE stage IN ('open', 'dispatched', 'running', 'in_progress')
               AND updated_at IS NOT NULL
               AND updated_at < ?`
          )
          .run(nowIso, staleTicketCutoffIso);
        summary.orphanTicketsHealed = Number(orphanTicketsRes?.changes || 0);

        const orphanEffectsRes = db
          .prepare(
            `DELETE FROM effects
             WHERE attempts >= 5
                OR (due_ms > 0 AND due_ms < ? AND attempts >= 3)`
          )
          .run(staleEffectCutoffMs);
        summary.orphanEffectsHealed = Number(orphanEffectsRes?.changes || 0);

        const staleOutboxRes = db
          .prepare(
            `UPDATE outbox_receipts
             SET status = 'expired', settled_at = ?
             WHERE status = 'pending'
               AND created_at IS NOT NULL
               AND created_at < ?`
          )
          .run(nowIso, staleOutboxCutoffIso);
        summary.staleOutboxHealed = Number(staleOutboxRes?.changes || 0);
      }

      const tTotal = db.prepare('SELECT COUNT(*) AS c FROM tickets').get();
      const tActive = db
        .prepare("SELECT COUNT(*) AS c FROM tickets WHERE stage IN ('open', 'dispatched', 'running', 'in_progress')")
        .get();
      const ePending = db.prepare('SELECT COUNT(*) AS c FROM effects').get();
      const oPending = db.prepare("SELECT COUNT(*) AS c FROM outbox_receipts WHERE status = 'pending'").get();

      summary.ticketsTotal = Number(tTotal?.c || 0);
      summary.activeTickets = Number(tActive?.c || 0);
      summary.pendingEffects = Number(ePending?.c || 0);
      summary.pendingOutbox = Number(oPending?.c || 0);
    });

    // 若存在 WAL 日志且开启 autoFix（或超过 64KB），自动执行 TRUNCATE checkpoint 收敛磁盘体积
    if (summary.walSizeBytesBefore > 0 && (autoFix || summary.walSizeBytesBefore > 64 * 1024)) {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      summary.walCheckpointed = true;
    }
  } finally {
    try {
      db.close();
    } catch {}
  }

  try {
    summary.walSizeBytesAfter = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
  } catch {}

  return summary;
}

function checkAndHealInitializedProjects(autoFix) {
  const containerDir = path.dirname(SOURCE_OS_DIR);
  const projects = [];
  const healed = [];
  const issues = [];
  const candidateRoots = new Set();

  if (fs.existsSync(containerDir)) {
    const entries = fs.readdirSync(containerDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'universal-fullstack-evo-os') continue;
      candidateRoots.add(path.join(containerDir, entry.name));
    }
  }

  const agyProjectsDir = path.join(os.homedir(), '.gemini/config/projects');
  if (fs.existsSync(agyProjectsDir)) {
    for (const file of fs.readdirSync(agyProjectsDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const cfg = JSON.parse(fs.readFileSync(path.join(agyProjectsDir, file), 'utf8'));
        const resUris = (cfg?.projectResources?.resources || [])
          .map((r) => r?.gitFolder?.folderUri || r?.folderUri)
          .filter(Boolean);
        const uris = [...(Array.isArray(cfg.workspace_uris) ? cfg.workspace_uris : []), ...resUris];
        for (const u of uris) {
          if (typeof u === 'string' && u.startsWith('file://')) {
            const p = decodeURIComponent(u.replace(/^file:\/\//, ''));
            if (p && p !== SOURCE_OS_DIR && p !== GLOBAL_PLUGIN_DIR && p !== containerDir && p !== HOME) {
              candidateRoots.add(p);
            }
          }
        }
      } catch {}
    }
  }
  for (const extraRoot of [
    path.join(HOME, 'Documents/Codex/2026-10-12/task-2/product-intake-mvp'),
    path.join(HOME, 'Documents/Codex/2026-10-15/gpt-6-astra-16-02-http/outputs/gemini4-frontend-handoff'),
    path.join(HOME, 'Documents/ChatGPT/服装批量/backend-takeover'),
    path.join(HOME, 'Downloads/未命名文件夹 3/dreamina-mvp'),
  ]) {
    if (fs.existsSync(extraRoot)) candidateRoots.add(extraRoot);
  }
  const codeDir = path.join(HOME, 'code');
  if (fs.existsSync(codeDir)) {
    for (const entry of fs.readdirSync(codeDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        candidateRoots.add(path.join(codeDir, entry.name));
      }
    }
  }

  for (const projRoot of candidateRoots) {
    const projName = path.basename(projRoot);
    const progressPath = path.join(projRoot, 'memory', 'PRODUCT_PROGRESS.md');
    if (!fs.existsSync(progressPath)) continue;

    const sqlitePath = path.join(projRoot, 'memory', '.memory-store', 'memory.sqlite');
    const html3dPath = path.join(projRoot, 'memory', 'CODE_GRAPH_3D.html');
    const reportPath = path.join(projRoot, 'memory', 'GRAPH_REPORT.md');
    const ratchetPath = path.join(projRoot, 'memory', '.memory-store', 'evolution-metrics.json');

    let hasSqlite = fs.existsSync(sqlitePath);
    let has3dGraph = fs.existsSync(html3dPath) && fs.existsSync(reportPath);
    let hasRatchet = fs.existsSync(ratchetPath);

    if ((!hasSqlite || !has3dGraph) && autoFix) {
      try {
        execFileSync(
          process.execPath,
          [path.join(GLOBAL_PLUGIN_DIR, 'scripts/code-graph-3d-generator.mjs'), '--root', projRoot],
          { stdio: 'pipe', timeout: 15000 }
        );
        hasSqlite = fs.existsSync(sqlitePath);
        has3dGraph = fs.existsSync(html3dPath) && fs.existsSync(reportPath);
        healed.push(`已为项目 ${projName} 自动补全/刷新 3D 知识图谱与 SQLite 索引`);
      } catch (err) {
        issues.push(`项目 ${projName} 自动生成 3D 图谱失败: ${err.message}`);
      }
    }

    if (!hasRatchet && autoFix) {
      try {
        execFileSync(
          process.execPath,
          [path.join(GLOBAL_PLUGIN_DIR, 'scripts/security-and-simplicity-audit.mjs'), '--root', projRoot, '--json'],
          { stdio: 'pipe', timeout: 15000 }
        );
        hasRatchet = fs.existsSync(ratchetPath);
        healed.push(`已为项目 ${projName} 自动初始化安全与化繁为简棘轮账本`);
      } catch {
        hasRatchet = fs.existsSync(ratchetPath);
      }
    }

    if (!hasSqlite || !has3dGraph || !hasRatchet) {
      issues.push(`项目 ${projName} 缺失派生资产 (sqlite=${hasSqlite}, 3dGraph=${has3dGraph}, ratchet=${hasRatchet})`);
    }

    // 检查并自愈 SQLite 强事务表 (tickets / effects / outbox_receipts) 与 WAL 日志截断收敛
    let sqliteState = null;
    if (hasSqlite) {
      try {
        sqliteState = inspectAndHealProjectSqliteState(projRoot, autoFix);
        if (sqliteState.orphanTicketsHealed > 0) {
          healed.push(`已为项目 ${projName} 自动收敛 ${sqliteState.orphanTicketsHealed} 个超时孤儿工单 (tickets)`);
        }
        if (sqliteState.orphanEffectsHealed > 0) {
          healed.push(`已为项目 ${projName} 自动清理 ${sqliteState.orphanEffectsHealed} 条死信副作用 (effects)`);
        }
        if (sqliteState.staleOutboxHealed > 0) {
          healed.push(`已为项目 ${projName} 自动结算 ${sqliteState.staleOutboxHealed} 条超时出箱回执 (outbox_receipts)`);
        }
        if (sqliteState.walCheckpointed && sqliteState.walSizeBytesBefore > sqliteState.walSizeBytesAfter) {
          healed.push(
            `已为项目 ${projName} 执行 SQLite WAL 截断收敛 (${sqliteState.walSizeBytesBefore}B -> ${sqliteState.walSizeBytesAfter}B)`
          );
        }
      } catch (err) {
        issues.push(`项目 ${projName} SQLite 状态机巡检异常: ${err.message}`);
      }
    }

    // 检查并自愈会话切片短 ID 别名软链接
    const sessionsDir = path.join(projRoot, 'memory', 'sessions');
    if (fs.existsSync(sessionsDir)) {
      try {
        const files = fs.readdirSync(sessionsDir);
        for (const f of files) {
          const match = f.match(/^(CONV-\d{8}-\d{3})_.+\.md$/);
          if (match) {
            const shortId = match[1];
            const aliasPath = path.join(sessionsDir, `${shortId}.md`);
            if (!fs.existsSync(aliasPath) && autoFix) {
              try {
                fs.symlinkSync(f, aliasPath);
                healed.push(`已为项目 ${projName} 自动补齐会话切片短ID软链接: ${shortId}.md -> ${f}`);
              } catch {
                try {
                  fs.copyFileSync(path.join(sessionsDir, f), aliasPath);
                  healed.push(`已为项目 ${projName} 自动拷贝补齐会话切片短ID别名: ${shortId}.md`);
                } catch {}
              }
            }
          }
        }
      } catch {}
    }

    projects.push({
      project: projName,
      projectRoot: projRoot,
      hasSqlite,
      has3dGraph,
      hasRatchet,
      sqliteState,
    });
  }

  return {
    ok: issues.length === 0,
    projects,
    healed,
    issues,
  };
}

function checkPluginAndMcpHealth() {
  const issues = [];
  let pluginEnabled = false;
  if (fs.existsSync(USER_CONFIG_PATH)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'));
      pluginEnabled = Boolean(cfg?.plugins?.['agy-evo-os']?.enabled);
    } catch (e) {
      issues.push(`读取 user_config.json 失败: ${e.message}`);
    }
  } else {
    issues.push(`未找到 ${USER_CONFIG_PATH}`);
  }

  const expectedTools = [
    'memory_recall_for_task.json',
    'memory_rebuild_index.json',
    'user_profile_update.json',
    'project_memory_init.json',
    'code_graph_blast_radius.json',
    'security_simplicity_audit.json',
    'code_graph_federated_3d.json',
    'cross_project_memory_append.json',
    'cross_inbox_ack.json',
    'cross_conversation_dispatch.json',
    'swarm_spawn_or_route_by_name.json',
    'swarm_report_to_commander.json',
    'swarm_status_board.json',
    'rsi_experiment_record.json',
  ];
  const registeredTools = [];
  for (const t of expectedTools) {
    const p = path.join(MCP_SCHEMA_DIR, t);
    if (fs.existsSync(p)) registeredTools.push(t.replace('.json', ''));
    else issues.push(`MCP 工具 Schema 缺失: ${p}`);
  }

  let preflightExitZero = false;
  const preflightTargetRoot = fs.existsSync(OPENSOURCE_OS_DIR) ? OPENSOURCE_OS_DIR : SOURCE_OS_DIR;
  try {
    execFileSync(
      process.execPath,
      [path.join(GLOBAL_PLUGIN_DIR, 'scripts/universal-preflight-gate.mjs'), '--root', preflightTargetRoot],
      { stdio: 'pipe', timeout: 15000 }
    );
    preflightExitZero = true;
  } catch (e) {
    issues.push(`预检门禁未通过: ${e.message}`);
  }

  return {
    ok: issues.length === 0,
    pluginEnabled,
    registeredTools,
    preflightExitZero,
    issues,
  };
}

function main() {
  const { windowMinutes, quietMode, excludeConvs, autoFix, ackCurrent, includeSubagents } = parseArgs(process.argv);
  const templateCheck = checkMotherTemplatePurity(autoFix);
  const convScan = scanRecentConversations(windowMinutes, excludeConvs, ackCurrent, includeSubagents, quietMode);
  const projectHealth = checkAndHealInitializedProjects(autoFix);
  const healthCheck = checkPluginAndMcpHealth();

  const report = {
    timestamp: new Date().toISOString(),
    windowMinutes,
    overallHealthy: templateCheck.ok && healthCheck.ok && projectHealth.ok && convScan.anomalies.length === 0,
    templateCheck,
    projectHealth,
    healthCheck,
    recentConversationScan: convScan,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
