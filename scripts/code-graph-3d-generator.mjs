#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openMemoryDatabase, syncIncrementalIndex, collectProjectFiles } from './memory-graph-engine.mjs';
import { parseFileToNodesAndEdges } from './memory-vector-tokenizer.mjs';
import {
  resolveCanonicalProjectRoot,
  isContainerOrMotherDir,
  hasRealProjectFiles,
  normalizePathInput,
} from './cross-project-federation.mjs';
export function buildGraphAndBlastRadius(rootDir, targetFileQuery = '', options = {}) {
  const allowSelfTest = Boolean(options?.allowEngineSelfTest ?? options?.allow_engine_self_test);
  const readOnly = Boolean(options?.readOnly ?? options?.read_only);
  const absRoot = resolveCanonicalProjectRoot(rootDir);
  if (!absRoot || isContainerOrMotherDir(absRoot, allowSelfTest)) {
    return {
      ok: false,
      error: `⚠️ 路径隔离拦截：project_root (${absRoot || rootDir}) 是容器目录或母版库，请指定具体业务子项目目录！`, }; }
  if (!allowSelfTest && !hasRealProjectFiles(absRoot)) {
    return {
      ok: false,
      error: `⚠️ 空壳目录拦截：project_root (${absRoot}) 不存在或无真实业务源码文件，已阻止创建孤儿 memory/！`, }; }
  const memDir = path.join(absRoot, 'memory');
  const hasMemoryInitialized =
    fs.existsSync(path.join(memDir, 'PRODUCT_PROGRESS.md')) ||
    fs.existsSync(path.join(memDir, 'CODE_GRAPH_3D.html'));
  let rawNodes = [];
  let rawEdges = [];
  if (readOnly && !hasMemoryInitialized) {
    for (const fullPath of collectProjectFiles(absRoot)) {
      try {
        const relFile = path.relative(absRoot, fullPath).replace(/\\/g, '/');
        const parsed = parseFileToNodesAndEdges(fullPath, relFile, fs.readFileSync(fullPath, 'utf8'), absRoot);
        for (const n of parsed.nodes) rawNodes.push({ id: n.id, type: n.type, title: n.title, file_path: n.file_path, content: n.content });
        for (const e of parsed.edges) rawEdges.push({ source_id: e.from, target_id: e.to, relation: e.relation, weight: e.weight });
      } catch {}
    }
  } else {
    syncIncrementalIndex(absRoot, false, false);
    let db = openMemoryDatabase(absRoot);
    const sourceNodeCount = db.prepare(`SELECT COUNT(*) AS c FROM memory_nodes WHERE type = 'SOURCE_FILE'`).get()?.c || 0;
    const manifestSourceCount =
      db.prepare(`SELECT COUNT(*) AS c FROM file_manifest WHERE file_path NOT LIKE 'memory/%'`).get()?.c || 0;
    if (manifestSourceCount > 0 && sourceNodeCount === 0) {
      db.close();
      syncIncrementalIndex(absRoot, true, false);
      db = openMemoryDatabase(absRoot); }
    rawNodes = db.prepare(`SELECT id, type, title, file_path, content FROM memory_nodes`).all();
    rawEdges = db.prepare(`SELECT from_id AS source_id, to_id AS target_id, relation, weight FROM memory_edges`).all();
    db.close();
  }
  const nodeMap = new Map();
  for (const n of rawNodes) {
    const lineMatch = n.title.match(/\((\d+)行\)/) || n.content.match(/行数:\s*(\d+)/);
    const lines = lineMatch ? Number(lineMatch[1]) : 0;
    const exportMatch = n.content.match(/导出符号:\s*([^\n|]+)/);
    const exportsList = exportMatch
      ? exportMatch[1].split(/[,，]/).map((s) => s.trim()).filter((s) => s && s !== '无显式导出')
      : [];
    nodeMap.set(n.id, {
      id: n.id,
      type: n.type,
      title: n.title.replace(/`/g, ''),
      file: n.file_path,
      lines,
      exports: exportsList,
      snippet: (n.content || '').replace(/\s+/g, ' ').slice(0, 220),
      inDegree: 0,
      outDegree: 0,
      callers: [],
      callees: [],
      linkedMemories: [] }); }
  const validEdges = [];
  const astDirectedSet = new Set();
  const astUndirectedSet = new Set();
  const inferredPairSet = new Set();
  for (const e of rawEdges) {
    if (!nodeMap.has(e.source_id) || !nodeMap.has(e.target_id) || e.source_id === e.target_id) continue;
    const isAst = e.relation === 'IMPORTS' || e.relation === 'DEPENDS_ON';
    if (!isAst) continue;
    const dirKey = `${e.source_id}->${e.target_id}`;
    if (astDirectedSet.has(dirKey)) continue;
    astDirectedSet.add(dirKey);
    astUndirectedSet.add([e.source_id, e.target_id].sort().join('::'));
    validEdges.push({
      source: e.source_id,
      target: e.target_id,
      relation: e.relation,
      provenance: 'EXTRACTED',
      weight: e.weight });
    const src = nodeMap.get(e.source_id);
    const dst = nodeMap.get(e.target_id);
    src.outDegree++;
    dst.inDegree++;
    if (!src.callees.includes(dst.id)) src.callees.push(dst.id);
    if (!dst.callers.includes(src.id)) dst.callers.push(src.id); }
  for (const e of rawEdges) {
    if (!nodeMap.has(e.source_id) || !nodeMap.has(e.target_id) || e.source_id === e.target_id) continue;
    const isAst = e.relation === 'IMPORTS' || e.relation === 'DEPENDS_ON';
    if (isAst || e.relation === 'REV_RELATES_TO') continue;
    const pairKey = [e.source_id, e.target_id].sort().join('::');
    if (astUndirectedSet.has(pairKey) || inferredPairSet.has(pairKey)) continue;
    inferredPairSet.add(pairKey);
    validEdges.push({
      source: e.source_id,
      target: e.target_id,
      relation: e.relation,
      provenance: 'INFERRED',
      weight: e.weight });
    const src = nodeMap.get(e.source_id);
    const dst = nodeMap.get(e.target_id);
    if (src.type !== 'SOURCE_FILE') src.outDegree++;
    if (dst.type !== 'SOURCE_FILE') dst.inDegree++;
    if (dst.type !== 'SOURCE_FILE' && !src.linkedMemories.includes(dst.id)) src.linkedMemories.push(dst.id);
    if (src.type !== 'SOURCE_FILE' && !dst.linkedMemories.includes(src.id)) dst.linkedMemories.push(src.id);
  }
  const nodes = Array.from(nodeMap.values());
  const godNodes = [...nodes]
    .filter((n) => n.type === 'SOURCE_FILE' || n.type === 'CODE_MODULE')
    .sort((a, b) => (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree))
    .slice(0, 8)
    .map((n) => ({
      id: n.id,
      file: n.file,
      lines: n.lines,
      inDegree: n.inDegree,
      outDegree: n.outDegree,
      totalDegree: n.inDegree + n.outDegree }));
  const cycles = [];
  const visited = new Set();
  const onStack = new Set();
  const pathStack = [];
  function dfsCycle(uId) {
    visited.add(uId);
    onStack.add(uId);
    pathStack.push(uId);
    const u = nodeMap.get(uId);
    for (const vId of (u ? u.callees : [])) {
      if (!visited.has(vId)) {
        dfsCycle(vId);
      } else if (onStack.has(vId)) {
        const idx = pathStack.indexOf(vId);
        if (idx !== -1 && cycles.length < 10) {
          cycles.push([...pathStack.slice(idx), vId]); } } }
    pathStack.pop();
    onStack.delete(uId); }
  for (const n of nodes) {
    if ((n.type === 'SOURCE_FILE' || n.type === 'CODE_MODULE') && !visited.has(n.id)) {
      dfsCycle(n.id); } }
  const entryRegex = /(index|main|app|server|cli|bootstrap|start|route|page|gate|guardian|inspector|mapper|engine|generator|audit|install|rollback)\./i;
  const orphanFiles = nodes
    .filter((n) => n.type === 'SOURCE_FILE' && n.inDegree === 0 && !entryRegex.test(n.file))
    .map((n) => ({ id: n.id, file: n.file, lines: n.lines }));
  const reusableHelpers = nodes
    .filter((n) => (n.type === 'SOURCE_FILE' || n.type === 'CODE_MODULE') && n.exports.length > 0)
    .map((n) => ({
      file: n.file,
      exports: n.exports.slice(0, 12),
      lines: n.lines }))
    .slice(0, 25);
  let blastRadiusReport = null;
  if (targetFileQuery) {
    let normQ = normalizePathInput(targetFileQuery).replace(/\\/g, '/');
    if (path.isAbsolute(normQ)) {
      const rel = path.relative(absRoot, normQ).replace(/\\/g, '/');
      if (!rel.startsWith('..')) normQ = rel;
      else normQ = path.basename(normQ); }
    normQ = normQ.replace(/^\.\//, '');
    const cleanQ = normQ.trim().toLowerCase();
    const baseQ = path.basename(cleanQ);
    const matched =
      nodes.find((n) => n.file && n.file.toLowerCase() === cleanQ) ||
      nodes.find((n) => n.id.toLowerCase().includes(cleanQ) || (n.file && n.file.toLowerCase().includes(cleanQ))) ||
      (baseQ ? nodes.find((n) => n.file && path.basename(n.file.toLowerCase()) === baseQ) : null);
    if (matched) {
      const hop1Callers = matched.callers;
      const hop2Callers = new Set();
      for (const c1 of hop1Callers) {
        const cNode = nodeMap.get(c1);
        if (cNode) {
          for (const c2 of cNode.callers) {
            if (c2 !== matched.id && !hop1Callers.includes(c2)) hop2Callers.add(c2); } } }
      blastRadiusReport = {
        targetNode: matched.id,
        targetFile: matched.file,
        lines: matched.lines,
        exports: matched.exports,
        directUpstreamCallers: hop1Callers.map((id) => nodeMap.get(id)?.file || id),
        indirectUpstreamCallersHop2: Array.from(hop2Callers).map((id) => nodeMap.get(id)?.file || id),
        directDownstreamCallees: matched.callees.map((id) => nodeMap.get(id)?.file || id),
        linkedMemoriesAndGuardrails: matched.linkedMemories.map((id) => {
          const m = nodeMap.get(id);
          return m ? `[${m.type}] ${m.id}: ${m.title}` : id; }),
        riskLevel: hop1Callers.length + hop2Callers.size >= 5 ? 'HIGH (高爆炸半径核心枢纽)' : hop1Callers.length > 0 ? 'MEDIUM (跨模块被依赖)' : 'LOW (叶子模块)'
      }; } }
  const reportMdPath = path.join(memDir, 'GRAPH_REPORT.md');
  const html3dPath = path.join(memDir, 'CODE_GRAPH_3D.html');
  let browserLaunched = false;
  if (!(readOnly && !hasMemoryInitialized)) {
    fs.mkdirSync(memDir, { recursive: true });
    const mdContent = renderGraphReportMd({ absRoot, html3dPath, nodes, validEdges, godNodes, cycles, orphanFiles, reusableHelpers });
    if (!fs.existsSync(reportMdPath) || fs.readFileSync(reportMdPath, 'utf8') !== mdContent) {
      fs.writeFileSync(reportMdPath, mdContent, 'utf8'); }
    const htmlContent = render3dGalaxyHtml({ projectName: path.basename(absRoot), nodes, edges: validEdges, godNodes, cycles });
    if (!fs.existsSync(html3dPath) || fs.readFileSync(html3dPath, 'utf8') !== htmlContent) {
      fs.writeFileSync(html3dPath, htmlContent, 'utf8'); }
    if (options && options.openInBrowser) {
      try {
        const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
        browserLaunched = spawnSync(opener, [html3dPath], { stdio: 'ignore', timeout: 5000 }).status === 0;
      } catch {
        browserLaunched = false; } }
  }
  return {
    projectRoot: absRoot,
    totalNodes: nodes.length,
    totalEdges: validEdges.length,
    extractedAstEdges: validEdges.filter((e) => e.provenance === 'EXTRACTED').length,
    inferredMemoryEdges: validEdges.filter((e) => e.provenance === 'INFERRED').length,
    godNodes,
    cyclesCount: cycles.length,
    cycles,
    circularDependencies: cycles,
    orphanFiles,
    reusableHelpersCount: reusableHelpers.length,
    reusableHelpers,
    blastRadius: blastRadiusReport,
    blastRadiusReport,
    html3dPath,
    reportPath: reportMdPath,
    reportMdPath,
    generatedFiles: {
      html3dPath,
      reportMdPath,
      browserLaunched,
      openCommand: `open "${html3dPath}"`,
      viewingGuide: `💡 【EVO-015 铁律】请勿在反重力 IDE 聊天框中仅丢出 file://...html 链接（会被 IDE 当做源码文本打开）！请通过 open_in_browser: true 或执行 open "${html3dPath}" 直接在系统浏览器中弹出 3D 交互星系图，并在回答中附上渲染后的 .png 截图。`
    } }; }
function renderGraphReportMd({ absRoot, html3dPath, nodes, validEdges, godNodes, cycles, orphanFiles, reusableHelpers }) {
  const extractedCount = validEdges.filter((e) => e.provenance === 'EXTRACTED').length;
  const inferredCount = validEdges.filter((e) => e.provenance === 'INFERRED').length;
  return [
    `# 🌌 项目全景知识图谱、爆炸半径与可复用轮子诊断报告 (\`GRAPH_REPORT.md\`)`,
    ``,
    `> **自动生成与实时进化说明**：本报告与同目录下的 [\`CODE_GRAPH_3D.html\`](./CODE_GRAPH_3D.html) 由 \`code-graph-3d-generator.mjs\` 自动生成。每次任务完成或记忆索引同步时自动增量刷新。`,
    `> - **扫描根目录**：\`${absRoot}\``,
    `> - **图谱规模**：共 **${nodes.length}** 个节点 | **${validEdges.length}** 条关系边（其中 **${extractedCount}** 条 \`EXTRACTED\` 静态 AST 实证边，**${inferredCount}** 条 \`INFERRED\` 记忆推导边）`,
    `> - **💡 3D 图谱交互查看方式**：请勿在 IDE 聊天框直接点击 \`file://\` 链接（会被 IDE 作为文本源码打开）；请在终端运行 \`open "${html3dPath}"\` 或将该文件拖入 Chrome / Safari / Edge 浏览器即可 360° 交互缩放查看！`,
    ``,
    `---`,
    ``,
    `## 一、 核心枢纽模块雷达（God Nodes / 高爆炸半径模块）`,
    ``,
    `| 排名 | 节点 ID | 源码路径 | 行数 | 被依赖数 (In) | 依赖外部数 (Out) | 总连接度 | 修改建议 |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`,
    ...(godNodes.length > 0
      ? godNodes.map((g, i) => `| #${i + 1} | \`${g.id}\` | \`${g.file}\` | ${g.lines} 行 | ${g.inDegree} | ${g.outDegree} | **${g.totalDegree}** | 修改前必查上下游调用方 |`)
      : [`| - | 暂无源码枢纽节点 | - | - | 0 | 0 | 0 | - |`]),
    ``,
    `## 二、 架构健康度：循环依赖（Circular Dependencies）与孤儿文件（Orphan Files）`,
    ``,
    `- **循环依赖检测结果**：${cycles.length === 0 ? '✅ **0 循环依赖（架构分层健康）**' : `⚠️ 发现 ${cycles.length} 处循环依赖：`}`,
    ...cycles.map((c) => `  - \`${c.join(' -> ')}\``),
    `- **疑似零引用孤儿源码文件**：${orphanFiles.length === 0 ? '✅ **0 孤儿死代码文件**' : `发现 ${orphanFiles.length} 个未被引用的非入口文件（建议核实是否可按 Ponytail 原则清理）：`}`,
    ...orphanFiles.map((o) => `  - \`${o.file}\` (${o.lines} 行)`),
    ``,
    `## 三、 Ponytail 化繁为简：本项目现成可复用轮子速查表（Reusable Helpers Registry）`,
    ``,
    `> **Ponytail 第 2 级铁律**：写任何新函数前，必须优先检索下表已导出的现成工具与模块，严禁重复造轮子！`,
    ``,
    `| 模块文件 | 已导出的可复用函数 / 符号 (Exports) | 体积 |`,
    `| :--- | :--- | :--- |`,
    ...(reusableHelpers.length > 0
      ? reusableHelpers.map((r) => `| \`${r.file}\` | \`${r.exports.join('`, `')}\` | ${r.lines} 行 |`)
      : [`| 暂无显式导出符号 | - | - |`]),
    ``
  ].join('\n'); }
function render3dGalaxyHtml({ projectName, nodes, edges, godNodes, cycles }) {
  const graphDataJson = JSON.stringify({ projectName, nodes, edges, godNodes, cycles }).replace(/<\//g, '<\\/');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${projectName} - AGY Evo-OS 3D 知识图谱与爆炸半径星系舱</title>
<style>
  body { background: radial-gradient(circle at center, #0f172a 0%, #020617 100%); color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; height: 100vh; width: 100vw; }
  #canvas3d { position: absolute; inset: 0; width: 100%; height: 100%; cursor: grab; }
  #canvas3d:active { cursor: grabbing; }
  .hud-top { position: absolute; top: 16px; left: 16px; right: 360px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; pointer-events: none; z-index: 10; }
  .brand-card { pointer-events: auto; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.35); backdrop-filter: blur(12px); padding: 12px 18px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.45); }
  .brand-title { font-size: 16px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
  .brand-sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .controls-bar { pointer-events: auto; display: flex; gap: 8px; flex-wrap: wrap; background: rgba(15, 23, 42, 0.82); border: 1px solid rgba(148, 163, 184, 0.25); padding: 8px 12px; border-radius: 10px; backdrop-filter: blur(10px); }
  .search-input { background: #1e293b; border: 1px solid #475569; color: #f8fafc; padding: 6px 12px; border-radius: 6px; font-size: 13px; width: 190px; outline: none; }
  .search-input:focus { border-color: #38bdf8; }
  .btn { background: #1e293b; border: 1px solid #475569; color: #e2e8f0; padding: 6px 11px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s; }
  .btn:hover, .btn.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
  .legend-bar { position: absolute; bottom: 16px; left: 16px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.25); padding: 10px 14px; border-radius: 10px; display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; z-index: 10; backdrop-filter: blur(10px); }
  .legend-item { display: flex; align-items: center; gap: 6px; color: #cbd5e1; cursor: pointer; }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .side-panel { position: absolute; top: 16px; right: 16px; bottom: 16px; width: 330px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 16px; overflow-y: auto; z-index: 10; backdrop-filter: blur(14px); box-shadow: -8px 0 32px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 14px; }
  .panel-sec-title { font-size: 13px; font-weight: 700; color: #38bdf8; border-bottom: 1px solid rgba(148,163,184,0.2); padding-bottom: 6px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .node-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-bottom: 6px; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat-box { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(148, 163, 184, 0.15); padding: 8px 10px; border-radius: 8px; }
  .stat-val { font-size: 18px; font-weight: 700; color: #f8fafc; }
  .stat-lbl { font-size: 11px; color: #94a3b8; }
  .list-chip { display: block; background: rgba(30, 41, 59, 0.8); border-left: 3px solid #38bdf8; padding: 6px 10px; margin-bottom: 6px; border-radius: 4px; font-size: 12px; color: #e2e8f0; cursor: pointer; word-break: break-all; }
  .list-chip:hover { background: rgba(56, 189, 248, 0.2); }
  .list-chip.blast-1 { border-left-color: #f43f5e; } .list-chip.blast-2 { border-left-color: #f59e0b; } .list-chip.mem { border-left-color: #a855f7; }
</style>
</head>
<body>
<canvas id="canvas3d"></canvas>
<div class="hud-top">
  <div class="brand-card"><div class="brand-title">🌌 ${projectName} · 3D 知识图谱与爆炸半径星系舱</div><div class="brand-sub" id="summaryText">正在加载 3D 节点与 AST 依赖边...</div></div>
  <div class="controls-bar">
    <input type="text" id="searchInput" class="search-input" placeholder="🔍 搜索文件、函数、EVO/ADR..." />
    <button class="btn active" id="btnAutoRotate">🔄 自动巡航</button><button class="btn" id="btnResetCamera">🎯 归位视角</button><button class="btn" id="btnClearSelect">✨ 取消高亮</button>
  </div>
</div>
<div class="legend-bar">
  <div class="legend-item" data-type="ALL"><span class="dot" style="background:#fff"></span>全部显示</div>
  <div class="legend-item" data-type="SOURCE_FILE"><span class="dot" style="background:#38bdf8"></span>源码文件 (AST)</div>
  <div class="legend-item" data-type="CODE_MODULE"><span class="dot" style="background:#06b6d4"></span>代码模块</div>
  <div class="legend-item" data-type="FEATURE"><span class="dot" style="background:#4ade80"></span>业务功能 (FEAT)</div>
  <div class="legend-item" data-type="ADR_DECISION"><span class="dot" style="background:#facc15"></span>架构决策 (ADR)</div>
  <div class="legend-item" data-type="EVO_GENE"><span class="dot" style="background:#f43f5e"></span>踩坑基因 (EVO)</div>
  <div class="legend-item" data-type="CROSS_MEMORY"><span class="dot" style="background:#fb923c"></span>跨项目记忆 (XMSG)</div>
  <div class="legend-item" data-type="SESSION_SLICE"><span class="dot" style="background:#a855f7"></span>对话切片 (CONV)</div>
</div>
<div class="side-panel" id="sidePanel">
  <div><div class="panel-sec-title">📊 图谱实时遥测指标</div><div class="stat-grid">
    <div class="stat-box"><div class="stat-val" id="stNodes">0</div><div class="stat-lbl">总节点数</div></div>
    <div class="stat-box"><div class="stat-val" id="stEdges">0</div><div class="stat-lbl">总关联边 (含AST)</div></div>
    <div class="stat-box"><div class="stat-val" id="stExtracted">0</div><div class="stat-lbl">EXTRACTED 实证边</div></div>
    <div class="stat-box"><div class="stat-val" id="stInferred">0</div><div class="stat-lbl">INFERRED 记忆边</div></div>
  </div></div>
  <div id="inspectorBox"><div class="panel-sec-title">🎯 节点与爆炸半径透视仪 (点击3D节点)</div><div style="font-size:12px;color:#94a3b8;line-height:1.5;">在左侧 3D 星系中点击任意节点，即可点亮该模块的 <b>1~2 跳修改爆炸半径 (Blast Radius)</b>，查看上下游调用链与历史防坑基因。</div></div>
  <div><div class="panel-sec-title">🔥 核心枢纽模块 (God Nodes Top 6)</div><div id="godNodesList"></div></div>
</div>
<script>
const GRAPH_DATA = ${graphDataJson};
const TYPE_COLORS = { SOURCE_FILE: '#38bdf8', CODE_MODULE: '#06b6d4', FEATURE: '#4ade80', ADR_DECISION: '#facc15', EVO_GENE: '#f43f5e', CROSS_MEMORY: '#fb923c', SESSION_SLICE: '#a855f7', USER_VETO: '#ec4899' };
const canvas = document.getElementById('canvas3d');
const ctx = canvas.getContext('2d');
let width = window.innerWidth, height = window.innerHeight;
function resize() { width = window.innerWidth; height = window.innerHeight; canvas.width = width * devicePixelRatio; canvas.height = height * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
window.addEventListener('resize', resize);
resize();
const nodes = GRAPH_DATA.nodes.map((n, i) => {
  const phi = Math.acos(-1 + (2 * i + 1) / Math.max(1, GRAPH_DATA.nodes.length));
  const theta = Math.sqrt(GRAPH_DATA.nodes.length * Math.PI) * phi;
  const radius = 220 + (n.type === 'SOURCE_FILE' ? 40 : -30);
  return { ...n, x: radius * Math.cos(theta) * Math.sin(phi), y: radius * Math.sin(theta) * Math.sin(phi), z: radius * Math.cos(phi), vx: 0, vy: 0, vz: 0, radius: Math.max(5, Math.min(16, 5 + Math.sqrt(n.inDegree + n.outDegree) * 2.2)), color: TYPE_COLORS[n.type] || '#94a3b8' };
});
const nodeById = new Map(nodes.map(n => [n.id, n]));
const edges = GRAPH_DATA.edges.map(e => ({ ...e, src: nodeById.get(e.source), dst: nodeById.get(e.target) })).filter(e => e.src && e.dst);
const extractedCnt = edges.filter(e => e.provenance === 'EXTRACTED').length;
const inferredCnt = edges.length - extractedCnt;
document.getElementById('stNodes').textContent = nodes.length;
document.getElementById('stEdges').textContent = edges.length;
document.getElementById('stExtracted').textContent = extractedCnt;
document.getElementById('stInferred').textContent = inferredCnt;
document.getElementById('summaryText').textContent = \`共 \${nodes.length} 个星系节点 · \${extractedCnt} 条 AST 实证依赖边 · \${inferredCnt} 条记忆边 (拖拽旋转 / 滚轮缩放 / 点击节点测算爆炸半径)\`;
const godListEl = document.getElementById('godNodesList');
(GRAPH_DATA.godNodes || []).slice(0, 6).forEach(g => {
  const div = document.createElement('div');
  div.className = 'list-chip';
  div.innerHTML = \`<b>\${g.id}</b> <span style="float:right;color:#38bdf8">连接度 \${g.totalDegree}</span><br/><span style="color:#94a3b8;font-size:11px">\${g.file} (\${g.lines}行)</span>\`;
  div.onclick = () => selectNode(nodeById.get(g.id));
  godListEl.appendChild(div); });
const repulseStride = nodes.length > 600 ? Math.ceil(nodes.length / 400) : 1;
const simSteps = nodes.length > 600 ? 35 : 90;
function stepPhysics() {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j += repulseStride) {
      const a = nodes[i], b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      let distSq = dx*dx + dy*dy + dz*dz + 40;
      let force = (1800 * repulseStride) / distSq;
      a.vx += dx * force * 0.02; a.vy += dy * force * 0.02; a.vz += dz * force * 0.02;
      b.vx -= dx * force * 0.02; b.vy -= dy * force * 0.02; b.vz -= dz * force * 0.02; } }
  for (const e of edges) {
    let dx = e.dst.x - e.src.x, dy = e.dst.y - e.src.y, dz = e.dst.z - e.src.z;
    let dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
    let delta = (dist - 120) * 0.008;
    e.src.vx += (dx / dist) * delta; e.src.vy += (dy / dist) * delta; e.src.vz += (dz / dist) * delta;
    e.dst.vx -= (dx / dist) * delta; e.dst.vy -= (dy / dist) * delta; e.dst.vz -= (dz / dist) * delta;
  }
  for (const n of nodes) {
    n.vx -= n.x * 0.002; n.vy -= n.y * 0.002; n.vz -= n.z * 0.002;
    n.x += n.vx; n.y += n.vy; n.z += n.vz;
    n.vx *= 0.82; n.vy *= 0.82; n.vz *= 0.82; } }
for (let k = 0; k < simSteps; k++) stepPhysics();
let rotY = 0.4, rotX = 0.25, cameraZ = 680, autoRotate = true;
let selectedNode = null, filterType = 'ALL', searchQuery = '';
let blastHop1 = new Set(), blastHop2 = new Set();
function selectNode(rawNode) {
  const node = rawNode ? (nodeById.get(rawNode.id) || rawNode) : null;
  selectedNode = node;
  blastHop1.clear(); blastHop2.clear();
  if (!node) {
    document.getElementById('inspectorBox').innerHTML = '<div class="panel-sec-title">🎯 节点与爆炸半径透视仪</div><div style="font-size:12px;color:#94a3b8">点击任意 3D 节点查看其上下游调用链与爆炸半径。</div>';
    return; }
  const badgeColor = node.color || TYPE_COLORS[node.type] || '#38bdf8';
  edges.forEach(e => {
    if (e.source === node.id) blastHop1.add(e.target);
    if (e.target === node.id) blastHop1.add(e.source); });
  edges.forEach(e => {
    if (blastHop1.has(e.source) && e.target !== node.id && !blastHop1.has(e.target)) blastHop2.add(e.target);
    if (blastHop1.has(e.target) && e.source !== node.id && !blastHop1.has(e.source)) blastHop2.add(e.source);
  });
  const callersHtml = (node.callers || []).map(cid => \`<div class="list-chip blast-1" onclick="window.__sel('\${cid}')">⬅️ 上游调用方: \${cid}</div>\`).join('') || '<div style="font-size:12px;color:#64748b">无直接上游调用方</div>';
  const calleesHtml = (node.callees || []).map(cid => \`<div class="list-chip blast-2" onclick="window.__sel('\${cid}')">➡️ 下游被调方: \${cid}</div>\`).join('') || '<div style="font-size:12px;color:#64748b">无直接下游依赖</div>';
  const memHtml = (node.linkedMemories || []).map(mid => \`<div class="list-chip mem" onclick="window.__sel('\${mid}')">🧠 关联记忆: \${mid}</div>\`).join('') || '';
  document.getElementById('inspectorBox').innerHTML = \`
    <div class="panel-sec-title">🎯 爆炸半径锁定: \${node.id}</div>
    <span class="node-badge" style="background:\${badgeColor};color:#020617">\${node.type}</span>
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">\${node.title}</div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:8px">路径: \${node.file || '-'} \${node.lines ? '(' + node.lines + ' 行)' : ''}</div>
    <div style="font-size:12px;color:#f43f5e;margin-bottom:8px">💥 <b>爆炸半径</b>: 1跳直接波及 <b>\${blastHop1.size}</b> 个节点 | 2跳间接波及 <b>\${blastHop2.size}</b> 个节点</div>
    <div style="font-size:11px;color:#cbd5e1;background:rgba(2,6,23,0.6);padding:8px;border-radius:6px;margin-bottom:8px">\${node.snippet || ''}</div>
    <div style="max-height:220px;overflow-y:auto">\${callersHtml}\${calleesHtml}\${memHtml}</div>
  \`; }
window.__sel = (id) => selectNode(nodeById.get(id));
function project3D(n) {
  let cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  let cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  let x1 = n.x * cosY - n.z * sinY;
  let z1 = n.z * cosY + n.x * sinY;
  let y2 = n.y * cosX - z1 * sinX;
  let z2 = z1 * cosX + n.y * sinX;
  let scale = 540 / Math.max(80, cameraZ + z2);
  return { sx: (width - 340) / 2 + x1 * scale, sy: height / 2 + y2 * scale, z: z2, scale }; }
let projectedNodes = [];
function render() {
  if (autoRotate) rotY += 0.0035;
  ctx.clearRect(0, 0, width, height);
  projectedNodes = nodes.map(n => ({ node: n, ...project3D(n) })).sort((a, b) => b.z - a.z);
  const projMap = new Map(projectedNodes.map(p => [p.node.id, p]));
  for (const e of edges) {
    const p1 = projMap.get(e.source), p2 = projMap.get(e.target);
    if (!p1 || !p2) continue;
    const isHighlight = selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id);
    const isDimmed = selectedNode && !isHighlight;
    ctx.beginPath();
    if (e.provenance === 'INFERRED') ctx.setLineDash([4, 4]);
    else ctx.setLineDash([]);
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.strokeStyle = isHighlight ? '#f43f5e' : (e.provenance === 'EXTRACTED' ? 'rgba(56,189,248,0.28)' : 'rgba(168,85,247,0.22)');
    if (isDimmed) ctx.strokeStyle = 'rgba(71,85,105,0.08)';
    ctx.lineWidth = isHighlight ? 2.2 : 1;
    ctx.stroke(); }
  ctx.setLineDash([]);
  for (const p of projectedNodes) {
    const n = p.node;
    if (filterType !== 'ALL' && n.type !== filterType) continue;
    if (searchQuery && !n.id.toLowerCase().includes(searchQuery) && !(n.title || '').toLowerCase().includes(searchQuery)) continue;
    const isSelected = selectedNode && selectedNode.id === n.id;
    const isHop1 = blastHop1.has(n.id);
    const isHop2 = blastHop2.has(n.id);
    const isDimmed = selectedNode && !isSelected && !isHop1 && !isHop2;
    const r = Math.max(3, n.radius * p.scale * (isSelected ? 1.45 : 1));
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffffff' : isHop1 ? '#f43f5e' : isHop2 ? '#f59e0b' : n.color;
    ctx.globalAlpha = isDimmed ? 0.16 : 0.95;
    ctx.shadowBlur = isSelected || isHop1 ? 18 : 8;
    ctx.shadowColor = isSelected ? '#38bdf8' : isHop1 ? '#f43f5e' : n.color;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (!isDimmed && (p.scale > 0.72 || isSelected || isHop1)) {
      ctx.fillStyle = isSelected ? '#38bdf8' : isHop1 ? '#fda4af' : '#e2e8f0';
      ctx.font = (isSelected ? 'bold 12px' : '11px') + ' -apple-system, sans-serif';
      ctx.fillText(n.id.replace(/^MOD:|^SRC:/, ''), p.sx + r + 5, p.sy + 4); }
    ctx.globalAlpha = 1; }
  requestAnimationFrame(render); }
render();
let dragging = false, lastX = 0, lastY = 0, moved = false;
canvas.addEventListener('mousedown', e => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
  rotY += dx * 0.006;
  rotX = Math.max(-1.3, Math.min(1.3, rotX + dy * 0.006));
  lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', e => {
  if (!dragging) return;
  dragging = false;
  if (!moved) {
    for (let i = projectedNodes.length - 1; i >= 0; i--) {
      const p = projectedNodes[i];
      const r = Math.max(6, p.node.radius * p.scale + 4);
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= r) {
        selectNode(p.node);
        return; } } } });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cameraZ = Math.max(220, Math.min(1400, cameraZ + e.deltaY * 0.6));
}, { passive: false });
document.getElementById('btnAutoRotate').onclick = function() { autoRotate = !autoRotate; this.classList.toggle('active', autoRotate); };
document.getElementById('btnResetCamera').onclick = () => { rotY = 0.4; rotX = 0.25; cameraZ = 680; };
document.getElementById('btnClearSelect').onclick = () => selectNode(null);
document.getElementById('searchInput').oninput = e => { searchQuery = e.target.value.trim().toLowerCase(); };
document.querySelectorAll('.legend-item').forEach(el => { el.onclick = () => { filterType = el.dataset.type; }; });
</script>
</body>
</html>`; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let rootDir = process.cwd(), targetFile = '', openInBrowser = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) rootDir = args[++i];
    else if (args[i] === '--target' && args[i + 1]) targetFile = args[++i];
    else if (args[i] === '--open') openInBrowser = true; }
  console.log(JSON.stringify(buildGraphAndBlastRadius(rootDir, targetFile, { openInBrowser }), null, 2));
}
