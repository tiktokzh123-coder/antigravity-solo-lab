#!/usr/bin/env node
/**
 * ============================================================================
 * 🧩 记忆引擎词元概念扩展与 256 维 Float32 向量编码器 (memory-vector-tokenizer.mjs)
 * ============================================================================
 * 单一职责：
 *  1. 维护口语 ↔ 工程术语双向语义概念簇并执行分词扩展 (`tokenizeForSearch`)；
 *  2. 将词元编码为定长 256 维 L2 归一化 `Float32Array` 二进制向量 (`encodeFloat32Vector`)；
 *  3. 解析 `.md` 账本与真实源码 AST 提取图谱节点与关系边 (`parseFileToNodesAndEdges`)；
 *  4. 读取用户画像配置 (`readUserProfile`)。
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';

export const VECTOR_DIM = 256;

const CONCEPT_CLUSTERS = [
  ['CONCEPT_ASYNC_UI', ['白屏', '崩溃', '转圈', '没反应', '连点', '重复提交', '双击', '点两下', '卡住', '空数据', '加载', 'loading', 'empty', 'error', 'disabled', '防抖', '防重入', '三态', '五态', '契约', 'undefined', 'typeerror', 'evo_001']],
  ['CONCEPT_DB_TX', ['丢数据', '重启就没', '清零', '半截数据', '脏数据', '孤儿记录', '假数据', 'mock', '内存数组', '事务', 'transaction', 'acid', '持久化', '落盘', '回滚', '多表写', 'evo_002']],
  ['CONCEPT_ENV_SECRET', ['本地电脑', '跑得好好的', '放到服务器', '换电脑', '换环境', '部署崩溃', '缺少配置', '密码写死', '写死在代码', '密码泄露', '写死密钥', '硬编码', '环境变量', 'env', 'fail_fast', '启动校验', 'secret', 'apikey', 'evo_003']],
  ['CONCEPT_SDK_API', ['方法不存在', '过时语法', '旧语法', '瞎编接口', '盲猜', '版本不对', '404', 'deprecated', 'methodnotfound', 'sdk', '第三方接口', '官方文档', '联网查证', '沙盒', 'poc', 'evo_004']],
  ['CONCEPT_LEGO_MODULAR', ['大文件', '上千行', '屎山', '越写越长', '改一处坏三处', '小积木', '复制粘贴', '臃肿', '耦合', '模块化', '乐高', '拆分', '300行', '500行', '行号索引', 'code_map', 'evo_005', '模式a', '模式b']],
  ['CONCEPT_SUBAGENT_AUDIT', ['子代理', '原地打转', '死循环', '死锁', '文件名对不上', '路径不一致', '连环弹窗', '传声筒', '交叉审查', '通读', '合并审批', 'stop_hook', 'ask_question', 'evo_006']],
  ['CONCEPT_SESSION_VETO', ['对话记忆', '跨窗口', '失忆', '忘了', '否定过', '拒绝过', '别再问', '短信网关', '短信验证码', '手机验证码', '偏好', '交接胶囊', '切片', 'conversation_index', 'veto', 'compact', '上下文压缩']],
  ['CONCEPT_AUTH_SESSION', ['登录状态', '鉴权', '权限', '会话', 'token', '登出', '凭证', 'auth', 'session', 'verifycredentials', 'useauthsession', 'feat_001']],
  ['CONCEPT_3D_GRAPH_PREVIEW', ['3d图谱', '星系图', '爆炸半径', 'blast_radius', 'code_graph_3d', 'graph_report', '打不开', '点开是源码', '浏览器打开', '可复用轮子', 'ponytail', '死代码', 'evo_014', 'evo_015']],
  ['CONCEPT_CROSS_FEDERATION', ['跨项目', '跨对话', '联邦图谱', '总星系图', '收件箱', '唤醒', '派单', 'cross_inbox', 'federated', 'xmsg', 'sendagentmessage', '前后端打通', '手机控制端', 'evo_024', 'evo_025']],
];

export function tokenizeForSearch(text) {
  const lower = (text || '').toLowerCase();
  const tokens = [];

  const wordMatches = lower.match(/[a-z0-9_.-]{2,}/g) || [];
  for (const w of wordMatches) {
    const normalized = w.replace(/[.-]/g, '_');
    tokens.push(normalized);
    if (w.includes('.') || w.includes('-')) {
      for (const part of w.split(/[.-]/)) {
        if (part.length >= 2) tokens.push(part);
      }
    }
  }

  const chineseBlocks = lower.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  for (const block of chineseBlocks) {
    for (let i = 0; i < block.length - 1; i++) {
      tokens.push(block.slice(i, i + 2));
      if (i < block.length - 2) tokens.push(block.slice(i, i + 3));
    }
  }

  for (const [clusterId, keywords] of CONCEPT_CLUSTERS) {
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.replace(/_/g, '-')) || lower.includes(kw)) hits++;
    }
    if (hits > 0) {
      const tag = clusterId.toLowerCase();
      for (let i = 0; i < hits * 3; i++) tokens.push(tag);
    }
  }

  return tokens;
}

export function encodeFloat32Vector(tokens) {
  const vec = new Float32Array(VECTOR_DIM);
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

  for (const [term, count] of Object.entries(tf)) {
    const weight = 1 + Math.log(count);
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let i = 0; i < term.length; i++) {
      const c = term.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 16777619);
      h2 ^= c * 31;
      h2 = Math.imul(h2, 16777619);
    }
    const idx = Math.abs(h1) % VECTOR_DIM;
    const sign = (h2 & 1) === 0 ? 1 : -1;
    const boost = term.startsWith('concept_') ? 2.2 : 1.0;
    vec[idx] += sign * weight * boost;
  }

  let normSq = 0;
  for (let i = 0; i < VECTOR_DIM; i++) normSq += vec[i] * vec[i];
  const norm = Math.sqrt(normSq);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) vec[i] /= norm;
  }
  return vec;
}

export function cosineSimFloat32(vecA, blobB) {
  const vecB = new Float32Array(blobB.buffer, blobB.byteOffset, VECTOR_DIM);
  let dot = 0;
  for (let i = 0; i < VECTOR_DIM; i++) dot += vecA[i] * vecB[i];
  return dot;
}

export function extractEntitiesFromText(text) {
  const found = new Set();
  const patterns = [
    /\bEVO-\d{3,4}\b/gi,
    /\bRSI-\d{3,4}\b/gi,
    /\bADR-\d{3,4}\b/gi,
    /\bFEAT-\d{3,4}\b/gi,
    /\bCONV-[A-Z0-9-]+\b/gi,
    /\bXMSG-[A-Z0-9_-]+\b/gi,
    /\b[a-zA-Z0-9_-]+\.(?:ts|tsx|js|mjs|py|sh)\b/g,
  ];
  for (const pat of patterns) {
    const matches = text.match(pat) || [];
    for (const m of matches) {
      found.add(m.includes('.') ? `MOD:${path.basename(m)}` : m.toUpperCase());
    }
  }
  return [...found];
}

export function parseFileToNodesAndEdges(fullPath, relFile, raw, rootDir = '') {
  const nodes = [];
  const edges = [];

  const pushNode = (id, type, title, content, extraEntities = []) => {
    const tokens = tokenizeForSearch(`${id} ${title} ${content}`);
    const vec = encodeFloat32Vector(tokens);
    const entities = [...new Set([...extractEntitiesFromText(`${title} ${content}`), ...extraEntities])];
    nodes.push({
      id,
      type,
      title,
      content: content.trim(),
      file_path: relFile,
      entities,
      expanded_tokens: tokens.join(' '),
      vector_blob: Buffer.from(vec.buffer),
    });
  };

  if (relFile === 'memory/EVOLUTION_LEDGER.md') {
    const tableRows = raw.match(/\|\s*\*\*`(EVO-\d+)`\*\*[\s\S]*?\|/g) || [];
    const tableLinks = {};
    for (const row of tableRows) {
      const m = row.match(/\*\*`(EVO-\d+)`\*\*/);
      if (m) tableLinks[m[1]] = extractEntitiesFromText(row);
    }
    const sections = raw.split(/(?=^### \[(?:EVO|RSI)-\d+\]|^## )/m);
    for (const sec of sections) {
      const m = sec.match(/^### \[(EVO-\d+)\]\s*(.+)$/m);
      if (m) {
        const evoId = m[1].toUpperCase();
        pushNode(evoId, 'EVO_GENE', m[2].trim(), sec, tableLinks[evoId] || []);
        continue;
      }
      const rm = sec.match(/^### \[(RSI-\d+)\]\s*(.+)$/m);
      if (rm) {
        const rsiId = rm[1].toUpperCase();
        pushNode(rsiId, 'RSI_EXPERIMENT', rm[2].trim(), sec);
      }
    }
  } else if (relFile === 'memory/PRODUCT_PROGRESS.md') {
    for (const line of raw.split('\n')) {
      const m = line.match(/\|\s*`(FEAT-\d+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
      if (m) pushNode(m[1].toUpperCase(), 'FEATURE', `${m[2].trim()} - ${m[3].trim()}`, line);
    }
  } else if (relFile === 'memory/CODE_MAP.md') {
    for (const line of raw.split('\n')) {
      // 仅匹配首列为模块路径且第2列包含“行”字的架构模块声明行（避免误匹配 auto-code-mapper 扩展名表与 SPLIT 大文件追踪表）
      const m = line.match(/^\s*\|\s*(?:\[)?`(\[示例:\s*)?([^`\]]+\.[a-z]{2,4})\]?`(?:\]\([^)]+\))?\s*\|\s*`?([^|`]*\d+\s*行[^|`]*)`?\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
      if (m) {
        const isExampleRow = Boolean(m[1]);
        const modPath = m[2].trim();
        const lineCountStr = m[3].trim();
        const roleDesc = m[4].trim();
        const exportDesc = m[5].trim();
        const depText = m[6].trim();
        if (roleDesc.includes('存量超标') || roleDesc.includes('预警')) continue;

        const modBase = path.basename(modPath);
        const modId = `MOD:${modBase}`;
        const depEntities = extractEntitiesFromText(depText);
        const domainTokens = tokenizeForSearch(`${modPath} ${roleDesc} ${exportDesc} ${depText}`);
        if (domainTokens.includes('concept_env_secret') || modBase.includes('env')) depEntities.push('EVO-003');
        if (domainTokens.includes('concept_async_ui') || modPath.includes('client/')) depEntities.push('EVO-001');
        if (domainTokens.includes('concept_db_tx') || modPath.includes('server/')) depEntities.push('EVO-002');
        if (domainTokens.includes('concept_auth_session')) depEntities.push('FEAT-001');

        const isMotherRepo = rootDir && path.basename(path.resolve(rootDir)) === 'universal-fullstack-evo-os';
        const realFileExists = rootDir && fs.existsSync(path.join(rootDir, modPath));
        if (!realFileExists && isExampleRow && isMotherRepo) {
          pushNode(
            modId,
            'CODE_MODULE',
            `${modPath} (${roleDesc})`,
            `模块路径: ${modPath} | 行数: ${lineCountStr} | 职责: ${roleDesc} | 导出符号: ${exportDesc} | 上下游依赖: ${depText}`,
            depEntities
          );
        } else if (realFileExists) {
          for (const targetEnt of new Set(depEntities)) {
            if (targetEnt === modId) continue;
            edges.push({ from: modId, to: targetEnt, relation: 'RELATES_TO', weight: 2.2, source_file: relFile });
            edges.push({ from: targetEnt, to: modId, relation: 'REV_RELATES_TO', weight: 2.0, source_file: relFile });
          }
        }
      }
    }
  } else if (relFile === 'memory/ARCHITECTURE_DECISIONS.md') {
    const sections = raw.split(/(?=^### \[ADR-\d+\])/m);
    for (const sec of sections) {
      const m = sec.match(/^### \[(ADR-\d+)\]\s*(.+)$/m);
      if (m) pushNode(m[1].toUpperCase(), 'ADR_DECISION', m[2].trim(), sec);
    }
  } else if (relFile === 'memory/CROSS_INBOX.md') {
    const sections = raw.split(/(?=^### \[XMSG-[A-Za-z0-9_-]+\])/m);
    for (const sec of sections) {
      const m = sec.match(/^### \[(XMSG-[A-Za-z0-9_-]+)\]\s*(.+)$/m);
      if (m) {
        const xmsgId = m[1].toUpperCase();
        const title = m[2].trim();
        const isPending = /STATUS:\s*PENDING/i.test(sec);
        const extra = extractEntitiesFromText(sec);
        pushNode(
          xmsgId,
          'CROSS_MEMORY',
          `${isPending ? '[待处理跨项目记忆] ' : '[跨项目记忆] '}${title}`,
          sec,
          extra
        );
      }
    }
  } else if (relFile.startsWith('memory/sessions/') && relFile.endsWith('.md')) {
    const idMatch = raw.match(/对话切片编号\*\*：`([^`]+)`/) || [null, path.basename(relFile, '.md')];
    const topicMatch = raw.match(/对话核心主题\*\*：`([^`]+)`/) || [null, path.basename(relFile)];
    const convId = idMatch[1].toUpperCase();
    pushNode(convId, 'SESSION_SLICE', `对话切片: ${topicMatch[1]}`, raw);

    const vetoMatch = raw.match(/明确否决过的想法[\s\S]*?-\s*(.+)/);
    if (vetoMatch) {
      const vetoId = `VETO:${convId}`;
      pushNode(vetoId, 'USER_VETO', `🚫 用户明确否决项 (${convId})`, `严禁重提已被用户否决的方案: ${vetoMatch[1].trim()}`, [convId]);
    }
  } else if (/\.(ts|tsx|js|mjs|cjs|jsx|py|go|rs)$/.test(relFile)) {
    const modBase = path.basename(relFile);
    const modId = `MOD:${modBase}`;
    const imports = [];
    const importRegex = /(?:^\s*import\s+[^;'"]*?\bfrom\s+['"]([^'"]+)['"]|^\s*export\s+[^;'"]*?\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\))/gm;
    let im;
    while ((im = importRegex.exec(raw)) !== null) {
      const target = im[1] || im[2] || im[3] || im[4];
      if (target && !target.startsWith('node:')) {
        const targetBase = path.basename(target).replace(/\.(js|ts|mjs|tsx|cjs|jsx)$/, '');
        imports.push(`MOD:${targetBase}.mjs`, `MOD:${targetBase}.ts`, `MOD:${targetBase}.tsx`, `MOD:${targetBase}.js`, `MOD:${targetBase}.cjs`, `MOD:${targetBase}.jsx`);
      }
    }
    if (relFile.endsWith('.py')) {
      const pyImportRegex = /^\s*(?:from\s+([a-zA-Z0-9_.]+)\s+import\s+([a-zA-Z0-9_,\s]+)|import\s+([a-zA-Z0-9_.]+))/gm;
      let pm;
      while ((pm = pyImportRegex.exec(raw)) !== null) {
        const modPath = pm[1] || pm[3] || '';
        const lastSeg = modPath.split('.').filter(Boolean).pop();
        if (lastSeg && lastSeg.length > 1) imports.push(`MOD:${lastSeg}.py`);
      }
    }
    const exportedSyms = new Set();
    const jsExpRegex = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_]+)/g;
    let em;
    while ((em = jsExpRegex.exec(raw)) !== null) exportedSyms.add(em[1]);
    const namedExpRegex = /export\s*\{\s*([^}]+)\s*\}/g;
    let nm;
    while ((nm = namedExpRegex.exec(raw)) !== null) {
      for (const part of nm[1].split(',')) {
        const cleanSym = part.trim().split(/\s+as\s+/i).pop().trim();
        if (/^[A-Za-z0-9_]+$/.test(cleanSym)) exportedSyms.add(cleanSym);
      }
    }
    if (relFile.endsWith('.py')) {
      const pyDefRegex = /^(?:async\s+)?(?:def|class)\s+([A-Za-z0-9_]+)/gm;
      let dm;
      while ((dm = pyDefRegex.exec(raw)) !== null) {
        if (!dm[1].startsWith('_')) exportedSyms.add(dm[1]);
      }
    }
    const exportStr = exportedSyms.size > 0 ? [...exportedSyms].slice(0, 12).join(', ') : '无显式导出';
    const routeSet = new Set(
      (raw.match(/['"`](\/(?:api|v1|v2)\/[a-zA-Z0-9_-]{2,}(?:\/[a-zA-Z0-9_-]{2,})?)/g) || []).map((s) => s.slice(1).toLowerCase())
    );
    const routeStr = routeSet.size > 0 ? ` | 接口路由: ${[...routeSet].slice(0, 10).join(', ')}` : '';
    const firstComment = (raw.match(/\/\*\*([\s\S]*?)\*\//) || raw.match(/"""([\s\S]*?)"""/) || [null, ''])[1]
      .replace(/\*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    const lineCount = raw.split('\n').length;
    pushNode(
      modId,
      'SOURCE_FILE',
      `${relFile} (${lineCount}行) ${firstComment.slice(0, 40)}`,
      `源码文件: ${relFile} | 行数: ${lineCount} | 导出符号: ${exportStr}${routeStr} | 摘要: ${firstComment}`,
      imports
    );
    for (const impTarget of new Set(imports)) {
      if (impTarget !== modId) {
        edges.push({ from: modId, to: impTarget, relation: 'IMPORTS', weight: 1.8, source_file: relFile });
      }
    }
  }

  for (const n of nodes) {
    for (const targetEnt of n.entities) {
      if (targetEnt === n.id) continue;
      const weight = n.type === 'EVO_GENE' || targetEnt.startsWith('EVO-') || n.type === 'USER_VETO' ? 2.5 : 1.3;
      edges.push({ from: n.id, to: targetEnt, relation: 'RELATES_TO', weight, source_file: relFile });
      edges.push({ from: targetEnt, to: n.id, relation: 'REV_RELATES_TO', weight: weight * 0.9, source_file: relFile });
    }
  }

  return { nodes, edges };
}

export function readUserProfile(rootDir) {
  const profilePath = path.join(rootDir, 'memory', 'USER_PROFILE.md');
  const defaults = {
    Onboarding_Completed: 'false',
    Language_Preference: 'zh-CN',
    Proficiency_Level: 'L0_BEGINNER',
    Default_Output_Style: 'MATCH_LEVEL',
  };
  if (!fs.existsSync(profilePath)) return defaults;
  const raw = fs.readFileSync(profilePath, 'utf8');
  for (const key of Object.keys(defaults)) {
    const m = raw.match(new RegExp(`\\*\\*\`${key}\`\\*\\*\\s*\\|\\s*\`([^\`]+)\``));
    if (m) defaults[key] = m[1].trim();
  }
  return defaults;
}
