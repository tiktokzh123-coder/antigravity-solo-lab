#!/usr/bin/env node
/**
 * ============================================================================
 * 🗂️ 对话上下文记忆自动切片与跨窗口交接归档器 (Session Memory Slicer)
 * ============================================================================
 * 定位：将每次对话（或长对话中的阶段节点）中的「用户原话意图、审美/交互偏好、
 *       明确否决项（别再问清单）、推理脉络、改动文件、快照ID与未完待续交接点」
 *       按对话粒度拆分为独立的 `memory/sessions/CONV-YYYYMMDD-XXX-<slug>.md` 文件，
 *       并通过智能锚点自动刷新 `memory/CONVERSATION_INDEX.md` 总索引与顶层交接胶囊。
 *
 * 用法示例：
 *   node scripts/session-memory-slicer.mjs \
 *     --topic "完成极简登录模块与会话持久化" \
 *     --intent "用户要求极简流程，明确否决付费短信网关，只用邮箱验证码" \
 *     --modules "src/client/Login.tsx, src/server/auth.ts" \
 *     --snapshot "latest" \
 *     --next "下一步开发登录后跳转的仪表盘首页汇总接口"
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    topic: '',
    intent: '',
    vetoed: '',
    reasoning: '',
    modules: '-',
    snapshot: 'latest',
    next: '待用户在下一轮对话指定新任务',
    convId: '',
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root' && argv[i + 1]) opts.root = path.resolve(argv[++i]);
    else if (arg === '--topic' && argv[i + 1]) opts.topic = argv[++i];
    else if (arg === '--intent' && argv[i + 1]) opts.intent = argv[++i];
    else if (arg === '--vetoed' && argv[i + 1]) opts.vetoed = argv[++i];
    else if (arg === '--reasoning' && argv[i + 1]) opts.reasoning = argv[++i];
    else if (arg === '--modules' && argv[i + 1]) opts.modules = argv[++i];
    else if (arg === '--snapshot' && argv[i + 1]) opts.snapshot = argv[++i];
    else if (arg === '--next' && argv[i + 1]) opts.next = argv[++i];
    else if (arg === '--conv-id' && argv[i + 1]) opts.convId = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(`
用法: node scripts/session-memory-slicer.mjs --topic "<对话主题>" [选项]

选项:
  --root <dir>        项目根目录 (默认: 当前目录)
  --topic <text>      [必填] 本次对话核心主题一句话摘要
  --intent <text>     用户核心诉求、偏好与否决项一句话精粹
  --vetoed <text>     用户在本次对话中明确拒绝/否决的方案（严禁后续重提）
  --reasoning <text>  本次对话关键推理脉络与技术取舍背景
  --modules <text>    关联的代码模块、ADR 或 EVO 编号
  --snapshot <id>     绑定的时光机快照 ID (默认: latest)
  --next <text>       跨窗口无缝交接的下一步第一顺位动作
  --conv-id <uuid>    可选：关联的原生会话 UUID
`);
      process.exit(0);
    }
  }
  return opts;
}

function formatDateParts(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return {
    dateCompact: `${yyyy}${mm}${dd}`,
    dateTimeDisplay: `${yyyy}-${mm}-${dd} ${hh}:${min}`,
  };
}

function sanitizeSlug(text) {
  const cleaned = text
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return cleaned || 'session';
}

function getNextSequenceNumber(sessionsDir, dateCompact) {
  if (!fs.existsSync(sessionsDir)) return '001';
  const files = fs.readdirSync(sessionsDir);
  let maxSeq = 0;
  const prefix = `CONV-${dateCompact}-`;
  for (const f of files) {
    if (f.startsWith(prefix)) {
      const rest = f.slice(prefix.length);
      const match = rest.match(/^(\d{3})/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
  }
  return String(maxSeq + 1).padStart(3, '0');
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.topic) {
    console.error('❌ 请通过 --topic "<对话核心主题>" 提供本次对话切片的主题摘要（使用 --help 查看用法）。');
    process.exit(1);
  }

  const sessionsDir = path.join(opts.root, 'memory', 'sessions');
  const indexFile = path.join(opts.root, 'memory', 'CONVERSATION_INDEX.md');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const { dateCompact, dateTimeDisplay } = formatDateParts();
  const seq = getNextSequenceNumber(sessionsDir, dateCompact);
  const sliceId = `CONV-${dateCompact}-${seq}`;
  const slug = sanitizeSlug(opts.topic);
  const fileName = `${sliceId}_${slug}.md`;
  const sliceFilePath = path.join(sessionsDir, fileName);
  const relSlicePath = `memory/sessions/${fileName}`;

  const intentText = opts.intent || opts.topic;
  const vetoText = opts.vetoed || '本次对话无特殊否决项';
  const reasoningText = opts.reasoning || '按标准工业级全栈流程完成需求解码、模块化实现与真机门禁验证。';
  const convLinkLine = opts.convId
    ? `- **原生对话链接**：\`[点击回溯原始对话记录](conversation://${opts.convId})\``
    : `- **原生对话链接**：\`本地对话归档\``;

  const sliceContent = `# 单次对话上下文记忆切片档案 (\`${fileName}\`)

> **切片元数据（Session Metadata）**
> - **对话切片编号**：\`${sliceId}\`
> - **记录时间**：\`${dateTimeDisplay}\`
> ${convLinkLine}
> - **对话核心主题**：\`${opts.topic}\`
> - **本轮绑定时光机快照 ID**：\`${opts.snapshot}\`（一键回滚：\`bash scripts/snapshot-and-rollback.sh rollback ${opts.snapshot}\`）

---

## 一、 用户原话意图、深层偏好与「明确否决项」沉淀（User Intent & Vetoed Ideas）

1. **用户本次的核心诉求与偏好精粹**：
   - ${intentText}
2. **🚫 用户在本次对话中明确否决过的想法（严禁后续对话重提）**：
   - ${vetoText}

---

## 二、 本次对话关键推理脉络与技术妥协背景（Contextual Reasoning）

- ${reasoningText}

---

## 三、 本次对话关联的代码模块与账本记录（Deliverables & Links）

- **涉及代码模块 / 架构决策 / 进化基因**：\`${opts.modules}\`
- **时光机安全回滚锚点**：\`${opts.snapshot}\`

---

## 四、 跨对话 / 跨窗口 10 秒无缝交接胶囊（Next Session Handoff Capsule）

1. **本次对话收尾状态**：已完成「${opts.topic}」并沉淀至独立对话切片。
2. **下一步第一顺位动作（Next Immediate Step）**：
   - \`[ ]\` ${opts.next}
`;

  fs.writeFileSync(sliceFilePath, sliceContent, 'utf8');

  // 创建短 ID 别名软链接（兼容跨窗口智能体直接根据切片编号盲猜短文件名的容错需求，EVO-022）
  const aliasFileName = `${sliceId}.md`;
  const aliasFilePath = path.join(sessionsDir, aliasFileName);
  try {
    if (fs.existsSync(aliasFilePath) || fs.lstatSync(aliasFilePath).isSymbolicLink()) {
      fs.rmSync(aliasFilePath, { force: true });
    }
  } catch {}
  try {
    fs.symlinkSync(fileName, aliasFilePath);
  } catch {
    try {
      fs.copyFileSync(sliceFilePath, aliasFilePath);
    } catch {}
  }

  if (fs.existsSync(indexFile)) {
    let indexContent = fs.readFileSync(indexFile, 'utf8');
    const startAnchor = '<!-- AUTO-SESSION-INDEX:START -->';
    const endAnchor = '<!-- AUTO-SESSION-INDEX:END -->';
    const startIdx = indexContent.indexOf(startAnchor);
    const endIdx = indexContent.indexOf(endAnchor);

    const newRow = `| **\`${sliceId}\`** | \`${dateTimeDisplay}\` | ${opts.topic.replace(/\|/g, '｜')} | ${intentText.replace(/\|/g, '｜')} | \`${opts.modules.replace(/\|/g, '｜')}\` | \`${opts.snapshot}\` | [\`${fileName}\`](./sessions/${fileName}) |`;

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const tableBlock = indexContent.slice(startIdx + startAnchor.length, endIdx).trimEnd();
      const updatedBlock = `${tableBlock}\n${newRow}\n`;
      indexContent =
        indexContent.slice(0, startIdx + startAnchor.length) +
        '\n' +
        updatedBlock.trimStart() +
        indexContent.slice(endIdx);
    }

    // 同步刷新顶部交接胶囊
    indexContent = indexContent
      .replace(/- \*\*最近一次活跃对话切片\*\*：.*/, `- **最近一次活跃对话切片**：[\`${relSlicePath}\`](./sessions/${fileName})`)
      .replace(/- \*\*上次对话刚完成的核心动作\*\*：.*/, `- **上次对话刚完成的核心动作**：\`${opts.topic}\``)
      .replace(/- \*\*用户在对话中强调的最新偏好 \/ 禁忌（别再犯）\*\*：.*/, `- **用户在对话中强调的最新偏好 / 禁忌（别再犯）**：\`${intentText}（否决项：${vetoText}）\``)
      .replace(/- \*\*当前未完待续的第一顺位动作（Next Immediate Step）\*\*：.*/, `- **当前未完待续的第一顺位动作（Next Immediate Step）**：\`${opts.next}\``)
      .replace(/- \*\*绑定的安全回滚快照 ID\*\*：.*/, `- **绑定的安全回滚快照 ID**：\`${opts.snapshot}\`（一键回滚：\`bash scripts/snapshot-and-rollback.sh rollback ${opts.snapshot}\`）`);

    fs.writeFileSync(indexFile, indexContent, 'utf8');
  }

  console.log(`✅ 对话上下文切片已生成: ${relSlicePath}`);
  console.log(`✅ 已自动创建短ID兼容别名: memory/sessions/${aliasFileName} -> ${fileName}`);
  console.log(`✅ 对话总目录与跨窗口交接胶囊已同步更新: memory/CONVERSATION_INDEX.md`);
}

main();
