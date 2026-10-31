#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  syncIncrementalIndex,
  readUserProfile,
  recallForTask,
  openMemoryDatabase,
  runInSavepoint,
  upsertTicket,
  listTickets,
  enqueueEffect,
  settleOutboxReceipt,
} from './memory-graph-engine.mjs';
import { buildGraphAndBlastRadius } from './code-graph-3d-generator.mjs';
import { runSecurityAndSimplicityAudit, recordRsiExperiment } from './security-and-simplicity-audit.mjs';
import { buildFederated3dGraph } from './federated-graph-3d-generator.mjs';
import {
  appendCrossProjectMemory,
  ackCrossProjectMemory,
  dispatchTaskToConversation,
  swarmSpawnOrRouteByName,
  swarmReportToCommander,
  getSwarmStatusBoard,
  resolveCanonicalProjectRoot,
  hasRealProjectFiles,
  isContainerOrMotherDir,
} from './cross-project-federation.mjs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENGINE_HOME_DIR = path.resolve(__dirname, '..');
const TEMPLATE_MEMORY_DIR = fs.existsSync(path.join(ENGINE_HOME_DIR, 'memory-templates'))
  ? path.join(ENGINE_HOME_DIR, 'memory-templates')
  : path.join(ENGINE_HOME_DIR, 'memory');
const CORE_LEDGER_FILES = [
  'USER_PROFILE.md',
  'PRODUCT_PROGRESS.md',
  'CODE_MAP.md',
  'ARCHITECTURE_DECISIONS.md',
  'EVOLUTION_LEDGER.md',
  'CONVERSATION_INDEX.md', ];
function ensureProjectMemoryInitialized(projectRoot, allowEngineSelfTest = false, readOnly = false) {
  const resolvedRoot = resolveCanonicalProjectRoot(projectRoot);
  if (!resolvedRoot || isContainerOrMotherDir(resolvedRoot, allowEngineSelfTest)) {
    return {
      initialized: false, rootDir: null,
      error: `⚠️ 路径隔离保护拦截：project_root (${resolvedRoot || projectRoot}) 是父级容器目录或 Evo-OS 引擎母版目录！请传入您当前实际正在开发/摸排的具体业务子项目根目录（例如 ${path.join(os.homedir(), 'Downloads', 'edge-container-cluster')} 或 ${path.join(os.homedir(), 'code', 'newcore')}），以确保各项目记忆 100% 物理隔离且不污染母版库。`,
    }; }
  if (!allowEngineSelfTest && !readOnly && !hasRealProjectFiles(resolvedRoot)) {
    return {
      initialized: false, rootDir: null,
      error: `⚠️ 空壳目录保护拦截：project_root (${resolvedRoot}) 在磁盘上不存在或无任何业务源码文件，已阻止创建孤儿 memory/ 目录！`, }; }
  const memDir = path.join(resolvedRoot, 'memory');
  if (readOnly) {
    if (!fs.existsSync(memDir)) return { initialized: true, readOnlyUninit: true, rootDir: resolvedRoot, createdCount: 0 };
    return { initialized: true, rootDir: resolvedRoot, createdCount: 0 }; }
  const sessionsDir = path.join(memDir, 'sessions');
  let createdCount = 0;
  const codeMapPath = path.join(memDir, 'CODE_MAP.md');
  const isFirstInit = !fs.existsSync(codeMapPath);
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(sessionsDir, { recursive: true });
  for (const fileName of CORE_LEDGER_FILES) {
    const destFile = path.join(memDir, fileName);
    const srcFile = path.join(TEMPLATE_MEMORY_DIR, fileName);
    if (!fs.existsSync(destFile) && fs.existsSync(srcFile)) { fs.copyFileSync(srcFile, destFile); createdCount++; } }
  const destSessionTpl = path.join(sessionsDir, 'TEMPLATE_SESSION_MEMORY.md');
  const srcSessionTpl = path.join(TEMPLATE_MEMORY_DIR, 'sessions', 'TEMPLATE_SESSION_MEMORY.md');
  if (!fs.existsSync(destSessionTpl) && fs.existsSync(srcSessionTpl)) { fs.copyFileSync(srcSessionTpl, destSessionTpl); createdCount++; }
  const hasTemplatePlaceholder =
    !allowEngineSelfTest &&
    fs.existsSync(codeMapPath) &&
    (fs.readFileSync(codeMapPath, 'utf8').includes('universal-fullstack-evo-os') || fs.readFileSync(codeMapPath, 'utf8').includes(ENGINE_HOME_DIR));
  const codeMapperScript = path.join(__dirname, 'auto-code-mapper.mjs');
  if ((isFirstInit || hasTemplatePlaceholder) && fs.existsSync(codeMapperScript)) {
    try {
      spawnSync(process.execPath, [codeMapperScript, '--root', resolvedRoot, '--output', codeMapPath], { stdio: 'ignore', timeout: 10000 });
      buildGraphAndBlastRadius(resolvedRoot);
    } catch { } }
  return { initialized: true, rootDir: resolvedRoot, createdCount }; }
const TOOLS = [
  {
    name: 'memory_recall_for_task',
    description:
      '【每轮任务第0步必调】根据具体业务项目路径(project_root)、用户提问与目标文件，在独立 SQLite 记忆库上执行「FTS5 倒排 + 2跳递归知识图谱 + 256维向量」检索，返回防坑基因(EVO)、架构决策(ADR)、对话切片(CONV)、否决项(VETO)与用户段位配置。支持 read_only 只查不改模式。',
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: '【必填】当前具体业务项目根目录绝对路径（严禁传入 ~/Downloads 容器或母版目录）' },
        user_query: { type: 'string', description: '用户的原始需求描述或问题' },
        target_files: { type: 'array', items: { type: 'string' }, description: '可选：本次拟读取或修改的代码文件名/模块路径列表' },
        top_k: { type: 'number', description: '召回记忆条目数量，默认 5' },
        read_only: { type: 'boolean', description: '可选：当用户明确要求“只查别改”且项目尚未建档时设为 true，不创建新文件' },
      },
      required: ['project_root'], }, },
  {
    name: 'memory_rebuild_index',
    description:
      '当更新了项目的 memory/*.md 账本或代码后，调用此工具即时重建该项目独立的 SQLite 知识图谱与向量库，并自动刷新 3D 知识图谱 (CODE_GRAPH_3D.html) 与架构枢纽报告 (GRAPH_REPORT.md)。',
    inputSchema: {
      type: 'object',
      properties: { project_root: { type: 'string', description: '【必填】当前具体业务项目的根目录绝对路径' } },
      required: ['project_root'], }, },
  {
    name: 'user_profile_update',
    description:
      '更新当前项目与全局默认模板的 USER_PROFILE.md 语言、编程段位与汇报版式配置（一次破冰，多项目自动继承）。',
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: '可选：当前具体业务项目的根目录绝对路径' },
        language_preference: { type: 'string', enum: ['zh-CN', 'zh-EN-bilingual', 'en-US'] },
        proficiency_level: { type: 'string', enum: ['L0_BEGINNER', 'L1_INTERMEDIATE', 'L2_EXPERT'] },
        default_output_style: { type: 'string', enum: ['MATCH_LEVEL', 'DUAL_VERSION_ALWAYS'] }, },
      required: ['language_preference', 'proficiency_level', 'default_output_style'], }, },
  {
    name: 'project_memory_init',
    description:
      '为指定项目初始化独立隔离的 memory/ 活体记忆账本、自动扫描 CODE_MAP.md 并生成 3D 知识图谱 CODE_GRAPH_3D.html。',
    inputSchema: {
      type: 'object',
      properties: { project_root: { type: 'string', description: '目标业务项目根目录绝对路径' } },
      required: ['project_root'], }, },
  {
    name: 'code_graph_blast_radius',
    description:
      '【接手大项目或修改核心模块前自动调用】内建增强版 Graphify 3D 引擎：自动生成/刷新真 3D 交互式知识图谱 (memory/CODE_GRAPH_3D.html) 与诊断报告 (memory/GRAPH_REPORT.md)，识别核心枢纽 (God Nodes)、循环依赖、可复用轮子清单 (供 Ponytail 复用)，并计算指定文件 (target_file) 的 2 跳修改爆炸半径 (Blast Radius)。支持 open_in_browser 自动在系统浏览器中弹出渲染好的 3D 星系图。',
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: '【必填】目标业务项目根目录绝对路径' },
        target_file: { type: 'string', description: '可选：拟修改的文件名或模块名，用于精准计算 1~2 跳上下游爆炸半径' },
        open_in_browser: { type: 'boolean', description: '可选：是否自动调用系统默认浏览器 (macOS open) 弹出 3D 交互式星系网页供用户直接操作' },
        read_only: { type: 'boolean', description: '可选：只读计算爆炸半径，对未初始化 memory/ 的项目不创建新目录' }, },
      required: ['project_root'], }, },
  {
    name: 'security_simplicity_audit',
    description:
      '【修改信任边界或完成编码后自动调用】内建 Cloudflare Security-Audit + Ponytail 化繁为简 + 契约漂移综合审计器：自动扫描高危安全边界漏洞、无意义单行套壳函数、零引用死导出、前后端 API/环境变量契约漂移与假测试，并自动更新项目自进化棘轮台账与研发劳动力倍增系数 (evolution-metrics.json)。',
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: '【必填】目标业务项目根目录绝对路径' },
        read_only: { type: 'boolean', description: '可选：只读扫描模式，不更新或创建棘轮文件' }, },
      required: ['project_root'], }, },
  {
    name: 'code_graph_federated_3d',
    description:
      '【跨项目排查/全局鸟瞰自动调用】生成多项目联邦 3D 总星系图 (CODE_GRAPH_FEDERATED_3D.html) 与全局联邦架构报告 (FEDERATED_GRAPH_REPORT.md)，自动汇总 Antigravity UI 项目名 ↔ 对话窗口标题 ↔ 磁盘真实目录三层动态映射，并识别跨项目 API 路由契约、收件箱记忆、环境变量与多项目对话桥接边。支持 open_in_browser 自动弹出系统默认浏览器渲染。',
    inputSchema: {
      type: 'object',
      properties: {
        project_roots: { type: 'array', items: { type: 'string' }, description: '可选：纳入联邦星系图的多个业务项目根目录绝对路径列表；省略时自动扫描已初始化 memory/ 的核心业务项目' },
        open_in_browser: { type: 'boolean', description: '可选：是否自动调用系统默认浏览器弹出 3D 联邦总星系网页供用户直接操作' }, }, }, },
  {
    name: 'cross_project_memory_append',
    description:
      '【跨项目契约变更自动调用】当修改了跨项目共享 API、环境变量、硬件/云端契约或排查出跨端根因时，向关联项目的 memory/CROSS_INBOX.md 投递跨项目记忆条目（带 SHA-256 内容指纹幂等去重与超 30 条自动归档），并立即同步重建目标项目的 SQLite 图谱索引。',
    inputSchema: {
      type: 'object',
      properties: {
        from_project: { type: 'string', description: '【必填】源项目名称或根目录绝对路径' },
        to_project_root: { type: 'string', description: '【必填】接收方目标项目的根目录绝对路径' },
        title: { type: 'string', description: '【必填】跨项目变更或告警简明标题' },
        impact_scope: { type: 'string', description: '【必填】受影响的 API 路由、环境变量或文件模块' },
        action_required: { type: 'string', description: '【必填】接收方项目需要配合执行的修改或排查动作' },
        severity: { type: 'string', enum: ['INFO', 'WARN', 'BREAKING'], description: '可选：变更级别，默认 WARN' },
        dry_run: { type: 'boolean', description: '可选：仅预演校验参数与计算指纹 ID，不写入文件' }, },
      required: ['from_project', 'to_project_root', 'title', 'impact_scope', 'action_required'], }, },
  {
    name: 'cross_conversation_dispatch',
    description:
      '【跨对话自动派单唤醒】在投递跨项目记忆后，经过 6 重安全门禁校验（禁止自派单、60s 冷却防震荡、目标必须为 IDLE 空闲态、禁止打断 ask_question 审批弹窗、禁止打断后台任务、自动强制先写入 CROSS_INBOX.md 持久化兜底），通过本机 LanguageServer SendAgentMessage RPC 自动向目标对话窗口发送派单并唤醒执行。',
    inputSchema: {
      type: 'object',
      properties: {
        target_conversation: { type: 'string', description: '【必填】目标对话窗口的 ID 或对话标题关键字（如 "全栈项目主对话"、"手机伪装测试与部署"）' },
        from_project: { type: 'string', description: '【必填】发起派单的源项目路径或名称' },
        to_project_root: { type: 'string', description: '【必填】目标对话负责的业务项目根目录绝对路径' },
        title: { type: 'string', description: '【必填】跨对话协同派单标题' },
        impact_scope: { type: 'string', description: '【必填】变更涉及的接口/模块范围' },
        action_required: { type: 'string', description: '【必填】希望目标对话自动执行的任务与回执要求' },
        sender_id: { type: 'string', description: '可选：当前发起方对话 ID（用于拦截自派单）' },
        dry_run: { type: 'boolean', description: '可选：仅预演校验 6 道安全门禁，不实际落盘或发送唤醒 RPC' },
        auto_wake: { type: 'boolean', description: '可选：是否发送实时唤醒 RPC，默认 true' }, },
      required: ['target_conversation', 'from_project', 'to_project_root', 'title', 'impact_scope', 'action_required'], }, },
  {
    name: 'swarm_spawn_or_route_by_name',
    description:
      '【AGY Swarm Commander 按板块名称路由或自动孵化具名子对话工作节点 (EVO-026)】总控根据业务板块名称（module_name）与子项目路径（project_root），优先检索已有「🧩 [板块:<module_name>] 工作节点」对话窗口并派发任务；当未找到且 auto_create_if_missing=true 时，通过 LanguageServer StartCascade + UpdateConversationAnnotations 自动新建具名领域工作会话窗口并写入全局蜂群注册表。',
    inputSchema: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: '【必填】业务板块名称（如 "EdgeNode控制端"、"Muse视频API"、"前端工坊"）' },
        project_root: { type: 'string', description: '【必填】该板块对应的真实业务项目根目录绝对路径' },
        task_title: { type: 'string', description: '【必填】指派给领域工作会话的任务标题' },
        task_prompt: { type: 'string', description: '【必填】指派给领域工作会话的详细执行指令与验收标准' },
        commander_id: { type: 'string', description: '可选：总控对话窗口 ID 或标题标识，供工作节点回传任务回执' },
        auto_create_if_missing: { type: 'boolean', description: '可选：未找到同名领域工作会话窗口时是否自动新建具名对话窗口，默认 false' },
        auto_wake: { type: 'boolean', description: '可选：是否立即向目标或新孵化的领域工作会话窗口发送唤醒/首任务指令 RPC，默认 true' },
        dry_run: { type: 'boolean', description: '可选：预演模式，不实际触发新建窗口或唤醒 RPC' }, },
      required: ['module_name', 'project_root', 'task_title', 'task_prompt'], }, },
  {
    name: 'swarm_report_to_commander',
    description:
      '【AGY Swarm 领域工作会话向总控异步回传任务回执特权通道 (SWARM_ACK · EVO-026)】具名领域工作会话完成任务、遇到阻塞或需总控拍板时调用。内置防死锁特权设计：免除总控容器目录写拦截、豁免 Gate 2 乒乓拦截、豁免 Gate 3 冷却与 Gate 4 空闲限制，直接写入全局 swarm-registry.json 回执队列并通过 SendAgentMessage 异步回传总控窗口。',
    inputSchema: {
      type: 'object',
      properties: {
        commander_conversation: { type: 'string', description: '【必填】总控对话窗口 ID 或窗口标题关键字' },
        from_module_name: { type: 'string', description: '【必填】汇报方板块名称（如 "EdgeNode控制端"）' },
        from_project_root: { type: 'string', description: '【必填】汇报方负责的业务项目根目录绝对路径' },
        task_title: { type: 'string', description: '【必填】所汇报的任务标题' },
        status: { type: 'string', enum: ['DONE', 'BLOCKED', 'NEEDS_DECISION', 'COMPLETED', 'SUCCESS', 'FAILED', 'STUCK'], description: '【必填】任务执行状态：DONE（已完成，兼容 COMPLETED/SUCCESS）、BLOCKED（阻塞失败，兼容 STUCK/FAILED）、NEEDS_DECISION（需总控决策）' },
        summary: { type: 'string', description: '【必填】核心改动、排查结论或阻塞原因摘要' },
        verification_evidence: { type: 'string', description: '可选：真机测试、门禁通过或截图验证证据' },
        minted_labor_assets: { type: 'string', description: '可选：本次任务新沉淀的可复用函数、脚本或 Skill 资产' },
        ack_xmsg_ids: { type: 'array', items: { type: 'string' }, description: '可选：本次任务完成并需核销的收件箱消息 ID 列表（如 ["XMSG-3785050D56"]，若省略则自动从标题与摘要中提取核销）' },
        dry_run: { type: 'boolean', description: '可选：预演模式，不实际写入注册表或发送 RPC' }, },
      required: ['commander_conversation', 'from_module_name', 'from_project_root', 'task_title', 'status', 'summary'], }, },
  {
    name: 'swarm_status_board',
    description:
      '【AGY Swarm 全局蜂群态势看板】一键汇总「1 总控调度器窗口 + N 个具名板块子对话窗口 + M 个会话内子代理 (Subagents)」的三层蜂群拓扑、最新工作节点任务回执回传队列 (commanderReports) 以及各业务项目的研发劳动力倍增系数 (R&D Labor Force Multiplier)。',
    inputSchema: {
      type: 'object',
      properties: {
        project_roots: { type: 'array', items: { type: 'string' }, description: '可选：指定汇总劳动力倍增指标的业务项目根目录列表' },
        include_subagents: { type: 'boolean', description: '可选：是否包含会话内子代理 (Subagents) 列表，默认 true' }, }, }, },
  {
    name: 'rsi_experiment_record',
    description:
      '【8 步科学实验闭环与研发劳动力倍增记录器 (EVO-025)】将针对「用户个人习惯 / 插件与 Skill 工具链 / 项目代码架构 / 蜂群协同工作流」的 8 步科学实验闭环（提出假设 -> 设计实验 -> 修改代码 -> 启动实验 -> 分析结果 -> 诊断失败原因 -> 调整实验路线 -> 开启下一轮迭代与铸造劳动力资产）结构化追加至项目 EVOLUTION_LEDGER.md，并自动重算刷新 evolution-metrics.json 中的研发劳动力倍增系数 (laborForceMultiplier)。',
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: '【必填】目标业务项目根目录绝对路径' },
        experiment_title: { type: 'string', description: '【必填】本次科学实验闭环的简明标题' },
        target_domain: { type: 'string', enum: ['USER_HABIT', 'PLUGIN_OR_SKILL', 'CODE_ARCHITECTURE', 'SWARM_WORKFLOW'], description: '可选：进化实验所属领域，默认 PLUGIN_OR_SKILL' },
        step1_hypothesis: { type: 'string', description: '【必填】Step 1 提出假设：明确待验证的改进假设与预期指标提升' },
        step2_experiment_design: { type: 'string', description: '【必填】Step 2 设计实验：对照组/实验组设计与可量化判定标准' },
        step3_code_changes: { type: 'string', description: '【必填】Step 3 修改代码与固化工具：具体修改的文件、新增的轮子/脚本/MCP工具' },
        step4_experiment_run: { type: 'string', description: '【必填】Step 4 启动实验：真机/沙盒/自动化测试运行过程与命令' },
        step5_result_analysis: { type: 'string', description: '【必填】Step 5 分析实验结果：实测数据对比与假设是否成立' },
        step6_failure_diagnosis: { type: 'string', description: '【必填】Step 6 诊断失败原因或边界缺陷：暴露出的边缘场景或残余瓶颈' },
        step7_route_adjustment: { type: 'string', description: '【必填】Step 7 调整实验路线：针对残余问题修正架构或参数策略' },
        step8_next_cycle_and_labor_minted: { type: 'string', description: '【必填】Step 8 开启下一轮迭代与铸造劳动力资产：沉淀了哪些永久替代人工的研发资产及下一轮假设' },
        dry_run: { type: 'boolean', description: '可选：预演模式，仅生成 Markdown 预览与计算劳动力乘数，不落盘' }, },
      required: [
        'project_root', 'experiment_title', 'step1_hypothesis', 'step2_experiment_design', 'step3_code_changes',
        'step4_experiment_run', 'step5_result_analysis', 'step6_failure_diagnosis', 'step7_route_adjustment', 'step8_next_cycle_and_labor_minted',
      ], }, },
  {
    name: 'cross_inbox_ack',
    description:
      '【跨项目/跨对话收件箱消息核销工具 (EVO-027)】将目标业务项目 memory/CROSS_INBOX.md 中的指定消息 (xmsg_id 如 XMSG-3785050D56) 状态原子级更新为 ACKED、MERGED 或 FAILED，并即时同步 SQLite 索引。彻底杜绝手动调用 edit_file 匹配 Target 报错。',
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: '【必填】目标业务项目的根目录绝对路径' },
        xmsg_id: { type: 'string', description: '【必填】收件箱中的消息指纹 ID（如 XMSG-3785050D56 或 3785050D56）' },
        status: { type: 'string', enum: ['ACKED', 'MERGED', 'FAILED', 'PENDING'], description: '可选：更新的目标状态，默认 ACKED' },
        dry_run: { type: 'boolean', description: '可选：是否仅预演' },
      },
      required: ['project_root', 'xmsg_id'],
    },
  },
];
function applyProfileFieldsToFile(profilePath, { language_preference, proficiency_level, default_output_style }) {
  if (!fs.existsSync(profilePath)) return false;
  let content = fs.readFileSync(profilePath, 'utf8');
  content = content
    .replace(/(\*\*`Onboarding_Completed`\*\*\s*\|\s*)`[^`]+`/, '$1`true`')
    .replace(/(\*\*`Language_Preference`\*\*\s*\|\s*)`[^`]+`/, `$1\`${language_preference}\``)
    .replace(/(\*\*`Proficiency_Level`\*\*\s*\|\s*)`[^`]+`/, `$1\`${proficiency_level}\``)
    .replace(/(\*\*`Default_Output_Style`\*\*\s*\|\s*)`[^`]+`/, `$1\`${default_output_style}\``);
  fs.writeFileSync(profilePath, content, 'utf8');
  return true; }
function updateUserProfileAcrossScopes(targetRoot, args) {
  const normalized = {
    language_preference: args.language_preference || args.languagePreference || 'zh-CN',
    proficiency_level: args.proficiency_level || args.proficiencyLevel || args.coding_tier || 'L0_BEGINNER',
    default_output_style: args.default_output_style || args.defaultOutputStyle || args.reporting_style || 'MATCH_LEVEL', };
  const updatedPaths = [];
  const targets = new Set([
    path.join(TEMPLATE_MEMORY_DIR, 'USER_PROFILE.md'),
    path.join(ENGINE_HOME_DIR, 'memory', 'USER_PROFILE.md'), ]);
  if (targetRoot && !isContainerOrMotherDir(targetRoot)) {
    targets.add(path.join(targetRoot, 'memory', 'USER_PROFILE.md')); }
  for (const p of targets) {
    if (applyProfileFieldsToFile(p, normalized)) updatedPaths.push(p); }
  return { updatedPaths, normalized }; }
async function handleRpcRequest(req) {
  const { id, method, params } = req;
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'evo-memory-mcp', version: '3.2.0' }, }, }; }
  if (method === 'notifications/initialized') return null;
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } }; }
  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    const rawRoot = args.project_root || args.projectRoot || process.env.PROJECT_ROOT || process.cwd();
    const allowSelfTest = Boolean(args.allow_engine_self_test ?? args.allowEngineSelfTest);
    const readOnly = Boolean(args.read_only ?? args.readOnly);
    try {
      if (toolName === 'memory_recall_for_task') {
        const initRes = ensureProjectMemoryInitialized(rawRoot, allowSelfTest, readOnly);
        if (!initRes.initialized) {
          const profile = readUserProfile(ENGINE_HOME_DIR);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      isolationWarning: initRes.error, userPersonaDirective: profile,
                      actionRequired:
                        '请立即传入当前任务对应的具体子项目文件夹路径作为 project_root 重新调用 memory_recall_for_task，并在该子项目的 memory/ 下维护账本！', },
                    null,
                    2 ), }, ], }, }; }
        if (initRes.readOnlyUninit) {
          const profile = readUserProfile(ENGINE_HOME_DIR);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      activeProjectRoot: initRes.rootDir, readOnlyMode: true, note: '当前为只读模式且该项目尚未初始化 memory/，未创建任何文件。',
                      userPersonaDirective: profile, recalledGraphAndVectorMemories: [], },
                    null,
                    2 ), }, ], }, }; }
        const targetRoot = initRes.rootDir;
        const rawTargetFiles = args.target_files ?? args.targetFiles ?? [];
        const targetFiles = Array.isArray(rawTargetFiles)
          ? rawTargetFiles.map(String)
          : typeof rawTargetFiles === 'string' && rawTargetFiles.trim()
            ? [rawTargetFiles.trim()]
            : [];
        const topK = Math.max(1, Math.min(20, Number(args.top_k ?? args.topK) || 5));
        const recallRes = recallForTask(targetRoot, {
          query: args.user_query || args.userQuery || args.query || '',
          targetFiles,
          readOnly,
          topK,
        });
        const html3dPath = path.join(targetRoot, 'memory', 'CODE_GRAPH_3D.html');
        if (!readOnly && (recallRes.indexSyncStats.updatedFiles > 0 || !fs.existsSync(html3dPath))) {
          try {
            buildGraphAndBlastRadius(targetRoot, '', { allowEngineSelfTest: allowSelfTest });
          } catch { } }
        const profile = recallRes.userProfile;
        const payload = {
          activeProjectRoot: targetRoot, isolatedMemoryDir: path.join(targetRoot, 'memory'), codeGraph3dHtml: html3dPath,
          codeGraphBrowserOpenCommand: `open "${html3dPath}"`,
          onboardingRequired: profile.Onboarding_Completed === 'false',
          pendingCrossInboxItems: recallRes.pendingCrossInboxItems || [], indexSyncStats: recallRes.indexSyncStats,
          retrievalFunnelStats: recallRes.stats,
          userPersonaDirective: {
            ...profile, internalRule: '【铁律】对内研发、代码质量、子代理审查与门禁验收必须 100% 执行最高工业级标准，严禁降级！',
            preAskQuestionEmailRule:
              '【EVO-024 弹窗提问前必发邮件铁律】每次即将调用 ask_question 弹出选择题/审批弹窗等待用户点击前，必须先通过 /usr/sbin/sendmail -t -oi 向 notify@example.com 发送提醒邮件（写明当前哪个项目/对话弹出了什么问题与选项），再调用 ask_question，防止用户在床上休息或离开电脑时看不到屏幕弹窗耽误进度！',
            externalRule:
              profile.Onboarding_Completed === 'false'
                ? '检测到首次启动未完成用户画像破冰！请先发邮件提醒，再调用 ask_question 弹出 USER_PROFILE.md 中的「首次启动三合一破冰问卷」！'
                : `对外向用户输出时，严格使用语言 [${profile.Language_Preference}] 并按用户段位 [${profile.Proficiency_Level}] (${profile.Default_Output_Style}) 组织回答；若用户要求看其他段位版本再按需展开。`,
          }, recalledGraphAndVectorMemories: recallRes.recalledMemories, };
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }, }; }
      if (toolName === 'memory_rebuild_index') {
        const initRes = ensureProjectMemoryInitialized(rawRoot, allowSelfTest);
        if (!initRes.initialized) {
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: initRes.error }] } }; }
        const idx = syncIncrementalIndex(initRes.rootDir, true, false);
        const graphInfo = buildGraphAndBlastRadius(initRes.rootDir, '', { allowEngineSelfTest: allowSelfTest });
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `✅ 项目 [${initRes.rootDir}] 的 SQLite 知识图谱与 3D 星系图已同步重建完成 (${idx.elapsedMs}ms)：共 ${idx.nodeCount} 个节点，${idx.edgeCount} 条边，已刷新 ${graphInfo.generatedFiles?.html3dPath || ''}`,
              }, ], }, }; }
      if (toolName === 'user_profile_update') {
        const targetRoot = args.project_root || args.projectRoot ? resolveCanonicalProjectRoot(args.project_root || args.projectRoot) : null;
        const { updatedPaths, normalized } = updateUserProfileAcrossScopes(targetRoot, args);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `✅ 用户画像已永久写入并同步全局模板 (Onboarding_Completed=true, Level=${normalized.proficiency_level}, Lang=${normalized.language_preference}, Style=${normalized.default_output_style})，影响路径：${updatedPaths.join(', ')}`,
              }, ], }, }; }
      if (toolName === 'project_memory_init' || toolName === 'project_memory_init_or_status') {
        const initRes = ensureProjectMemoryInitialized(rawRoot, allowSelfTest);
        if (!initRes.initialized) {
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: initRes.error }] } }; }
        const idx = syncIncrementalIndex(initRes.rootDir, false, false);
        const graphInfo = buildGraphAndBlastRadius(initRes.rootDir, '', { allowEngineSelfTest: allowSelfTest });
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    projectRoot: initRes.rootDir, memoryInitialized: initRes.initialized,
                    newlyCreatedFiles: initRes.createdCount, nodeCount: idx.nodeCount, edgeCount: idx.edgeCount,
                    codeGraph3dHtml: graphInfo.generatedFiles?.html3dPath,
                    graphReportMd: graphInfo.generatedFiles?.reportMdPath, syncMs: idx.elapsedMs, },
                  null,
                  2 ), }, ], }, }; }
      if (toolName === 'code_graph_blast_radius') {
        const initRes = ensureProjectMemoryInitialized(rawRoot, allowSelfTest, readOnly);
        if (!initRes.initialized) {
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: initRes.error }] } }; }
        const res = buildGraphAndBlastRadius(initRes.rootDir, args.target_file || args.targetFile || '', {
          openInBrowser: Boolean(args.open_in_browser ?? args.openInBrowser),
          allowEngineSelfTest: allowSelfTest,
          readOnly,
        });
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] }, }; }
      if (toolName === 'security_simplicity_audit') {
        const resolvedAuditRoot = resolveCanonicalProjectRoot(rawRoot);
        if (!resolvedAuditRoot || isContainerOrMotherDir(resolvedAuditRoot, allowSelfTest)) {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `⚠️ 路径隔离保护拦截：project_root (${resolvedAuditRoot || rawRoot}) 是父级容器目录或 Evo-OS 引擎母版目录！请传入您当前实际正在开发/摸排的具体业务子项目根目录，以确保各项目记忆与棘轮指标 100% 物理隔离。`,
                }, ], }, }; }
        const res = runSecurityAndSimplicityAudit(resolvedAuditRoot, {
          allowEngineSelfTest: allowSelfTest,
          readOnly,
        });
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] }, }; }
      if (toolName === 'code_graph_federated_3d') {
        const roots = args.project_roots || args.projectRoots || [];
        const res = await buildFederated3dGraph(Array.isArray(roots) ? roots : [roots], {
          openInBrowser: Boolean(args.open_in_browser ?? args.openInBrowser),
          outputRoot: args.output_root || args.outputRoot || '',
        });
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] }, }; }
      if (toolName === 'cross_project_memory_append') {
        const fed = await import(`./cross-project-federation.mjs?v=${fs.statSync(path.join(__dirname, 'cross-project-federation.mjs')).mtimeMs}`);
        const isDryRun = Boolean(args.dry_run ?? args.dryRun);
        const res = fed.appendCrossProjectMemory({
          fromProject: args.from_project || args.fromProject,
          toProjectRoot: args.to_project_root || args.toProjectRoot || args.target_project_root,
          title: args.title,
          impactScope: args.impact_scope || args.impactScope,
          actionRequired: args.action_required || args.actionRequired,
          severity: args.severity || 'WARN',
          allowEngineSelfTest: allowSelfTest,
          dryRun: isDryRun,
        });
        if (res.ok && !isDryRun && res.targetProjectRoot && res.xmsgId) {
          try {
            const payloadData = {
              xmsgId: res.xmsgId,
              fromProject: args.from_project || args.fromProject || '跨窗口协同',
              title: args.title,
              impactScope: args.impact_scope || args.impactScope || '',
              actionRequired: args.action_required || args.actionRequired || '',
              severity: args.severity || 'WARN',
            };
            const db = openMemoryDatabase(res.targetProjectRoot);
            try {
              runInSavepoint(db, () => {
                res.outboxReceipt = settleOutboxReceipt(db, res.xmsgId, 'PENDING', {
                  channel: 'cross_inbox',
                  payload: payloadData,
                });
                res.enqueuedEffect = enqueueEffect(db, 'cross_inbox_append', res.xmsgId, payloadData);
              });
            } finally {
              try { db.close(); } catch {}
            }
          } catch {}
        }
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] }, }; }
      if (toolName === 'cross_conversation_dispatch') {
        const fed = await import(`./cross-project-federation.mjs?v=${fs.statSync(path.join(__dirname, 'cross-project-federation.mjs')).mtimeMs}`);
        const res = await fed.dispatchTaskToConversation({
          targetConversationIdOrTitle: args.target_conversation || args.targetConversation,
          fromProject: args.from_project || args.fromProject,
          toProjectRoot: args.to_project_root || args.toProjectRoot || args.target_project_root,
          title: args.title,
          impactScope: args.impact_scope || args.impactScope,
          actionRequired: args.action_required || args.actionRequired,
          senderId: args.sender_id || args.senderId || process.env.CONVERSATION_ID || '',
          allowEngineSelfTest: allowSelfTest,
          dryRun: Boolean(args.dry_run ?? args.dryRun),
          autoWake:
            args.auto_wake !== undefined || args.autoWake !== undefined
              ? Boolean(args.auto_wake ?? args.autoWake)
              : true,
        });
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] }, }; }
      if (toolName === 'swarm_spawn_or_route_by_name') {
        const fed = await import(`./cross-project-federation.mjs?v=${fs.statSync(path.join(__dirname, 'cross-project-federation.mjs')).mtimeMs}`);
        const res = await fed.swarmSpawnOrRouteByName({ ...args, allowEngineSelfTest: allowSelfTest });
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] } };
      }
      if (toolName === 'swarm_report_to_commander') {
        const fed = await import(`./cross-project-federation.mjs?v=${fs.statSync(path.join(__dirname, 'cross-project-federation.mjs')).mtimeMs}`);
        const res = await fed.swarmReportToCommander({ ...args, allowEngineSelfTest: allowSelfTest });
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] } };
      }
      if (toolName === 'swarm_status_board') {
        const fed = await import(`./cross-project-federation.mjs?v=${fs.statSync(path.join(__dirname, 'cross-project-federation.mjs')).mtimeMs}`);
        const res = await fed.getSwarmStatusBoard(args);
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] } };
      }
      if (toolName === 'rsi_experiment_record') {
        const res = recordRsiExperiment({ ...args, allowEngineSelfTest: allowSelfTest });
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] } };
      }
      if (toolName === 'cross_inbox_ack') {
        const fed = await import(`./cross-project-federation.mjs?v=${fs.statSync(path.join(__dirname, 'cross-project-federation.mjs')).mtimeMs}`);
        const isDryRun = Boolean(args.dry_run ?? args.dryRun);
        const res = fed.ackCrossProjectMemory({ ...args, allowEngineSelfTest: allowSelfTest });
        const rawTarget = args.project_root || args.projectRoot || args.target_project_root || args.targetProjectRoot || rawRoot;
        const resolvedTarget = resolveCanonicalProjectRoot(rawTarget);
        const rawXmsgId = String(args.xmsg_id || args.xmsgId || args.msg_id || args.msgId || '').trim();
        const cleanId = rawXmsgId
          ? (rawXmsgId.toUpperCase().startsWith('XMSG-') ? rawXmsgId.toUpperCase() : `XMSG-${rawXmsgId.toUpperCase()}`)
          : '';
        const targetStatus = String(args.status || 'ACKED').trim().toUpperCase();
        if (!isDryRun && cleanId && resolvedTarget && (allowSelfTest || hasRealProjectFiles(resolvedTarget))) {
          try {
            const inboxPath = path.join(resolvedTarget, 'memory', 'CROSS_INBOX.md');
            let fallbackMdUpdated = Boolean(res.updated);
            if (!fallbackMdUpdated && fs.existsSync(inboxPath)) {
              const rawMd = fs.readFileSync(inboxPath, 'utf8');
              if (rawMd.toUpperCase().includes(cleanId)) {
                const patchedMd = rawMd.replace(
                  new RegExp(`(\\[${cleanId}\\][\\s\\S]*?STATUS:\\s*)([A-Z_]+)`, 'i'),
                  `$1${targetStatus}`
                );
                if (patchedMd !== rawMd) {
                  fs.writeFileSync(inboxPath, patchedMd, 'utf8');
                  fallbackMdUpdated = true;
                }
              }
            }
            let receipt = null;
            let effect = null;
            const db = openMemoryDatabase(resolvedTarget);
            try {
              runInSavepoint(db, () => {
                receipt = settleOutboxReceipt(db, cleanId, targetStatus, {
                  channel: 'cross_inbox',
                  payload: { xmsgId: cleanId, status: targetStatus, targetProjectRoot: resolvedTarget },
                });
                effect = enqueueEffect(db, 'cross_inbox_ack', cleanId, {
                  xmsgId: cleanId,
                  status: targetStatus,
                  settledAt: receipt.settled_at,
                });
              });
            } finally {
              try { db.close(); } catch {}
            }
            let syncStats = null;
            try {
              syncStats = syncIncrementalIndex(resolvedTarget, false, false);
            } catch {}
            const mergedRes = {
              ...res,
              ok: true,
              xmsgId: cleanId,
              previousStatus: res.previousStatus ?? receipt?.previousStatus ?? null,
              status: targetStatus,
              inboxPath,
              targetProjectRoot: resolvedTarget,
              updated: true,
              markdownUpdated: fallbackMdUpdated,
              sqliteReceiptSettled: Boolean(receipt),
              outboxReceipt: receipt,
              enqueuedEffect: effect,
              sqliteSynced: Boolean(syncStats) || Boolean(res.sqliteSynced),
              nodeCount: syncStats?.nodeCount || res.nodeCount || 0,
            };
            delete mergedRes.error;
            return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(mergedRes, null, 2) }] } };
          } catch {}
        }
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] } };
      }
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ ok: false, error: `MCP 工具执行异常: ${err.message || String(err)}` }) }],
        },
      };
    }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }; }
if (process.argv[2] === '--dump-schemas' && process.argv[3]) {
  const outDir = path.resolve(process.argv[3]);
  fs.mkdirSync(outDir, { recursive: true });
  for (const t of TOOLS) {
    fs.writeFileSync(path.join(outDir, `${t.name}.json`), JSON.stringify(t, null, 2) + '\n', 'utf8'); }
  process.exit(0); }
const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    Promise.resolve(handleRpcRequest(req))
      .then((res) => {
        if (res) process.stdout.write(JSON.stringify(res) + '\n'); })
      .catch((err) => {
        process.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id ?? null, error: { code: -32603, message: err.message } }) + '\n' ); });
  } catch (err) {
    process.stdout.write(
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: err.message } }) + '\n' ); } });
