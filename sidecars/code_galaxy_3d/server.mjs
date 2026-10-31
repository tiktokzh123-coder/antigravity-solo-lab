#!/usr/bin/env node
/**
 * ============================================================================
 * 🌌 AGY Evo-OS 3D 联邦知识星系 Antigravity 原生 Sidecar 服务端 (server.mjs)
 * ============================================================================
 * 监听环境变量 ANTIGRAVITY_SIDECAR_WEB_PORT，在 IDE 右侧辅助面板内嵌渲染 3D 联邦知识星系图。
 * 支持：
 *  - GET / 或 /ui.html：返回最新生成的 CODE_GRAPH_FEDERATED_3D.html
 *  - GET /?project=<abs_path>：返回指定单项目的 memory/CODE_GRAPH_3D.html
 *  - POST /api/rebuild：实时重新扫描并刷新联邦 3D 星系图
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { buildFederated3dGraph } from '../../scripts/federated-graph-3d-generator.mjs';
import { resolveCanonicalProjectRoot } from '../../scripts/cross-project-federation.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENGINE_HOME = path.resolve(__dirname, '../..');
const DEFAULT_FEDERATED_HTML = path.join(ENGINE_HOME, 'memory', 'CODE_GRAPH_FEDERATED_3D.html');
const PORT = Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || process.env.PORT || 18991);

const FEDERATED_HTML_CANDIDATES = [
  '/workspace/acme-edge-cluster/memory/CODE_GRAPH_FEDERATED_3D.html',
  '/workspace/acme-api-gateway/memory/CODE_GRAPH_FEDERATED_3D.html',
  '/workspace/acme-media-engine/memory/CODE_GRAPH_FEDERATED_3D.html',
  DEFAULT_FEDERATED_HTML,
];

async function getHtmlContent(projectParam) {
  if (projectParam) {
    const resolved = resolveCanonicalProjectRoot(projectParam);
    const singleGraph = path.join(resolved, 'memory', 'CODE_GRAPH_3D.html');
    if (fs.existsSync(singleGraph)) return fs.readFileSync(singleGraph, 'utf8');
    const fedGraph = path.join(resolved, 'memory', 'CODE_GRAPH_FEDERATED_3D.html');
    if (fs.existsSync(fedGraph)) return fs.readFileSync(fedGraph, 'utf8');
  }
  for (const cand of FEDERATED_HTML_CANDIDATES) {
    if (fs.existsSync(cand)) return fs.readFileSync(cand, 'utf8');
  }
  try {
    const built = await buildFederated3dGraph([], { openInBrowser: false });
    if (built?.htmlFedPath && fs.existsSync(built.htmlFedPath)) {
      return fs.readFileSync(built.htmlFedPath, 'utf8');
    }
  } catch {
    // 忽略首次生成异常
  }
  return '<!doctype html><html><body style="background:#030712;color:#f8fafc;font-family:sans-serif;padding:24px"><h3>🌌 正在初始化 3D 联邦知识星系图...</h3></body></html>';
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (req.method === 'POST' && urlObj.pathname === '/api/rebuild') {
    try {
      const report = await buildFederated3dGraph([], { openInBrowser: false });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, report }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  const projectParam = urlObj.searchParams.get('project');
  const html = await getHtmlContent(projectParam);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
});

server.listen(PORT, '127.0.0.1', () => {
  console.error(`[code_galaxy_3d] Sidecar listening on http://127.0.0.1:${server.address().port}`);
});

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
