#!/usr/bin/env node
/**
 * ============================================================================
 * 通用全栈代码地图自动生成器 (Universal Auto Code Mapper)
 * ============================================================================
 * 用途：
 * - 自动扫描任意项目的目录结构、各文件精确行数、模块体积分级状态
 * - 自动提取导出的函数/类名与核心符号定义所在行号（支持 JS/MJS/CJS/TS/TSX/JSX/Python/HTML/Shell）
 * - 生成结构化的 Markdown 索引报告（或 JSON 数据），供 Agent 在几秒内精准定位代码并更新 memory/CODE_MAP.md
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 忽略扫描的目录集合（统一转为小写匹配）
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'backups', '.backups', 'dist', 'build', 'out',
  'coverage', '__pycache__', '.next', '.nuxt', '.venv', 'venv', '.venv_local',
  'env', '.env', '.cache', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox',
  '.idea', '.vscode', '.turbo', '.memory-store', 'memory-templates', 'profiles',
  'cache', 'cache_data', 'code cache', 'gpucache', 'blob_storage', 'vendor',
  'target', 'outputs', 'output', 'data', 'logs', 'launcher-logs', 'ui-audit',
  'evidence', 'db_data', 'video_frames', 'screenshots', 'artifacts', 'tmp', 'temp',
  'acme-source', 'frames', 'audio', 'raw',
]);

const SKIP_BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.mp4', '.mov', '.avi',
  '.mkv', '.mp3', '.wav', '.ogg', '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar',
  '.pdf', '.xlsx', '.xls', '.doc', '.docx', '.ppt', '.pptx', '.db', '.sqlite',
  '.sqlite3', '.shm', '.wal', '.pyc', '.pyo', '.so', '.dylib', '.dll', '.exe',
  '.bin', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.log', '.patch',
]);

const MAX_MAP_FILE_BYTES = 1536 * 1024; // 1.5MB 阈值

function shouldIgnoreDirName(name) {
  if (!name) return true;
  if (name.startsWith('.') && name !== '.agents') return true;
  if (IGNORED_DIRS.has(name.toLowerCase())) return true;
  if (/^(_db_|_backup|backup_|bak_|logs?\d*$|fingerprints)/i.test(name)) return true;
  if (/session[-_]data|user[-_]data|browser[-_]profile|acme-source/i.test(name)) return true;
  return false;
}

// 忽略扫描的 B 类机器自动派生文件与二进制产物
const IGNORED_FILES = new Set([
  '.DS_Store',
  'CODE_GRAPH_3D.html',
  'GRAPH_REPORT.md',
  'CODE_GRAPH_3D_PREVIEW.png',
  'CODE_GRAPH_FEDERATED_3D.html',
  'FEDERATED_GRAPH_REPORT.md',
  'CODE_GRAPH_FEDERATED_3D_PREVIEW.png',
  'memory.sqlite',
  'memory.sqlite-wal',
  'memory.sqlite-shm',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

/**
 * 解析命令行参数
 */
function parseArgs(argv) {
  const options = {
    root: '',
    output: '',
    json: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--root' && argv[i + 1]) {
      options.root = path.resolve(argv[++i]);
    } else if ((arg === '--output' || arg === '-o') && argv[i + 1]) {
      options.output = path.resolve(argv[++i]);
    }
  }

  if (!options.root) {
    if (process.env.PROJECT_ROOT) {
      options.root = path.resolve(process.env.PROJECT_ROOT);
    } else {
      let cwd = process.cwd();
      if (path.basename(cwd) === 'scripts' || path.basename(cwd) === 'hooks') {
        cwd = path.dirname(cwd);
      }
      if (path.basename(cwd) === '.agents' || path.basename(cwd) === '.agent') {
        cwd = path.dirname(cwd);
      }
      options.root = cwd;
    }
  }

  return options;
}

/**
 * 构建可视化目录树并收集所有文件
 */
function scanDirectoryTree(rootDir) {
  const treeLines = ['.'];
  const filePaths = [];
  const visitedDirs = new Set();

  function walk(dir, prefix, depth = 0) {
    if (depth > 8) return;
    let realDir = dir;
    try {
      realDir = fs.realpathSync(dir);
    } catch {
      return;
    }
    if (visitedDirs.has(realDir)) return;
    visitedDirs.add(realDir);

    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const filtered = entries
      .filter((e) => {
        if (e.isSymbolicLink()) return false;
        if (IGNORED_FILES.has(e.name)) return false;
        if (e.isDirectory()) return !shouldIgnoreDirName(e.name);
        if (e.isFile()) {
          if (e.name.startsWith('.') && e.name !== '.env.example') return false;
          if (e.name.endsWith('.min.js') || e.name.endsWith('.bundle.js')) return false;
          const ext = path.extname(e.name).toLowerCase();
          if (SKIP_BINARY_EXTS.has(ext)) return false;
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    filtered.forEach((entry, index) => {
      const isLast = index === filtered.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (treeLines.length < 300) treeLines.push(`${prefix}${connector}${entry.name}/`);
        walk(fullPath, prefix + childPrefix, depth + 1);
      } else if (entry.isFile()) {
        try {
          const st = fs.statSync(fullPath);
          if (st.size > MAX_MAP_FILE_BYTES) return;
        } catch {
          return;
        }
        if (treeLines.length < 300) treeLines.push(`${prefix}${connector}${entry.name}`);
        filePaths.push(fullPath);
      }
    });
  }

  walk(rootDir, '', 0);
  if (treeLines.length >= 300) treeLines.push('└── ... (更多子文件详见下方符号索引表)');
  return { treeText: treeLines.join('\n'), filePaths };
}

/**
 * 提取 JS / TS / MJS / CJS 文件中的函数、类与导出符号及行号
 */
function extractJsTsSymbols(lines) {
  const symbols = [];
  const patterns = [
    { type: 'export function', regex: /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/ },
    { type: 'export class', regex: /^\s*export\s+(?:default\s+)?class\s+([A-Za-z0-9_$]+)/ },
    { type: 'export const', regex: /^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/ },
    { type: 'function', regex: /^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/ },
    { type: 'class', regex: /^\s*class\s+([A-Za-z0-9_$]+)/ },
    { type: 'const fn', regex: /^\s*(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/ },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of patterns) {
      const match = line.match(pat.regex);
      if (match && match[1]) {
        symbols.push({
          name: match[1],
          kind: pat.type,
          line: i + 1,
        });
        break;
      }
    }
  }
  return symbols;
}

/**
 * 提取 Python 文件中的类与函数定义及行号
 */
function extractPythonSymbols(lines) {
  const symbols = [];
  const classRegex = /^\s*class\s+([A-Za-z0-9_]+)/;
  const defRegex = /^(\s*)(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cMatch = line.match(classRegex);
    if (cMatch) {
      symbols.push({ name: cMatch[1], kind: 'class', line: i + 1 });
      continue;
    }
    const dMatch = line.match(defRegex);
    if (dMatch) {
      const indent = dMatch[1].length;
      symbols.push({
        name: dMatch[2],
        kind: indent > 0 ? 'method' : 'def',
        line: i + 1,
      });
    }
  }
  return symbols;
}

/**
 * 提取 HTML 文件中的内联 <script> 块、核心 DOM 容器 ID 与内联函数行号
 */
function extractHtmlSymbols(lines) {
  const symbols = [];
  const idRegex = /\bid\s*=\s*['"]([A-Za-z0-9_-]+)['"]/g;
  const scriptStartRegex = /<script\b[^>]*>/i;
  const fnRegex = /^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (scriptStartRegex.test(line)) {
      symbols.push({ name: '<script>', kind: 'script-block', line: i + 1 });
    }
    const fnMatch = line.match(fnRegex);
    if (fnMatch) {
      symbols.push({ name: fnMatch[1], kind: 'inline-fn', line: i + 1 });
    }
    let idMatch;
    while ((idMatch = idRegex.exec(line)) !== null) {
      if (symbols.length < 40) {
        symbols.push({ name: `#${idMatch[1]}`, kind: 'dom-id', line: i + 1 });
      }
    }
  }
  return symbols;
}

/**
 * 提取 Shell 脚本中的函数定义与行号
 */
function extractShellSymbols(lines) {
  const symbols = [];
  const shFnRegex = /^\s*(?:function\s+)?([A-Za-z0-9_-]+)\s*\(\)\s*\{/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(shFnRegex);
    if (match && match[1]) {
      symbols.push({ name: match[1], kind: 'sh-fn', line: i + 1 });
    }
  }
  return symbols;
}

/**
 * 分析单个文件的行数、体积状态与符号索引
 */
function analyzeFile(filePath, rootDir) {
  const relPath = path.relative(rootDir, filePath);
  const ext = path.extname(filePath).toLowerCase() || '(no-ext)';

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  // 跳过二进制文件
  if (content.includes('\u0000')) {
    return null;
  }

  const lines = content.split('\n');
  const lineCount = lines.length;

  let volumeStatus = '🟢 健康 (≤300行)';
  if (lineCount >= 500) {
    volumeStatus = '🔴 超标 (≥500行，需乐高拆分或模式B渐进抽离)';
  } else if (lineCount > 300) {
    volumeStatus = '🟡 预警 (301~499行，禁止继续塞入无关特性)';
  }

  let symbols = [];
  if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].includes(ext)) {
    symbols = extractJsTsSymbols(lines);
  } else if (ext === '.py') {
    symbols = extractPythonSymbols(lines);
  } else if (ext === '.html' || ext === '.htm') {
    symbols = extractHtmlSymbols(lines);
  } else if (ext === '.sh' || ext === '.bash') {
    symbols = extractShellSymbols(lines);
  }

  return {
    file: relPath,
    ext,
    lines: lineCount,
    volumeStatus,
    symbols,
  };
}

/**
 * 生成结构化 Markdown 报告，可直接贴入或更新至 memory/CODE_MAP.md
 */
function renderMarkdownReport(data) {
  const out = [];
  out.push('# 🗺️ 项目全栈代码地图与符号行号索引 (Auto Code Map)');
  out.push('');
  out.push(`> **自动生成时间**: \`${data.generatedAt}\`  `);
  out.push(`> **扫描项目根目录**: \`${data.rootDir}\`  `);
  out.push(`> **统计摘要**: 共扫描 **${data.totalFiles}** 个文本/源码文件，累计 **${data.totalLines}** 行代码`);
  out.push('');

  out.push('## 1. 目录拓扑结构树');
  out.push('');
  out.push('```text');
  out.push(data.treeText);
  out.push('```');
  out.push('');

  out.push('## 2. 模块行数与体积分级总览');
  out.push('');
  out.push('| 文件路径 | 类型 | 行数 | 模块体积状态 | 关键符号数量 |');
  out.push('| :--- | :--- | ---: | :--- | ---: |');
  for (const item of data.files) {
    out.push(`| \`${item.file}\` | \`${item.ext}\` | ${item.lines} | ${item.volumeStatus} | ${item.symbols.length} |`);
  }
  out.push('');

  out.push('## 3. 核心源码模块符号与行号精准索引');
  out.push('');
  const filesWithSymbols = data.files.filter((f) => f.symbols.length > 0);
  if (filesWithSymbols.length === 0) {
    out.push('_当前目录暂无包含函数/类导出的代码文件。_');
  } else {
    for (const item of filesWithSymbols) {
      out.push(`### 📄 \`${item.file}\` (${item.lines} 行)`);
      const formattedSymbols = item.symbols
        .map((s) => `- \`L${s.line}\` **[${s.kind}]** \`${s.name}\``)
        .join('\n');
      out.push(formattedSymbols);
      out.push('');
    }
  }

  return out.join('\n');
}

function main() {
  const options = parseArgs(process.argv);
  const { treeText, filePaths } = scanDirectoryTree(options.root);

  const analyzedFiles = [];
  let totalLines = 0;

  for (const fp of filePaths) {
    const info = analyzeFile(fp, options.root);
    if (info) {
      analyzedFiles.push(info);
      totalLines += info.lines;
    }
  }

  const reportData = {
    rootDir: options.root,
    generatedAt: new Date().toISOString(),
    totalFiles: analyzedFiles.length,
    totalLines,
    treeText,
    files: analyzedFiles,
  };

  const outputText = options.json
    ? JSON.stringify(reportData, null, 2)
    : renderMarkdownReport(reportData);

  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    const startAnchor = '<!-- AUTO-CODE-MAP:START -->';
    const endAnchor = '<!-- AUTO-CODE-MAP:END -->';
    if (!options.json && fs.existsSync(options.output)) {
      const existingContent = fs.readFileSync(options.output, 'utf8');
      const startIdx = existingContent.indexOf(startAnchor);
      const endIdx = existingContent.indexOf(endAnchor);
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const merged =
          existingContent.slice(0, startIdx + startAnchor.length) +
          '\n\n' +
          outputText +
          '\n\n' +
          existingContent.slice(endIdx);
        fs.writeFileSync(options.output, merged, 'utf8');
        console.log(`✅ 代码地图已通过智能锚点无损注入更新（保留手工架构与SSoT表）: ${options.output}`);
        return;
      }
    }
    fs.writeFileSync(options.output, outputText + '\n', 'utf8');
    console.log(`✅ 代码地图已成功生成并写入: ${options.output}`);
  } else {
    process.stdout.write(outputText + '\n');
  }
}

main();
