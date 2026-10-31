#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const COLOR = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m', };
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'backups', '.backups', 'dist', 'build', 'out',
  'coverage', '__pycache__', '.next', '.nuxt', '.venv', 'venv', '.venv_local',
  'env', '.env', '.cache', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox',
  '.idea', '.vscode', '.turbo', 'vendor', 'target', 'outputs', 'output',
  'data', 'logs', 'launcher-logs', 'ui-audit', 'evidence', 'db_data',
  'video_frames', 'screenshots', 'artifacts', 'tmp', 'temp', 'acme-source',
  'frames', 'audio', 'raw',
]);
const SOURCE_EXTENSIONS = new Set([
  '.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx',
  '.html', '.htm', '.vue', '.svelte', '.css', '.scss',
  '.sh', '.bash', '.py', '.go', '.rs', '.java',
]);
const MAX_SCAN_FILE_BYTES = 1536 * 1024; // 1.5MB 阈值，跳过超大产物/数据转储文件
function stripJsoncCommentsAndTrailingCommas(raw) {
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inString) {
      out += ch;
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue; }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue; }
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < raw.length && raw[i] !== '\n') i++;
      if (i < raw.length) out += '\n';
      continue; }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) {
        if (raw[i] === '\n') out += '\n';
        i++; }
      i++;
      continue; }
    out += ch; }
  return out.replace(/,\s*([}\]])/g, '$1'); }
export function parseArgs(argv) {
  const options = {
    json: false,
    fast: process.env.EVO_FAST_PREFLIGHT === '1',
    strictMemory: false,
    root: '',
    healthUrl: process.env.HEALTH_CHECK_URL || '', };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--fast' || arg === '--hook-fast') options.fast = true;
    else if (arg === '--strict-memory') options.strictMemory = true;
    else if (arg === '--root' && argv[i + 1]) options.root = path.resolve(argv[++i]);
    else if (arg === '--health-url' && argv[i + 1]) options.healthUrl = argv[++i]; }
  if (!options.root) {
    if (process.env.PROJECT_ROOT) {
      options.root = path.resolve(process.env.PROJECT_ROOT);
    } else {
      let cwd = process.cwd();
      const base = path.basename(cwd);
      if (base === 'hooks' || base === 'scripts') cwd = path.dirname(cwd);
      if (path.basename(cwd) === '.agents' || path.basename(cwd) === '.agent') {
        cwd = path.dirname(cwd); }
      options.root = cwd; } }
  return options; }
export function walkProjectFiles(rootDir) {
  const files = [];
  const visitedDirs = new Set();
  function walk(currentDir) {
    let realDir = currentDir;
    try {
      realDir = fs.realpathSync(currentDir);
    } catch {
      return; }
    if (visitedDirs.has(realDir)) return;
    visitedDirs.add(realDir);
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const name = entry.name;
      if (IGNORED_DIRS.has(name.toLowerCase())) continue;
      if (entry.isDirectory()) {
        if (
          name.startsWith('.') ||
          /^(_db_|_backup|backup_|bak_|logs?\d*$|fingerprints)/i.test(name) ||
          /session[-_]data|user[-_]data|browser[-_]profile|acme-source/i.test(name)
        ) continue;
        walk(path.join(currentDir, name));
      } else if (entry.isFile()) {
        if (name.endsWith('.min.js') || name.endsWith('.bundle.js')) continue;
        const fullPath = path.join(currentDir, name);
        try {
          const st = fs.statSync(fullPath);
          if (st.size > MAX_SCAN_FILE_BYTES) continue;
        } catch {
          continue; }
        files.push(fullPath); } } }
  walk(rootDir);
  return files.sort(); }
function stripEsmSyntaxPreservingLines(code) {
  const blankKeepNewlines = (m) => m.replace(/[^\n]/g, ' ');
  return code
    .replace(/^\s*import\s+['"][^'"\n]+['"]\s*;?/gm, blankKeepNewlines)
    .replace(/^\s*import\s+(?:type\s+)?[A-Za-z0-9_$*\s,{}\n]+\s+from\s+['"][^'"\n]+['"]\s*;?/gm, blankKeepNewlines)
    .replace(/^\s*export\s+\*\s+(?:as\s+[A-Za-z0-9_$]+\s+)?from\s+['"][^'"\n]+['"]\s*;?/gm, blankKeepNewlines)
    .replace(/^\s*export\s+(?:type\s+)?\{[A-Za-z0-9_$*\s,\n]*\}\s*(?:from\s*['"][^'"\n]+['"])?\s*;?/gm, blankKeepNewlines)
    .replace(/^\s*export\s+default\s+(?=(?:async\s+)?function\b|class\b)/gm, '               ')
    .replace(/^\s*export\s+default\b/gm, 'void ')
    .replace(/^\s*export\s+(async\s+function|function|class|const|let|var)\s+/gm, '$1 ')
    .replace(/\bimport\.meta\b/g, '({ url: "" })'); }
function validateInlineScriptAst(scriptContent, relPath, scriptIndex, startLine, scriptType = '') {
  if (!scriptContent.trim()) return null;
  const compileWithVm = (code) => {
    new vm.Script(code, { filename: `${relPath}#inline-script-${scriptIndex}(L${startLine})` }); };
  try {
    compileWithVm(scriptContent);
    return null;
  } catch (firstErr) {
    const msg = String(firstErr && firstErr.message ? firstErr.message : firstErr);
    const isEsmSyntaxHint =
      scriptType === 'module' ||
      msg.includes('Cannot use import statement outside a module') ||
      msg.includes("Unexpected token 'export'") ||
      msg.includes('Cannot use import.meta outside a module') ||
      msg.includes('await is only valid in async functions');
    if (!isEsmSyntaxHint) return msg;
    const transformed = stripEsmSyntaxPreservingLines(scriptContent);
    try {
      compileWithVm(transformed);
      return null;
    } catch (secondErr) {
      const msg2 = String(secondErr && secondErr.message ? secondErr.message : secondErr);
      if (msg2.includes('await is only valid in async functions')) {
        try {
          compileWithVm(`(async () => { ${transformed}\n})()`);
          return null;
        } catch (thirdErr) {
          return String(thirdErr && thirdErr.message ? thirdErr.message : thirdErr); } }
      return msg2; } } }
function checkJsSyntaxFast(filePath, relPath) {
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return `无法读取文件: ${err.message}`; }
  const stripped = raw.replace(/^#![^\n]*\n/, '\n');
  try {
    new vm.Script(stripped, { filename: relPath });
    return null;
  } catch {
    if ((stripped.match(/^\s*export\s+default\b/gm) || []).length <= 1) {
      const transformed = stripEsmSyntaxPreservingLines(stripped);
      try {
        new vm.Script(transformed, { filename: relPath });
        return null;
      } catch {} }
    const res = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8', timeout: 5000 });
    if (res.status !== 0) {
      return (res.stderr || res.stdout || 'Node 语法校验失败').trim(); }
    return null; } }
export function runCheck1SyntaxAndAst(files, rootDir, options = {}) {
  const isFast = Boolean(options?.fast);
  const errors = [];
  const stats = { jsCount: 0, tsCount: 0, htmlCount: 0, inlineScriptCount: 0, shCount: 0, pyCount: 0, jsonCount: 0 };
  const pyFilesToBatch = [];
  const tsconfigPath = path.join(rootDir, 'tsconfig.json');
  const localTsc = path.join(rootDir, 'node_modules', '.bin', 'tsc');
  if (!isFast && fs.existsSync(tsconfigPath) && fs.existsSync(localTsc)) {
    const tsconfigApp = path.join(rootDir, 'tsconfig.app.json');
    const tscArgs = fs.existsSync(tsconfigApp) ? ['-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'] : ['--noEmit', '--pretty', 'false'];
    const tscRes = spawnSync(localTsc, tscArgs, { cwd: rootDir, encoding: 'utf8', timeout: 10000 });
    if (tscRes.status !== 0 && !tscRes.error) {
      const firstLine = (tscRes.stdout || tscRes.stderr || 'TypeScript 编译校验未通过').trim().split('\n')[0];
      errors.push({ file: 'tsconfig.json', type: 'TS_COMPILE_ERROR', message: firstLine }); } }
  let targetFiles = files;
  if (isFast && files.length > 120) {
    const nowMs = Date.now();
    const recentWindowMs = 6 * 3600 * 1000;
    const recent = files.filter((fp) => {
      try { return nowMs - fs.statSync(fp).mtimeMs <= recentWindowMs; } catch { return false; }
    });
    targetFiles = recent.length > 0 ? recent.slice(0, 120) : files.slice(0, 120);
  }
  for (const filePath of targetFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const relPath = path.relative(rootDir, filePath);
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      stats.jsCount++;
      const jsErr = checkJsSyntaxFast(filePath, relPath);
      if (jsErr) {
        errors.push({
          file: relPath,
          type: 'JS_SYNTAX_ERROR',
          message: jsErr, }); } }
    else if (ext === '.ts' || ext === '.tsx' || ext === '.jsx') {
      stats.tsCount++;
      try {
        const tsContent = fs.readFileSync(filePath, 'utf8');
        if (/^(<{7}\s|>{7}\s)/m.test(tsContent)) {
          errors.push({ file: relPath, type: 'TS_CONFLICT_MARKER', message: 'TS/TSX 文件包含未解决的 Git 冲突标记' });
        }
      } catch (err) {
        errors.push({ file: relPath, type: 'TS_READ_ERROR', message: err.message }); } }
    else if (ext === '.html' || ext === '.htm') {
      stats.htmlCount++;
      let content = '';
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (err) {
        errors.push({ file: relPath, type: 'HTML_READ_ERROR', message: `无法读取文件: ${err.message}` });
        continue; }
      const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
      let match;
      let scriptIdx = 0;
      while ((match = scriptRegex.exec(content)) !== null) {
        const attrs = match[1] || '';
        const body = match[2] || '';
        if (/\bsrc\s*=/i.test(attrs)) continue;
        const typeMatch = attrs.match(/\btype\s*=\s*['"]?([^'">\s]+)['"]?/i);
        const scriptType = typeMatch ? typeMatch[1].toLowerCase() : '';
        if (
          scriptType &&
          scriptType !== 'text/javascript' &&
          scriptType !== 'application/javascript' &&
          scriptType !== 'module'
        ) {
          continue; }
        scriptIdx++;
        stats.inlineScriptCount++;
        const startLine = content.slice(0, match.index).split('\n').length;
        const astErr = validateInlineScriptAst(body, relPath, scriptIdx, startLine, scriptType);
        if (astErr) {
          errors.push({
            file: `${relPath}:L${startLine}`,
            type: 'HTML_INLINE_SCRIPT_AST_ERROR',
            message: `内联 <script> #${scriptIdx} (第 ${startLine} 行) AST 语法错误: ${astErr}`, }); } } }
    else if (ext === '.sh' || ext === '.bash') {
      stats.shCount++;
      const res = spawnSync('bash', ['-n', filePath], { encoding: 'utf8', timeout: isFast ? 1500 : 5000 });
      if (res.status !== 0) {
        errors.push({
          file: relPath,
          type: 'SHELL_SYNTAX_ERROR',
          message: (res.stderr || res.stdout || 'Bash 语法检查未通过').trim(), }); } }
    else if (ext === '.py') {
      stats.pyCount++;
      pyFilesToBatch.push({ filePath, relPath }); }
    else if (ext === '.json') {
      stats.jsonCount++;
      try {
        const rawJson = fs.readFileSync(filePath, 'utf8');
        const isJsoncAllowed = /(?:^|[\/\\])(?:[tj]sconfig(?:\.[^\/\\]+)?|\.eslintrc(?:\.[^\/\\]+)?|devcontainer|components|turbo|biome|deno)\.json$/i.test(relPath);
        JSON.parse(isJsoncAllowed ? stripJsoncCommentsAndTrailingCommas(rawJson) : rawJson);
      } catch (err) {
        errors.push({ file: relPath, type: 'JSON_PARSE_ERROR', message: `JSON 格式错误: ${err.message}` });
      } } }
  if (pyFilesToBatch.length > 0) {
    const pyScript = [
      'import ast, json, sys',
      'errs = []',
      'for item in json.loads(sys.stdin.read()):',
      '    fp, rel = item["filePath"], item["relPath"]',
      '    try:',
      '        with open(fp, "rb") as f:',
      '            ast.parse(f.read(), filename=rel)',
      '    except SyntaxError as e:',
      '        errs.append({"file": rel, "message": f"{e.msg} (line {e.lineno})"})',
      '    except Exception as e:',
      '        errs.append({"file": rel, "message": str(e)})',
      'print(json.dumps(errs))',
    ].join('\n');
    const pyRes = spawnSync('python3', ['-c', pyScript], {
      input: JSON.stringify(pyFilesToBatch),
      encoding: 'utf8',
      timeout: isFast ? 1500 : 12000, });
    if (pyRes.status === 0 && pyRes.stdout) {
      try {
        const pyErrs = JSON.parse(pyRes.stdout.trim());
        for (const pe of pyErrs) {
          errors.push({ file: pe.file, type: 'PYTHON_SYNTAX_ERROR', message: pe.message }); }
      } catch {}
    } else if (!isFast && (pyRes.error || pyRes.status !== 0)) {
      errors.push({
        file: 'python3_batch_ast',
        type: 'PYTHON_SYNTAX_ERROR',
        message: (pyRes.stderr || pyRes.stdout || 'Python 批量语法检查异常').trim().slice(0, 200), }); } }
  return { passed: errors.length === 0, stats, errors }; }
export function runCheck2ModuleVolumeRadar(files, rootDir) {
  const splitSuggestions = []; // 600 < lines <= 1500
  const legacyLargeFiles = []; // lines > 1500
  let totalSourceFiles = 0;
  let totalLines = 0;
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    if (relPath === 'memory/CODE_GRAPH_3D.html' || relPath === 'memory/CODE_GRAPH_FEDERATED_3D.html') continue;
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue; }
    const lineCount = content.split('\n').length;
    totalSourceFiles++;
    totalLines += lineCount;
    if (lineCount > 1500) {
      legacyLargeFiles.push({ file: relPath, lines: lineCount, label: '📦 待渐进抽离追踪提醒 (>1500行)' });
    } else if (lineCount > 600) {
      splitSuggestions.push({ file: relPath, lines: lineCount, label: '⚠️ 模块拆分建议 (>600行)' }); } }
  return { passed: true, totalSourceFiles, totalLines, splitSuggestions, legacyLargeFiles }; }
export function runCheck3AntiPatternScan(files, rootDir) {
  const blockingIssues = [];
  const warnings = [];
  const todoFixmeRegex = new RegExp('TO' + 'DO:\\s*FIX' + 'ME', 'i');
  const mergeConflictRegex = new RegExp('^(' + '<'.repeat(7) + '\\s|' + '>'.repeat(7) + '\\s)', 'm');
  const privateKeyRegex = new RegExp('-----BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----');
  const awsKeyRegex = new RegExp('\\bAKIA' + '[0-9A-Z]{16}\\b');
  const hardcodedSecretRegex = new RegExp(
    '(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\\s*[:=]\\s*[\'"](?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{25,}|xox[baprs]-[a-zA-Z0-9-]{20,})[\'"]',
    'i'
  );
  const emptyCatchRegex = /catch\s*\([^)]*\)\s*\{\s*\}/;
  const deprecatedFocusApi = ['init', 'With', 'Focused', 'View', 'Rect'].join('');
  for (const filePath of files) {
    if (path.basename(filePath) === 'universal-preflight-gate.mjs') continue;
    if (path.resolve(filePath) === path.resolve(__filename)) continue;
    const ext = path.extname(filePath).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    if (relPath === 'memory/CODE_GRAPH_3D.html' || relPath === 'memory/CODE_GRAPH_FEDERATED_3D.html') continue;
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue; }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      if (todoFixmeRegex.test(line)) {
        blockingIssues.push({
          file: `${relPath}:L${lineNum}`,
          rule: 'UNRESOLVED_TODO_FIXME',
          message: `存在未处理的阻塞标记: ${line.trim().slice(0, 80)}`, }); }
      if (mergeConflictRegex.test(line)) {
        blockingIssues.push({
          file: `${relPath}:L${lineNum}`,
          rule: 'GIT_CONFLICT_MARKER',
          message: '检测到未解决的 Git 合并冲突标记', }); }
      if (privateKeyRegex.test(line) || awsKeyRegex.test(line) || hardcodedSecretRegex.test(line)) {
        blockingIssues.push({
          file: `${relPath}:L${lineNum}`,
          rule: 'HARDCODED_SECRET_DETECTED',
          message: '检测到疑似硬编码高危密钥或私钥特征，请改用环境变量', }); }
      if (line.includes(deprecatedFocusApi)) {
        warnings.push({
          file: `${relPath}:L${lineNum}`,
          rule: 'MACOS_DEPRECATED_FOCUS_VIEW_API',
          message: '检测到已废弃的 initWithFocusedViewRect:，在无头 CLI 或无活动窗口环境下将静默失败，建议改用 sips 或 [icon TIFFRepresentation] + NSBitmapImageRep (EVO-011)',
        }); } }
    if (emptyCatchRegex.test(content)) {
      warnings.push({
        file: relPath,
        rule: 'EMPTY_CATCH_BLOCK',
        message: '检测到空的 catch {} 块，建议补充错误日志或显式注释说明原因', }); }
    if (!relPath.startsWith('scripts/') && lines.length > 500) {
      warnings.push({
        file: relPath,
        rule: 'LEGO_MODULE_SIZE_500',
        message: `单文件达 ${lines.length} 行（超过 500 行红线）：若是新模块请拆分；若是模式 B 存量历史大文件请确认已登记在 memory/CODE_MAP.md 且行数只减不增`,
      }); } }
  return { passed: blockingIssues.length === 0, blockingIssues, warnings }; }
export function runCheck4MemoryLedgerCheck(rootDir, strictMemory) {
  const requiredLedgers = [
    'memory/USER_PROFILE.md',
    'memory/PRODUCT_PROGRESS.md',
    'memory/CODE_MAP.md',
    'memory/EVOLUTION_LEDGER.md',
    'memory/ARCHITECTURE_DECISIONS.md',
    'memory/CONVERSATION_INDEX.md',
  ];
  const details = [];
  const missingOrInvalid = [];
  for (const relLedger of requiredLedgers) {
    const fullPath = path.join(rootDir, relLedger);
    if (!fs.existsSync(fullPath)) {
      missingOrInvalid.push({ file: relLedger, status: 'MISSING', message: '活体记忆账本文件尚未创建' });
      details.push({ file: relLedger, valid: false, status: 'MISSING' });
      continue; }
    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf8').trim();
    } catch (err) {
      missingOrInvalid.push({ file: relLedger, status: 'READ_ERROR', message: `读取失败: ${err.message}` });
      details.push({ file: relLedger, valid: false, status: 'READ_ERROR' });
      continue; }
    const hasHeading = /^#\s+.+/m.test(content);
    if (!content || content.length < 20 || !hasHeading) {
      missingOrInvalid.push({
        file: relLedger,
        status: 'INVALID_FORMAT',
        message: '账本内容为空或缺少标准 Markdown 一级标题结构', });
      details.push({ file: relLedger, valid: false, status: 'INVALID_FORMAT' });
    } else {
      details.push({ file: relLedger, valid: true, status: 'OK', lines: content.split('\n').length });
    } }
  const allReady = missingOrInvalid.length === 0;
  return { passed: strictMemory ? allReady : true, allReady, details, missingOrInvalid }; }
export function runCheck5HealthProbe(healthUrl, rootDir, options = {}) {
  const isFast = Boolean(options?.fast);
  let targetUrl = healthUrl;
  if (!targetUrl) {
    const hcFile = path.join(rootDir, '.healthcheck');
    if (fs.existsSync(hcFile)) {
      try {
        targetUrl = fs.readFileSync(hcFile, 'utf8').trim();
      } catch {
        targetUrl = ''; } } }
  if (!targetUrl) {
    return Promise.resolve({
      passed: true,
      configured: false,
      message: '未配置激活的本地服务健康探针（可通过 HEALTH_CHECK_URL 环境变量或 .healthcheck 文件启用）', }); }
  return new Promise((resolve) => {
    const client = targetUrl.startsWith('https://') ? https : http;
    const req = client.get(targetUrl, { timeout: isFast ? 1000 : 3500 }, (res) => {
      res.resume();
      const ok = res.statusCode >= 200 && res.statusCode < 400;
      resolve({
        passed: ok,
        configured: true,
        url: targetUrl,
        statusCode: res.statusCode,
        message: ok
          ? `本地服务健康探针响应正常 (HTTP ${res.statusCode})`
          : `本地服务健康探针返回异常状态码 (HTTP ${res.statusCode})`, }); });
    req.on('timeout', () => {
      req.destroy();
      resolve({ passed: false, configured: true, url: targetUrl, message: `本地服务健康探针请求超时: ${targetUrl}` });
    });
    req.on('error', (err) => {
      resolve({ passed: false, configured: true, url: targetUrl, message: `本地服务健康探针连接失败: ${err.message}` });
    }); }); }
function printHumanReport(report) {
  const { rootDir, durationMs, checks, overallPassed } = report;
  const c1 = checks.check1SyntaxAndAst;
  const c2 = checks.check2ModuleVolume;
  const c3 = checks.check3AntiPatterns;
  const c4 = checks.check4MemoryLedgers;
  const c5 = checks.check5HealthProbe;
  console.log(`\n${COLOR.bold}${COLOR.cyan}======================================================================${COLOR.reset}`);
  console.log(`${COLOR.bold}🛡️  通用全栈自动化预检门禁报告 (Universal Pre-flight Gate)${COLOR.reset}`);
  console.log(`${COLOR.dim}扫描根目录: ${rootDir} | 耗时: ${durationMs}ms${COLOR.reset}`);
  console.log(`${COLOR.bold}${COLOR.cyan}======================================================================${COLOR.reset}\n`);
  const c1Badge = c1.passed ? `${COLOR.green}✅ 通过${COLOR.reset}` : `${COLOR.red}❌ 失败 (${c1.errors.length} 处错误)${COLOR.reset}`;
  console.log(`${COLOR.bold}[Check 1] 全语言语法与内联 <script> AST 扫描:${COLOR.reset} ${c1Badge}`);
  console.log(
    `  ${COLOR.dim}已校验 -> JS/MJS: ${c1.stats.jsCount} | TS/TSX: ${c1.stats.tsCount || 0} | HTML: ${c1.stats.htmlCount} (内联脚本: ${c1.stats.inlineScriptCount}) | Shell: ${c1.stats.shCount} | Python: ${c1.stats.pyCount} | JSON: ${c1.stats.jsonCount}${COLOR.reset}`
  );
  for (const err of c1.errors) console.log(`  ${COLOR.red}• [${err.type}] ${err.file}: ${err.message}${COLOR.reset}`);
  const c2WarnCount = c2.splitSuggestions.length + c2.legacyLargeFiles.length;
  const c2Badge =
    c2WarnCount === 0
      ? `${COLOR.green}✅ 全部业务模块体积健康 (≤500行)${COLOR.reset}`
      : `${COLOR.yellow}⚠️ 发现 ${c2WarnCount} 个大体积模块需关注${COLOR.reset}`;
  console.log(`\n${COLOR.bold}[Check 2] 防万行屎山与模块体积雷达:${COLOR.reset} ${c2Badge}`);
  console.log(`  ${COLOR.dim}源码文件总数: ${c2.totalSourceFiles} | 累计源码行数: ${c2.totalLines} 行${COLOR.reset}`);
  for (const item of c2.legacyLargeFiles) console.log(`  ${COLOR.yellow}• ${item.label}: ${item.file} (${item.lines} 行)${COLOR.reset}`);
  for (const item of c2.splitSuggestions) console.log(`  ${COLOR.yellow}• ${item.label}: ${item.file} (${item.lines} 行)${COLOR.reset}`);
  const c3Badge = c3.passed
    ? `${COLOR.green}✅ 0 阻塞级危险反模式${COLOR.reset}`
    : `${COLOR.red}❌ 发现 ${c3.blockingIssues.length} 处高危/阻塞反模式${COLOR.reset}`;
  console.log(`\n${COLOR.bold}[Check 3] 前端与全栈危险反模式静态扫描:${COLOR.reset} ${c3Badge}`);
  for (const issue of c3.blockingIssues) console.log(`  ${COLOR.red}• [${issue.rule}] ${issue.file}: ${issue.message}${COLOR.reset}`);
  for (const warn of c3.warnings) console.log(`  ${COLOR.yellow}• [提醒] ${warn.file}: ${warn.message}${COLOR.reset}`);
  const c4Badge = c4.allReady
    ? `${COLOR.green}✅ ${c4.details.length}/${c4.details.length} 活体记忆账本完好${COLOR.reset}`
    : `${COLOR.yellow}⚠️ ${c4.missingOrInvalid.length} 个记忆账本待初始化或补全${COLOR.reset}`;
  console.log(`\n${COLOR.bold}[Check 4] 活体记忆账本完整性检查:${COLOR.reset} ${c4Badge}`);
  for (const d of c4.details) {
    if (d.valid) console.log(`  ${COLOR.green}• ${d.file}: 格式完好 (${d.lines} 行)${COLOR.reset}`);
    else console.log(`  ${COLOR.yellow}• ${d.file}: ${d.status}${COLOR.reset}`); }
  let c5Badge = `${COLOR.blue}⚪ 未启用 (按需可选)${COLOR.reset}`;
  if (c5.configured) c5Badge = c5.passed ? `${COLOR.green}✅ 健康在线${COLOR.reset}` : `${COLOR.red}❌ 探针异常${COLOR.reset}`;
  console.log(`\n${COLOR.bold}[Check 5] 可选本地服务健康探针:${COLOR.reset} ${c5Badge}`);
  console.log(`  ${COLOR.dim}${c5.message}${COLOR.reset}`);
  console.log(`\n${COLOR.bold}${COLOR.cyan}----------------------------------------------------------------------${COLOR.reset}`);
  if (overallPassed) {
    console.log(`${COLOR.bold}${COLOR.green}🎉 预检门禁总结: 全部必过门禁项校验通过！(EXIT 0)${COLOR.reset}\n`);
  } else {
    console.log(`${COLOR.bold}${COLOR.red}🚨 预检门禁总结: 存在未通过的强制门禁项，请修复后再提交！(EXIT 1)${COLOR.reset}\n`);
  } }
async function main() {
  const startTime = Date.now();
  const options = parseArgs(process.argv);
  const files = walkProjectFiles(options.root);
  const check1SyntaxAndAst = runCheck1SyntaxAndAst(files, options.root, options);
  const check2ModuleVolume = runCheck2ModuleVolumeRadar(files, options.root);
  const check3AntiPatterns = runCheck3AntiPatternScan(files, options.root);
  const check4MemoryLedgers = runCheck4MemoryLedgerCheck(options.root, options.strictMemory);
  const check5HealthProbe = await runCheck5HealthProbe(options.healthUrl, options.root, options);
  const overallPassed =
    check1SyntaxAndAst.passed &&
    check3AntiPatterns.passed &&
    check4MemoryLedgers.passed &&
    check5HealthProbe.passed;
  const report = {
    overallPassed,
    rootDir: options.root,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    checks: { check1SyntaxAndAst, check2ModuleVolume, check3AntiPatterns, check4MemoryLedgers, check5HealthProbe },
  };
  if (options.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else printHumanReport(report);
  process.exit(overallPassed ? 0 : 1); }
if (import.meta.url === `file://${process.argv[1]}` || (process.argv[1] && process.argv[1].endsWith('universal-preflight-gate.mjs'))) {
  main();
}
