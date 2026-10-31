#!/usr/bin/env node
import fs from 'node:fs'; import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openMemoryDatabase, syncIncrementalIndex, collectProjectFiles } from './memory-graph-engine.mjs';
import { parseFileToNodesAndEdges } from './memory-vector-tokenizer.mjs';
import {
  discoverAntigravityProjectsAndConversations,
  isContainerOrMotherDir,
  resolveCanonicalProjectRoot,
  hasRealProjectFiles,
  inferProjectRoleTag,
} from './cross-project-federation.mjs';
const GALAXY_PALETTE = ['#38bdf8', '#4ade80', '#fb923c', '#c084fc', '#f43f5e', '#facc15', '#2dd4bf', '#60a5fa'];
export async function buildFederated3dGraph(projectRootsInput = [], options = {}) {
  let rawRoots = projectRootsInput;
  let opts = options || {};
  if (projectRootsInput && !Array.isArray(projectRootsInput) && typeof projectRootsInput === 'object') {
    rawRoots = projectRootsInput.projectRoots || projectRootsInput.project_roots || [];
    opts = projectRootsInput; }
  const topology = await discoverAntigravityProjectsAndConversations();
  const discoveredByRoot = new Map(topology.businessProjects.map((bp) => [bp.projectRoot, bp]));
  let targetRoots = [];
  if (Array.isArray(rawRoots) && rawRoots.length > 0) {
    for (const r of rawRoots) {
      if (!r) continue;
      const abs = resolveCanonicalProjectRoot(r);
      if (hasRealProjectFiles(abs) && !isContainerOrMotherDir(abs, false)) targetRoots.push(abs); } }
  if (targetRoots.length === 0) {
    targetRoots = topology.businessProjects
      .filter((bp) => bp.hasMemoryInitialized && hasRealProjectFiles(bp.projectRoot))
      .map((bp) => bp.projectRoot); }
  targetRoots = [...new Set(targetRoots)];
  const galaxies = [];
  const allNodes = [];
  const allEdges = [];
  const nodeMap = new Map();
  const byRawModName = new Map();
  const apiRouteToNodes = new Map();
  const orbitRadius = targetRoots.length <= 1 ? 0 : 390;
  for (let idx = 0; idx < targetRoots.length; idx++) {
    const rootDir = targetRoots[idx];
    const folderName = path.basename(rootDir);
    const defaultUiNames = /SoloLab|demo-app|demo-app|demo-app|demo-app|demo-app/i.test(rootDir)
      ? ['SoloLab', '脚本']
      : [folderName];
    const meta = discoveredByRoot.get(rootDir) || {
      projectRoot: rootDir,
      folderName, projectRoleTag: inferProjectRoleTag(rootDir), uiProjectNames: defaultUiNames,
      linkedConversations: [],
      displayLabel: `【软件项目: ${defaultUiNames.join('/')}】📂 ${folderName}`, };
    const hasMemInit =
      fs.existsSync(path.join(rootDir, 'memory', 'PRODUCT_PROGRESS.md')) ||
      fs.existsSync(path.join(rootDir, 'memory', 'CODE_GRAPH_3D.html'));
    let rawNodes = [], rawEdges = [];
    if (hasMemInit) {
      try { syncIncrementalIndex(rootDir, false, false); } catch {}
      const dbPath = path.join(rootDir, 'memory', '.memory-store', 'memory.sqlite');
      if (!fs.existsSync(dbPath)) continue;
      const db = openMemoryDatabase(rootDir);
      rawNodes = db.prepare(`SELECT id, type, title, file_path, content FROM memory_nodes`).all();
      rawEdges = db.prepare(`SELECT from_id AS source_id, to_id AS target_id, relation, weight FROM memory_edges`).all();
      db.close();
    } else {
      for (const fullPath of collectProjectFiles(rootDir)) {
        try {
          const relFile = path.relative(rootDir, fullPath).replace(/\\/g, '/');
          const parsed = parseFileToNodesAndEdges(fullPath, relFile, fs.readFileSync(fullPath, 'utf8'), rootDir);
          for (const n of parsed.nodes) rawNodes.push({ id: n.id, type: n.type, title: n.title, file_path: n.file_path, content: n.content });
          for (const e of parsed.edges) rawEdges.push({ source_id: e.from, target_id: e.to, relation: e.relation, weight: e.weight });
        } catch {} }
      if (rawNodes.length === 0) continue; }
    const angle = (2 * Math.PI * idx) / Math.max(1, targetRoots.length);
    const cx = Math.round(orbitRadius * Math.cos(angle));
    const cz = Math.round(orbitRadius * Math.sin(angle));
    const cy = idx % 2 === 0 ? -45 : 45;
    const galaxyColor = GALAXY_PALETTE[idx % GALAXY_PALETTE.length];
    const galaxyPrefix = `G${idx}`;
    const galaxyInfo = {
      galaxyIndex: idx, galaxyId: galaxyPrefix,
      folderName, projectRoot: rootDir, projectRoleTag: meta.projectRoleTag || inferProjectRoleTag(rootDir),
      uiProjectNames: meta.uiProjectNames, linkedConversations: meta.linkedConversations,
      displayLabel: meta.displayLabel, color: galaxyColor,
      center: { x: cx, y: cy, z: cz }, nodeCount: rawNodes.length, edgeCount: 0, primaryHubNodeId: null, };
    let maxDeg = -1;
    const localNodeIds = new Set(rawNodes.map((n) => n.id));
    for (const n of rawNodes) {
      const fedId = `${galaxyPrefix}:${n.id}`;
      const lineMatch = n.title.match(/\((\d+)行\)/) || n.content.match(/行数:\s*(\d+)/);
      const lines = lineMatch ? Number(lineMatch[1]) : 0;
      const nodeObj = {
        id: fedId, rawId: n.id, galaxyIndex: idx, galaxyId: galaxyPrefix, galaxyFolder: folderName,
        galaxyLabel: meta.displayLabel,
        galaxyColor, type: n.type, title: n.title.replace(/`/g, ''), file: n.file_path,
        lines, snippet: (n.content || '').replace(/\s+/g, ' ').slice(0, 220), inDegree: 0, outDegree: 0,
        bridgeDegree: 0, callers: [], callees: [], bridges: [], };
      nodeMap.set(fedId, nodeObj);
      allNodes.push(nodeObj);
      for (const r of ((n.content || '') + ' ' + n.title).match(/\/(?:api|v1|v2)\/[a-zA-Z0-9_-]{2,}(?:\/[a-zA-Z0-9_-]{2,})?/g) || []) {
        const rk = r.toLowerCase();
        if (!apiRouteToNodes.has(rk)) apiRouteToNodes.set(rk, []);
        apiRouteToNodes.get(rk).push(nodeObj); }
      if (n.id.startsWith('MOD:')) {
        const base = n.id.slice(4).toLowerCase();
        if (!byRawModName.has(base)) byRawModName.set(base, []);
        byRawModName.get(base).push(fedId); } }
    const seenPairs = new Set();
    for (const e of rawEdges) {
      if (e.relation === 'REV_RELATES_TO') continue;
      if (!localNodeIds.has(e.source_id) || !localNodeIds.has(e.target_id) || e.source_id === e.target_id) continue;
      const pairKey = [e.source_id, e.target_id].sort().join('::');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      const srcFed = `${galaxyPrefix}:${e.source_id}`;
      const dstFed = `${galaxyPrefix}:${e.target_id}`;
      const isAst = e.relation === 'IMPORTS' || e.relation === 'DEPENDS_ON';
      allEdges.push({
        source: srcFed, target: dstFed, relation: e.relation, provenance: isAst ? 'EXTRACTED' : 'INFERRED',
        isCrossBridge: false, });
      galaxyInfo.edgeCount++;
      const sNode = nodeMap.get(srcFed);
      const dNode = nodeMap.get(dstFed);
      if (sNode && dNode) {
        sNode.outDegree++;
        dNode.inDegree++;
        sNode.callees.push(dstFed);
        dNode.callers.push(srcFed); } }
    for (const n of allNodes.filter((x) => x.galaxyIndex === idx && (x.type === 'SOURCE_FILE' || x.type === 'CODE_MODULE'))) {
      const deg = n.inDegree + n.outDegree;
      if (deg > maxDeg) {
        maxDeg = deg;
        galaxyInfo.primaryHubNodeId = n.id; } }
    if (!galaxyInfo.primaryHubNodeId) {
      const firstNode = allNodes.find((x) => x.galaxyIndex === idx);
      if (firstNode) galaxyInfo.primaryHubNodeId = firstNode.id; }
    galaxies.push(galaxyInfo); }
  const bridges = [];
  const bridgePairSet = new Set();
  const addBridge = (srcFedId, dstFedId, bridgeType, label) => {
    if (!srcFedId || !dstFedId || srcFedId === dstFedId) return;
    const sNode = nodeMap.get(srcFedId);
    const dNode = nodeMap.get(dstFedId);
    if (!sNode || !dNode || sNode.galaxyIndex === dNode.galaxyIndex) return;
    const key = [srcFedId, dstFedId].sort().join('===') + '::' + bridgeType;
    if (bridgePairSet.has(key)) return;
    bridgePairSet.add(key);
    const bridgeObj = {
      source: srcFedId, target: dstFedId, sourceGalaxy: sNode.galaxyFolder, targetGalaxy: dNode.galaxyFolder,
      relation: bridgeType,
      label, provenance: 'CROSS_BRIDGE', isCrossBridge: true, };
    bridges.push(bridgeObj);
    allEdges.push(bridgeObj);
    sNode.bridgeDegree++;
    dNode.bridgeDegree++;
    sNode.bridges.push({ peer: dstFedId, label, type: bridgeType });
    dNode.bridges.push({ peer: srcFedId, label, type: bridgeType }); };
  const findNodeInGalaxy = (folderSubstr, rawModSubstr) => {
    const g = galaxies.find((x) => x.folderName.toLowerCase().includes(folderSubstr.toLowerCase()));
    if (!g) return null;
    const found = allNodes.find(
      (n) => n.galaxyIndex === g.galaxyIndex && n.rawId.toLowerCase().includes(rawModSubstr.toLowerCase()) );
    return found ? found.id : g.primaryHubNodeId; };
  const genericNames = new Set(['index.js', 'index.ts', 'index.mjs', 'types.ts', 'config.js', 'env.ts', 'main.tsx', 'app.tsx', 'server.mjs', 'server.py']);
  for (const [modBase, fedIds] of byRawModName.entries()) {
    if (genericNames.has(modBase) || fedIds.length < 2) continue;
    for (let i = 0; i < fedIds.length; i++) {
      for (let j = i + 1; j < fedIds.length; j++) {
        addBridge(fedIds[i], fedIds[j], 'SHARED_CONTRACT_MODULE', `跨仓库共享核心模块契约 (${modBase})`); } } }
  addBridge(
    findNodeInGalaxy('demo-app-handoff', 'MOD:App.tsx'),
    findNodeInGalaxy('demo-app-mvp', 'MOD:server.mjs'),
    'SSOT_BUILD_HASH_BRIDGE',
    '前端构建产物 public/studio 与 STUDIO_BUILD 哈希锁契约 (:8813)' );
  addBridge(
    findNodeInGalaxy('demo-app-handoff', 'MOD:WorkbenchView.tsx'),
    findNodeInGalaxy('demo-app-mvp', 'MOD:browser-collection-jobs.mjs'),
    'API_CONTRACT_BRIDGE',
    '创作工坊批量商品采集与任务轮询 HTTP 契约' );
  addBridge(
    findNodeInGalaxy('demo-app-mvp', 'MOD:workflow.mjs'),
    findNodeInGalaxy('media-synthesis-pipeline', 'MOD:SoloLab_ai_hub.py'),
    'ONEHUB_VIDEO_API_BRIDGE',
    'SoloLab One-Hub (:8000) 视频生成与日本商品采集网关调用' );
  addBridge(
    findNodeInGalaxy('demo-app-mvp', 'MOD:browser-collection-jobs.mjs'),
    findNodeInGalaxy('media-synthesis-pipeline', 'MOD:api_server.py'),
    'ONEHUB_SCRAPER_BRIDGE',
    'One-Hub /v1/scraper/jp-product 跨服务商品解析接口' );
  addBridge(
    findNodeInGalaxy('demo-app-mvp', 'MOD:account-details.mjs'),
    findNodeInGalaxy('edge-container-cluster', 'MOD:matrix-routes.mjs'),
    'EdgeNode_MATRIX_BRIDGE',
    '手机工作台投递队列 <-> EdgeNode 云手机矩阵控制网关 (:8899)' );
  addBridge(
    findNodeInGalaxy('demo-app-mvp', 'MOD:code-freeze.mjs'),
    findNodeInGalaxy('edge-container-cluster', 'MOD:EdgeNode-cloud.mjs'),
    'HASH_FREEZE_GUARD_BRIDGE',
    '前后端与板卡端 SHA-256 代码冻结防篡改双重校验锁' );
  addBridge(
    findNodeInGalaxy('media-synthesis-pipeline', 'MOD:SoloLab_ai_hub.py'),
    findNodeInGalaxy('edge-container-cluster', 'MOD:tiktok-automation-suite.py'),
    'CLOUD_PHONE_TIKTOK_BRIDGE',
    '云手机 TikTok 视频数据回传与账号 Token 池联动' );
  for (const [routeKey, routeNodes] of apiRouteToNodes.entries()) {
    const distinctGalaxies = new Map();
    for (const rn of routeNodes) {
      if (!distinctGalaxies.has(rn.galaxyIndex)) distinctGalaxies.set(rn.galaxyIndex, rn.id); }
    if (distinctGalaxies.size >= 2) {
      const fedIds = [...distinctGalaxies.values()];
      for (let i = 0; i < fedIds.length; i++) {
        for (let j = i + 1; j < fedIds.length; j++) {
          addBridge(fedIds[i], fedIds[j], 'DYNAMIC_API_ROUTE_BRIDGE', `自动识别跨仓库共享接口契约 (${routeKey})`); } } } }
  for (const n of allNodes.filter((x) => x.type === 'CROSS_MEMORY')) {
    for (const g of galaxies) {
      if (g.galaxyIndex === n.galaxyIndex) continue;
      if (
        n.snippet.toLowerCase().includes(g.folderName.toLowerCase()) ||
        g.linkedConversations.some((c) => n.snippet.includes(c.windowTitle))
      ) {
        addBridge(g.primaryHubNodeId, n.id, 'CROSS_INBOX_MEMORY_BRIDGE', `跨对话投递记忆/派单 (${n.rawId})`); } } }
  const requestedOut = opts.outputRoot || opts.output_root || '';
  const candidateOut = requestedOut ? resolveCanonicalProjectRoot(requestedOut) : '';
  const initTargetRoot = targetRoots.find(
    (r) => fs.existsSync(path.join(r, 'memory', 'PRODUCT_PROGRESS.md')) || fs.existsSync(path.join(r, 'memory', 'CODE_GRAPH_3D.html'))
  );
  const fallbackPluginRoot = path.join(os.homedir(), '.gemini', 'config', 'plugins', 'agy-evo-os');
  const primaryRoot =
    candidateOut && !isContainerOrMotherDir(candidateOut, false) && hasRealProjectFiles(candidateOut)
      ? candidateOut
      : initTargetRoot || fallbackPluginRoot;
  const memDir = path.join(primaryRoot, 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  const htmlFedPath = path.join(memDir, 'CODE_GRAPH_FEDERATED_3D.html');
  const reportFedPath = path.join(memDir, 'FEDERATED_GRAPH_REPORT.md');
  const mdContent = renderFederatedReportMd({ galaxies, allNodes, allEdges, bridges, topology, htmlFedPath });
  const htmlContent = renderFederated3dHtml({ galaxies, nodes: allNodes, edges: allEdges, bridges, topology });
  fs.writeFileSync(reportFedPath, mdContent, 'utf8');
  fs.writeFileSync(htmlFedPath, htmlContent, 'utf8');
  const mirroredPaths = [htmlFedPath];
  const mirroredReportPaths = [reportFedPath];
  for (const r of targetRoots) {
    if (path.resolve(r) === path.resolve(primaryRoot)) continue;
    try {
      const mDir = path.join(r, 'memory');
      if (fs.existsSync(mDir)) {
        const hp = path.join(mDir, 'CODE_GRAPH_FEDERATED_3D.html');
        const rp = path.join(mDir, 'FEDERATED_GRAPH_REPORT.md');
        fs.writeFileSync(hp, htmlContent, 'utf8');
        fs.writeFileSync(rp, mdContent, 'utf8');
        mirroredPaths.push(hp);
        mirroredReportPaths.push(rp); }
    } catch {} }
  let browserLaunched = false;
  if (opts && (opts.openInBrowser || opts.open_in_browser)) {
    try {
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
      browserLaunched = spawnSync(opener, [htmlFedPath], { stdio: 'ignore', timeout: 5000 }).status === 0;
    } catch {
      browserLaunched = false; } }
  return {
    federatedGalaxyCount: galaxies.length, projectCount: galaxies.length, totalFederatedNodes: allNodes.length,
    totalNodes: allNodes.length, totalFederatedEdges: allEdges.length,
    totalIntraEdges: Math.max(0, allEdges.length - bridges.length), crossProjectBridgeCount: bridges.length,
    crossBridgeCount: bridges.length,
    galaxies: galaxies.map((g) => ({
      galaxyId: g.galaxyId, folderName: g.folderName, projectRoot: g.projectRoot, projectRoleTag: g.projectRoleTag,
      uiProjectNames: g.uiProjectNames,
      linkedConversations: g.linkedConversations.map((c) => `${c.windowTitle} (${c.status.replace('CASCADE_RUN_STATUS_', '')})`),
      displayLabel: g.displayLabel, nodeCount: g.nodeCount, edgeCount: g.edgeCount, })),
    bridges,
    htmlFedPath, html3dPath: htmlFedPath,
    reportFedPath, reportMdPath: reportFedPath,
    mirroredPaths,
    mirroredReportPaths,
    browserLaunched,
    openCommand: `open "${htmlFedPath}"`,
    sidecarLink: 'sidecar://agy-evo-os/code_galaxy_3d/',
  }; }
function renderFederatedReportMd({ galaxies, allNodes, allEdges, bridges, topology, htmlFedPath }) {
  const statusMap = {
    ACTIVE_REPO: '🟢 独立业务源码仓', CONTAINER_DIR: '📦 父级容器工作区 (内含多个业务子仓)', EMPTY_DIR: '⚪ 空目录 (代码已合入主干仓)',
    MOVED_OR_MISSING: '⚪ 路径已迁移/合入主干仓', };
  return [
    `# 🌌 AGY Evo-OS v3.1 联邦多星系 3D 知识图谱与反重力软件映射全景报告 (\`FEDERATED_GRAPH_REPORT.md\`)`,
    ``,
    `> **报告定位**：解决多项目/多窗口协同开发中「反重力软件项目名 ↔ 对话窗口标题 ↔ 真实磁盘源码目录」名称不一致问题，并将前后端与手机控制端独立图谱打通为联邦总星系图。`,
    `> - **联邦星系规模**：共 **${galaxies.length}** 个关联业务项目星系 | **${allNodes.length}** 个联邦节点 | **${allEdges.length}** 条关系边（含 **${bridges.length}** 条跨项目星际桥接光束）`,
    `> - **3D 交互打开命令**：\`open "${htmlFedPath}"\``,
    ``,
    `---`,
    ``,
    `## 一、 为什么文件夹名与软件界面名字不同？——「软件项目名 ↔ 对话窗口标题 ↔ 真实源码目录」全量映射表`,
    ``,
    `在反重力（Antigravity）软件中，您在左侧项目切换器共注册了 **${topology.uiProjects.length} 个软件项目**（其中 **\`SoloLab\`、\`脚本\`、\`Downloads\`** 三个软件项目均将根目录挂载在父级容器 \`${path.join(os.homedir(), 'Downloads')}\` 上）；而不同对话窗口在实际干活时，分别深潜操作了不同的真实业务子目录：`,
    ``,
    `### 1.1 当前联邦 3D 总星系纳入的 ${galaxies.length} 大核心业务星系`,
    ``,
    `| 星系编号 | 您在软件里的项目名 (\`.gemini/config/projects\`) | 关联主对话窗口标题 (\`Summary\`) | 架构分工角色 | 底层真实业务文件夹名 | 节点数 | 绝对路径 |`,
    `| :--- | :--- | :--- | :--- | :--- | :---: | :--- |`,
    ...galaxies.map((g) => {
      const uiStr = g.uiProjectNames.join(' / ') || 'SoloLab';
      const convStr = g.linkedConversations.map((c) => `💬 **${c.windowTitle}**`).join('<br>') || '独立窗口';
      const roleStr = g.projectRoleTag || g.linkedConversations[0]?.roleTag || '通用全栈模块';
      return `| \`${g.galaxyId}\` | **\`${uiStr}\`** | ${convStr} | ${roleStr} | \`${g.folderName}\` | **${g.nodeCount}** | \`${g.projectRoot}\` |`;
    }),
    ``,
    `### 1.2 您在反重力软件界面注册的全部 ${topology.uiProjects.length} 个软件项目全量盘点`,
    ``,
    `| 序号 | 软件界面项目名 (\`UI Name\`) | 挂载目录类型 | 挂载的物理路径 (\`folderUri\`) | 说明与活跃子仓映射 |`,
    `| :---: | :--- | :--- | :--- | :--- |`,
    ...topology.uiProjects.map((up, idx) => {
      const folderStr = up.mountedFolders.join(', ') || '-';
      const note =
        up.diskStatus === 'CONTAINER_DIR'
          ? '承载 `edge-container-cluster`、`media-synthesis-pipeline`、`demo-app-mvp`、`demo-app-handoff` 等多对话协同子仓'
          : up.diskStatus === 'ACTIVE_REPO'
            ? '独立代码仓，可随时一键加入联邦 3D 星系'
            : '早期测试目录（现手机端/板卡端控制逻辑已收敛至 `edge-container-cluster`）';
      return `| #${idx + 1} | **\`${up.uiName}\`** | ${statusMap[up.diskStatus] || up.diskStatus} | \`${folderStr}\` | ${note} |`;
    }),
    ``,
    `### 1.3 磁盘全部活跃业务源码目录与对话窗口映射（共 ${topology.businessProjects.length} 个可联邦仓库）`,
    ``,
    `| 软件界面项目名 | 底层真实文件夹名 | 架构角色 | 当前关联主对话窗口 | 是否已初始化 memory/ | 真实磁盘路径 |`,
    `| :--- | :--- | :--- | :--- | :---: | :--- |`,
    ...topology.businessProjects.map((bp) => {
      const convs = bp.linkedConversations.map((c) => c.windowTitle).join(', ') || '暂无活跃长对话';
      return `| **\`${bp.uiProjectNames.join(' / ')}\`** | \`${bp.folderName}\` | ${bp.projectRoleTag} | ${convs} | ${bp.hasMemoryInitialized ? '✅ 已就绪' : '⚪ 按需初始化'} | \`${bp.projectRoot}\` |`;
    }),
    ``,
    `---`,
    ``,
    `## 二、 跨项目星际桥接边矩阵（Cross-Project Bridges）`,
    ``,
    `| 序号 | 源项目星系 (Source) | 源节点 | 桥接类型 | 目标项目星系 (Target) | 目标节点 | 跨项目耦合与契约说明 |`,
    `| :---: | :--- | :--- | :--- | :--- | :--- | :--- |`,
    ...bridges.map(
      (b, i) =>
        `| #${i + 1} | \`${b.sourceGalaxy}\` | \`${b.source.split(':').slice(1).join(':')}\` | **\`${b.relation}\`** | \`${b.targetGalaxy}\` | \`${b.target.split(':').slice(1).join(':')}\` | ${b.label} |`
    ),
    ``,
  ].join('\n'); }
function renderFederated3dHtml({ galaxies, nodes, edges, bridges, topology }) {
  const payloadJson = JSON.stringify({ galaxies, nodes, edges, bridges, mainConversations: topology.mainConversations.slice(0, 12) }).replace(/<\//g, '<\\/');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AGY Evo-OS v3.1 · 联邦多星系 3D 知识图谱与跨对话协同总舱</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: radial-gradient(circle at 35% 50%, #0f172a 0%, #020617 100%); color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; height: 100vh; width: 100vw; }
  #canvas3d { position: absolute; inset: 0; width: 100%; height: 100%; cursor: grab; }
  #canvas3d:active { cursor: grabbing; }
  .hud-top { position: absolute; top: 14px; left: 16px; right: 390px; display: flex; flex-direction: column; gap: 10px; pointer-events: none; z-index: 10; }
  .top-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .brand-card { pointer-events: auto; background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(56, 189, 248, 0.4); backdrop-filter: blur(12px); padding: 10px 16px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
  .brand-title { font-size: 15px; font-weight: 700; color: #38bdf8; }
  .brand-sub { font-size: 11px; color: #cbd5e1; margin-top: 3px; }
  .controls-bar { pointer-events: auto; display: flex; gap: 7px; flex-wrap: wrap; background: rgba(15, 23, 42, 0.86); border: 1px solid rgba(148, 163, 184, 0.25); padding: 7px 11px; border-radius: 10px; backdrop-filter: blur(10px); }
  .search-input { background: #1e293b; border: 1px solid #475569; color: #f8fafc; padding: 5px 10px; border-radius: 6px; font-size: 12px; width: 180px; outline: none; }
  .btn { background: #1e293b; border: 1px solid #475569; color: #e2e8f0; padding: 5px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.15s; }
  .btn:hover, .btn.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
  .btn.bridge-btn.active { background: #d97706; border-color: #fbbf24; color: #fff; }
  .side-panel { position: absolute; top: 14px; right: 14px; bottom: 14px; width: 365px; background: rgba(15, 23, 42, 0.93); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 14px; overflow-y: auto; z-index: 10; backdrop-filter: blur(14px); display: flex; flex-direction: column; gap: 12px; }
  .panel-sec-title { font-size: 12px; font-weight: 700; color: #38bdf8; border-bottom: 1px solid rgba(148,163,184,0.2); padding-bottom: 5px; margin-bottom: 7px; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .stat-box { background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(148, 163, 184, 0.15); padding: 7px 9px; border-radius: 8px; }
  .stat-val { font-size: 16px; font-weight: 700; color: #f8fafc; }
  .stat-lbl { font-size: 10px; color: #94a3b8; }
  .list-chip { display: block; background: rgba(30, 41, 59, 0.85); border-left: 3px solid #38bdf8; padding: 6px 9px; margin-bottom: 5px; border-radius: 4px; font-size: 11px; color: #e2e8f0; cursor: pointer; line-height: 1.4; }
  .list-chip:hover { background: rgba(56, 189, 248, 0.22); }
  .list-chip.bridge { border-left-color: #fbbf24; }
  .legend-bar { position: absolute; bottom: 14px; left: 16px; background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(148, 163, 184, 0.25); padding: 8px 12px; border-radius: 10px; display: flex; gap: 12px; flex-wrap: wrap; font-size: 11px; z-index: 10; }
  .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; margin-right: 4px; }
</style>
</head>
<body>
<canvas id="canvas3d"></canvas>
<div class="hud-top">
  <div class="top-row">
    <div class="brand-card">
      <div class="brand-title">🌌 AGY Evo-OS v3.1 · 联邦多星系 3D 知识图谱与跨对话协同总舱</div>
      <div class="brand-sub" id="summaryText">正在加载多项目联邦星系与跨项目桥接光束...</div>
    </div>
    <div class="controls-bar">
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 搜节点/对话名/桥接..." />
      <button class="btn active" id="btnAutoRotate">🔄 自动巡航</button>
      <button class="btn bridge-btn" id="btnOnlyBridges">⚡ 聚焦跨项目桥接</button>
      <button class="btn" id="btnResetCamera">🎯 归位</button>
    </div>
  </div>
  <div class="controls-bar" id="galaxyTabs"></div>
</div>
<div class="legend-bar">
  <span><span class="dot" style="background:#38bdf8"></span>源码模块 (AST)</span>
  <span><span class="dot" style="background:#f43f5e"></span>踩坑基因 (EVO)</span>
  <span><span class="dot" style="background:#facc15"></span>架构决策 (ADR)</span>
  <span><span class="dot" style="background:#fb923c"></span>跨项目收件箱 (XMSG)</span>
  <span style="color:#fbbf24;font-weight:600">━━⚡ 金色脉冲线：跨项目/跨对话桥接契约 (CROSS_BRIDGE)</span>
</div>
<div class="side-panel">
  <div><div class="panel-sec-title">📊 联邦多星系实时遥测</div><div class="stat-grid">
    <div class="stat-box"><div class="stat-val" id="stGalaxies">0</div><div class="stat-lbl">联邦业务项目星系</div></div>
    <div class="stat-box"><div class="stat-val" id="stNodes">0</div><div class="stat-lbl">联邦总节点数</div></div>
    <div class="stat-box"><div class="stat-val" id="stEdges">0</div><div class="stat-lbl">总关联边 (含AST)</div></div>
    <div class="stat-box"><div class="stat-val" style="color:#fbbf24" id="stBridges">0</div><div class="stat-lbl">⚡ 跨项目桥接光束</div></div>
  </div></div>
  <div id="inspectorBox"><div class="panel-sec-title">🎯 跨星系爆炸半径透视仪</div><div style="font-size:11px;color:#94a3b8;line-height:1.45">点击左侧任意星系节点或下方桥接链路，即可透视其在本项目及跨项目的 1~2 跳修改爆炸半径。</div></div>
  <div><div class="panel-sec-title">🗂️ 软件项目名 ↔ 活跃对话窗口 ↔ 真实目录</div><div id="mappingList"></div></div>
  <div><div class="panel-sec-title">⚡ 跨项目星际桥接链路 (点击高亮)</div><div id="bridgeList"></div></div>
</div>
<script>
const DATA = ${payloadJson};
const TYPE_COLORS = { SOURCE_FILE: '#38bdf8', CODE_MODULE: '#06b6d4', FEATURE: '#4ade80', ADR_DECISION: '#facc15', EVO_GENE: '#f43f5e', CROSS_MEMORY: '#fb923c', SESSION_SLICE: '#a855f7', USER_VETO: '#ec4899' };
const canvas = document.getElementById('canvas3d');
const ctx = canvas.getContext('2d');
let width = window.innerWidth, height = window.innerHeight;
function resize() { width = window.innerWidth; height = window.innerHeight; canvas.width = width * devicePixelRatio; canvas.height = height * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
window.addEventListener('resize', resize); resize();
const galaxyByIdx = new Map(DATA.galaxies.map(g => [g.galaxyIndex, g]));
const nodes = DATA.nodes.map((n, i) => {
  const g = galaxyByIdx.get(n.galaxyIndex) || { center: { x: 0, y: 0, z: 0 }, color: '#38bdf8' };
  const phi = Math.acos(-1 + (2 * (i % 75) + 1) / 75);
  const theta = Math.sqrt(75 * Math.PI) * phi + i;
  const r = 125 + (n.type === 'SOURCE_FILE' ? 25 : -20);
  return {
    ...n, cx: g.center.x, cy: g.center.y, cz: g.center.z, x: g.center.x + r * Math.cos(theta) * Math.sin(phi),
    y: g.center.y + r * Math.sin(theta) * Math.sin(phi), z: g.center.z + r * Math.cos(phi), vx: 0, vy: 0, vz: 0,
    radius: Math.max(4.5, Math.min(15, 4.5 + Math.sqrt(n.inDegree + n.outDegree + n.bridgeDegree * 3) * 2)),
    color: n.type === 'SOURCE_FILE' ? g.color : (TYPE_COLORS[n.type] || '#94a3b8') }; });
const nodeById = new Map(nodes.map(n => [n.id, n]));
const edges = DATA.edges.map(e => ({ ...e, src: nodeById.get(e.source), dst: nodeById.get(e.target) })).filter(e => e.src && e.dst);
document.getElementById('stGalaxies').textContent = DATA.galaxies.length;
document.getElementById('stNodes').textContent = nodes.length;
document.getElementById('stEdges').textContent = edges.length;
document.getElementById('stBridges').textContent = DATA.bridges.length;
document.getElementById('summaryText').textContent = \`已打通 \${DATA.galaxies.length} 个项目星系 · 共 \${nodes.length} 节点 · \${DATA.bridges.length} 条跨项目桥接光束 (支持按反重力软件名/对话窗口筛选)\`;
let activeGalaxyFilter = 'ALL', onlyBridges = false, searchQuery = '', selectedNode = null, autoRotate = true;
const tabsEl = document.getElementById('galaxyTabs');
const allBtn = document.createElement('button');
allBtn.className = 'btn active'; allBtn.textContent = '🌐 全部联邦星系 (' + DATA.galaxies.length + ')';
allBtn.onclick = () => { activeGalaxyFilter = 'ALL'; updateTabStyles(allBtn); };
tabsEl.appendChild(allBtn);
function updateTabStyles(activeBtn) {
  tabsEl.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active'); }
const mapListEl = document.getElementById('mappingList');
DATA.galaxies.forEach(g => {
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.innerHTML = \`<span class="dot" style="background:\${g.color}"></span>\${g.displayLabel} (\${g.nodeCount})\`;
  btn.onclick = () => { activeGalaxyFilter = g.galaxyIndex; updateTabStyles(btn); };
  tabsEl.appendChild(btn);
  const chip = document.createElement('div');
  chip.className = 'list-chip';
  chip.style.borderLeftColor = g.color;
  const convTitles = (g.linkedConversations || []).map(c => '💬 ' + c.windowTitle).join(' | ') || '💬 独立窗口';
  chip.innerHTML = \`<b>软件项目: [\${g.uiProjectNames.join('/')}]</b> → <b>📂 \${g.folderName}</b><br/><span style="color:#38bdf8">\${convTitles}</span><br/><span style="color:#64748b;font-size:10px">\${g.projectRoot}</span>\`;
  chip.onclick = () => { activeGalaxyFilter = g.galaxyIndex; updateTabStyles(btn); if (g.primaryHubNodeId) selectNode(nodeById.get(g.primaryHubNodeId)); };
  mapListEl.appendChild(chip); });
const bridgeListEl = document.getElementById('bridgeList');
DATA.bridges.forEach(b => {
  const div = document.createElement('div');
  div.className = 'list-chip bridge';
  div.innerHTML = \`<b>⚡ [\${b.sourceGalaxy}] ↔ [\${b.targetGalaxy}]</b><br/><span>\${b.label}</span>\`;
  div.onclick = () => selectNode(nodeById.get(b.source));
  bridgeListEl.appendChild(div); });
for (let step = 0; step < 55; step++) {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j += 2) {
      const b = nodes[j];
      if (a.galaxyIndex !== b.galaxyIndex) continue;
      let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      let distSq = dx*dx + dy*dy + dz*dz + 35;
      let f = 1400 / distSq;
      a.vx += dx * f * 0.018; a.vy += dy * f * 0.018; a.vz += dz * f * 0.018;
      b.vx -= dx * f * 0.018; b.vy -= dy * f * 0.018; b.vz -= dz * f * 0.018; }
    a.vx += (a.cx - a.x) * 0.015; a.vy += (a.cy - a.y) * 0.015; a.vz += (a.cz - a.z) * 0.015;
    a.x += a.vx; a.y += a.vy; a.z += a.vz;
    a.vx *= 0.8; a.vy *= 0.8; a.vz *= 0.8; } }
let blastHop1 = new Set();
function selectNode(node) {
  selectedNode = node || null;
  blastHop1.clear();
  if (!node) return;
  edges.forEach(e => {
    if (e.source === node.id) blastHop1.add(e.target);
    if (e.target === node.id) blastHop1.add(e.source); });
  const brHtml = (node.bridges || []).map(b => \`<div class="list-chip bridge" onclick="window.__sel('\${b.peer}')">⚡ 跨项目桥接: \${b.label} (\${b.peer})</div>\`).join('');
  document.getElementById('inspectorBox').innerHTML = \`
    <div class="panel-sec-title">🎯 锁定节点: \${node.rawId}</div>
    <div style="font-size:11px;color:\${node.color};font-weight:700;margin-bottom:4px">\${node.galaxyLabel}</div>
    <div style="font-size:12px;font-weight:600;margin-bottom:4px">\${node.title}</div>
    <div style="font-size:11px;color:#f43f5e;margin-bottom:6px">💥 直接关联与跨星系波及: <b>\${blastHop1.size}</b> 个节点 (含 <b>\${node.bridgeDegree}</b> 条跨项目桥接)</div>
    <div style="font-size:10px;color:#cbd5e1;background:rgba(2,6,23,0.65);padding:6px;border-radius:6px;margin-bottom:6px">\${node.snippet || ''}</div>
    \${brHtml}
  \`; }
window.__sel = (id) => selectNode(nodeById.get(id));
let rotY = 0.35, rotX = 0.22, cameraZ = 980;
function project3D(x, y, z) {
  let cosY = Math.cos(rotY), sinY = Math.sin(rotY), cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  let x1 = x * cosY - z * sinY, z1 = z * cosY + x * sinY;
  let y2 = y * cosX - z1 * sinX, z2 = z1 * cosX + y * sinX;
  let scale = 680 / Math.max(100, cameraZ + z2);
  return { sx: (width - 370) / 2 + x1 * scale, sy: height / 2 + y2 * scale, z: z2, scale }; }
let projectedNodes = [];
function render() {
  if (autoRotate) rotY += 0.0028;
  ctx.clearRect(0, 0, width, height);
  DATA.galaxies.forEach(g => {
    if (activeGalaxyFilter !== 'ALL' && activeGalaxyFilter !== g.galaxyIndex) return;
    const p = project3D(g.center.x, g.center.y, g.center.z);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, 145 * p.scale, 0, Math.PI * 2);
    ctx.strokeStyle = g.color + '33';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = g.color;
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.fillText(g.displayLabel, p.sx - 95, p.sy - 135 * p.scale); });
  projectedNodes = nodes.map(n => ({ node: n, ...project3D(n.x, n.y, n.z) })).sort((a, b) => b.z - a.z);
  const projMap = new Map(projectedNodes.map(p => [p.node.id, p]));
  for (const e of edges) {
    if (onlyBridges && !e.isCrossBridge) continue;
    if (activeGalaxyFilter !== 'ALL' && e.src.galaxyIndex !== activeGalaxyFilter && e.dst.galaxyIndex !== activeGalaxyFilter) continue;
    const p1 = projMap.get(e.source), p2 = projMap.get(e.target);
    if (!p1 || !p2) continue;
    ctx.beginPath();
    if (e.isCrossBridge) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.4;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id) ? '#f43f5e' : 'rgba(56,189,248,0.18)';
      ctx.lineWidth = 1; }
    ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke(); }
  ctx.setLineDash([]);
  for (const p of projectedNodes) {
    const n = p.node;
    if (activeGalaxyFilter !== 'ALL' && n.galaxyIndex !== activeGalaxyFilter) continue;
    if (onlyBridges && n.bridgeDegree === 0) continue;
    if (searchQuery && !n.rawId.toLowerCase().includes(searchQuery) && !n.title.toLowerCase().includes(searchQuery) && !n.galaxyLabel.toLowerCase().includes(searchQuery)) continue;
    const isSel = selectedNode && selectedNode.id === n.id;
    const isHop1 = blastHop1.has(n.id);
    const r = Math.max(3, n.radius * p.scale * (isSel ? 1.5 : 1));
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? '#fff' : isHop1 ? '#f43f5e' : (n.bridgeDegree > 0 ? '#fbbf24' : n.color);
    ctx.shadowBlur = n.bridgeDegree > 0 || isSel ? 14 : 5;
    ctx.shadowColor = n.bridgeDegree > 0 ? '#fbbf24' : n.color;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (n.bridgeDegree > 0 || isSel || isHop1 || p.scale > 0.78) {
      ctx.fillStyle = n.bridgeDegree > 0 ? '#fde047' : '#e2e8f0';
      ctx.font = (n.bridgeDegree > 0 || isSel ? 'bold 11px' : '10px') + ' -apple-system, sans-serif';
      ctx.fillText(n.rawId.replace(/^MOD:/, ''), p.sx + r + 4, p.sy + 3); } }
  requestAnimationFrame(render); }
render();
let dragging = false, lastX = 0, lastY = 0, moved = false;
canvas.addEventListener('mousedown', e => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
  rotY += dx * 0.006; rotX = Math.max(-1.2, Math.min(1.2, rotX + dy * 0.006));
  lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', e => {
  if (!dragging) return;
  dragging = false;
  if (!moved) {
    for (let i = projectedNodes.length - 1; i >= 0; i--) {
      const p = projectedNodes[i];
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= Math.max(7, p.node.radius * p.scale + 4)) {
        selectNode(p.node); return; } } } });
canvas.addEventListener('wheel', e => { e.preventDefault(); cameraZ = Math.max(300, Math.min(1800, cameraZ + e.deltaY * 0.7)); }, { passive: false });
document.getElementById('btnAutoRotate').onclick = function() { autoRotate = !autoRotate; this.classList.toggle('active', autoRotate); };
document.getElementById('btnOnlyBridges').onclick = function() { onlyBridges = !onlyBridges; this.classList.toggle('active', onlyBridges); };
document.getElementById('btnResetCamera').onclick = () => { rotY = 0.35; rotX = 0.22; cameraZ = 980; selectedNode = null; blastHop1.clear(); };
document.getElementById('searchInput').oninput = e => { searchQuery = e.target.value.trim().toLowerCase(); };
</script>
</body>
</html>`; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let roots = [], openInBrowser = false, outputRoot = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--roots' && args[i + 1]) roots = args[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (args[i] === '--output-root' && args[i + 1]) outputRoot = args[++i];
    else if (args[i] === '--open') openInBrowser = true; }
  buildFederated3dGraph(roots, { openInBrowser, outputRoot }).then((res) => console.log(JSON.stringify(res, null, 2))); }
