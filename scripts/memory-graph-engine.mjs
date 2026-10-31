#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  tokenizeForSearch,
  encodeFloat32Vector,
  cosineSimFloat32,
  extractEntitiesFromText,
  parseFileToNodesAndEdges,
  readUserProfile,
} from './memory-vector-tokenizer.mjs';
export { readUserProfile };
const savepointDepthMap = new WeakMap();
export function runInSavepoint(db, fn) {
  const depth = (savepointDepthMap.get(db) || 0) + 1;
  savepointDepthMap.set(db, depth);
  const spName = `sp_${depth}`;
  db.exec(`SAVEPOINT ${spName}`);
  try {
    const res = fn();
    db.exec(`RELEASE ${spName}`);
    return res;
  } catch (err) {
    try {
      db.exec(`ROLLBACK TO ${spName}`);
      db.exec(`RELEASE ${spName}`);
    } catch {}
    throw err;
  } finally {
    const prev = depth - 1;
    if (prev <= 0) savepointDepthMap.delete(db);
    else savepointDepthMap.set(db, prev);
  }
}
export function initDatabase(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
  `);
  runInSavepoint(db, () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_manifest (
        file_path TEXT PRIMARY KEY,
        mtime_ms INTEGER NOT NULL,
        sha256 TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        file_path TEXT NOT NULL,
        entities_json TEXT NOT NULL,
        vector_blob BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nodes_file ON memory_nodes(file_path);
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON memory_nodes(type);
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        id UNINDEXED,
        title,
        expanded_tokens,
        tokenize = 'unicode61'
      );
      CREATE TABLE IF NOT EXISTS memory_edges (
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL NOT NULL,
        source_file TEXT NOT NULL,
        PRIMARY KEY (from_id, to_id, relation)
      );
      CREATE INDEX IF NOT EXISTS idx_edges_from ON memory_edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to ON memory_edges(to_id);
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        title TEXT,
        thread_key TEXT,
        workspace TEXT,
        worker_session_id TEXT,
        stage TEXT NOT NULL DEFAULT 'open',
        mandate_json TEXT,
        report_json TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_stage ON tickets(stage);
      CREATE INDEX IF NOT EXISTS idx_tickets_thread ON tickets(thread_key);
      CREATE TABLE IF NOT EXISTS effects (
        kind TEXT NOT NULL,
        key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        error TEXT NOT NULL DEFAULT '',
        due_ms INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT,
        PRIMARY KEY (kind, key)
      );
      CREATE INDEX IF NOT EXISTS idx_effects_due ON effects(kind, due_ms);
      CREATE TABLE IF NOT EXISTS outbox_receipts (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        ticket_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        payload_json TEXT NOT NULL,
        created_at TEXT,
        settled_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_receipts(status);
      CREATE INDEX IF NOT EXISTS idx_outbox_ticket ON outbox_receipts(ticket_id);
    `);
  });
  return db;
}
export function openMemoryDatabase(rootDir) {
  const storeDir = path.join(rootDir, 'memory', '.memory-store');
  fs.mkdirSync(storeDir, { recursive: true });
  const dbPath = path.join(storeDir, 'memory.sqlite');
  const db = new DatabaseSync(dbPath);
  try {
    return initDatabase(db);
  } catch (err) {
    try { db.close(); } catch {}
    throw err;
  }
}
function withProjectDb(projectRootOrDb, fn) {
  if (projectRootOrDb && typeof projectRootOrDb.exec === 'function' && typeof projectRootOrDb.prepare === 'function') {
    return fn(projectRootOrDb, null);
  }
  const resolvedRoot = path.resolve(String(projectRootOrDb || process.cwd()));
  const db = openMemoryDatabase(resolvedRoot);
  try {
    return fn(db, resolvedRoot);
  } finally {
    try { db.close(); } catch {}
  }
}
export function upsertTicket(projectRoot, ticketObj = {}) {
  return withProjectDb(projectRoot, (db, resolvedRoot) =>
    runInSavepoint(db, () => {
      const nowIso = new Date().toISOString();
      const id = String(ticketObj.id || ticketObj.ticketId || ticketObj.ticket_id || `TKT-${Date.now()}`).trim();
      const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
      const title = ticketObj.title !== undefined ? String(ticketObj.title) : (existing?.title ?? '');
      const threadKey = ticketObj.thread_key ?? ticketObj.threadKey ?? existing?.thread_key ?? null;
      const workspace = ticketObj.workspace ?? existing?.workspace ?? (resolvedRoot || null);
      const workerSessionId = ticketObj.worker_session_id ?? ticketObj.workerSessionId ?? existing?.worker_session_id ?? null;
      const stage = String(ticketObj.stage ?? ticketObj.status ?? existing?.stage ?? 'open');
      const mandateJson =
        typeof ticketObj.mandate_json === 'string'
          ? ticketObj.mandate_json
          : ticketObj.mandate !== undefined || ticketObj.mandateJson !== undefined
            ? JSON.stringify(ticketObj.mandate ?? ticketObj.mandateJson ?? {})
            : (existing?.mandate_json ?? '{}');
      const reportJson =
        typeof ticketObj.report_json === 'string'
          ? ticketObj.report_json
          : ticketObj.report !== undefined || ticketObj.reportJson !== undefined
            ? JSON.stringify(ticketObj.report ?? ticketObj.reportJson ?? {})
            : (existing?.report_json ?? '{}');
      const createdAt = existing?.created_at || ticketObj.created_at || ticketObj.createdAt || nowIso;
      const updatedAt = nowIso;
      db.prepare(`
        INSERT INTO tickets (id, title, thread_key, workspace, worker_session_id, stage, mandate_json, report_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          thread_key = excluded.thread_key,
          workspace = excluded.workspace,
          worker_session_id = excluded.worker_session_id,
          stage = excluded.stage,
          mandate_json = excluded.mandate_json,
          report_json = excluded.report_json,
          updated_at = excluded.updated_at
      `).run(id, title, threadKey, workspace, workerSessionId, stage, mandateJson, reportJson, createdAt, updatedAt);
      return {
        id,
        title,
        thread_key: threadKey,
        workspace,
        worker_session_id: workerSessionId,
        stage,
        mandate_json: mandateJson,
        report_json: reportJson,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    })
  );
}
export function listTickets(projectRoot, filter = {}) {
  return withProjectDb(projectRoot, (db) => {
    const normFilter = typeof filter === 'string' ? { stage: filter } : (filter || {});
    const clauses = [];
    const params = [];
    if (normFilter.id) {
      clauses.push('id = ?');
      params.push(String(normFilter.id));
    }
    if (normFilter.stage || normFilter.status) {
      clauses.push('stage = ?');
      params.push(String(normFilter.stage || normFilter.status));
    }
    if (normFilter.thread_key || normFilter.threadKey) {
      clauses.push('thread_key = ?');
      params.push(String(normFilter.thread_key || normFilter.threadKey));
    }
    if (normFilter.worker_session_id || normFilter.workerSessionId) {
      clauses.push('worker_session_id = ?');
      params.push(String(normFilter.worker_session_id || normFilter.workerSessionId));
    }
    if (normFilter.workspace) {
      clauses.push('workspace = ?');
      params.push(String(normFilter.workspace));
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limitVal = Number(normFilter.limit) > 0 ? Math.min(500, Number(normFilter.limit)) : 100;
    const rows = db.prepare(`SELECT * FROM tickets ${whereSql} ORDER BY updated_at DESC, rowid DESC LIMIT ?`).all(...params, limitVal);
    return rows.map((r) => ({ ...r }));
  });
}
export function enqueueEffect(projectRoot, kind, key, payload = {}) {
  return withProjectDb(projectRoot, (db) =>
    runInSavepoint(db, () => {
      const normKind = String(kind || 'generic').trim();
      const normKey = String(key || `eff_${Date.now()}`).trim();
      const payloadObj = payload && typeof payload === 'object' ? payload : { value: payload };
      const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payloadObj);
      const dueMs = Number.isFinite(payloadObj.due_ms ?? payloadObj.dueMs)
        ? Number(payloadObj.due_ms ?? payloadObj.dueMs)
        : Date.now();
      const updatedAt = new Date().toISOString();
      db.prepare(`
        INSERT INTO effects (kind, key, payload_json, attempts, error, due_ms, updated_at)
        VALUES (?, ?, ?, 0, '', ?, ?)
        ON CONFLICT(kind, key) DO UPDATE SET
          payload_json = excluded.payload_json,
          attempts = 0,
          error = '',
          due_ms = excluded.due_ms,
          updated_at = excluded.updated_at
      `).run(normKind, normKey, payloadJson, dueMs, updatedAt);
      return {
        ok: true,
        kind: normKind,
        key: normKey,
        payload_json: payloadJson,
        attempts: 0,
        error: '',
        due_ms: dueMs,
        updated_at: updatedAt,
      };
    })
  );
}
export function settleOutboxReceipt(projectRoot, id, status = 'ACKED', extra = {}) {
  return withProjectDb(projectRoot, (db) =>
    runInSavepoint(db, () => {
      const rawId = String(id || '').trim();
      const normId = /^xmsg-/i.test(rawId) ? rawId.toUpperCase() : rawId;
      const normStatus = String(status || 'ACKED').trim();
      const nowIso = new Date().toISOString();
      const existing = db.prepare('SELECT * FROM outbox_receipts WHERE id = ?').get(normId);
      const previousStatus = existing ? existing.status : null;
      const channel = String(extra.channel || existing?.channel || 'cross_inbox');
      const ticketId = extra.ticket_id ?? extra.ticketId ?? existing?.ticket_id ?? null;
      const payloadJson =
        extra.payload_json !== undefined
          ? String(extra.payload_json)
          : extra.payload !== undefined
            ? JSON.stringify(extra.payload)
            : (existing?.payload_json ?? JSON.stringify({ id: normId, status: normStatus }));
      const createdAt = existing?.created_at || extra.created_at || nowIso;
      const isPending = /^pending$/i.test(normStatus);
      const settledAt = isPending ? null : nowIso;
      db.prepare(`
        INSERT INTO outbox_receipts (id, channel, ticket_id, status, payload_json, created_at, settled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          channel = excluded.channel,
          ticket_id = COALESCE(excluded.ticket_id, outbox_receipts.ticket_id),
          status = excluded.status,
          payload_json = excluded.payload_json,
          settled_at = excluded.settled_at
      `).run(normId, channel, ticketId, normStatus, payloadJson, createdAt, settledAt);
      return {
        ok: true,
        id: normId,
        previousStatus,
        status: normStatus,
        channel,
        ticket_id: ticketId,
        payload_json: payloadJson,
        created_at: createdAt,
        settled_at: settledAt,
      };
    })
  );
}
export function collectProjectFiles(rootDir) {
  const results = [];
  const memoryDir = path.join(rootDir, 'memory');
  if (fs.existsSync(memoryDir)) {
    for (const entry of fs.readdirSync(memoryDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        if (entry.name === 'GRAPH_REPORT.md' || entry.name === 'FEDERATED_GRAPH_REPORT.md') continue;
        results.push(path.join(memoryDir, entry.name));
      } else if (entry.isDirectory() && entry.name === 'sessions') {
        const sessDir = path.join(memoryDir, 'sessions');
        const sessFiles = fs.readdirSync(sessDir).filter((sf) => sf.endsWith('.md'));
        const hasRealConv = sessFiles.some((sf) => sf.startsWith('CONV-'));
        const isMotherRepo = path.basename(path.resolve(rootDir)) === 'universal-fullstack-evo-os';
        for (const sf of sessFiles) {
          if (sf === 'TEMPLATE_SESSION_MEMORY.md' && (hasRealConv || !isMotherRepo)) continue;
          results.push(path.join(sessDir, sf));
        }
      }
    }
  }
  const SKIP_DIRS = new Set([
    'memory', 'node_modules', 'dist', 'build', 'out', 'coverage', '__pycache__',
    'venv', '.venv', '.venv_local', 'env', 'backups', 'target', 'vendor',
    'outputs', 'output', 'data', 'logs', 'launcher-logs', 'ui-audit',
    'evidence', 'db_data', 'video_frames', 'screenshots', 'artifacts', 'tmp', 'temp',
    'acme-source', 'frames', 'audio', 'raw',
  ]);
  const visitedDirs = new Set();
  const walkCode = (dir, depth = 0) => {
    if (!fs.existsSync(dir) || depth > 7) return;
    let realDir = dir;
    try { realDir = fs.realpathSync(dir); } catch { return; }
    if (visitedDirs.has(realDir)) return;
    visitedDirs.add(realDir);
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (
        entry.name.startsWith('.') ||
        SKIP_DIRS.has(entry.name.toLowerCase()) ||
        /^(_db_|_backup|backup_|bak_|logs?\d*$|fingerprints)/i.test(entry.name) ||
        /session[-_]data|user[-_]data|browser[-_]profile|acme-source/i.test(entry.name)
      ) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkCode(full, depth + 1);
      else if (/\.(ts|tsx|js|mjs|cjs|jsx|py|go|rs)$/.test(entry.name)) {
        if (entry.name.endsWith('.min.js') || entry.name.endsWith('.bundle.js')) continue;
        try {
          if (fs.statSync(full).size > 1536 * 1024) continue;
        } catch { continue; }
        results.push(full);
      }
    }
  };
  walkCode(rootDir, 0);
  return results;
}
export function syncIncrementalIndex(rootDir, forceRebuild = false, keepOpen = true) {
  const startMs = performance.now();
  const db = openMemoryDatabase(rootDir);
  try {
    const allFiles = collectProjectFiles(rootDir);
    let updatedFilesCount = 0;
    let skippedFilesCount = 0;
    if (!forceRebuild) {
      const fastManifest = {};
      for (const row of db.prepare('SELECT file_path, mtime_ms, sha256 FROM file_manifest').all()) {
        fastManifest[row.file_path] = row;
      }
      const manifestKeys = Object.keys(fastManifest);
      if (manifestKeys.length === allFiles.length && allFiles.length > 0) {
        let allClean = true;
        for (const fullPath of allFiles) {
          const relFile = path.relative(rootDir, fullPath);
          const prev = fastManifest[relFile];
          if (!prev) {
            allClean = false;
            break;
          }
          try {
            const stat = fs.statSync(fullPath);
            if (Math.floor(stat.mtimeMs) !== prev.mtime_ms) {
              allClean = false;
              break;
            }
          } catch {
            allClean = false;
            break;
          }
        }
        if (allClean) {
          skippedFilesCount = allFiles.length;
          const nodeCount = db.prepare('SELECT COUNT(*) AS c FROM memory_nodes').get().c;
          const edgeCount = db.prepare('SELECT COUNT(*) AS c FROM memory_edges').get().c;
          const elapsedMs = Number((performance.now() - startMs).toFixed(2));
          if (!keepOpen) {
            db.close();
            return { db: null, nodeCount, edgeCount, updatedFilesCount: 0, skippedFilesCount, elapsedMs };
          }
          return { db, nodeCount, edgeCount, updatedFilesCount: 0, skippedFilesCount, elapsedMs };
        }
      }
    }
    const deleteNodesByFile = db.prepare('DELETE FROM memory_nodes WHERE file_path = ?');
    const deleteEdgesByFile = db.prepare('DELETE FROM memory_edges WHERE source_file = ?');
    const deleteFtsById = db.prepare('DELETE FROM memory_fts WHERE id = ?');
    const selectIdsByFile = db.prepare('SELECT id FROM memory_nodes WHERE file_path = ?');
    const insertNode = db.prepare(
      'INSERT OR REPLACE INTO memory_nodes (id, type, title, content, file_path, entities_json, vector_blob) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertFts = db.prepare('INSERT INTO memory_fts (id, title, expanded_tokens) VALUES (?, ?, ?)');
    const insertEdge = db.prepare(
      'INSERT OR REPLACE INTO memory_edges (from_id, to_id, relation, weight, source_file) VALUES (?, ?, ?, ?, ?)'
    );
    const upsertManifest = db.prepare(
      'INSERT OR REPLACE INTO file_manifest (file_path, mtime_ms, sha256) VALUES (?, ?, ?)'
    );
    runInSavepoint(db, () => {
      if (forceRebuild) {
        db.exec('DELETE FROM file_manifest; DELETE FROM memory_nodes; DELETE FROM memory_fts; DELETE FROM memory_edges;');
      }
      const existingManifest = {};
      if (!forceRebuild) {
        for (const row of db.prepare('SELECT file_path, mtime_ms, sha256 FROM file_manifest').all()) {
          existingManifest[row.file_path] = row;
        }
      }
      const seenRelPaths = new Set();
      for (const fullPath of allFiles) {
        const relFile = path.relative(rootDir, fullPath);
        seenRelPaths.add(relFile);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }
        const mtimeMs = Math.floor(stat.mtimeMs);
        const prev = existingManifest[relFile];
        if (!forceRebuild && prev && prev.mtime_ms === mtimeMs) {
          skippedFilesCount++;
          continue;
        }
        const raw = fs.readFileSync(fullPath, 'utf8');
        const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
        if (!forceRebuild && prev && prev.sha256 === sha256) {
          upsertManifest.run(relFile, mtimeMs, sha256);
          skippedFilesCount++;
          continue;
        }
        for (const oldRow of selectIdsByFile.all(relFile)) deleteFtsById.run(oldRow.id);
        deleteNodesByFile.run(relFile);
        deleteEdgesByFile.run(relFile);
        const { nodes, edges } = parseFileToNodesAndEdges(fullPath, relFile, raw, rootDir);
        for (const n of nodes) {
          insertNode.run(n.id, n.type, n.title, n.content, n.file_path, JSON.stringify(n.entities), n.vector_blob);
          deleteFtsById.run(n.id);
          insertFts.run(n.id, n.title, n.expanded_tokens);
        }
        for (const e of edges) {
          insertEdge.run(e.from, e.to, e.relation, e.weight, e.source_file);
        }
        upsertManifest.run(relFile, mtimeMs, sha256);
        updatedFilesCount++;
      }
      if (!forceRebuild) {
        for (const oldPath of Object.keys(existingManifest)) {
          if (!seenRelPaths.has(oldPath)) {
            for (const oldRow of selectIdsByFile.all(oldPath)) deleteFtsById.run(oldRow.id);
            deleteNodesByFile.run(oldPath);
            deleteEdgesByFile.run(oldPath);
            db.prepare('DELETE FROM file_manifest WHERE file_path = ?').run(oldPath);
          }
        }
      }
    });
    const nodeCount = db.prepare('SELECT COUNT(*) AS c FROM memory_nodes').get().c;
    const edgeCount = db.prepare('SELECT COUNT(*) AS c FROM memory_edges').get().c;
    const elapsedMs = Number((performance.now() - startMs).toFixed(2));
    if (!keepOpen) {
      db.close();
      return { db: null, nodeCount, edgeCount, updatedFilesCount, skippedFilesCount, elapsedMs };
    }
    return { db, nodeCount, edgeCount, updatedFilesCount, skippedFilesCount, elapsedMs };
  } catch (outerErr) {
    try { db.close(); } catch {}
    throw outerErr;
  }
}
export function funnelHybridRecall(db, queryText, targetFiles = [], topK = 5) {
  const startMs = performance.now();
  const queryTokens = tokenizeForSearch(`${queryText} ${targetFiles.join(' ')}`);
  const queryVec = encodeFloat32Vector(queryTokens);
  const uniqueTokens = [...new Set(queryTokens)].filter((t) => /^[a-z0-9_\u4e00-\u9fa5]+$/.test(t)).slice(0, 32);
  const ftsRankMap = {};
  const bm25ScoreMap = {};
  if (uniqueTokens.length > 0) {
    const ftsMatchExpr = uniqueTokens.map((t) => `"${t}"`).join(' OR ');
    const ftsRows = db
      .prepare(
        `SELECT id, -bm25(memory_fts, 2.0, 1.0) AS score
         FROM memory_fts
         WHERE memory_fts MATCH ?
         ORDER BY score DESC
         LIMIT 40`
      )
      .all(ftsMatchExpr);
    ftsRows.forEach((row, idx) => {
      ftsRankMap[row.id] = idx + 1;
      bm25ScoreMap[row.id] = Number(row.score.toFixed(2));
    });
  }
  const seedIds = new Set();
  for (const tf of targetFiles) seedIds.add(`MOD:${path.basename(tf)}`);
  for (const ent of extractEntitiesFromText(queryText)) seedIds.add(ent);
  const explicitSeedHit = seedIds.size > 0;
  if (!explicitSeedHit) {
    for (const topId of Object.keys(ftsRankMap).slice(0, 3)) seedIds.add(topId);
  }
  const graphScoreMap = {};
  if (explicitSeedHit) {
    for (const s of seedIds) graphScoreMap[s] = 6.0;
  }
  if (seedIds.size > 0) {
    const placeholders = [...seedIds].map(() => '?').join(',');
    const maxDepth = explicitSeedHit ? 2 : 1;
    const graphRows = db
      .prepare(
        `WITH RECURSIVE graph_walk(node_id, weight, depth) AS (
           SELECT to_id, weight * ${explicitSeedHit ? 1.8 : 1.0}, 1
           FROM memory_edges
           WHERE from_id IN (${placeholders})
           UNION ALL
           SELECT e.to_id, gw.weight * e.weight * 0.5, gw.depth + 1
           FROM memory_edges e
           JOIN graph_walk gw ON e.from_id = gw.node_id
           WHERE gw.depth < ${maxDepth}
         )
         SELECT node_id, SUM(weight) AS total_kg_weight
         FROM graph_walk
         GROUP BY node_id
         ORDER BY total_kg_weight DESC
         LIMIT 30`
      )
      .all(...seedIds);
    for (const r of graphRows) {
      graphScoreMap[r.node_id] = Number(((graphScoreMap[r.node_id] || 0) + r.total_kg_weight).toFixed(2));
    }
  }
  const candidateIds = [...new Set([...Object.keys(ftsRankMap), ...Object.keys(graphScoreMap)])];
  if (candidateIds.length === 0) {
    return { results: [], stats: { candidateCount: 0, queryMs: Number((performance.now() - startMs).toFixed(2)) } };
  }
  const candPlaceholders = candidateIds.map(() => '?').join(',');
  const candRows = db
    .prepare(`SELECT id, type, title, content, file_path, vector_blob FROM memory_nodes WHERE id IN (${candPlaceholders})`)
    .all(...candidateIds);
  const vecScores = {};
  for (const row of candRows) vecScores[row.id] = cosineSimFloat32(queryVec, row.vector_blob);
  const vecRankMap = [...candRows]
    .sort((a, b) => vecScores[b.id] - vecScores[a.id])
    .reduce((acc, r, i) => {
      if (vecScores[r.id] > 0) acc[r.id] = i + 1;
      return acc;
    }, {});
  const graphRankMap = [...candRows]
    .filter((r) => (graphScoreMap[r.id] || 0) > 0)
    .sort((a, b) => (graphScoreMap[b.id] || 0) - (graphScoreMap[a.id] || 0))
    .reduce((acc, r, i) => {
      acc[r.id] = i + 1;
      return acc;
    }, {});
  const k = 10;
  const graphRrfWeight = explicitSeedHit ? 1.5 : 0.35;
  const fused = candRows.map((r) => {
    const rVec = vecRankMap[r.id] ? 1.6 / (k + vecRankMap[r.id]) : 0;
    const rBm25 = ftsRankMap[r.id] ? 1.1 / (k + ftsRankMap[r.id]) : 0;
    const rGraph = graphRankMap[r.id] ? graphRrfWeight / (k + graphRankMap[r.id]) : 0;
    const isPendingCross = r.type === 'CROSS_MEMORY' && r.title.includes('[待处理跨项目记忆]');
    const assetWeight =
      r.type === 'EVO_GENE' || r.type === 'USER_VETO' || r.type === 'ADR_DECISION' || r.type === 'CROSS_MEMORY'
        ? isPendingCross
          ? 0.065
          : 0.04
        : 0;
    const safetyBonus =
      explicitSeedHit && (r.type === 'EVO_GENE' || r.type === 'USER_VETO' || r.type === 'CROSS_MEMORY') && (graphScoreMap[r.id] || 0) >= 3.5 ? 0.05 : 0;
    const totalRrf = rVec + rBm25 + rGraph + assetWeight + safetyBonus;
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      file: r.file_path,
      rrfScore: Number(totalRrf.toFixed(4)),
      cosineSim: Number((vecScores[r.id] || 0).toFixed(3)),
      bm25Score: bm25ScoreMap[r.id] || 0,
      graphScore: graphScoreMap[r.id] || 0,
      snippet: r.content.replace(/\s+/g, ' ').slice(0, 180) + '...',
    };
  });
  const results = fused.sort((a, b) => b.rrfScore - a.rrfScore).slice(0, topK);
  const queryMs = Number((performance.now() - startMs).toFixed(2));
  const totalNodesInDb = db.prepare('SELECT COUNT(*) AS c FROM memory_nodes').get().c;
  return {
    results,
    stats: {
      totalNodesInDb,
      candidatePoolEvaluated: candRows.length,
      pruningRatio: `${((1 - candRows.length / Math.max(totalNodesInDb, 1)) * 100).toFixed(1)}% 节点已通过倒排与图索引直接剪枝跳过`,
      queryMs,
    },
  };
}
function readPendingCrossInboxSummary(rootDir) {
  const inboxPath = path.join(rootDir, 'memory', 'CROSS_INBOX.md');
  const dbPath = path.join(rootDir, 'memory', '.memory-store', 'memory.sqlite');
  const settledSet = new Set();
  if (fs.existsSync(dbPath)) {
    try {
      const db = openMemoryDatabase(rootDir);
      try {
        for (const r of db.prepare('SELECT id, status FROM outbox_receipts').all()) {
          if (r.id && !/^pending$/i.test(String(r.status || ''))) {
            settledSet.add(String(r.id).toUpperCase());
          }
        }
      } finally {
        try { db.close(); } catch {}
      }
    } catch {}
  }
  if (!fs.existsSync(inboxPath)) return [];
  try {
    const raw = fs.readFileSync(inboxPath, 'utf8');
    const sections = raw.split(/(?=^### \[XMSG-[A-Za-z0-9_-]+\])/m);
    const pending = [];
    for (const sec of sections) {
      const m = sec.match(/^### \[(XMSG-[A-Za-z0-9_-]+)\]\s*(.+)$/m);
      if (m && /STATUS:\s*PENDING/i.test(sec)) {
        const xid = m[1].toUpperCase();
        if (settledSet.has(xid)) continue;
        const srcMatch = sec.match(/来源项目\s*\/?\s*对话\*\*：`([^`]+)`/);
        const catMatch = sec.match(/记忆类别\*\*：`([^`]+)`/);
        pending.push({
          id: xid,
          title: m[2].trim(),
          from: srcMatch ? srcMatch[1] : '跨对话协同',
          category: catMatch ? catMatch[1] : 'CROSS_MEMORY',
          snippet: sec.replace(/\s+/g, ' ').slice(0, 220),
        });
      }
    }
    return pending;
  } catch {
    return [];
  }
}
export function recallForTask(rootDir, optionsOrQuery = {}, maybeTargetFiles = [], maybeOpts = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const options = typeof optionsOrQuery === 'string'
    ? { query: optionsOrQuery, targetFiles: Array.isArray(maybeTargetFiles) ? maybeTargetFiles : [], ...maybeOpts }
    : (optionsOrQuery || {});
  const { query = '', targetFiles = [], readOnly = false, topK = 5 } = options;
  const memDir = path.join(resolvedRoot, 'memory');
  const dbPath = path.join(memDir, '.memory-store', 'memory.sqlite');
  const hasStore = fs.existsSync(dbPath);
  const zeroSyncStats = { incrementalSyncMs: 0, updatedFiles: 0, skippedUnchangedFiles: 0 };
  const pendingCrossInboxItems = readPendingCrossInboxSummary(resolvedRoot);
  if (readOnly && (!fs.existsSync(memDir) || !hasStore)) {
    return {
      initialized: false,
      readOnly: true,
      activeProjectRoot: resolvedRoot,
      userProfile: readUserProfile(resolvedRoot),
      pendingCrossInboxItems,
      recalledMemories: [],
      results: [],
      stats: { totalNodesInDb: 0, candidatePoolEvaluated: 0, pruningRatio: '0.0%', queryMs: 0, reason: 'uninitialized_readonly' },
      indexSyncStats: zeroSyncStats,
    };
  }
  if (readOnly && hasStore) {
    const db = openMemoryDatabase(resolvedRoot);
    try {
      const recallOut = funnelHybridRecall(db, query || '全局架构与防坑规范', targetFiles, topK);
      return {
        initialized: true,
        readOnly: true,
        activeProjectRoot: resolvedRoot,
        userProfile: readUserProfile(resolvedRoot),
        pendingCrossInboxItems,
        recalledMemories: recallOut.results,
        results: recallOut.results,
        stats: recallOut.stats,
        indexSyncStats: zeroSyncStats,
      };
    } finally {
      try { db?.close(); } catch {}
    }
  }
  const syncInfo = syncIncrementalIndex(resolvedRoot, false, true);
  try {
    const recallOut = funnelHybridRecall(syncInfo.db, query || '全局架构与防坑规范', targetFiles, topK);
    return {
      initialized: true,
      readOnly: false,
      activeProjectRoot: resolvedRoot,
      userProfile: readUserProfile(resolvedRoot),
      pendingCrossInboxItems,
      recalledMemories: recallOut.results,
      results: recallOut.results,
      stats: recallOut.stats,
      indexSyncStats: {
        incrementalSyncMs: syncInfo.elapsedMs,
        updatedFiles: syncInfo.updatedFilesCount,
        skippedUnchangedFiles: syncInfo.skippedFilesCount,
      },
    };
  } finally {
    try { syncInfo.db?.close(); } catch {}
  }
}
function runStressBenchmark(rootDir, syntheticNoiseCount = 1200) {
  const { db } = syncIncrementalIndex(rootDir, true);
  const insertNode = db.prepare('INSERT OR REPLACE INTO memory_nodes (id, type, title, content, file_path, entities_json, vector_blob) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertFts = db.prepare('INSERT INTO memory_fts (id, title, expanded_tokens) VALUES (?, ?, ?)');
  const insertEdge = db.prepare('INSERT OR REPLACE INTO memory_edges (from_id, to_id, relation, weight, source_file) VALUES (?, ?, ?, ?, ?)');
  const noiseDomains = [
    ['订单报表导出模块', '处理订单列表分页查询、CSV导出流与前端表格渲染 order_export.ts'],
    ['用户资料头像上传组件', '支持裁剪头像图片、上传OSS存储与进度条展示 profile_avatar.tsx'],
    ['商品库存预警定时任务', '每小时扫描库存水位并推送飞书/邮件通知告警 inventory_cron.mjs'],
    ['后台权限菜单树接口', '查询角色绑定的菜单路由树与按钮显示权限 rbac_menu.service.ts'],
    ['系统操作审计日志查询', '记录管理员增删改查流水日志并提供按日期筛选 audit_log.repo.ts'],
    ['历史日常对话切片记录', '讨论页面主题配色微调、图标对齐与文案修改建议 session_ui_tweak.md'],
  ];
  const injectStart = performance.now();
  runInSavepoint(db, () => {
    for (let i = 1; i <= syntheticNoiseCount; i++) {
      const [titlePrefix, desc] = noiseDomains[i % noiseDomains.length];
      const id = `NOISE-MOD-${String(i).padStart(4, '0')}`;
      const title = `${titlePrefix} #${i}`;
      const content = `模块编号 ${id}: ${desc}，包含常规接口请求、数据库读取与页面按钮交互逻辑 (行号 L10-L180)。`;
      const tokens = [id.toLowerCase(), ...desc.toLowerCase().split(/\s+/), '模块', '接口', '数据', '页面', `noise_${i}`];
      const vec = encodeFloat32Vector(tokens);
      insertNode.run(id, 'SYNTHETIC_MODULE', title, content, `src/synthetic/mod_${i}.ts`, '[]', Buffer.from(vec.buffer));
      insertFts.run(id, title, tokens.join(' '));
      if (i > 1) insertEdge.run(id, `NOISE-MOD-${String(i - 1).padStart(4, '0')}`, 'IMPORTS', 1.0, '__benchmark__');
    }
  });
  const injectMs = Number((performance.now() - injectStart).toFixed(1));
  const totalNodes = db.prepare('SELECT COUNT(*) AS c FROM memory_nodes').get().c;
  const totalEdges = db.prepare('SELECT COUNT(*) AS c FROM memory_edges').get().c;
  const testCases = [
    { name: '用例1 [小白口语 -> 异步防重入基因]', query: '按钮点保存没反应，多点两下居然建了好几条重复数据，有时候接口慢一点页面直接白屏崩了', files: [], expectedTop1: 'EVO-001' },
    { name: '用例2 [小白口语 -> 数据库事务与真持久化基因]', query: '为什么重启一下服务刚才填的数据全清零没了？而且写到一半报错数据库里留了一堆半截脏数据', files: [], expectedTop1: 'EVO-002' },
    { name: '用例3 [小白口语 -> 环境变量与密钥防泄漏基因]', query: '我本地电脑跑得好好的，一放到服务器上就崩溃打不开，还有千万别把密码写死在代码里', files: [], expectedTop1: 'EVO-003' },
    { name: '用例4 [小白口语 -> 外部SDK联网查证基因]', query: '调第三方接口或者大模型老是报方法不存在，AI老是凭记忆用过时的旧语法瞎猜', files: [], expectedTop1: 'EVO-004' },
    { name: '用例5 [小白口语 -> 乐高模块化与防屎山基因]', query: '一个代码文件越写越长都快上千行了，每次改一处坏三处，能不能拆成小积木模块', files: [], expectedTop1: 'EVO-005' },
    { name: '用例6 [小白口语 -> 多子代理交叉审查与防打转基因]', query: '派好几个子代理出去写东西，结果文件名对不上，门禁和弹窗互锁导致模型在内部原地打转', files: [], expectedTop1: 'EVO-006' },
    { name: '用例7 [模糊需求 -> 对话切片中用户明确否决项召回]', query: '登录验证这里我们要不要接入第三方付费短信网关发手机验证码？', files: [], expectedTop1: 'VETO:CONV-YYYYMMDD-001' },
    { name: '用例8 [代码文件触碰 -> 2跳知识图谱上下游与防坑召回]', query: '修改登录状态钩子', files: ['src/client/hooks/useAuthSession.ts'], expectedTop1: 'MOD:useAuthSession.ts', expectedInTop3: 'EVO-001' },
  ];
  console.log('================================================================================');
  console.log('🔥 工业级 SQLite (FTS5 倒排 + 递归 CTE 图谱 + Float32 向量) 高噪声大规模压力评测');
  console.log(`压测库规模: ${totalNodes} 个节点 (含 ${syntheticNoiseCount} 个高干扰同义模块) | ${totalEdges} 条图谱边 | 注入耗时: ${injectMs}ms`);
  console.log('================================================================================\n');
  let top1Hits = 0;
  let top3Hits = 0;
  let totalQueryMs = 0;
  let totalCandidates = 0;
  for (const tc of testCases) {
    const { results, stats } = funnelHybridRecall(db, tc.query, tc.files, 3);
    totalQueryMs += stats.queryMs;
    totalCandidates += stats.candidatePoolEvaluated;
    const top1Id = results[0]?.id || 'NONE';
    const top3Ids = results.map((r) => r.id);
    const hit1 = top1Id === tc.expectedTop1;
    const hit3 = top3Ids.includes(tc.expectedTop1) && (!tc.expectedInTop3 || top3Ids.includes(tc.expectedInTop3));
    if (hit1) top1Hits++;
    if (hit3) top3Hits++;
    console.log(`${hit1 ? '✅' : '❌'} ${tc.name} [耗时: ${stats.queryMs}ms | 粗排候选池: ${stats.candidatePoolEvaluated}/${totalNodes} (${stats.pruningRatio})]`);
    console.log(`   实际召回 Top-3: ${results.map((r, i) => `#${i + 1} [${r.id}] (RRF:${r.rrfScore}, Vec:${r.cosineSim}, BM25:${r.bm25Score}, KG:${r.graphScore})`).join(' | ')}\n`);
  }
  db.exec("DELETE FROM memory_nodes WHERE type = 'SYNTHETIC_MODULE'; DELETE FROM memory_edges WHERE source_file = '__benchmark__'; DELETE FROM memory_fts WHERE id LIKE 'NOISE-MOD-%';");
  try { db.close(); } catch {}
  const incCheck = syncIncrementalIndex(rootDir, false, false);
  console.log('--------------------------------------------------------------------------------');
  console.log(`🎯 1,200+ 节点高压评测结论:`);
  console.log(`   • Top-1 首位精准命中率: ${((top1Hits / testCases.length) * 100).toFixed(1)}% (${top1Hits}/${testCases.length})`);
  console.log(`   • Top-3 综合召回准确率: ${((top3Hits / testCases.length) * 100).toFixed(1)}% (${top3Hits}/${testCases.length})`);
  console.log(`   • 平均单次检索延迟: ${(totalQueryMs / testCases.length).toFixed(2)} ms/次 (平均每次仅精排 ${Math.round(totalCandidates / testCases.length)} 个候选节点，拒绝全表扫描！)`);
  console.log(`   • 增量脏检缓存命中耗时: ${incCheck.elapsedMs} ms (跳过未变更文件 ${incCheck.skippedFilesCount} 个，更新 ${incCheck.updatedFilesCount} 个)`);
  console.log('================================================================================');
}
function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'recall';
  let rootDir = process.cwd();
  let query = '';
  let files = [];
  let scale = 1200;
  for (let i = 1; i < argv.length; i++) {
    if ((argv[i] === '--root' || argv[i] === '--project') && argv[i + 1]) rootDir = path.resolve(argv[++i]);
    else if (argv[i] === '--query' && argv[i + 1]) query = argv[++i];
    else if (argv[i] === '--files' && argv[i + 1]) files = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === '--scale' && argv[i + 1]) scale = parseInt(argv[++i], 10) || 1200;
  }
  if (cmd === 'build' || cmd === 'index') {
    const res = syncIncrementalIndex(rootDir, true, false);
    console.log(`✅ SQLite 混合记忆库构建完成 (${res.elapsedMs}ms): ${res.nodeCount} 个节点 (含真实源码AST), ${res.edgeCount} 条图谱边 -> memory/.memory-store/memory.sqlite`);
  } else if (cmd === 'status') {
    const db = openMemoryDatabase(rootDir);
    try {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all()
        .map((r) => r.name);
      const counts = {
        memory_nodes: db.prepare('SELECT COUNT(*) AS c FROM memory_nodes').get().c,
        memory_edges: db.prepare('SELECT COUNT(*) AS c FROM memory_edges').get().c,
        file_manifest: db.prepare('SELECT COUNT(*) AS c FROM file_manifest').get().c,
        tickets: db.prepare('SELECT COUNT(*) AS c FROM tickets').get().c,
        effects: db.prepare('SELECT COUNT(*) AS c FROM effects').get().c,
        outbox_receipts: db.prepare('SELECT COUNT(*) AS c FROM outbox_receipts').get().c,
      };
      const pragmas = {
        journal_mode: db.prepare('PRAGMA journal_mode').get()?.journal_mode,
        synchronous: db.prepare('PRAGMA synchronous').get()?.synchronous,
        busy_timeout: db.prepare('PRAGMA busy_timeout').get()?.timeout ?? db.prepare('PRAGMA busy_timeout').get()?.busy_timeout,
        foreign_keys: db.prepare('PRAGMA foreign_keys').get()?.foreign_keys,
      };
      console.log(
        JSON.stringify(
          {
            ok: true,
            projectRoot: rootDir,
            dbPath: path.join(rootDir, 'memory', '.memory-store', 'memory.sqlite'),
            pragmas,
            tables,
            counts,
          },
          null,
          2
        )
      );
    } finally {
      try { db.close(); } catch {}
    }
  } else if (cmd === 'benchmark') {
    runStressBenchmark(rootDir, scale);
  } else if (cmd === 'recall') {
    const recallResult = recallForTask(rootDir, { query: query || '全局架构与防坑规范', targetFiles: files, topK: 5, readOnly: false });
    console.log(JSON.stringify(recallResult, null, 2));
  } else {
    console.log('用法: node scripts/memory-graph-engine.mjs [status --project <dir> | build | recall --query "..." --files "..." | benchmark --scale 1200]');
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
