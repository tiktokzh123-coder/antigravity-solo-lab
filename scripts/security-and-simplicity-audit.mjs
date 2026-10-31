#!/usr/bin/env node
/**
 * AGY Evo-OS 全栈安全边界审计、Ponytail 化繁为简脱水与契约防漂移引擎 (security-and-simplicity-audit.mjs)
 * 职责：
 * 1. Cloudflare Security-Audit 确定性边界扫描 (密钥泄露、前端环境变量越权暴露、注入、XSS、弱密码学)；
 * 2. Ponytail 化繁为简与 Knip 死代码棘轮扫描 (无意义单行套壳函数、零引用死导出、过度抽象包装)；
 * 3. 前后端 API 契约漂移、环境变量契约漂移 (.env.example) 与防假测试 (expect(true)/.only) 扫描；
 * 4. 维护项目级「越用越瘦、越用越安全」自进化棘轮台账 (memory/.memory-store/evolution-metrics.json)。
 */

import fs from 'node:fs';
import path from 'node:path';
import { syncIncrementalIndex } from './memory-graph-engine.mjs';
import {
  resolveCanonicalProjectRoot,
  isContainerOrMotherDir,
  hasRealProjectFiles,
  readSwarmRegistry,
} from './cross-project-federation.mjs';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', '.next',
  '.nuxt', 'coverage', '.venv', 'venv', '.venv_local', 'env', '.env',
  '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.memory-store',
  'backups', '.backups', 'vendor', 'assets', '.runtime', 'target',
  'outputs', 'output', 'data', 'logs', 'launcher-logs', 'ui-audit',
  'evidence', 'db_data', 'video_frames', 'screenshots', 'artifacts', 'tmp', 'temp',
]);

const CODE_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py']);
const MAX_AUDIT_FILE_BYTES = 1536 * 1024; // 1.5MB 阈值

function collectCodeFiles(dir, rootDir, list = [], visitedDirs = new Set()) {
  if (!fs.existsSync(dir)) return list;
  let realDir = dir;
  try {
    realDir = fs.realpathSync(dir);
  } catch {
    return list;
  }
  if (visitedDirs.has(realDir)) return list;
  visitedDirs.add(realDir);

  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return list;
  }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const nameLower = e.name.toLowerCase();
    if (IGNORE_DIRS.has(nameLower)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (
        e.name.startsWith('.') ||
        /^(_db_|_backup|backup_|bak_)/i.test(e.name) ||
        /session[-_]data|user[-_]data|browser[-_]profile|chromium|puppeteer|playwright|acme-source/i.test(e.name)
      ) continue;
      collectCodeFiles(full, rootDir, list, visitedDirs);
    } else if (e.isFile() && CODE_EXTS.has(path.extname(e.name).toLowerCase())) {
      if (nameLower.endsWith('.min.js') || nameLower.endsWith('.bundle.js')) continue;
      try {
        const st = fs.statSync(full);
        if (st.size > MAX_AUDIT_FILE_BYTES) continue;
      } catch {
        continue;
      }
      list.push({ abs: full, rel: path.relative(rootDir, full).replace(/\\/g, '/') });
    }
  }
  return list;
}

export function runSecurityAndSimplicityAudit(rootDir, options = {}) {
  const allowSelfTest = Boolean(options?.allowEngineSelfTest ?? options?.allow_engine_self_test);
  const absRoot = resolveCanonicalProjectRoot(rootDir);
  if (!absRoot || isContainerOrMotherDir(absRoot, allowSelfTest)) {
    return {
      ok: false,
      error: `⚠️ 路径隔离拦截：project_root (${absRoot || rootDir}) 是容器目录或母版库，请指定具体业务子项目目录！`,
    };
  }
  if (!allowSelfTest && !hasRealProjectFiles(absRoot)) {
    return {
      ok: false,
      error: `⚠️ 空壳目录拦截：project_root (${absRoot}) 不存在或无真实业务源码文件，已阻止审计空目录！`,
    };
  }
  const files = collectCodeFiles(absRoot, absRoot);

  const securityFindings = [];
  const ponytailFindings = [];
  const contractAndTestFindings = [];

  const identifierTotalCounts = new Map();
  const exportedSymbols = [];
  const envVarsUsed = new Set();
  const frontendApiCalls = new Set();
  const backendApiRoutes = new Set();

  for (const f of files) {
    let content = '';
    try {
      content = fs.readFileSync(f.abs, 'utf8');
    } catch {
      continue;
    }
    const codeWithoutComments = content
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*(?:\/\/|#).*$/gm, ' ');
    const tokens = codeWithoutComments.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    for (const tk of tokens) {
      identifierTotalCounts.set(tk, (identifierTotalCounts.get(tk) || 0) + 1);
    }
    const lines = content.split('\n');
    const isTestFile = /\.(test|spec)\.[jt]sx?$|test_.*\.py$/.test(f.rel);
    const isSelfScanner = f.rel.includes('security-and-simplicity-audit.mjs') || f.rel.includes('universal-preflight-gate.mjs');

    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) return;

      if (!isSelfScanner) {
        // SEC-01: 前端公开环境变量挂载私钥/敏感凭据
        if (/(?:NEXT_PUBLIC_|VITE_|REACT_APP_)[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|SERVICE_ROLE|DATABASE_URL|PASSWORD)/.test(line)) {
          securityFindings.push({
            id: 'SEC-01',
            severity: 'HIGH',
            category: 'Frontend Secret Exposure',
            file: f.rel,
            line: lineNo,
            detail: '前端公开环境变量前缀 (NEXT_PUBLIC_/VITE_/REACT_APP_) 绑定了服务端私钥或数据库凭据'
          });
        }

        // SEC-02: 高危硬编码云私钥或平台 Token (AWS / RSA / GitHub / OpenAI / Slack)
        const sec02Regex = new RegExp('(?:AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[0-9A-Za-z]{25,}|sk-[0-9A-Za-z_-]{20,}|xox[baprs]-[0-9A-Za-z-]{20,})');
        if (sec02Regex.test(line)) {
          securityFindings.push({
            id: 'SEC-02',
            severity: 'HIGH',
            category: 'Hardcoded Secret',
            file: f.rel,
            line: lineNo,
            detail: '检测到疑似硬编码私钥或访问令牌，请移至环境变量或受控凭据库'
          });
        }

        // SEC-03: 命令注入或 SQL 拼接风险
        if (/\b(?:exec|execSync)\s*\(\s*`[^`]*\$\{[^}]+\}/.test(line)) {
          securityFindings.push({
            id: 'SEC-03',
            severity: 'HIGH',
            category: 'Command Injection Sink',
            file: f.rel,
            line: lineNo,
            detail: '将动态变量直接模板拼接进 exec/execSync 存在命令注入风险，请改用 execFile/execFileSync/spawn 参数数组'
          });
        }

        // SEC-04: JWT 固定硬编码回退密钥
        if (/process\.env\.[A-Z0-9_]*JWT[A-Z0-9_]*\s*\|\|\s*['"][^'"]+['"]/.test(line)) {
          securityFindings.push({
            id: 'SEC-04',
            severity: 'MEDIUM',
            category: 'Hardcoded JWT Fallback Secret',
            file: f.rel,
            line: lineNo,
            detail: 'JWT 密钥配置了硬编码默认值回退，一旦生产环境漏配将导致任意伪造签名'
          });
        }
      }

      // 收集环境变量引用
      for (const m of line.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) {
        envVarsUsed.add(m[1]);
      }

      // 收集前后端 API 路径
      for (const m of line.matchAll(/fetch\s*\(\s*['"](\/api\/[a-zA-Z0-9_/-]+)['"]/g)) {
        frontendApiCalls.add(m[1]);
      }
      for (const m of line.matchAll(/\.(?:get|post|put|delete|patch)\s*\(\s*['"](\/api\/[a-zA-Z0-9_/:*-]+)['"]/g)) {
        backendApiRoutes.add(m[1]);
      }

      // TEST-01: 防假测试与遗留 .only
      if (isTestFile && !isSelfScanner) {
        if (/expect\s*\(\s*true\s*\)\s*\.toBe\s*\(\s*true\s*\)/.test(line)) {
          contractAndTestFindings.push({
            id: 'TEST-01',
            severity: 'MEDIUM',
            file: f.rel,
            line: lineNo,
            detail: '检测到恒真假断言 expect(true).toBe(true)，违反防作弊测试铁律'
          });
        }
        if (/\b(?:describe|it|test)\.only\s*\(/.test(line)) {
          contractAndTestFindings.push({
            id: 'TEST-02',
            severity: 'MEDIUM',
            file: f.rel,
            line: lineNo,
            detail: '测试文件中遗留了 .only()，会导致其余回归测试被跳过'
          });
        }
      }
    });

    // PONY-01: 检测单行无意义透传包装函数 (Trivial Pass-Through Wrapper，支持 TypeScript 泛型/对象解构参数类型剥离)
    if (!isSelfScanner) {
      const splitTopLevelCommas = (str) => {
        const items = [];
        let cur = '';
        let dBrace = 0, dBracket = 0, dParen = 0, dAngle = 0;
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          if (ch === '{') dBrace++;
          else if (ch === '}') dBrace = Math.max(0, dBrace - 1);
          else if (ch === '[') dBracket++;
          else if (ch === ']') dBracket = Math.max(0, dBracket - 1);
          else if (ch === '(') dParen++;
          else if (ch === ')') dParen = Math.max(0, dParen - 1);
          else if (ch === '<') dAngle++;
          else if (ch === '>') dAngle = Math.max(0, dAngle - 1);
          if (ch === ',' && dBrace === 0 && dBracket === 0 && dParen === 0 && dAngle === 0) {
            items.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
        if (cur.trim()) items.push(cur.trim());
        return items;
      };
      const stripTopLevelTypeAndDefault = (param) => {
        let dBrace = 0, dBracket = 0, dParen = 0, dAngle = 0;
        for (let i = 0; i < param.length; i++) {
          const ch = param[i];
          if (ch === '{') dBrace++;
          else if (ch === '}') dBrace = Math.max(0, dBrace - 1);
          else if (ch === '[') dBracket++;
          else if (ch === ']') dBracket = Math.max(0, dBracket - 1);
          else if (ch === '(') dParen++;
          else if (ch === ')') dParen = Math.max(0, dParen - 1);
          else if (ch === '<') dAngle++;
          else if (ch === '>') dAngle = Math.max(0, dAngle - 1);
          if ((ch === ':' || ch === '=') && dBrace === 0 && dBracket === 0 && dParen === 0 && dAngle === 0) {
            return param.slice(0, i).replace(/^\.\.\./, '').replace(/\?$/, '').replace(/\s+/g, '');
          }
        }
        return param.replace(/^\.\.\./, '').replace(/\?$/, '').replace(/\s+/g, '');
      };

      const passThroughRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\{\s*return\s+(?:await\s+)?([a-zA-Z0-9_.]+)\s*\(([^)]*)\)\s*;?\s*\}/g;
      let pm;
      while ((pm = passThroughRegex.exec(content)) !== null) {
        const fnName = pm[1];
        const rawParams = splitTopLevelCommas(pm[2])
          .map(stripTopLevelTypeAndDefault)
          .filter(Boolean)
          .join(',');
        const targetFn = pm[3];
        const callArgs = splitTopLevelCommas(pm[4])
          .map((a) => a.replace(/^\.\.\./, '').replace(/\s+/g, ''))
          .filter(Boolean)
          .join(',');
        if (fnName !== targetFn && rawParams.length > 0 && rawParams === callArgs) {
          ponytailFindings.push({
            id: 'PONY-01',
            type: 'Trivial Pass-Through Wrapper',
            file: f.rel,
            symbol: fnName,
            detail: `函数 ${fnName}(${rawParams}) 仅原样透传调用 ${targetFn}(${callArgs})，无任何附加逻辑（建议按 Ponytail 阶梯直接调用 ${targetFn}）`
          });
        }
      }
    }

    // 收集导出符号用于死代码检测 (Knip 思想)
    for (const em of codeWithoutComments.matchAll(/export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g)) {
      exportedSymbols.push({ symbol: em[1], file: f.rel });
    }
  }

  // PONY-02: 检查导出后在全项目零引用的死导出符号 (Dead Exports，基于 O(1) 全局标识符频次哈希表)
  for (const exp of exportedSymbols) {
    if (['main', 'default', 'handler', 'GET', 'POST', 'PUT', 'DELETE'].includes(exp.symbol)) continue;
    const totalOccurrences = identifierTotalCounts.get(exp.symbol) || 0;
    if (totalOccurrences <= 1) {
      ponytailFindings.push({
        id: 'PONY-02',
        type: 'Unused Export (Dead Symbol)',
        file: exp.file,
        symbol: exp.symbol,
        detail: `导出函数 ${exp.symbol} 在全项目及当前文件内均未被调用（疑似可裁剪死代码或去掉冗余 export）`
      });
    }
  }

  // DRIFT-01: 检查 .env.example 环境变量契约漂移
  const envExamplePath = path.join(absRoot, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    const systemBuiltins = new Set([
      'NODE_ENV', 'PORT', 'PATH', 'HOME', 'PWD', 'CI', 'TZ', 'PROJECT_ROOT',
      'HEALTH_CHECK_URL', 'USER', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM',
      'CONVERSATION_ID', 'ANTIGRAVITY_CLI_ALIAS', 'DEBUG', 'HOST', 'HOSTNAME',
    ]);
    for (const v of envVarsUsed) {
      if (!systemBuiltins.has(v) && !envExampleContent.includes(v)) {
        contractAndTestFindings.push({
          id: 'DRIFT-01',
          severity: 'LOW',
          file: '.env.example',
          line: 1,
          detail: `代码中读取了 process.env.${v}，但未在 .env.example 契约文件中登记声明`
        });
      }
    }
  }

  // 4. 更新项目级「自进化棘轮台账」(memory/.memory-store/evolution-metrics.json) 与研发劳动力复利倍增指标 (EVO-025 / EVO-026)
  const memDir = path.join(absRoot, 'memory');
  const storeDir = path.join(memDir, '.memory-store');
  const metricsPath = path.join(storeDir, 'evolution-metrics.json');
  const ledgerPath = path.join(memDir, 'EVOLUTION_LEDGER.md');
  const hasMemoryInitialized =
    fs.existsSync(path.join(memDir, 'PRODUCT_PROGRESS.md')) ||
    fs.existsSync(path.join(memDir, 'CODE_GRAPH_3D.html')) ||
    fs.existsSync(metricsPath);

  const reusableWheelsCount = exportedSymbols.length;
  let automationScriptsCount = 0;
  for (const sDir of [path.join(absRoot, 'scripts'), path.join(absRoot, '.agents', 'scripts')]) {
    if (fs.existsSync(sDir)) {
      try { automationScriptsCount += fs.readdirSync(sDir).filter((f) => /\.(mjs|js|cjs|sh|py)$/i.test(f)).length; } catch {}
    }
  }
  const mcpServerPath = path.join(absRoot, 'scripts', 'evo-memory-mcp-server.mjs');
  let mcpAndSkillsCount = fs.existsSync(mcpServerPath) ? 0 : 18; // 非引擎仓默认计入已装备的 13 个原生 MCP 工具 + 5 个核心领域 Skill
  for (const skDir of [path.join(absRoot, 'skills'), path.join(absRoot, '.agents', 'skills')]) {
    if (fs.existsSync(skDir)) {
      try {
        for (const d of fs.readdirSync(skDir, { withFileTypes: true })) {
          if (d.isDirectory() && fs.existsSync(path.join(skDir, d.name, 'SKILL.md'))) mcpAndSkillsCount++;
        }
      } catch {}
    }
  }
  if (fs.existsSync(mcpServerPath)) {
    try {
      const mcpRaw = fs.readFileSync(mcpServerPath, 'utf8');
      mcpAndSkillsCount += (mcpRaw.match(/\{\s*name:\s*['"][a-z0-9_]+['"]/g) || []).length;
    } catch {}
  }
  const swarmReg = readSwarmRegistry();
  const swarmSpecialistsCount = Object.keys(swarmReg.specialists || {}).length;
  let rsiExperimentsCount = 0;
  if (fs.existsSync(ledgerPath)) {
    try {
      const ledgerRaw = fs.readFileSync(ledgerPath, 'utf8');
      rsiExperimentsCount = (ledgerRaw.match(/^### \[RSI-[A-Z0-9_-]+\]/gm) || []).length;
    } catch {}
  }
  const laborForceMultiplier = Number(
    (
      1 +
      reusableWheelsCount * 0.05 +
      automationScriptsCount * 0.35 +
      mcpAndSkillsCount * 0.5 +
      swarmSpecialistsCount * 1.2 +
      rsiExperimentsCount * 0.25
    ).toFixed(2)
  );
  const laborForceMetrics = {
    reusableWheelsCount,
    automationScriptsCount,
    mcpAndSkillsCount,
    swarmSpecialistsCount,
    rsiExperimentsCount,
    laborForceMultiplier,
  };

  let history = [];
  if (fs.existsSync(metricsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
      history = Array.isArray(parsed.history) ? parsed.history : [];
    } catch {
      history = [];
    }
  }

  const currentSnapshot = {
    timestamp: new Date().toISOString(),
    scannedFiles: files.length,
    securityFindingsCount: securityFindings.length,
    ponytailBloatCount: ponytailFindings.length,
    contractAndTestCount: contractAndTestFindings.length,
    exportedReusableSymbolsCount: exportedSymbols.length,
    laborForceMetrics,
  };

  const prev = history.length > 0 ? history[history.length - 1] : null;
  const prevMultiplier = prev?.laborForceMetrics?.laborForceMultiplier || 1;
  const evolutionDelta = prev
    ? {
        securityDelta: currentSnapshot.securityFindingsCount - prev.securityFindingsCount,
        ponytailBloatDelta: currentSnapshot.ponytailBloatCount - prev.ponytailBloatCount,
        reusableHelpersDelta: currentSnapshot.exportedReusableSymbolsCount - prev.exportedReusableSymbolsCount,
        laborForceMultiplierDelta: Number((laborForceMultiplier - prevMultiplier).toFixed(2)),
        summary:
          currentSnapshot.securityFindingsCount <= prev.securityFindingsCount &&
          currentSnapshot.ponytailBloatCount <= prev.ponytailBloatCount
            ? `🟢 棘轮状态健康：安全风险与冗余代码只减不增，研发劳动力倍增系数达 ${laborForceMultiplier}x`
            : '🟡 检测到新增提醒项，建议按 Ponytail 与安全边界清单复核精简',
      }
    : {
        securityDelta: 0,
        ponytailBloatDelta: 0,
        reusableHelpersDelta: 0,
        laborForceMultiplierDelta: 0,
        summary: `✨ 已建立本项目首次安全与极简度棘轮基线 (Ratchet Baseline · 研发劳动力倍增系数 ${laborForceMultiplier}x)`,
      };

  if ((hasMemoryInitialized || options?.writeRatchet === true) && !options?.readOnly) {
    fs.mkdirSync(storeDir, { recursive: true });
    const nextHistory = [...history.slice(-19), currentSnapshot];
    const tmpMetricsPath = `${metricsPath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(
      tmpMetricsPath,
      JSON.stringify(
        {
          projectRoot: absRoot,
          lastUpdated: currentSnapshot.timestamp,
          currentSnapshot,
          latestSnapshot: currentSnapshot,
          evolutionDelta,
          history: nextHistory,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    fs.renameSync(tmpMetricsPath, metricsPath);
  }

  return {
    ok: true,
    projectRoot: absRoot,
    scannedFiles: files.length,
    securityFindings,
    ponytailFindings,
    contractAndTestFindings,
    currentSnapshot,
    laborForceMetrics,
    evolutionDelta,
    metricsPath: hasMemoryInitialized || options?.writeRatchet ? metricsPath : null,
  };
}

export function recordRsiExperiment(rawOpts = {}) {
  const rawProjectRoot = rawOpts.projectRoot || rawOpts.project_root || '';
  const experimentTitle = String(rawOpts.experimentTitle || rawOpts.experiment_title || '').trim();
  const targetDomain = String(rawOpts.targetDomain || rawOpts.target_domain || 'PLUGIN_OR_SKILL').trim().toUpperCase();
  const step1 = String(rawOpts.step1Hypothesis || rawOpts.step1_hypothesis || '').trim();
  const step2 = String(rawOpts.step2ExperimentDesign || rawOpts.step2_experiment_design || '').trim();
  const step3 = String(rawOpts.step3CodeChanges || rawOpts.step3_code_changes || '').trim();
  const step4 = String(rawOpts.step4ExperimentRun || rawOpts.step4_experiment_run || '').trim();
  const step5 = String(rawOpts.step5ResultAnalysis || rawOpts.step5_result_analysis || '').trim();
  const step6 = String(rawOpts.step6FailureDiagnosis || rawOpts.step6_failure_diagnosis || '').trim();
  const step7 = String(rawOpts.step7RouteAdjustment || rawOpts.step7_route_adjustment || '').trim();
  const step8 = String(rawOpts.step8NextCycleAndLaborMinted || rawOpts.step8_next_cycle_and_labor_minted || '').trim();
  const dryRun = Boolean(rawOpts.dryRun ?? rawOpts.dry_run ?? false);
  const allowEngineSelfTest = Boolean(rawOpts.allowEngineSelfTest ?? rawOpts.allow_engine_self_test ?? false);

  if (!rawProjectRoot || !experimentTitle || !step1 || !step2 || !step3 || !step4 || !step5 || !step6 || !step7 || !step8) {
    return {
      ok: false,
      error: '⚠️ 参数缺失：project_root、experiment_title 以及 8 步科学实验闭环（step1_hypothesis 至 step8_next_cycle_and_labor_minted）全部为必填项！',
    };
  }
  const validDomains = ['USER_HABIT', 'PLUGIN_OR_SKILL', 'CODE_ARCHITECTURE', 'SWARM_WORKFLOW'];
  const normalizedDomain = validDomains.includes(targetDomain) ? targetDomain : 'PLUGIN_OR_SKILL';
  const absRoot = resolveCanonicalProjectRoot(rawProjectRoot);
  if (isContainerOrMotherDir(absRoot, allowEngineSelfTest)) {
    return {
      ok: false,
      error: `⚠️ 路径隔离拦截：project_root (${absRoot}) 是容器目录或母版库，请传入具体业务项目根目录！`,
    };
  }
  if (!allowEngineSelfTest && !hasRealProjectFiles(absRoot)) {
    return {
      ok: false,
      error: `⚠️ 空壳目录拦截：project_root (${absRoot}) 不存在或无真实业务代码文件，拒绝写入孤儿 memory/！`,
    };
  }

  const memDir = path.join(absRoot, 'memory');
  const ledgerPath = path.join(memDir, 'EVOLUTION_LEDGER.md');
  const existingRaw = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf8') : '';
  const existingMatches = [...existingRaw.matchAll(/^### \[(RSI-(\d+))\]\s*(.+)$/gm)];
  const maxNum = existingMatches.reduce((mx, m) => Math.max(mx, Number(m[2]) || 0), 0);
  let rsiId = `RSI-${String(maxNum + 1).padStart(3, '0')}`;
  let deduplicated = false;
  const normTitle = experimentTitle.trim().toLowerCase();
  for (const m of existingMatches) {
    const cleanHeading = m[3].replace(/（8\s*步科学实验闭环[\s\S]*$/, '').trim().toLowerCase();
    if (cleanHeading === normTitle) {
      rsiId = m[1];
      deduplicated = true;
      break;
    }
  }
  const dateStr = new Date().toISOString().slice(0, 10);
  const entryBlock = [
    `### [${rsiId}] ${experimentTitle}（8 步科学实验闭环 · \`${normalizedDomain}\` · ${dateStr}）`,
    `- **Step 1 提出假设 (Hypothesis)**：${step1}`,
    `- **Step 2 设计实验 (Experiment Design)**：${step2}`,
    `- **Step 3 修改代码与固化工具 (Code & Tool Changes)**：${step3}`,
    `- **Step 4 启动实验 (Experiment Execution)**：${step4}`,
    `- **Step 5 分析实验结果 (Result Analysis)**：${step5}`,
    `- **Step 6 诊断失败原因 (Failure Diagnosis)**：${step6}`,
    `- **Step 7 调整实验路线 (Route Adjustment)**：${step7}`,
    `- **Step 8 开启下一轮迭代与铸造劳动力资产 (Next Cycle & Labor Force Minted)**：${step8}`,
  ].join('\n');

  if (dryRun) {
    const auditPreview = runSecurityAndSimplicityAudit(absRoot, { readOnly: true, allowEngineSelfTest });
    const baseLf = auditPreview.laborForceMetrics;
    const projectedLf = baseLf
      ? {
          ...baseLf,
          rsiExperimentsCount: deduplicated ? baseLf.rsiExperimentsCount : baseLf.rsiExperimentsCount + 1,
          laborForceMultiplier: deduplicated ? baseLf.laborForceMultiplier : Number((baseLf.laborForceMultiplier + 0.25).toFixed(2)),
        }
      : null;
    return {
      ok: true, dryRun: true, rsiId, experimentTitle, targetDomain: normalizedDomain, projectRoot: absRoot,
      ledgerPath, deduplicated, previewMarkdown: entryBlock, laborForceMetrics: projectedLf,
      evolutionDelta: { ...(auditPreview.evolutionDelta || {}), laborForceMultiplierDelta: deduplicated ? 0 : 0.25 },
    };
  }

  fs.mkdirSync(memDir, { recursive: true });
  const sectionHeader = '## 四、8 步科学实验闭环与研发劳动力倍增台账（Scientific RSI & Labor Force Compounding）';
  let nextRaw = existingRaw || `# 🧬 自进化与防复发踩坑账本 (\`EVOLUTION_LEDGER.md\`)\n\n${sectionHeader}\n`;
  if (deduplicated) {
    const escapedId = rsiId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const secRe = new RegExp(`^### \\[${escapedId}\\][\\s\\S]*?(?=^### \\[|^## |(?![\\s\\S]))`, 'm');
    if (secRe.test(nextRaw)) {
      nextRaw = nextRaw.replace(secRe, entryBlock + '\n\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    } else {
      nextRaw = nextRaw.trimEnd() + '\n\n' + entryBlock + '\n';
    }
  } else if (nextRaw.includes(sectionHeader)) {
    nextRaw = nextRaw.trimEnd() + '\n\n' + entryBlock + '\n';
  } else {
    nextRaw = nextRaw.trimEnd() + `\n\n---\n\n${sectionHeader}\n\n` + entryBlock + '\n';
  }
  fs.writeFileSync(ledgerPath, nextRaw, 'utf8');
  let sqliteSynced = false;
  try { sqliteSynced = Boolean(syncIncrementalIndex(absRoot, false, false)); } catch {}
  const auditRes = runSecurityAndSimplicityAudit(absRoot, { writeRatchet: true, allowEngineSelfTest });
  return {
    ok: true, dryRun: false, rsiId, experimentTitle, targetDomain: normalizedDomain, projectRoot: absRoot,
    ledgerPath, deduplicated, sqliteSynced, laborForceMetrics: auditRes.laborForceMetrics || null,
    evolutionDelta: auditRes.evolutionDelta || null, metricsPath: auditRes.metricsPath || null,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let rootDir = process.cwd();
  let allowEngineSelfTest = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) rootDir = args[++i];
    else if (args[i] === '--self-test' || args[i] === '--allow-self-test') allowEngineSelfTest = true;
  }
  const result = runSecurityAndSimplicityAudit(rootDir, { allowEngineSelfTest });
  console.log(JSON.stringify(result, null, 2));
}
