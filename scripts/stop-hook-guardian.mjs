#!/usr/bin/env node
/**
 * ============================================================================
 * Antigravity Stop 生命周期守卫脚本 (Stop Hook Guardian)
 * ============================================================================
 * 作用：
 * - 挂载于 Antigravity 的 `Stop` 生命周期钩子（支持全局插件模式与单项目 `.agents` 模式）
 * - 当模型准备结束当前回合并交差（`terminationReason === "NO_TOOL_CALL"`）时自动触发
 * - 智能识别已接入 `memory/` 账本的目标项目（避免对 `~/Downloads` 等大容器目录或未启用项目误扫）
 * - 自动调用 `universal-preflight-gate.mjs --json` 执行全栈语法与内联 <script> AST 校验
 * - 若发现任何语法错误、内联 <script> AST 编译错误或阻塞级反模式，且当前会话连续拦截未超过 2 次，
 *   立即返回 `{"decision": "continue", "reason": "..."}` 强制模型修复后再交差！
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 最大连续强制拦截次数上限（防止极端情况下产生死循环）
const MAX_CONSECUTIVE_BLOCKS = 2;

/**
 * 从 stdin 读取 Hook 上下文 JSON（若在终端直接手动执行则立即返回默认测试载荷）
 */
function readHookInput() {
  if (process.stdin.isTTY) {
    return {
      conversationId: 'manual-cli-check',
      terminationReason: 'NO_TOOL_CALL',
      workspacePaths: [process.cwd()],
    };
  }

  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    if (!raw) {
      return {
        conversationId: 'empty-stdin-check',
        terminationReason: 'NO_TOOL_CALL',
        workspacePaths: [process.cwd()],
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      conversationId: 'invalid-json-check',
      terminationReason: 'NO_TOOL_CALL',
      workspacePaths: [process.cwd()],
    };
  }
}

const HOME = os.homedir();
const BRAIN_DIR = path.join(HOME, '.gemini/antigravity/brain');
const MOTHER_OS_DIR = path.join(HOME, 'Downloads/universal-fullstack-evo-os');
const CONTAINER_DIRS = new Set([
  '/',
  HOME,
  path.join(HOME, 'Downloads'),
  path.join(HOME, 'Downloads', '未命名文件夹 3'),
  path.join(HOME, 'Documents'),
  path.join(HOME, 'code'),
  path.join(HOME, 'Desktop'),
  path.join(HOME, '.gemini/config/plugins/agy-evo-os'),
]);
const EXTRA_KNOWN_REPOS = [
  path.join(HOME, 'Documents/Codex/2026-10-12/task-2/product-intake-mvp'),
  path.join(HOME, 'Documents/Codex/2026-10-15/gpt-6-astra-16-02-http/outputs/gemini4-frontend-handoff'),
  path.join(HOME, 'Documents/ChatGPT/服装批量/backend-takeover'),
  path.join(HOME, 'Downloads/未命名文件夹 3/dreamina-mvp'),
];

function isContainerDir(dirPath) {
  if (!dirPath) return true;
  const resolved = path.resolve(dirPath);
  if (CONTAINER_DIRS.has(resolved)) return true;
  try {
    if (fs.existsSync(resolved) && CONTAINER_DIRS.has(fs.realpathSync(resolved))) return true;
  } catch {}
  return false;
}

/**
 * 判断某个目录是否已挂载或初始化了 Evo-OS 记忆账本（且绝不是父级容器目录）
 */
function isEvoEnabledProject(dirPath) {
  if (!dirPath || isContainerDir(dirPath)) return false;
  return (
    fs.existsSync(path.join(dirPath, 'memory', 'PRODUCT_PROGRESS.md')) ||
    fs.existsSync(path.join(dirPath, '.agents', 'hooks.json')) ||
    fs.existsSync(path.join(dirPath, 'hooks', 'hooks.json'))
  );
}

function findEvoProjectAncestor(matchPath) {
  let cur = path.resolve(matchPath);
  let depth = 0;
  while (cur && cur.startsWith(HOME + '/') && cur !== HOME && depth < 12) {
    if (isContainerDir(cur)) break;
    if (isEvoEnabledProject(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
    depth++;
  }
  return '';
}

/**
 * 从当前会话的 transcript.jsonl 中提取最近实际读写的业务项目根目录
 */
function resolveProjectFromTranscript(conversationId) {
  if (!conversationId || typeof conversationId !== 'string') return null;
  const tPath = path.join(BRAIN_DIR, conversationId, '.system_generated/logs/transcript.jsonl');
  if (!fs.existsSync(tPath)) return null;
  try {
    const stat = fs.statSync(tPath);
    const readSize = Math.min(stat.size, 180 * 1024);
    const fd = fs.openSync(tPath, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);
    const tailText = buf.toString('utf8');
    const lines = tailText.split('\n').filter(Boolean).slice(-100);
    let lastUserIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('"type":"USER_INPUT"') || lines[i].includes('"type": "USER_INPUT"')) {
        lastUserIdx = i;
        break;
      }
    }
    const hits = new Map();
    const escapedHome = HOME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pathRegex = new RegExp(
      `${escapedHome}\\/(?:未命名文件夹 3|业务大脑 \\(Agent AI:Dify\\)|[A-Za-z0-9_.\\-\\/\\u4e00-\\u9fa5])+`,
      'g'
    );
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const weight = lastUserIdx >= 0 && i >= lastUserIdx ? 20 : i >= lines.length - 25 ? 4 : 1;
      const matches = line.match(pathRegex) || [];
      for (const m of matches) {
        if (m.includes('/.gemini/') || m.includes('/Library/') || m.includes('/Applications/')) continue;
        const candidate = findEvoProjectAncestor(m);
        if (candidate) {
          hits.set(candidate, (hits.get(candidate) || 0) + weight);
        }
      }
    }
    const sorted = [...hits.entries()].sort((a, b) => b[1] - a[1]);
    const nonMother = sorted.find(([dir]) => dir !== MOTHER_OS_DIR);
    if (nonMother) return nonMother[0];
    if (sorted.length > 0) return sorted[0][0];
  } catch {}
  return null;
}

/**
 * 计算项目目录内记忆文件与一二级源码文件的最新修改时间戳
 */
function getLatestProjectActivityMtime(projectDir) {
  let latestMtime = 0;
  const checkStat = (p) => {
    try {
      const st = fs.statSync(p);
      if (st.mtimeMs > latestMtime) latestMtime = st.mtimeMs;
    } catch {}
  };
  for (const mf of [
    path.join(projectDir, 'memory', 'PRODUCT_PROGRESS.md'),
    path.join(projectDir, 'memory', '.memory-store', 'memory.sqlite'),
    path.join(projectDir, 'memory', 'CODE_GRAPH_3D.html'),
    path.join(projectDir, 'memory', 'CONVERSATION_INDEX.md'),
  ]) {
    if (fs.existsSync(mf)) checkStat(mf);
  }
  const skipSub = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.venv', 'venv', '.venv_local', 'memory']);
  try {
    for (const e1 of fs.readdirSync(projectDir, { withFileTypes: true })) {
      if (e1.name.startsWith('.') || skipSub.has(e1.name)) continue;
      const p1 = path.join(projectDir, e1.name);
      if (e1.isFile()) {
        checkStat(p1);
      } else if (e1.isDirectory()) {
        try {
          for (const e2 of fs.readdirSync(p1, { withFileTypes: true }).slice(0, 40)) {
            if (e2.isFile() && !e2.name.startsWith('.')) checkStat(path.join(p1, e2.name));
          }
        } catch {}
      }
    }
  } catch {}
  return latestMtime;
}

/**
 * 智能推断当前受检项目的根目录：
 * 1. 若当前工作区本身是具体业务项目且已启用 Evo-OS（含 memory/PRODUCT_PROGRESS.md），直接检查该目录；
 * 2. 若当前工作区是 ~/Downloads 等父级容器目录，优先从当前会话 transcript.jsonl 精确锁定正在操作的业务子项目；
 * 3. 若无会话日志（如 CLI 调用），扫描候选子项目最近 30 分钟内的源码或记忆活跃修改；
 * 4. 若当前打开的是未初始化 memory/ 的普通临时项目，返回 null 直接放行（绝不误拦其他无关项目）。
 */
function resolveProjectRoot(payload) {
  let ws = '';
  if (
    payload &&
    Array.isArray(payload.workspacePaths) &&
    payload.workspacePaths.length > 0 &&
    payload.workspacePaths[0]
  ) {
    const rawWs = String(payload.workspacePaths[0]).replace(/^file:\/\//, '');
    try {
      ws = path.resolve(decodeURIComponent(rawWs));
    } catch {
      ws = path.resolve(rawWs);
    }
  } else {
    let candidate = path.resolve(__dirname, '..');
    if (path.basename(candidate) === '.agents' || path.basename(candidate) === '.agent') {
      candidate = path.dirname(candidate);
    }
    ws = candidate;
  }

  if (!ws || !fs.existsSync(ws)) return null;

  if (isEvoEnabledProject(ws)) {
    return ws;
  }

  if (!isContainerDir(ws)) {
    return null;
  }

  // 1. 优先根据当前 conversationId 的 transcript 精确解析当前会话操作的目标项目
  const fromTranscript = resolveProjectFromTranscript(payload?.conversationId);
  if (fromTranscript) return fromTranscript;

  // 2. 扫描容器目录及已知项目目录中最近 30 分钟有源码或记忆修改的 Evo-OS 项目
  try {
    const candidateDirs = new Set(EXTRA_KNOWN_REPOS);
    for (const parent of [ws, path.join(HOME, 'code')]) {
      if (!fs.existsSync(parent)) continue;
      try {
        for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            candidateDirs.add(path.join(parent, entry.name));
          }
        }
      } catch {}
    }

    let bestBusinessChild = null;
    let bestBusinessMtime = 0;
    let bestMotherChild = null;
    let bestMotherMtime = 0;
    const recentWindowMs = 30 * 60 * 1000;
    const now = Date.now();

    for (const childDir of candidateDirs) {
      if (!isEvoEnabledProject(childDir)) continue;
      const latestMtime = getLatestProjectActivityMtime(childDir);
      if (now - latestMtime <= recentWindowMs) {
        if (path.resolve(childDir) === MOTHER_OS_DIR) {
          if (latestMtime > bestMotherMtime) {
            bestMotherMtime = latestMtime;
            bestMotherChild = childDir;
          }
        } else if (latestMtime > bestBusinessMtime) {
          bestBusinessMtime = latestMtime;
          bestBusinessChild = childDir;
        }
      }
    }
    if (bestBusinessChild) return bestBusinessChild;
    if (bestMotherChild) return bestMotherChild;
  } catch {
    // 忽略目录枚举异常
  }

  return null;
}

/**
 * 获取当前会话的连续拦截计数文件路径
 */
function getSessionStateFile(conversationId) {
  const safeId = String(conversationId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(os.tmpdir(), `universal-evo-stop-guardian-${safeId}.json`);
}

function readBlockCount(stateFile) {
  try {
    if (!fs.existsSync(stateFile)) return 0;
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return Number(data.blockCount) || 0;
  } catch {
    return 0;
  }
}

function writeBlockCount(stateFile, count) {
  try {
    fs.writeFileSync(
      stateFile,
      JSON.stringify({ blockCount: count, updatedAt: new Date().toISOString() }),
      'utf8'
    );
  } catch {
    // 忽略临时文件写入异常
  }
}

/**
 * 对项目下的 SQLite 记忆图谱数据库执行 PRAGMA wal_checkpoint(TRUNCATE); 自动收敛，
 * 防止 .sqlite-wal 文件无限膨胀，确保单次收敛在数十毫秒内完成。
 */
export function checkpointProjectSqliteWal(projectRoot) {
  if (!projectRoot) return { checked: 0, truncated: [] };
  const candidateDbPaths = [
    path.join(projectRoot, '.memory-store', 'memory-graph.sqlite'),
    path.join(projectRoot, 'memory', '.memory-store', 'memory-graph.sqlite'),
    path.join(projectRoot, 'memory', '.memory-store', 'memory.sqlite'),
    path.join(projectRoot, '.memory-store', 'memory.sqlite'),
  ];
  const truncated = [];
  for (const dbPath of candidateDbPaths) {
    if (!fs.existsSync(dbPath)) continue;
    let db = null;
    try {
      db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 400;');
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      truncated.push(dbPath);
    } catch {
      // 忽略并发锁占用异常，绝不阻塞收工钩子
    } finally {
      if (db) {
        try {
          db.close();
        } catch {}
      }
    }
  }
  return { checked: candidateDbPaths.length, truncated };
}

function main() {
  const hookStartMs = Date.now();
  const TOTAL_BUDGET_MS = 2800; // 严格控制在 3 秒（2800ms）内极速完成收工守护
  const payload = readHookInput();
  const terminationReason = payload.terminationReason || 'NO_TOOL_CALL';

  // 仅在模型正常结束回合（NO_TOOL_CALL）时执行门禁拦截，避免干扰用户主动取消或异常中断
  if (terminationReason !== 'NO_TOOL_CALL') {
    process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    return;
  }

  const projectRoot = resolveProjectRoot(payload);
  if (!projectRoot || isContainerDir(projectRoot)) {
    process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    return;
  }

  // 自动对项目 SQLite WAL 日志执行 TRUNCATE 检查点收敛，防止 .sqlite-wal 无限膨胀
  checkpointProjectSqliteWal(projectRoot);

  const preflightScript = path.join(__dirname, 'universal-preflight-gate.mjs');
  const stateFile = getSessionStateFile(payload.conversationId);

  if (!fs.existsSync(preflightScript)) {
    process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    return;
  }

  const preflightBudgetMs = Math.max(800, Math.min(2100, TOTAL_BUDGET_MS - (Date.now() - hookStartMs) - 250));
  const res = spawnSync(
    process.execPath,
    [preflightScript, '--json', '--fast', '--root', projectRoot],
    { encoding: 'utf8', timeout: preflightBudgetMs }
  );

  let report = null;
  try {
    report = JSON.parse((res.stdout || '').trim());
  } catch {
    process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    return;
  }

  const syntaxErrors =
    (report &&
      report.checks &&
      report.checks.check1SyntaxAndAst &&
      report.checks.check1SyntaxAndAst.errors) ||
    [];
  const blockingAntiPatterns =
    (report &&
      report.checks &&
      report.checks.check3AntiPatterns &&
      report.checks.check3AntiPatterns.blockingIssues) ||
    [];

  const allBlockingIssues = [
    ...syntaxErrors.map((e) => `[${e.type}] ${e.file}: ${e.message}`),
    ...blockingAntiPatterns.map((b) => `[${b.rule}] ${b.file}: ${b.message}`),
  ];

  // 无任何语法错误、内联 <script> AST 编译错误与阻塞问题 -> 异步分离刷新 3D 知识图谱与进化棘轮台账并立即放行
  if (allBlockingIssues.length === 0) {
    writeBlockCount(stateFile, 0);
    try {
      const graphGenScript = path.join(__dirname, 'code-graph-3d-generator.mjs');
      const auditScript = path.join(__dirname, 'security-and-simplicity-audit.mjs');
      if (fs.existsSync(graphGenScript)) {
        const child1 = spawn(process.execPath, [graphGenScript, '--root', projectRoot], {
          detached: true,
          stdio: 'ignore',
        });
        child1.unref();
      }
      if (fs.existsSync(auditScript)) {
        const child2 = spawn(process.execPath, [auditScript, '--root', projectRoot], {
          detached: true,
          stdio: 'ignore',
        });
        child2.unref();
      }
    } catch {
      // 图谱与棘轮后台刷新异常不阻塞主流程
    }
    checkpointProjectSqliteWal(projectRoot);
    process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    return;
  }

  const currentCount = readBlockCount(stateFile);
  if (currentCount < MAX_CONSECUTIVE_BLOCKS) {
    const nextCount = currentCount + 1;
    writeBlockCount(stateFile, nextCount);

    const detailList = allBlockingIssues.slice(0, 10).map((item, i) => `${i + 1}. ${item}`).join('\n');
    const reason = [
      `🚨 【Stop 生命周期质量门禁拦截（项目: ${projectRoot}，当前会话第 ${nextCount}/${MAX_CONSECUTIVE_BLOCKS} 次拦截）】`,
      `检测到项目存在未修复的语法错误、HTML 内联 <script> AST 编译错误或阻塞级反模式，严禁带病交差！`,
      `发现的问题明细如下：`,
      detailList,
      ``,
      `👉 请立即完成以下动作：`,
      `1. 定位并修复上述所有语法/AST 报错；`,
      `2. 重新运行 \`node scripts/universal-preflight-gate.mjs --root "${projectRoot}"\` 确认 0 报错通过；`,
      `3. 若有记忆账本需更新，通过 1 次合并 \`ask_question\` 弹窗请用户审批（若用户选择跳过则立即直接汇报收工，严禁原地打转）。`,
    ].join('\n');

    process.stdout.write(
      JSON.stringify({
        decision: 'continue',
        reason,
      }) + '\n'
    );
    return;
  }

  // 若已达到最大连续拦截上限（2 次），重置计数并放行，防止无限循环
  writeBlockCount(stateFile, 0);
  process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}` || (process.argv[1] && process.argv[1].endsWith('stop-hook-guardian.mjs'))) {
  main();
}
