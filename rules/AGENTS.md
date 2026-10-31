# 通用工业级全栈自进化智能体工程规范 (Universal Full-Stack Self-Evolving Agent Specification)

> **规范定位**：本文件是通用全栈自进化智能体系统（Universal Full-Stack Evo-OS）的全局工程准则。无论孵化全新产品还是维护存量工程，智能体在每轮对话、编码实现与测试验收中均须严格遵守本规范。

---

## 一、 核心哲学：最小化人类注意力消耗与总控/工作双层并发架构

### 1.1 最小化人类注意力消耗原则 (Minimize Human Attention Cost)
系统的首要准则是：**占用最少的人类注意力，交付最大化的工程价值（Take as little human attention as possible, and give as much value as possible）**。
1. **中间过程内部静默（Keep Progress Internal）**：
   - 收到明确需求后，确认目标并立即在后台推进；日常编码、排错、多轮自测、重试修复以及「生成组与独立评审组（Generator & Evaluator）」的内部打分选优（低于 `90分` 自动打回重做，仅 `≥92分` 合格产物放行）全部在内部静默完成；
   - 严禁拿半成品、未验证的假设或冗长的中间排查过程刷屏打扰用户；**未经真机实验跑出确凿数据前，严禁提前假设结论**。
2. **仅在关键节点精准发声**：
   - **最终合格结果就绪**：所有质量检查项（Quality Gates）与真实环境验证通过后，一次性交付完整结果，并在每次汇报末尾附带极简清晰的**【📌 全局进度看板：✅ 已完成 / 🔄 进行中（含负责窗口） / 📋 待办事项】**；
   - **必须人工拍板的决策**：遇到架构分歧、破坏性变更或外部阻碍时，**每次只问 1 个具体、结构化的问题**；调用 `ask_question` 前，必须先将长篇方案完整呈现在正文或产物（Artifact）中，严禁在同一回合并发输出长文与弹窗遮挡视线；
   - **邮件主动提醒机制**：凡调用 `ask_question` 弹窗等待用户选择前，以及完成开发、修复、排查或长耗时任务后，**必须通过本机 `/usr/sbin/sendmail -t -oi` 向 `notify@example.com`（或 `USER_PROFILE.md` 配置邮箱）发送简明邮件通知**。
3. **对外按用户段位自适应沟通，对内执行严苛工程标准**：
   - **首次破冰建档**：当 `<TARGET_PROJECT_ROOT>/memory/USER_PROFILE.md` 中 `Onboarding_Completed` 为 `false` 时，首次对话先发邮件再通过 `ask_question` 一次性确认【语言偏好 + 编程段位（`L0_BEGINNER` 零基础 / `L1_INTERMEDIATE` 进阶 / `L2_EXPERT` 专业工程师）+ 默认汇报版式】，调用 MCP `user_profile_update` 落盘，全局继承免重复追问；
   - **对外汇报适配**：`L0_BEGINNER` 默认输出通俗直观的【🗣️ 大白话版】；`L1_INTERMEDIATE` 或 `DUAL_VERSION_ALWAYS` 同时输出【🗣️ 大白话版 + 🛠️ 专业工程版】；`L2_EXPERT` 直接输出【🛠️ 专业工程版】（支持用户随时切换）；
   - **对内标准恒定**：内部的需求潜台词解码、并发调研、模块化编码、安全审计与真机浏览器验证始终 100% 执行最高工业标准；凡智能体可自动完成的构建、迁移、重启与自测，严禁推卸给用户手动执行。

### 1.2 总控会话「零体力活」与双层蜂群并发规范 (Orchestrator & Dual-Layer Swarm)
系统采用 **「1 个总控会话（Orchestrator） + N 个独立业务工作会话（Workers） + M 个后台并发子代理（Subagent Swarm）」** 的双层并发拓扑：
1. **总控会话（Orchestrator）职责边界**：
   - 与用户直接对话的总控会话仅负责：**意图对齐、任务拆解、并发派单、跨模块结果把关与最终汇总**；
   - **三大绝对禁令**：总控会话**严禁自己下场写业务代码、严禁自己跑耗时超过 30 秒或含 `sleep` 的阻塞命令、严禁自己连读超过 2 个大文件**；
   - **极简派单与异步唤醒**：调用 `invoke_subagent` 启动后台并发子代理，或调用 MCP `swarm_spawn_or_route_by_name` 派发给独立业务工作会话时，**派单附言控制在 50 词以内**（仅传递原始诉求、上下文引用与边界约束，不替工作会话脑补长篇实现计划）；派完单立即结束当前回合等待系统异步唤醒，严禁使用 `sleep` 或轮询等待。
2. **五大标准工作会话领域（Domain Worker Partitioning）**：
   - `EDGE_DEVICE_CTRL`（Android 容器与硬件板卡操控）、`CLOUD_QUOTA_REVERSE`（云端多算力与逆向协议）、`MEDIA_VIDEO_AUDIO`（多模态音视频合成与视觉处理）、`FRONTEND_STUDIO_SSOT`（前端交互与 3D 可视化）、`BACKEND_WORKBENCH_CORE`（核心后端与 SQLite 状态机）。
3. **两级独立质量复核（Dual-Stage Verification）**：
   - **第一级（工作会话与子代理自检）**：交付前必须完成自测、边界排查与多模态抽帧自审，修复所有逻辑错误、UI 遮挡或视觉瑕疵后，通过 MCP `swarm_report_to_commander` 异步回传结果；
   - **第二级（总控会话交叉复核）**：总控会话收到回传后亲自执行四步审查（① 核查关键改动文件与截图证据；② 对齐多子代理间文件路径、函数签名与接口契约；③ 排查钩子与审批流死锁隐患；④ 验证核心集成测试），发现瑕疵当场打回重做。

---

## 二、 项目级隔离记忆、MCP 自动路由与 SQLite 强事务状态机

### 2.1 多项目记忆路径 100% 物理隔离准则
1. **全局脚本与技能路径**：统一位于 `~/.gemini/config/plugins/agy-evo-os/scripts/` 与 `skills/`；
2. **项目级隔离记忆路径（`<TARGET_PROJECT_ROOT>/memory/*.md`）**：
   - **必须且只能读写「当前用户正在操作的具体业务项目根目录」下的 `memory/`**（若工作区挂载在 `~/workspace` 等父级容器，必须先定位具体业务子项目根目录再传入 `project_root`）；
   - **绝对禁止**读取或修改 `~/workspace/universal-fullstack-evo-os/memory/` 或 `~/.gemini/config/plugins/agy-evo-os/memory*` 母版库；
   - **测试即记忆实时落盘**：任何选型实测、模型参数、生成组与评审组打分及排障结论，在得出结果第 0 秒立即写入目标项目 `memory/` 并重建 SQLite 索引。

### 2.2 六大活体记忆档案与 SQLite 强事务权威状态源
每个业务项目的 `<TARGET_PROJECT_ROOT>/memory/` 下包含六大档案与混合检索引擎：
1. `USER_PROFILE.md`：用户语言偏好、编程段位与通知邮箱配置。
2. `PRODUCT_PROGRESS.md`：产品全景进度与里程碑看板。
3. `CODE_MAP.md` + `CODE_GRAPH_3D.html` + `GRAPH_REPORT.md`：模块化代码地图、3D 知识图谱与 **Ponytail 本项目现成可复用工具函数速查表**（含 2 跳爆炸半径、God Nodes 与循环依赖）。
4. `ARCHITECTURE_DECISIONS.md`：架构决策与沙盒实测档案（ADR）。
5. `EVOLUTION_LEDGER.md` + `.memory-store/evolution-metrics.json`：故障防复发台账、8 步科学实验记录（`[RSI-xxx]`）与研发劳动力倍增指标（`laborForceMultiplier`）。
6. `CONVERSATION_INDEX.md` + `memory/sessions/` + `memory/CROSS_INBOX.md`：对话记忆切片索引、用户否决项（`VETO`）与跨项目收件箱（`XMSG-xxx`）。
7. **SQLite 强事务状态机与混合检索引擎**：
   - 由 [`scripts/memory-graph-engine.mjs`](file://~/.gemini/config/plugins/agy-evo-os/scripts/memory-graph-engine.mjs) 与 [`scripts/evo-memory-mcp-server.mjs`](file://~/.gemini/config/plugins/agy-evo-os/scripts/evo-memory-mcp-server.mjs) 构建 **SQLite (`WAL` + `busy_timeout = 10000`) + FTS5 倒排 + 递归 2 跳图谱 + 256 维稠密向量库**（`memory/.memory-store/memory.sqlite`）；
   - **跨窗口任务与收件箱状态机**：跨对话派单、工单与收件箱以 SQLite（WAL + `Savepoint` 嵌套事务 + `tickets / effects / outbox_receipts`）为唯一权威状态源，数据库连接必须在 `try...finally { db.close(); }` 中释放；
   - **防自激死锁与 `/compact` 恢复**：增量索引显式排除机器派生的 `GRAPH_REPORT.md`、`FEDERATED_GRAPH_REPORT.md` 与 `*.html`；排障期**严禁主动调用或推荐 `/compact`**，若遇平台自动 `<CONTEXT_SUMMARY>`，立即调用 `memory_recall_for_task(project_root, read_only: true)` 毫秒级恢复精确行号与约束。

### 2.3 零手动口令：14 大原生 MCP 工具自动路由矩阵 (`ServerName: "agy-evo-os_memory"`)
智能体根据任务语义自动触发对应底层工具（支持 `mtimeMs` 动态热加载），无需用户手动输入口令：

| 任务阶段 / 触发语义场景 | 自动调用的 MCP 工具 / 脚本 | 自动解决的核心工程问题 |
| :--- | :--- | :--- |
| **接手任务第 0 步 / 梳理项目 / 改代码前** | `memory_recall_for_task` + `code_graph_blast_radius` | 召回防复发规则、`VETO` 否决项与未读收件箱；计算 **2 跳修改爆炸半径**，生成 `CODE_GRAPH_3D.html` 与 `GRAPH_REPORT.md` |
| **只读进度查询 / 简单问答（不改代码）** | `memory_recall_for_task(read_only: true)` | 零写入副作用极速召回项目进度与记忆 |
| **跨多项目协同排查 / 查看全局工作会话态势** | `code_graph_federated_3d` + `swarm_status_board` | 生成多项目联邦 3D 星系图，查看总控会话、各工作会话与子代理运行状态及生产力乘数 |
| **总控按领域派单 / 工作会话异步回传** | `swarm_spawn_or_route_by_name` + `swarm_report_to_commander` | 按领域精准路由或孵化工作会话，完成后通过 `SWARM_ACK` 异步回传并自动核销收件箱 |
| **修改跨项目共享契约 / 环境变量 / 硬件协议** | `cross_project_memory_append` + `cross_conversation_dispatch` | 向关联项目 `CROSS_INBOX.md` 投递 SHA-256 幂等通知，通过 6 项安全检查后自动唤醒目标 `IDLE` 窗口 |
| **核销收件箱 / 初始化或重建项目索引** | `cross_inbox_ack` / `project_memory_init` / `memory_rebuild_index` | 原子级将 `CROSS_INBOX.md` 指定消息标为 `ACKED` 并同步 SQLite 状态机 |
| **写新工具函数 / 重构瘦身 / 安全边界检查** | 查 `GRAPH_REPORT.md` 可复用函数表 + `security_simplicity_audit` | 优先复用现有函数；拦截公钥泄露（`SEC-01`）、硬编码私钥（`SEC-02`）、命令注入（`SEC-03`）、弱密钥（`SEC-04`）、1 行透传（`PONY-01`）、死导出（`PONY-02`）与环境漂移（`DRIFT-01`） |
| **主动效率攻坚 / 工具链演进 / 用户画像更新** | `rsi_experiment_record` + `user_profile_update` | 执行 **8 步科学实验闭环（假设->设计->改码->实验->分析->诊断->调优->固化资产）**，刷新 `laborForceMultiplier` |
| **完成代码修改 / 准备验收交差** | `universal-preflight-gate.mjs` + 无头浏览器实测 + `stop-hook-guardian.mjs` | 完成语法/TS 检查、拦截虚假测试断言（`TEST-01`）、真实浏览器 UI 点击截屏，自动刷新 3D 图谱与脱水棘轮 |

### 2.4 垂直业务专项准则按需路由表（On-Demand Domain Routing）
垂直业务细则已下沉至对应项目的 `memory/` 账本，操作相关项目时必须在第 0 步按需加载：
- **多模态短视频、12 国本地化、带货/赶海真实 UGC 与开源宣传片工程规范**：
  👉 路由至 [`~/workspace/media-synthesis-pipeline/memory/ARCHITECTURE_DECISIONS.md`](file://~/workspace/media-synthesis-pipeline/memory/ARCHITECTURE_DECISIONS.md)（含 2K 首帧与 `-crf 16` 高码率、飞书 `2160px` 2K 原画与 AI `<240KB` 1fps 抽帧图物理分离、Muse `[0:a]` 原生音轨与单段人像上限 + 2K B-Roll 混编、12 国五位一体真本地化、全品类带货/赶海 100% 真实 UGC、开源宣传片 100% 脱敏 + 禁用乱晃光斑 + 强制嵌入真实系统截图、生成组与评审组 `≥92分` 自动选优及外推五项检查）。
- **EdgeNode 硬件盒子容器编排、90 账号防关联代理拓扑与三星双卡硬件指纹规范**：
  👉 路由至 [`~/workspace/edge-container-cluster/memory/EVOLUTION_LEDGER.md`](file://~/workspace/edge-container-cluster/memory/EVOLUTION_LEDGER.md)（含单盒 10 容器算力槽位解锁与 `.powered_off` 保活区分、90 账号 `MAX_PER_IP = 10` 硬上限、5 款三星旗舰双卡 3GPP Luhn 15 位 IMEI 指纹下发与切号净室清理、控制台 100% 真实浏览器 UI 点击验证）。

### 2.5 五大核心分域标准作业程序（`skills/`）
1. [`skills/01-intent-and-research/SKILL.md`](file://~/.gemini/config/plugins/agy-evo-os/skills/01-intent-and-research/SKILL.md)：意图解码、子代理并发联网调研、开源去伪存真与沙盒 PoC 实测 SOP。
2. [`skills/02-modular-refactor-and-map/SKILL.md`](file://~/.gemini/config/plugins/agy-evo-os/skills/02-modular-refactor-and-map/SKILL.md)：乐高式模块化架构（常规 ≤300 行、硬上限 ≤500 行）与存量项目双轨改造 SOP。
3. [`skills/03-fullstack-atomic-guardrails/SKILL.md`](file://~/.gemini/config/plugins/agy-evo-os/skills/03-fullstack-atomic-guardrails/SKILL.md)：全栈各层防御性编码与 120 项工程检查点 SOP。
4. [`skills/04-qa-release-and-ops/SKILL.md`](file://~/.gemini/config/plugins/agy-evo-os/skills/04-qa-release-and-ops/SKILL.md)：真机全链路质量检查、诚实熔断与 30 秒一键快照回滚 SOP。
5. [`skills/05-self-evolving-skill-mcp-forge/SKILL.md`](file://~/.gemini/config/plugins/agy-evo-os/skills/05-self-evolving-skill-mcp-forge/SKILL.md)：活体记忆维护、两阶段合并审批自进化与 Skill/MCP 锻造 SOP。

---

## 三、 全栈防御性工程准则与三级影响面分流

### 3.1 八大工业级防御性潜台词（8 Defensive Engineering Subtexts）
任何功能开发必须自动落实以下 8 项标准：
1. **全边界输入防呆**：前后端双重校验（防空、防超长、防注入、防越界、防高频连点重复提交 Debounce/幂等键）。
2. **UI 五态齐全**：加载态（骨架屏/Spinner）、空数据态、正常态、局部错误态（含一键重试）、成功反馈态齐全。
3. **运行态热联动**：配置或状态变更后，上下游视图与后台工作流实时热更新生效，免重启整机。
4. **四层缓存一致性与孤儿锁清理**：变更穿透刷新本地、HTTP、内存与数据库缓存；异常或退出在 `finally` 中释放锁、临时文件与子进程。
5. **局部无感刷新**：增删改采用乐观更新或局部增量重取，保持滚动位置与筛选分页状态不变。
6. **老数据默认兜底**：结构变更提供安全默认值或运行时懒迁移（Lazy Migration），历史数据读取零报错。
7. **零丢数平滑迁移**：Schema 变更遵循“先备份快照 -> 扩列/双写兼容 -> 校验 -> 切换”，严禁无备份裸执行 `DROP / TRUNCATE`。
8. **失败自动回滚**：跨表写入包裹在原子事务或补偿状态机中（SQLite 条件更新预占强制校验 `r.changes === 1`），失败自动退回干净状态。

### 3.2 三级影响面分流（L1 / L2 / L3）与存量项目双轨改造
- **L1 轻量级（纯文案、局部样式、只读查询、注释微调）**：原位修改，不拆新文件、不跑子代理、不重启后端、免弹记忆审批窗，冒烟无报错即交付。
- **L2 标准级（单模块新增、前后端联调、状态流调整）**：查 2 跳爆炸半径 + 落实 8 大潜台词 + 跑 `universal-preflight-gate.mjs` 与无头浏览器截屏实测。
- **L3 高危级（Schema 迁移、鉴权/密钥边界、并发锁、容器或 EdgeNode 板卡部署）**：先打 `snapshot-and-rollback.sh backup` 快照 + 跑 `security_simplicity_audit` + 沙盒/单节点验证后再推广。
- **Ponytail 化繁为简与模式 B 豁免**：写工具函数前先查 `GRAPH_REPORT.md` 复用现有函数，零容忍 1 行透传与死导出；存量老项目首次摸排提供 **模式 A（全量重构 + 1:1 复现）** 与 **模式 B（随改随抽离渐进改造）**，模式 B 下存量超长文件执行**「行数只减不增」**豁免，严禁强行触发全量拆分死循环。

---

## 四、 系统稳定性、多算力调度与近期故障防复发硬约束

### 4.1 桌面端防白屏、动态端口自愈、并发窗口上限与内存/磁盘保护
1. **gRPC 动态端口实时探活**：常驻桥接进程读取 `ANTIGRAVITY_LS_ADDRESS` 时先执行 HTTP 探活（`probeLsPort`），若客户端重启换端口，自动通过 `ps aux` + `lsof` 实时探测新端口。
2. **并发窗口上限与容量水位自动热轮转**：
   - 单机同时处于运行态的工作会话窗口控制在 **≤ 4 个 + 1 个人工优先槽位**；
   - 工作会话 `transcript.jsonl > 15MB` 时自动归档并孵化新工作窗口；总控会话 `> 85MB`（或收到 `/new`）时 3 秒内自动孵化新总控窗口并无缝切换飞书绑定。
3. **左侧 `Projects` 树挂载与真实 UUID/模型强绑定**：
   - 调用 `StartCascade` 创建新窗口时，**严禁同时传入 `workspaceUris` 与 `projectEnvConfig`**（触发 HTTP 400）；必须匹配 `~/.gemini/antigravity/projects/*.json` 的 `projectId` 并传入 `projectEnvConfig: { projectId, defaultProjectEnvironment: {} }` 挂载至左侧 `Projects` 树；
   - 向未驻留内存的 `IDLE` 窗口发消息前先调 `LoadTrajectory({ cascadeId })`；所有 `SendUserCascadeMessage` 必须传 `cascadeConfig.plannerConfig.requestedModel` 并绑定 **`MODEL_PLACEHOLDER_M417` (`Gemini 4 Argon High`)**；`SendAgentMessage` 的 `senderId` 必须为真实 36 位 UUID。
4. **后台验证双倒计时防搁置与子代理内存回收**：
   - 工作会话启动后台验证任务时，必须立即挂载 `schedule(DurationSeconds: 45, TimerCondition: "any", Prompt: "立即调用 manage_task 检查后台任务状态")` 自唤醒，配合外部 60 秒看门狗防搁置；调用 `kill` 前先通过 `manage_task(Action: 'list')` 确认任务处于 `RUNNING`；
   - 子代理用完立即 `manage_subagents(Action: 'kill' / 'kill_all')` 释放内存；遇 `Squirrel.Mac` 静默更新引发 `ERR_CERT_AUTHORITY_INVALID` 白屏时，指引用户 `Cmd+Q` 重开客户端。
5. **磁盘水位自动守护与 macOS TCC 零弹窗边界**：
   - 由 `mac-disk-guardian.mjs` 每 5 分钟巡检 APFS 数据卷（`/System/Volumes/Data`），使用率超过 **85%**（或可用空间 `< 25GB`）时自动清理缓存并截断轮转守护进程日志；
   - **严禁 `launchd` (`~/Library/LaunchAgents/*.plist`) 定时任务直接运行或扫描 `~/Downloads`、`~/Desktop`、`~/Documents` 等 macOS TCC 保护目录**（防止脱离宿主权限继承后弹出系统授权窗卡死无人值守进程）；`launchd` 脚本仅限访问 `~/.gemini/`、`~/Library/`、`~/.npm/`、`/tmp/` 等免 TCC 目录，涉及 `~/Downloads` 的常驻进程（如飞书桥接与看门狗）必须由宿主环境直接派生以继承 TCC 授权。

### 4.2 多生态算力优先级与双额度池智能分流
1. **Tier 0 零边际成本算力优先**：优先调度 Google AI Ultra 全家桶（Gemini + Flow Veo 3.1 0积分 + Nano Banana Pro 0积分 + Lyria 3 + Genie + Jules 300并发）及逆向免费通道（含 ChatGPT Plus 逆向全系高级模型）；Tier 1 本地 Ollama/vLLM 兜底；Tier 2 官方付费 API 严格熔断（未获显式授权严禁静默调用）。
2. **双额度池精准分流**：
   - **Gemini 5小时额度池**：`Gemini 4 Argon (High)` (`M417`) 负责总控调度、全模态审查、长耗时脚本与无头浏览器实测；
   - **Claude/GPT 每周共享池**：**100% 禁用纯文本 `GPT-OSS 120B`**；`Claude Opus/Sonnet 5.5` (`M402/M405`) 仅用于全新短窗口 3~5 步内的架构设计、静态代码审计与 UI/母语精雕（禁长轮询、禁喂 `.mp4`/PDF，共享池 `<15%` 自动切回 Gemini）。

### 4.3 单文件串行原子编辑、文件读取安全与真机浏览器验证
1. **单文件串行原子编辑**：**严禁同一回合对同一文件发起多次并发 `edit_file`**；编辑 >200 行文件前先 `read_file` 核实落盘行号与缩进，Target 限 3~10 行唯一特征锚点。
2. **文件读取安全与双分辨率分离**：
   - 调用 `read_file` 前先确认路径存在；脚本生成文件后须在下一回合确认落盘（`test -f`）后再读取；非 UTF-8 外部文件报 binary 错误时改用 `python3` 容错解码；宿主二进制解析优先用 Node/Python 内存流而非未授权外部调试器；
   - **严禁对 `.mp4 / .mov` 直接调 `read_file`**：必须先用 `ffmpeg` 抽帧合成 **`<240KB`** 预览图供 AI 审阅，而**发给用户飞书则必须使用 `2160px` 2K 超清原画**。
3. **真实无头浏览器验证与 3D HTML 三合一交付**：
   - 前端与硬件管控改动必须在真实无头浏览器（Playwright / Chrome DevTools）UI 点击验证并截屏留证（`beforeunload` 中 `navigator.sendBeacon` 须带 `?token=` 参数），**严禁直接改数据库作弊**；
   - 交付 `CODE_GRAPH_3D.html` 等交互式 HTML 时强制执行：① `--open` 自动浏览器弹出；② 附上 `.png` 预览截图；③ 附上 `open "<HTML绝对路径>"` 重开口令。

---

## 五、 两阶段合并审批、诚实熔断与推理档位配对表

### 5.1 A/B 类记忆分流、两阶段合并审批与诚实熔断
1. **A/B 类分流与合并审批**：A 类人类语义账本、目录重构与新建 Skill/MCP 遵循单任务最多 2 次合并弹窗审批（编码前方案审批 + 收工前记忆合并审批，弹窗前先发邮件，用户选跳过即干净完结）；B 类机器派生视图（`memory.sqlite`、`evolution-metrics.json`、`*.html`、`*REPORT.md`、`CROSS_INBOX.md`）全自动静默刷新。
2. **诚实熔断与三级完结水位**：同一报错连续 2 轮未果或陷入 `A↔B` 摇摆死循环、客观外部阻碍、或远端/板卡指令超时（**超时必须先只读回读状态，严禁盲目重发写操作**）时立即停手熔断，发邮件并调用 `ask_question` 提供【推荐替代方案 / 协助补充条件 / 一键回滚 `bash scripts/snapshot-and-rollback.sh rollback latest`】；汇报时严格区分 **① 本地代码通过检查**、**② 本地/远端服务重启并通过真实浏览器实测**、**③ 外部真实业务链路/硬件板卡端到端确认** 三级真实水位。

### 5.2 推理档位（High / Mid / Low）与斜杠指令配对表

| 推理档位 | 适用任务场景 | 推荐斜杠指令 | 绑定的分域 Skill SOP | 执行策略与并发配置 |
| :--- | :--- | :--- | :--- | :--- |
| **High（高档推理 · 默认 `M417`）** | 0到1产品孵化、复杂架构设计、存量项目全量重构（模式A）、跨端疑难排障、多模态/硬件并发调度 | `/plan`、`/grill-me`、`/boost`、`/teamwork` | `01-intent-and-research`<br>`02-modular-refactor-and-map`<br>`04-qa-release-and-ops` | 总控拆解并派生子代理/工作会话并发执行 + 沙盒 PoC 实测 + 总控四步交叉复核。 |
| **Mid（标准均衡档）** | 常规模块新增、前后端联调、渐进抽离（模式B）、无头浏览器验收、自动化工具锻造 | `/browser`、`/goal`、`/learn` | `02-modular-refactor-and-map`<br>`03-fullstack-atomic-guardrails`<br>`04-qa-release-and-ops`<br>`05-self-evolving-skill-mcp-forge` | 落实 8 大防御性潜台词；启动真实无头浏览器完成 UI 五态与截屏验证；收尾单次合并审批。 |
| **Low（轻量极速档）** | 文案微调、局部样式修改、已知配置调整、只读进度查询、一键快照回滚 | `/schedule` | `03-fullstack-atomic-guardrails`（轻量冒烟）<br>`05-self-evolving-skill-mcp-forge` | 原位精准执行，免除子代理沙盒开销与 L1 记忆弹窗打扰；B 类派生视图静默刷新。 |
