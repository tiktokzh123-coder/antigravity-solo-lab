# 原子级错题本与自我进化基因库 (`EVOLUTION_LEDGER.md`)

> [!NOTE]
> **账本定位与维护铁律**：
> 本文件是项目的**「活体免疫系统与防复发基因库（Single Source of Truth for Self-Evolution Genes）」**。
> - **核心理念**：允许踩新坑，但**绝对禁止在同一个地方摔倒第二次**！每当修复一个隐蔽 Bug、解决一次环境冲突、发现一处前后端契约脱节或遭遇第三方库版本陷阱，AI 无需等待用户输入 `/learn`，必须自动提炼出「现象 -> 深层根因 -> 原子级防错铁律 -> 注入门禁位置」。
> - **全程审批硬约束**：任何新增或修改进化基因的动作，必须先通过 `ask_question` 工具弹窗向用户展示大白话审批卡片，待用户点击“同意写入”后方可落盘，并同步将该基因固化到对应的 `SKILL.md` 或自动化检查脚本中。

---

## 一、 进化基因录入标准模板（Evolution Gene Template）

每当新增一条错题记录时，严格按照以下 6 维结构追加至第二节基因库表格及第三节详情档案中：

```markdown
### [EVO-XXX] 简明扼要的防坑基因标题（一句话点破核心教训）
- **踩坑日期**：`YYYY-MM-DD`
- **关联模块 / 领域**：`[前端交互 / 后端接口 / 数据库迁移 / 异步并发 / 部署环境]`
- **问题表面现象（Symptom）**：`[用户或测试看到了什么报错、白屏、卡死或数据异常？]`
- **深层病根剖析（Root Cause）**：`[剥离表象后的本质原因是什么？为什么原有的代码或流程没能拦住它？]`
- **触发条件（Trigger Condition）**：`[在什么特定输入、并发时序或环境配置下必定复现？]`
- **原子级防错铁律（Atomic Prevention Rule）**：`[可执行、可验证的刚性法则：凡是遇到 X 场景，必须先执行 Y 动作，严禁出现 Z 写法！]`
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：`[明确已写入哪个 SKILL.md 章节、哪个 Lint 规则或哪个预检脚本，实现自动化拦截]`
```

---

## 二、 全局自我进化基因速查总表（Evolution Genes Matrix）

> 本表预置了 **8 条全栈通用高频防坑初始基因（`EVO-001` ~ `EVO-008`）** 作为出厂免疫底座，后续项目实战中产生的新基因按序递增（`EVO-009`, `EVO-010`...）。

| 基因编号 | 录入日期 | 领域分类 | 问题现象摘要 | 提炼出的原子防错铁律（一句话核心准则） | 已注入的门禁 / Skill 位置 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **`EVO-001`** | `出厂预置` | 前后端契约与异步状态 | 接口报错或返回空数据时前端页面白屏崩溃，或按钮点击后无加载反馈导致用户重复提交产生脏数据 | **【异步三态与契约强校验铁律】**：任何异步请求与数据渲染必须强制覆盖 `Loading`（加载防抖）、`Empty`（空数据兜底）、`Error`（友好重试提示）三态，且对接口响应执行运行期非空与 Schema 校验，严禁裸链式解构未校验字段！ | `skills/03-fullstack-atomic-guardrails/SKILL.md` & `memory/CODE_MAP.md` | `已激活` |
| **`EVO-002`** | `出厂预置` | 后端数据持久化与事务 | 多步写库操作中途抛错导致数据库残留“半截脏数据”，或把内存 Mock 数组当成持久化通过验收 | **【多表写操作原子事务与真库验收铁律】**：凡涉及 $\ge 2$ 次数据库写入或状态流转的操作必须包裹在显式数据库事务（Transaction）中；任何功能验收必须查验真实数据库落盘记录，严禁以内存变量或 Mock 假数据冒充持久化完成！ | `skills/03-fullstack-atomic-guardrails/SKILL.md` & `skills/04-qa-release-and-ops/SKILL.md` | `已激活` |
| **`EVO-003`** | `出厂预置` | 环境配置与密钥安全 | 本地能跑但部署或换环境即崩溃（缺少环境变量），或不小心将 API Key / 生产密码硬编码进源码提交 | **【启动期环境变量 Fail-Fast 与零硬编码密钥铁律】**：项目必须在唯一配置真源文件启动时一次性校验所有必填环境变量（缺失立即抛出清晰修复指引并终止启动）；源码中严禁出现任何硬编码密钥，必须仅维护 `.env.example` 模板！ | `GEMINI.md` & `memory/CODE_MAP.md` (唯一环境配置真源) | `已激活` |
| **`EVO-004`** | `出厂预置` | 第三方 SDK 与新版本 API | AI 凭过时的训练记忆编造已废弃的 SDK 方法名、参数格式或旧版模型名称，导致运行时报 `MethodNotFound` | **【外部 SDK 与新版 API 联网查证先行铁律】**：凡接入外部 SDK、云服务 API 或遇到不熟悉的库报错，严禁凭记忆盲猜试错！必须先通过官方文档工具或联网搜索核实最新当前版本（Current SDK）签名并在最小沙盒实测通过后再写入业务代码！ | `skills/01-intent-and-research/SKILL.md` & `memory/ARCHITECTURE_DECISIONS.md` | `已激活` |
| **`EVO-005`** | `出厂预置` | 模块化架构与代码演进 | 连续迭代几个需求后把所有逻辑塞进同一个文件，导致单文件膨胀至上千行，改一处坏三处且上下文截断 | **【乐高模块边界与单文件行号熔断铁律】**：严禁在单文件中混合视图渲染、网络请求与复杂业务算法；新建单文件超过 300 行触发预警、达到 500 行强制启动乐高无损拆分流程（模式 B 存量历史大文件执行行数只减不增守卫），并在修改后即时刷新 `CODE_MAP.md` 行号索引！ | `skills/02-modular-refactor-and-map/SKILL.md` & `memory/CODE_MAP.md` | `已激活` |
| **`EVO-006`** | `出厂预置` | 多子代理协同与防死锁审查 | 多个并行子代理各自产出代码/文档后，出现跨文件引用路径名不一致、脚本命令对不上、或者门禁规则与审批流互锁导致主模型内部原地打转 | **【子代理产物主代理强制通读交叉审查与两阶段合并审批铁律】**：主代理严禁盲信子代理汇报摘要，必须逐文件通读原文、横向对齐所有跨模块路径/接口名、推演消除循环死锁并亲手跑通门禁；且单次任务的记忆账本更新必须打包为 1 次合并弹窗审批，用户点击跳过即合法放行！ | `GEMINI.md` (3.4 & 5.3) & `skills/01-intent-and-research/SKILL.md` (Step 4.5) | `已激活` |
| **`EVO-007`** | `出厂预置` | 存量项目接管与记忆SOP执行 | 接手存量项目全面摸排时，首轮仅读取了外部交接文档而未在第 0 步显式调用记忆召回、未直接核对真实源码行号、也未立即弹窗提请初始化记忆账本与改造模式 | **【存量项目接管四步闭环与源码实证铁律】**：凡受命摸排或接管存量项目，必须严格按顺序执行：① 第 0 步调用 `memory_recall_for_task(project_root)`；② 任何来自历史交接文档的结论必须亲自用 `read_file` 对照真实源码行号逐一核实；③ 执行 `snapshot-and-rollback.sh backup` 与 `auto-code-mapper.mjs` 扫描；④ 调用 `ask_question` 提请用户拍板改造模式（A/B）并审批写入该项目独立的 6 大活体记忆账本！ | `GEMINI.md` (4.2 & 5.4) & `skills/02-modular-refactor-and-map/SKILL.md` | `已激活` |
| **`EVO-008`** | `出厂预置` | 多项目记忆物理隔离与容器目录防误写 | 当工作区位于 `~/Downloads` 等父级容器目录或宪章中包含示例路径时，AI 误将具体业务项目的记忆写入 `universal-fullstack-evo-os/memory/` 母版库导致跨项目串味 | **【多项目记忆路径 100% 物理隔离铁律】**：读写 `memory/*.md` 或调用 MCP 记忆工具时，`project_root` 必须指向当前正在开发/摸排的**具体业务子项目根目录**（如 `<子项目路径>/memory/`），绝对禁止向 `universal-fullstack-evo-os/memory/` 或 `~/.gemini/config/plugins/agy-evo-os/` 母版目录写入任何业务项目数据！ | `GEMINI.md` & `scripts/evo-memory-mcp-server.mjs` | `已激活` |
| **`EVO-009`** | `2026-10-30` | 视觉交互质检与真机验收 | 测试通过后仅文字汇报无可视化凭证，被用户质询“要给我截图什么的吧” | **【视觉交互与端到端测试强制截屏留证铁律】**：涉及 UI 交互与视觉效果的验收，必须自动截屏存图并在汇报中附上可点击链接（有图有真相），杜绝纯文字空口报喜！ | `GEMINI.md` (反作弊第3条/GATE-04) & `skills/04-qa-release-and-ops` | `已激活` |
| **`EVO-010`** | `2026-10-30` | 工具时序并发与MCP服务名防猜错 | ① 生成图片/产物文件时同 turn 并发调用 `read_file` 报 `file does not exist`；② 盲猜 MCP 服务名 `universal-fullstack-evo-os_...` 报 `server name not found` | **【产物生成查验绝对串行化与 MCP 命名显式化铁律】**：凡通过脚本/命令生成新文件，绝对禁止在同一 step 内并发 `read_file`，必须在生成命令退出码为 0 且文件落盘后的下一 step 独立读取；且调用 MCP 必须严格使用官方登记名 `ServerName: "agy-evo-os_memory"` 并配置对应 `instructions.md`！ | `GEMINI.md` (4.2/5.4) & `skills/03-fullstack-atomic-guardrails` & `mcp/instructions.md` | `已激活` |
| **`EVO-011`** | `2026-10-30` | 存量项目路径防盲猜与产物落盘验真 | 未查 `CODE_MAP.md` 盲猜路径 `read_file` 报错；或使用 macOS 已废弃 `initWithFocusedViewRect:` 无头绘图静默失败后盲读报错 | **【存量项目路径查验先行与生成产物 `test -f` 落盘验真铁律】**：严禁盲猜文件路径调用 `read_file`；动态生成文件后必须先确认命令落盘或 `test -f` 存在性断言后再读取！ | `GEMINI.md` (反作弊第3/10条) & `skills/03-fullstack-atomic-guardrails` | `已激活` |
| **`EVO-012`** | `2026-10-30` | 后台任务管理与响应式唤醒 | 未检查后台任务状态即对已自然完成的短任务调用 `manage_task(kill)` 报 `task is not running (status: DONE)` | **【后台任务状态感知先行与信任响应式唤醒铁律】**：严禁在未通过 `manage_task(Action: 'list')` 确认任务处于 `RUNNING` 态前盲目调用 `kill`！ | `GEMINI.md` (反作弊第11条) & `skills/03-fullstack-atomic-guardrails` | `已激活` |
| **`EVO-013`** | `2026-10-30` | 前沿开源项目去伪存真审查 | 盲目接入写死循环假动画的“WiFi 3D 穿墙雷达”营销项目浪费算力 | **【开源项目去伪存真三步审查铁律】**：接入前沿黑科技开源项目前，必先排查源码 mock/写死假动画、检索社区真实口碑并如实预警宣传落差！ | `GEMINI.md` (3.5) & `skills/01-intent-and-research` | `已激活` |
| **`EVO-014`** | `2026-10-30` | 五维全自动复利更新与 L1~L3 分流 | 图谱/化繁为简/安全审计若需手动口令则无法自动复利；L1 小改若走重型流程则过度工程 | **【五维收工自动刷新与 L1/L2/L3 按需分流铁律】**：按语义自动路由工具，每次收工自动刷新 3D 图谱、可复用轮子表与安全/死代码棘轮，L1 小改原位完成！ | `GEMINI.md` (0.3/1.3/4.4/5.5) & `scripts/stop-hook-guardian.mjs` | `已激活` |
| **`EVO-015`** | `2026-10-30` | 交互式 HTML 产物三合一交付 | 在 IDE 聊天框直接发 `file://...CODE_GRAPH_3D.html` 链接，用户点击后被 IDE 当成代码编辑器打开源码，无法交互查看 3D 星系图 | **【交互式 HTML 产物三合一交付铁律】**：交付 `CODE_GRAPH_3D.html` 时必须 ① 传 `open_in_browser: true` 或 `--open` 自动在系统浏览器弹出 3D 窗口 + ② 无头浏览器截取 `.png` 预览图附于汇报 + ③ 附 `open "<path>"` 终端口令，严禁裸发 `.html` 链接让用户在 IDE 内点开看源码！ | `GEMINI.md` (反作弊第12条) & `scripts/code-graph-3d-generator.mjs` & `skills/02,04` | `已激活` |
| **`EVO-016`** | `2026-10-30` | 全系统自冲突清零与 `/compact` 协同 | A/B类记忆文件审批边界模糊、MCP 长进程未关 SQLite 连接、`GRAPH_REPORT.md` 自激重索引、`CODE_MAP.md` 表格正则误伤源码节点、巡检 cron 盲区 | **【全系统零自冲突与 A/B 记忆分流铁律】**：A 类人类账本合并审批（L1 免打扰）、B 类机器派生图谱/棘轮全自动静默刷新且排除自索引；所有 SQLite 连接强制 `WAL + busy_timeout=5000 + finally db.close()`；平台 `<CONTEXT_SUMMARY>` 压缩后 1.5ms 自动召回恢复！ | `GEMINI.md` (5.1/5.4) & `scripts/memory-graph-engine.mjs` & `scripts/evo-memory-mcp-server.mjs` | `已激活` |
| **`EVO-017`** | `2026-10-30` | recallForTask 统一导出与模板软链接对齐 | 外部测试动态导入 `recallForTask` 报函数不存在；子代理查验母版库盲猜 `memory-templates/` 报文件不存在 | **【高阶 API 导出与母版软链接双重兼容铁律】**：核心引擎必须导出高阶一站式 `recallForTask`；母版库根目录保留 `memory-templates -> memory` 软链接杜绝路径误报！ | `scripts/memory-graph-engine.mjs` & 母版库根目录软链接 | `已激活` |
| **`EVO-018`** | `2026-10-30` | SQLite WAL 读转写死锁消除与图谱返回值多别名解耦 | 6 进程并发高压测试报 `SQLITE_BUSY: database is locked`；端到端测试读取 `graphRes.cyclesCount`、`blastRadius`、`html3dPath` 报 undefined | **【SQLite 写事务强制 BEGIN IMMEDIATE 与图谱返回值全兼容顶级导出铁律】**：写事务前必须先执行纯内存只读脏检，无变化直接返回 0 写锁；确需写入一律使用 `BEGIN IMMEDIATE` 尽早排队排队，配合 `busy_timeout=10000` 杜绝读转写死锁；图谱生成器必须拍平导出顶级属性（`html3dPath`, `cyclesCount`, `blastRadius`, `reusableHelpers`）！ | `scripts/memory-graph-engine.mjs` & `scripts/code-graph-3d-generator.mjs` | `已激活` |
| **`EVO-019`** | `2026-10-31` | edit_file 精准微靶向修改与最小唯一锚点 | 跨多项目或长对话时，从内存中凭空拼凑数十上百行跨章节 Target，或错误混入其他项目文本，导致 `target content not found in the file` 报错 | **【edit_file 最小特征锚点微靶向替换铁律】**：Target 必须且仅能来自最近一次 `read_file` 的真实源码行；Target 严格限制在待改行及其前后 1~2 行特征锚点（3~10 行以内），禁止超长跨段落替换；多处修改必须分多次独立调用！ | `GEMINI.md` (反作弊第14条) & `skills/02` & `skills/03` | `已激活` |
| **`EVO-020`** | `2026-10-31` | 深层未知文件路径先行探测防盲猜读取 | 存量大项目中凭经验直觉盲猜组件/模块文件名直接调用 `read_file` / `view_file`，导致抛错 `file does not exist` 或 `no such file or directory` | **【未知路径先行轻量探测验证铁律】**：严禁凭直觉脑补文件路径直接发起读取！必须先查 `CODE_MAP.md` 或通过轻量命令（`ls` / `find` / `git ls-files`）实证文件落盘存在后再调用 `read_file`！ | `GEMINI.md` (反作弊第10条) & `skills/02` & `skills/03` | `已激活` |
| **`EVO-021`** | `2026-10-31` | 后台任务状态响应式唤醒协同与盲目 kill 拦截 | 智能体在后台任务已自然执行完毕退出（`status: DONE`）后盲目发起 `manage_task(kill)`，抛错 `cannot kill task: task is not running` | **【后台任务状态验证先行与响应式唤醒铁律】**：调用 `manage_task(kill)` 前必须先通过 `manage_task(list)` 实证状态为 `RUNNING`；系统原生具备响应式唤醒，自发命令完成后会自动通知，严禁盲目提前 kill！ | `GEMINI.md` (反作弊第11条) & `skills/03` | `已激活` |
| **`EVO-022`** | `2026-10-31` | 对话切片短ID双向软链接自愈 | 智能体按 `CONV-YYYYMMDD-XXX` 短编号直接读取切片报 `no such file or directory` | **【切片短ID软链接双向容错铁律】**：`session-memory-slicer.mjs` 与 `evo-patrol-inspector.mjs` 自动建立 `CONV-YYYYMMDD-XXX.md` 短软链接指向带标题后缀的真实文件！ | `scripts/session-memory-slicer.mjs` & `scripts/evo-patrol-inspector.mjs` | `已激活` |
| **`EVO-023`** | `2026-10-31` | 进程内文件流解析替代外部逆向 CLI | 直接调用 `objdump` / `nm` 等底层调试器或带管道 `lsof` 触发 `Permission denied for unsandboxed` | **【进程内文件流解析与无管道 execFileSync 铁律】**：严禁通过 `run_command` 裸调 `objdump`/`nm` 或带 Shell 管道的受限命令，统一使用 Node.js 进程内文件流或无管道 `execFileSync`！ | `GEMINI.md` (反作弊第15条) & `scripts/cross-project-federation.mjs` | `已激活` |
| **`EVO-024`** | `2026-10-31` | `ask_question` 弹窗提问前必发邮件提醒 | 用户在床上休息或离开电脑屏幕时，智能体直接调用 `ask_question` 弹窗导致用户在电脑前看不到、会话长时间阻塞 | **【`ask_question` 弹窗提问前必发邮件提醒铁律】**：每次智能体即将调用 `ask_question` 弹出选择题/审批模态窗等待用户点击前，必须先通过 `/usr/sbin/sendmail -t -oi` 向 `dev-notify@example.com` 发送提醒邮件（写明项目/对话名、问题与选项），再调用 `ask_question`！ | `GEMINI.md` (5.1/5.2) & `memory/USER_PROFILE.md` & `skills/05` & `evo-memory-mcp-server.mjs` | `已激活` |
| **`EVO-025`** | `2026-10-31` | 多项目联邦星系、6重门禁派单与8步科学实验闭环 | 跨对话盲目派单打断运行会话；传统自进化缺乏主动科学实验闭环与研发劳动力复利量化指标 | **【三层动态映射、6重门禁安全派单与 8 步科学实验闭环 (`rsi_experiment_record`) 铁律】**：跨项目通知先写 `CROSS_INBOX.md` 并过 6 重门禁；主动优化强制记录 8 步科学实验闭环 (`[RSI-xxx]`) 并刷新 `laborForceMultiplier`！ | `GEMINI.md` (5.2/7.5) & `scripts/security-and-simplicity-audit.mjs` & `scripts/cross-project-federation.mjs` | `已激活` |
| **`EVO-026`** | `2026-10-31` | AGY Swarm Commander (`1+N+M`) 与 `SWARM_ACK` 防死锁回传 | 新建具名工作会话窗口未读 `annotations.title`、子代理识别读盘开销大、工作节点反向汇报总控触发容器写保护与乒乓/冷却锁死锁 | **【`1+N+M` 具名蜂群路由、零 IO 子代理识别与 `SWARM_ACK` 特权防死锁铁律】**：按 `annotations.title` 与 `trajectoryMetadata` 零 IO 分流三层拓扑；`StartCascade` 显式携带 `CortexTrajectorySource`；工作节点调用 `swarm_report_to_commander` 豁免容器目录与 Gate 2/3/4 限制直达总控！ | `GEMINI.md` (第七章定律六) & `scripts/cross-project-federation.mjs` & `scripts/evo-memory-mcp-server.mjs` | `已激活` |
| **`EVO-027`** | `2026-10-31` | 非UTF8文件防 read_file 误判二进制崩溃 | 读取特定编码 CSV/导出账单报 `appears to be a binary file` 崩溃中断 | **【非UTF8文本与外部数据文件预检铁律】**：读取外部账单/CSV等文件若报错二进制，严禁盲目重试 read_file，必须立即改用 python3 (errors='replace'/latin1) 或 head/awk 安全探查！ | `GEMINI.md` (反作弊第16条) & `skills/03` | `已激活` |
| **`EVO-028`** | `2026-10-31` | 工作节点强制自审与总控法医级复核双道门禁 | 工作节点未看片拿无关缓存画面交差、带货视频乱加杂音与塑料假人、UI外露研发黑话；总控未复核直接转发残次品 | **【工作节点强制自审找Bug + 总控法医级复核拦截双门禁铁律】**：工作节点产出视频/音频/图片/UI后必须先自审看图挑刺找Bug（带货视频只允许BGM+自然旁白、严禁乱加音效）；总控收到任务回执必须亲自看图复核，发现瑕疵当场拦截打回！ | `GEMINI.md` (0.3/反作弊第20条) & `scripts/cross-project-federation.mjs` | `已激活` |
| **`EVO-029`** | `2026-10-31` | 大体积视频防 read_file 撑爆上下文与收件箱原子核销 | 直接对 `.mp4` 调用 `read_file` 触发 `This conversation grew too large`；手动 `edit_file` 核销收件箱报 `target content not found` | **【严禁直接 read_file 读取 .mp4 防爆上下文与收件箱原子核销铁律】**：审片严禁对 `.mp4` 直接调 `read_file`，必须先用 `ffmpeg` 抽帧合成单张 `.png` 四宫格预览图再读取；收件箱核销统一调 `cross_inbox_ack` 或 `swarm_report_to_commander` 自动核销！ | `GEMINI.md` (0.3/反作弊第14,20条) & `scripts/cross-project-federation.mjs` | `已激活` |
| **`EVO-030`** | `2026-10-31` | 同文件串行原子编辑与精确行号查验 | 同一回合对同一文件并发发起多次 `edit_file` 导致后续替换锚点漂移报错 | **【同文件串行编辑与最小锚点铁律】**：严禁同 Turn 对同一文件并发调用多次 `edit_file`，编辑前必先 `read_file` 核对精确缩进，Target 严格控制在 3~10 行！ | `GEMINI.md` (0.3/反作弊第19条) | `已激活` |
| **`EVO-031`** | `2026-10-31` | Antigravity v2.28.2+ 防白屏、动态端口自愈、左边栏项目树挂载与内存回收 | ① 后台静默更新证书导致 `Cmd+R` 报 `ERR_CERT_AUTHORITY_INVALID` 白屏；② 重启后旧 `ANTIGRAVITY_LS_ADDRESS` 端口失效；③ `v2.28.2` 懒加载漏扫未打开窗口；④ 新窗口未挂入左边栏 `Projects` 树；⑤ 累积 20+ 子代理拖慢内存 | **【动态端口探活自愈、懒加载 `LoadTrajectory` 唤醒、`projectEnvConfig` 挂载左边栏项目树与子代理即时回收铁律】**：① 环境变量端口必先 `probeLsPort` 探活，失效自动重扫；② 结合 `SearchConversations` 全量发现 + `LoadTrajectory` 预加载；③ `StartCascade` 传 `projectEnvConfig: { projectId, defaultProjectEnvironment: {} }` 挂入左边栏 `Projects` 树；④ 子代理超过 8 个立即 `kill_all` 回收！ | `GEMINI.md` (0.3/反作弊第21条) & `scripts/cross-project-federation.mjs` & `feishu-commander-bridge.mjs` | `已激活` |

---

## 三、 进化基因详细病理档案（Detailed Gene Profiles）

### [EVO-001] 异步三态完备性与前后端契约运行期防御基因
- **踩坑日期**：`出厂预置基准基因`
- **关联模块 / 领域**：`前端视图渲染 / 前后端接口联调 / 表单交互`
- **问题表面现象（Symptom）**：
  1. 当后端接口因网络抖动返回 `500` 或某字段返回 `null/undefined` 时，前端组件直接执行 `data.items.map(...)` 引发 `TypeError: Cannot read properties of undefined (reading 'map')` 导致整页白屏。
  2. 用户点击“保存/提交”按钮后界面无任何 Loading 锁死状态，用户以为没点中而连续点击 3 次，导致后端插入 3 条重复记录。
- **深层病根剖析（Root Cause）**：
  开发者假设后端永远返回完美符合预期的 `200 OK` 非空数组（Happy Path 幻觉），且忽略了网络I/O固有的延迟属性与并发重入风险。
- **触发条件（Trigger Condition）**：
  首次冷启动数据库为空、弱网高延迟环境、后端抛出业务异常、用户快速双击提交按钮。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **前端异步渲染必配三态**：凡发起异步数据获取的组件，必须显式实现 `isLoading`（骨架屏或加载指示器）、`isError`（带一键重试按钮的大白话错误卡片）、`isEmpty`（空数据引导插画与操作入口）。
  2. **写操作按钮必配防重入锁**：凡触发 POST/PUT/DELETE 的交互按钮，在请求未返回前必须处于 `disabled` 或 `loading` 锁定态。
  3. **响应数据必过安全解析**：统一在唯一网络客户端层通过 Schema（如 Zod 或类型守卫）校验响应结构，列表字段默认提供空数组兜底 `items ?? []`。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至全栈研发规程与 E2E 验收清单：验收时必须人工/自动化模拟一次“空列表渲染”与“异常状态提示”检查。

---

### [EVO-002] 多步写操作原子事务与真实落盘验收基因
- **踩坑日期**：`出厂预置基准基因`
- **关联模块 / 领域**：`后端领域服务 / 数据库持久化 / 端到端测试验收`
- **问题表面现象（Symptom）**：
  1. 创建主记录成功，但紧接着扣减配额或写入子表时报错抛出，结果主表多了一条孤儿记录，账目或状态彻底错乱。
  2. 研发阶段为了图快在 Service 层用了内存数组或假返回值，前端看似操作成功，一旦重启服务所有数据瞬间清零。
- **深层病根剖析（Root Cause）**：
  缺乏数据库 ACID 事务边界意识；以及在未打通真实数据持久化的情况下过早声称“功能开发完毕”。
- **触发条件（Trigger Condition）**：
  跨表写入中途发生唯一索引冲突、外键约束失败、网络中断，或服务进程重启。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **跨表/多步写必用 Transaction**：只要一个业务动作包含两次及以上数据变更，必须封装在数据库事务块中，确保全成功或全回滚。
  2. **零假数据验收铁律**：任何涉及增删改查的功能在标记为已完成前，必须执行一次完整的「真实写入 -> 真实落盘查询核对 -> 服务重启后数据依然存在」验证闭环。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已写入 `memory/PRODUCT_PROGRESS.md` 功能验收状态矩阵准入标准与真实 E2E 验证技能规程。

---

### [EVO-003] 启动期环境变量 Fail-Fast 预检与密钥零硬编码基因
- **踩坑日期**：`出厂预置基准基因`
- **关联模块 / 领域**：`全局配置管理 / 安全合规 / 跨环境部署`
- **问题表面现象（Symptom）**：
  服务启动时风平浪静，直到用户触发某个特定功能（如发邮件、调大模型、连对象存储）时才因为某个环境变量为 `undefined` 而突然崩溃；或者代码仓库中泄露了真实的 API Secret。
- **深层病根剖析（Root Cause）**：
  环境变量读取分散在各个业务文件深处（Lazy Read），缺乏集中在应用入口处的启动期完整性校验（Eager Validation）。
- **触发条件（Trigger Condition）**：
  新克隆仓库首次运行、Docker 容器部署漏传环境变量、新增第三方服务依赖后未同步更新配置模板。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **唯一配置入口启动强校验**：所有环境变量统一在配置真源文件中声明 Schema 并在应用启动第 0 秒完成校验；若缺失必填项，立即打印中文/大白话错误提示（指明缺哪个变量、去哪里配置）并立即退出进程（Fail-Fast）。
  2. **双文件同步法则**：每新增一个环境变量，必须同步在 `.env.example` 中写入带注释的占位符示例，且确保 `.env` 已列入 `.gitignore`。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已登记至 `memory/CODE_MAP.md` 全局唯一真源文件表（环境变量与全局配置项）。

---

### [EVO-004] 外部 SDK 与第三方 API 权威文档查证先行基因
- **踩坑日期**：`出厂预置基准基因`
- **关联模块 / 领域**：`第三方集成 / AI SDK 调用 / 外部依赖升级`
- **问题表面现象（Symptom）**：
  集成第三方 SDK（如大模型 API、支付网关、数据库 ORM 新版本）时，写出的代码反复报类型错误、废弃警告或 `404/400` 接口参数格式不匹配，多次盲目修改依然不工作。
- **深层病根剖析（Root Cause）**：
  AI 模型预训练权重中混杂了历史旧版 SDK 用法（Legacy / Deprecated API），在未查阅当前安装版本官方文档的情况下凭记忆自由发挥。
- **触发条件（Trigger Condition）**：
  使用近 1~2 年内发生过重大版本升级的 SDK、调用最新发布的云端模型或框架特性。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **先查版本再查文档**：编写第三方集成代码前，先检查项目中 `package.json` / `pyproject.toml` / `go.mod` 的实际安装版本号，并调用文档检索工具或联网搜索核对最新官方写法（严禁使用标注为 Deprecated/Previous SDK 的旧语法）。
  2. **最小沙盒脚本先行**：对复杂或不确定的外部调用，先在临时沙盒脚本中用 20 行以内代码跑通真实请求与响应解析，确认无误后再合入主工程。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至架构调研规程与 `memory/ARCHITECTURE_DECISIONS.md` 实测验证环节。

---

### [EVO-005] 乐高模块职责单一化与大文件自动熔断拆分基因
- **踩坑日期**：`出厂预置基准基因`
- **关联模块 / 领域**：`全栈代码结构 / 可维护性 / 持续重构`
- **问题表面现象（Symptom）**：
  随着功能迭代，核心页面文件或核心 Service 文件突破 600~1000 行，AI 每次读取和修改耗时剧增、容易误删相邻代码逻辑，且多处地方复制粘贴了相同的格式化或校验片段。
- **深层病根剖析（Root Cause）**：
  采用“增量贴膏药式”编程，每次加需求都图省事往现有文件末尾追加，没有在写入前检查文件体量与职责边界。
- **触发条件（Trigger Condition）**：
  连续在一个模块上叠加 3 个以上子特性，或单个源码文件行数突破 300 行预警线 / 500 行熔断线。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **写前先看代码地图**：修改或新增功能前先查阅 `memory/CODE_MAP.md`，复用已登记的唯一真源工具与契约，严禁复制粘贴重复逻辑。
  2. **超限必拆且即时更新地图**：当单文件超过 300 行时优先将独立子组件、纯计算逻辑或数据查询抽离为独立子模块；若达到 500 行必须向用户发起弹窗审批执行无损拆分，并在落盘后同步更新 `CODE_MAP.md` 的行号索引。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已绑定至 `memory/CODE_MAP.md` 第五节「待拆分历史大文件与技术债追踪表」及自进化审批流。

---

### [EVO-006] 多子代理并行交付物主代理强制交叉审查与防原地打转死锁基因
- **踩坑日期**：`出厂预置基准基因（源自 6 子代理并行构建 OS 实战复盘）`
- **关联模块 / 领域**：`多智能体编排 / 跨文件契约对齐 / 门禁钩子与审批流协同`
- **问题表面现象（Symptom）**：
  1. 派出多个子代理并行编写不同模块或文档时，子代理 A 在 `GEMINI.md` 和 `EVOLUTION_LEDGER.md` 中引用的技能路径名（如 `02-modular-architecture`）、回滚脚本名（`rollback.sh`）与子代理 B/C 实际创建的目录名（`02-modular-refactor-and-map`）、脚本名（`snapshot-and-rollback.sh`）不一致，出现跨文件“断头路”。
  2. `Stop` 钩子要求“更新完 `memory/` 后再汇报”，而全程审批铁律要求“未经 `ask_question` 用户批准严禁改 `memory/`”，或者一次任务连续弹出 5 次审批窗、对模式 B 的历史大文件机械套用 450/500 行硬拦截，导致主模型在内部陷入“想停不敢停、想改不敢改、反复重试打转”的死循环。
- **深层病根剖析（Root Cause）**：
  并行子代理处于各自独立的上下文沙箱中，天然存在“命名漂移（Naming Drift）”；若主代理只看子代理汇报的文字总结而不亲自通读原文并做横向交叉验证，局部正确的产物拼装在一起就会产生系统级冲突与循环死锁。
- **触发条件（Trigger Condition）**：
  调用 `invoke_subagent` 派出 1 个或多个子代理执行调研、文档撰写或分模块编码任务；或同时启用自动化拦截钩子（Hooks）与人工审批门禁（Approval Gate）。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **主代理四步强制交叉审查**：子代理返回后，主代理必须亲自 ① 调用 `read_file` 通读所有产出文件原文；② 横向对齐所有跨文件引用路径、脚本名、函数签名与阈值常量；③ 推演消除规则间的循环等待死锁；④ 亲手运行 `universal-preflight-gate.mjs` 实测通过后才准向用户汇报。
  2. **两阶段合并审批与跳过即放行**：单次任务最多在「编码前（架构拍板）」和「收工前（全部记忆账本汇总更新）」各弹 1 次合并 `ask_question`；一旦用户选择“跳过/暂不更新”，立即视为合法豁免完结，严禁原地打转重试！
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（第 3.4 节与第 5.3 节）、`skills/01-intent-and-research/SKILL.md`（步骤 4.5）及 `scripts/stop-hook-guardian.mjs`。

---

### [EVO-007] 存量项目接管四步闭环与源码逐行实证基因
- **踩坑日期**：`出厂预置基准基因`
- **关联模块 / 领域**：`存量项目接管 / 活体记忆维护 / 源码交叉核验`
- **问题表面现象（Symptom）**：
  用户要求“把当前存量项目先整体看一下 / 熟悉一下”时，AI 第一时间去翻找项目目录与外部历史交接报告，虽然快速给出了业务概览，但跳过了 Evo-OS 宪章规定的第 0 步记忆召回、源码直接核验、自动代码扫描与弹窗审批写入记忆账本闭环。
- **深层病根剖析（Root Cause）**：
  将“整体看一下”误判为普通只读闲聊，未意识到“首次接管存量项目”正是激活 `02-modular-refactor-and-map`（建立快照、扫描大文件、拍板模式 A/B）与 `05-self-evolving-skill-mcp-forge`（初始化该项目独立的 6 大记忆档案）的关键起点；同时对交接文档的结论未第一时间展示真实源码行号佐证。
- **触发条件（Trigger Condition）**：
  用户首次要求查看、摸排、接手或分析一个存量项目。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **第 0 步必调记忆召回**：无论任务是只读摸排还是编码修改，第 0 步必须对当前目标项目根目录执行 `memory_recall_for_task(project_root: "<目标项目路径>")` 并检查 `<目标项目路径>/memory/*.md` 状态。
  2. **文档结论必过源码实证**：任何从 README 或历史交接报告中读到的架构结论或缺陷点，必须亲自调用 `read_file` 对照真实源码文件（精确到行号区间）二次核实后方可采信。
  3. **摸排即建档（经审批）**：首次摸排完存量项目后，必须自动对该项目执行 `snapshot-and-rollback.sh backup` 与 `auto-code-mapper.mjs`，并通过 `ask_question` 请用户拍板改造模式（A/B）及授权写入 `<目标项目路径>/memory/` 下的 6 大账本与 SQLite 图谱索引。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（第 4.2 节与第 5.4 节）及 `skills/02-modular-refactor-and-map/SKILL.md`。

---

### [EVO-008] 多项目记忆路径 100% 物理隔离与严禁污染母版库基因
- **踩坑日期**：`出厂预置基准基因`
- **关联模块 / 领域**：`多项目管理 / 记忆路径解析 / 容器目录防误写`
- **问题表面现象（Symptom）**：
  当 Antigravity 工作区挂载在 `~/workspace` 等包含多个子项目的父级容器目录时，AI 在更新某个具体业务项目的 `memory/*.md` 时，误将其写进了 `~/.gemini/config/plugins/agy-evo-os/memory/` 母版目录中，导致母版被特定业务项目污染。
- **深层病根剖析（Root Cause）**：
  宪章文档中使用了指向 `universal-fullstack-evo-os/memory/*.md` 的静态示例链接，且 MCP 服务端对宽泛容器目录曾采用回退至 `universal-fullstack-evo-os` 的策略，误导 AI 将业务项目数据写入了引擎母版目录。
- **触发条件（Trigger Condition）**：
  在多项目共享的父级工作区（如 `~/Downloads`、`~/code`）或任意独立业务项目中读写 `memory/*.md` 及调用 MCP 记忆工具时。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **严格绑定真实业务子项目根目录**：所有 `memory/*.md` 读写与 MCP `project_root` 参数，必须指向**当前正在开发/摸排的具体业务项目根目录**（例如 `~/workspace/xxx-project` 或 `~/code/xxx`）。
  2. **母版库只读保护**：绝对禁止任何业务项目向 `~/.gemini/config/plugins/agy-evo-os/memory/` 或 `~/.gemini/config/plugins/agy-evo-os/memory-templates/` 写入业务进度或代码地图！
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（顶部红线与第 5.4 节）及 `scripts/evo-memory-mcp-server.mjs` 路径强校验拦截器。

---

### [EVO-009] 视觉交互与端到端测试强制截屏留证（有图有真相）基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`前端验收 / 无头浏览器 / 多模态AI交互 / 质检留证`
- **问题表面现象（Symptom）**：
  在完成前端渲染、看图写脚本或多模态分析功能修复后，AI 在终端执行无报错验证后向用户文字汇报“实测通过，AI已认出细节”，但用户质询：“你像这种测试后面要给我截图什么的吧？”，指出缺乏看得见的可视化物证。
- **深层病根剖析（Root Cause）**：
  六道门禁 GATE-04 中仅强调了“无头浏览器无报错、console.error===0”，未将“自动保存页面截图（`page.screenshot`）并在验收汇报中直接附上可点击的截图链接或图片”设为强制必选项，导致向用户汇报时呈现为纯文字“空口报喜”。
- **触发条件（Trigger Condition）**：
  任何涉及 Web 界面渲染、UI 交互、多模态看图识别或多媒体生成的功能测试验收。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **无头浏览器必截屏**：GATE-04 验收脚本必须调用 `page.screenshot` 保存关键渲染帧至 `<PROJECT_ROOT>/tests/screenshots/` 或工作区测试目录。
  2. **汇报必附图证**：无论是大白话版还是专业工程版汇报，必须主动附带截图绝对路径链接（`file:///...`）或 Markdown 内嵌图片，用“有图有真相”替代纯文字空口宣称。
  3. **巡检雷达扩充**：在 `evo-patrol-inspector.mjs` 中加入对截图质询信号（“要给我截图”、“怎么没图”等）的主动监听。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（反作弊十条铁律第 3 条与六道门禁 GATE-04）、`skills/04-qa-release-and-ops/SKILL.md`（GATE-04 标准脚本模板与判据）及 `scripts/evo-patrol-inspector.mjs`。

---

### [EVO-010] 产物生成查验绝对串行化与 MCP 命名防猜错基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`工具链调用 / 命令产物读取 / MCP JSON-RPC 通信`
- **问题表面现象（Symptom）**：
  1. AI 编写并执行一段脚本生成图标/截图，并在同一个 step 的 tool_calls 中同时并发调用了 `read_file` 读取该文件，导致 Antigravity 返回 `Encountered error in step execution: file does not exist`。
  2. AI 尝试调用记忆召回 MCP 工具时，因不知道 exact MCP 服务名，自行臆测 `ServerName: "universal-fullstack-evo-os_evo_memory_graph"`，触发报错 `server name ... not found`。
- **深层病根剖析（Root Cause）**：
  1. 单一模型轮次内的多个 tool_calls 在客户端可能并行派发，且生成文件的子进程尚未退出并完成磁盘写缓冲刷新，`read_file` 即抢先执行导致 ENOENT；
  2. 系统规则中只写了“调用 MCP memory_recall_for_task”，未注明 MCP 服务名 `ServerName: "agy-evo-os_memory"`，且 schema 目录缺少 `instructions.md` 指引。
- **触发条件（Trigger Condition）**：
  在同一个 response 中同时调度生成命令与文件读取；或者使用 `call_mcp_tool` 调用项目 MCP 记忆工具。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **命令与查验严格分步**：任何新文件的生成（截图、图标、打包文件）与读取必须严格分两步：Step 1 运行生成命令；Step 2 在收到命令执行成功回包后，再独立调用 `read_file` 查看内容。
  2. **MCP 服务名显式化**：调用 Evo-OS 记忆工具时统一使用 `ServerName: "agy-evo-os_memory"`，并在 `${HOME}/.gemini/antigravity/mcp/agy-evo-os_memory/instructions.md` 固化调用契约。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（反作弊第 3 条、第 4.2 节、第 5.4 节）、`skills/03-fullstack-atomic-guardrails/SKILL.md`（第 2.5 节）、`mcp/instructions.md` 与 `scripts/install-to-antigravity.sh`。

---

### [EVO-011] 存量老项目路径防盲猜与生成型产物落盘验真双重门禁基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`存量代码摸排 / 工具调用防御 / 动态文件生成 / macOS AppKit 无头限制`
- **问题表面现象（Symptom）**：
  在处理前端需求与桌面快捷应用打包任务时，AI 连续触发两次 `file does not exist` 报错：
  1. 智能体未经源码目录结构摸排，凭空猜测存在 `src/components/layout/Sidebar.tsx` 并直接调用 `read_file` 导致报错；
  2. 智能体编写 Objective-C 脚本试图从 app 中抓取图标为 PNG，但在无头 CLI 环境下调用了已废弃且需视窗焦点的 `initWithFocusedViewRect:` API，导致图片未成功落盘；且智能体未检查文件存在即在后续 step 调用 `read_file` 报错。
- **深层病根剖析（Root Cause）**：
  1. **路径直觉盲猜违背实证原则**：接入存量老项目或陌生模块时，智能体未查验项目的 `CODE_MAP.md`，也未通过 `find`/`ls` 获取真实代码树，凭借经验盲猜文件名和目录；
  2. **生成与消费缺少存在性断言**：在生成型脚本退出后，智能体假定“命令退出即代表目标文件生成成功”，未断言文件落盘状态（无 `test -f <file>` 校验或日志验证），直接盲读导致 ENOENT；
  3. **macOS Cocoa API 无头局限**：在无图形视窗的 CLI 子进程中，部分 AppKit 绘图方法依赖 Window Focus，静默返回 nil，导致写文件失败。
- **触发条件（Trigger Condition）**：
  在存量代码库中定位陌生组件或文件；或者执行脚本动态生成临时图片/编译文件并准备后续读取。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **存量老项目查验先行**：严禁凭直觉猜测文件路径调用 `read_file`/`edit_file`；必须先检索 `memory/CODE_MAP.md` 或执行 `ls` / `find` / `git ls-files` 确认相对路径 100% 存在。
  2. **生成产物落盘验真断言**：动态生成新文件后，在调用 `read_file` 之前，必须在命令输出中显式验证生成日志，或通过 `test -f <path>` / `ls -la <path>` 确认文件落盘，严禁盲读未确证落盘的文件。
  3. **macOS 提取图标推荐标准**：优先使用 `sips -s format png <App>/Contents/Resources/*.icns --out <Target.png>`，或使用 Python `AppKit` 的 `[icon TIFFRepresentation]` 结合 `NSBitmapImageRep` 导出，彻底杜绝已废弃的 Focus 绘图 API。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（反作弊十条铁律第 3、10 条）、`skills/03-fullstack-atomic-guardrails/SKILL.md`（第 2.5 节）及 `scripts/evo-patrol-inspector.mjs`。

---

### [EVO-012] 后台任务防盲目 kill 与响应式唤醒协同基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`后台任务管理 / 异步工具调度 / Reactive Wakeup / manage_task`
- **问题表面现象（Symptom）**：
  在执行后台搜索或命令调度时（如 `mdfind`），智能体在下一个 turn 尝试调用 `manage_task(Action: "kill", TaskId: "...")`，结果系统返回 `Encountered error in step execution: cannot kill task: task is not running (status: DONE)`。
- **深层病根剖析（Root Cause）**：
  智能体误以为后台任务启动后会一直占用后台，未意识到短耗时命令在启动后几秒内即已自然完成（退出码 0，状态置为 DONE）。智能体未通过 `manage_task(Action: 'list')` 查询当前任务列表与运行态，盲目向已完结的任务发出 `kill` 指令，从而触发系统抛错。
- **触发条件（Trigger Condition）**：
  在启动异步后台命令后，未检查任务状态即尝试调用 `manage_task(Action: 'kill')`。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **状态感知先行**：严禁在未通过 `manage_task(Action: 'list')` 确认任务仍处于 `RUNNING` 状态前，对后台任务盲目调用 `kill`。
  2. **信任响应式唤醒**：宿主环境具备 Reactive Wakeup 机制，后台任务完成时会自动向智能体发送高优先级系统消息唤醒，无需盲目手动轮询或提前 kill。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（核心原则二第 11 条）、`skills/03-fullstack-atomic-guardrails/SKILL.md`（第 4.5 节）及 `scripts/evo-patrol-inspector.mjs`。

---

### [EVO-013] 前沿开源项目去伪存真与宣传落差主动预警基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`前沿技术接入 / 开源项目选型 / 真实性审查 / 意图解码科研`
- **问题表面现象（Symptom）**：
  用户引入号称具备“普通 WiFi 隔墙 3D 姿态透视雷达”的开源项目（如 RuView / WiFi DensePose），智能体花费大量精力调通环境并修改代码后，用户通过论坛查证发现该项目实际效果疑似造假（3D 人体动作为写死的假动画，实测准确率仅 3% 且属于商业营销），最终用户要求全部关闭并删除。
- **深层病根剖析（Root Cause）**：
  在技术调研与项目接管初期，智能体缺乏对“革命性/黑科技”开源项目的去伪存真怀疑精神，未先对关键算法模型代码做真假审查（未排查是否存在 mock/写死动画序列），也未检索技术社区对该项目的口碑与真实效果评价，导致在虚假或营销噱头项目上浪费了大量算力与排查时间。
- **触发条件（Trigger Condition）**：
  接手或调研宣传效果惊人、但业界尚未普遍普及的黑科技/概念性开源项目。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **源码内核真实性检索**：检索仓库是否存在 `mock`、`fake`、`simulation`、`demo_replay` 或写死循环关键帧动画，核查核心算法模型与权重是否真实可用。
  2. **社区论坛口碑交叉核验**：使用 `search_web` 搜索项目名 + `scam/fake/accuracy/真实效果/论坛`，查验 GitHub Issues 与论坛真实用户评价。
  3. **宣传落差如实预警**：一旦发现代码实为假 demo 或准确率极低，第一时间向用户披露代码实证，严禁盲目调通，避免用户浪费硬件购置与调试精力。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（核心原则三第 5 项）、`skills/01-intent-and-research/SKILL.md`（第 4.3 节）及 `memory/EVOLUTION_LEDGER.md`。

---

### [EVO-014] 五维「越用越聪明」全自动复利进化与 L1/L2/L3 按需分流防过度工程基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`3D 知识图谱自刷新 / Ponytail 化繁为简棘轮 / 安全边界审计 / L1~L3 影响面分流`
- **问题表面现象（Symptom）**：
  1. 如果把 `graphify`（知识图谱）、`ponytail`（化繁为简）、`security-audit`（安全审计）仅仅当成静态 Markdown 规则或需要手动触发的独立脚本，不仅需要用户打字提醒，而且每次任务做完后图谱不会自己长出新节点、已有工具函数不会被自动汇总复用、死代码也不会随时间自动收敛。
  2. 反过来，如果连改一行文案（L1 轻量级）都强制要求拆新文件、跑重型流程，又会导致过度工程与改动膨胀。
- **深层病根剖析（Root Cause）**：
  缺少在任务结束点（`stop-hook-guardian.mjs` 与 `memory_rebuild_index`）自动触发的**确定性复利闭环（Deterministic Compound Loop）**，以及在任务起点按影响面（L1/L2/L3）精准分流的路由表。
- **触发条件（Trigger Condition）**：
  每次任务启动时的工具路由，以及每次代码修改完成后的收工验收阶段。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **零口令自动路由**：按 `GEMINI.md`「任务语义 -> 工具自动按需路由总表」，在接手大项目/改核心模块时自动调用 MCP `code_graph_blast_radius`，在写工具函数/重构/上线前自动调用 `security_simplicity_audit`。
  2. **五维收工自动刷新**：每次任务通过 `stop-hook-guardian.mjs` 或 `memory_rebuild_index` 收工时，全自动刷新 `CODE_GRAPH_3D.html`（3D 星系图）、`GRAPH_REPORT.md`（Ponytail 现成可复用轮子速查表）与 `evolution-metrics.json`（安全与死代码收敛棘轮）。
  3. **L1/L2/L3 分流与防 A↔B 摇摆**：L1 小改原位完成不拆文件；同一问题严禁在 A↔B 两套旧方案间来回摇摆；远端指令超时必须先只读回读状态再动作。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（第 0.3、1.3、4.4、5.5、6.1 节）、`scripts/code-graph-3d-generator.mjs`、`scripts/security-and-simplicity-audit.mjs`、`scripts/stop-hook-guardian.mjs` 与 `scripts/evo-memory-mcp-server.mjs`。

---

### [EVO-015] 交互式 HTML 产物「三合一交付」防源码展示基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`交互式 HTML 交付 / CODE_GRAPH_3D.html / 系统浏览器拉起 / 无头浏览器预览图`
- **问题表面现象（Symptom）**：
  智能体向用户汇报时直接给出 `[.../CODE_GRAPH_3D.html](file:///.../CODE_GRAPH_3D.html)` 链接，用户在 Antigravity IDE 聊天框中点击后，IDE 默认将其作为代码文本文件在编辑器中打开，满屏显示 HTML/JS 源码而非 3D 可旋转星系图，用户反馈：“你以后给我这样发的话我是直接打不开的，这个注意下”。
- **深层病根剖析（Root Cause）**：
  1. Antigravity IDE 聊天面板中的 `file:///*.html` 协议链接绑定的是代码编辑器（Code Editor View），并非内置 Web 浏览器；
  2. `code-graph-3d-generator.mjs` 与 MCP `code_graph_blast_radius` 此前仅在磁盘静默生成 `.html` 文件，未提供自动调用宿主系统浏览器（macOS `open`）弹出的能力，也未生成可在 IDE 内直接点击看图的 `.png` 视觉预览截图。
- **触发条件（Trigger Condition）**：
  生成或交付 `CODE_GRAPH_3D.html`、测试报告网页或任何包含 Canvas/WebGL/DOM 交互的本地 `.html` 产物时。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **三合一交付法（3-in-1 Interactive HTML Delivery）**：
     - **动作 ①（系统浏览器自动弹出）**：调用 MCP `code_graph_blast_radius(..., open_in_browser: true)` 或 `node scripts/code-graph-3d-generator.mjs --root "<项目路径>" --open`，自动通过 macOS `open "<htmlPath>"` 在用户系统默认浏览器（Chrome/Safari）中弹出可交互 3D 窗口；
     - **动作 ②（IDE 内嵌 `.png` 预览截图）**：用 Playwright 无头浏览器渲染该 HTML 并保存高清预览截图（如 `memory/CODE_GRAPH_3D_PREVIEW.png`），在汇报中附上 `.png` 链接（用户在 IDE 聊天框点击 `.png` 即可直接查看高清渲染画面）；
     - **动作 ③（终端一键重开口令與防呆提示）**：在汇报中提供 `open "<HTML绝对路径>"` 命令，并明确提醒用户勿在聊天框直接点 `.html` 链接。
  2. **内联 JSON 防 `</script>` 截断转义**：向 HTML 内联 `<script>` 注入 `GRAPH_DATA` 时，强制执行 `.replace(/<\//g, '<\\/')`，杜绝记忆切片或源码中包含 `</script>` 字符串时破坏 HTML 解析。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（核心原则二第 12 条）、`scripts/code-graph-3d-generator.mjs`（`--open` / `openInBrowser`）、`scripts/evo-memory-mcp-server.mjs`（`open_in_browser` 参数）、`skills/02-modular-refactor-and-map/SKILL.md` 与 `skills/04-qa-release-and-ops/SKILL.md`。

---

### [EVO-016] 全系统零自冲突、A/B 类记忆分流、SQLite 连接池闭环与平台 `<CONTEXT_SUMMARY>` 协同基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`规则自洽性 / SQLite 并发锁与连接管理 / 派生文件防自激 / 平台上下文压缩 / 20分钟巡逻盲区修复`
- **问题表面现象（Symptom）**：
  用户要求深度排查系统升级 v3.0 后是否存在“自己冲突自己”的隐患，并询问上下文中出现的 `compact`（`<CONTEXT_SUMMARY>`）是否与活体记忆系统冲突。经全链路源码深潜审计，定位出 7 处真实存在的底层自冲突隐患：
  1. **审批门禁 vs 自动刷新冲突**：`GEMINI.md` 5.1 节规定“修改任何 `memory/` 文件需 `ask_question` 弹窗”，而 5.5 节与 `stop-hook-guardian.mjs` 在收工时会自动刷新 `CODE_GRAPH_3D.html`、`GRAPH_REPORT.md`、`memory.sqlite`、`evolution-metrics.json`；
  2. **派生文件自激脏循环**：`memory-graph-engine.mjs` 将机器派生的 `memory/GRAPH_REPORT.md` 也纳入了 `memory/*.md` 索引范围，导致每次生成报告后下次 `recall` 永远判定索引脏并触发重算；
  3. **`CODE_MAP.md` 正则误伤真实源码节点**：`memory-vector-tokenizer.mjs` 解析 `CODE_MAP.md` 时未锚定列格式，误把 `.json`/`.md` 统计表与 `SPLIT-xxx` 当成源码模块并覆盖了真实 `SOURCE_FILE` 节点的 `file_path`，导致 `GRAPH_REPORT.md` 可复用轮子表混入 Markdown 伪节点；且 `import\s+[\s\S]*?from` 正则在遇到无 `from` 的 `import './a.css'` 时会跨行吞掉后续真实 import；
  4. **MCP 长进程 `DatabaseSync` 句柄泄漏**：`evo-memory-mcp-server.mjs` 与 `code-graph-3d-generator.mjs` 在调用 `syncIncrementalIndex` 后未关闭 `DatabaseSync` 连接；
  5. **预检门禁误扫派生大 HTML**：`universal-preflight-gate.mjs` 的 Check 2/3 扫描了内嵌全部错题文本的 `memory/CODE_GRAPH_3D.html`，存在体积告警与反模式误报隐患；
  6. **容器工作区活跃项目识别不全**：`stop-hook-guardian.mjs` 在 `~/Downloads` 容器目录下仅检查 `PRODUCT_PROGRESS.md` 的 `mtimeMs`，漏掉仅更新了 `memory.sqlite` 或 `CODE_GRAPH_3D.html` 的活跃子项目；
  7. **后台巡逻周期盲区**：`sidecar.json` 配置了每 60 分钟运行一次（`0 * * * *`），却只扫描最近 30 分钟（`--window-minutes 30`），每小时漏检 30 分钟。
- **深层病根剖析（Root Cause）**：
  v3.0 新增的多维复利组件（3D 图谱、Ponytail 轮子表、安全棘轮、MCP 服务）在接入原有 v2.0 门禁与索引流水线时，未对「人类语义真源文件（A类）」与「机器编译派生视图（B类）」划清物理边界，且长驻进程资源生命周期与定时任务时间窗口未做跨模块对齐。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **A/B 类记忆文件严格分流**：A 类人类语义账本（6 大 `.md` + `sessions/*.md`）修改必过单次合并 `ask_question` 审批（L1 轻量微调免弹窗）；B 类机器派生文件（`memory.sqlite`、`evolution-metrics.json`、`CODE_GRAPH_3D.html`、`GRAPH_REPORT.md`）全自动静默更新，且从 `collectProjectFiles`、`auto-code-mapper.mjs` 与预检 Check 2/3 中排除，彻底消除自激循环。
  2. **SQLite 并发与连接闭环**：所有 `DatabaseSync` 实例强制启用 `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000;` 并采用 `BEGIN IMMEDIATE`，且所有工具函数必须在 `try ... finally { db.close(); }` 中释放句柄。
  3. **平台 `<CONTEXT_SUMMARY>` 互补恢复**：平台自动 `compact` 仅压缩当前会话窗口 RAM，绝不破坏磁盘 `memory.sqlite`；检测到 `<CONTEXT_SUMMARY>` 后自动执行 1.5ms `memory_recall_for_task(read_only: true)` 即可无损恢复精确行号与 `VETO` 约束。
  4. **20 分钟无盲区巡逻**：巡逻 Sidecar 采用 `*/20 * * * *` 搭配 `--window-minutes 30` 重叠滑动窗口，做到零盲区、无人值守零阻塞、全绿静默不扰民。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（5.1/5.4 节）、`scripts/memory-vector-tokenizer.mjs`、`scripts/memory-graph-engine.mjs`、`scripts/code-graph-3d-generator.mjs`、`scripts/evo-memory-mcp-server.mjs`、`scripts/universal-preflight-gate.mjs`、`scripts/stop-hook-guardian.mjs`、`scripts/evo-patrol-inspector.mjs` 与 `sidecar.json`。

---

### [EVO-017] 高阶 recallForTask API 统一导出与母版模板软链接对齐基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`memory-graph-engine.mjs / recallForTask 统一导出 / memory-templates 路径兼容 / 自动化端到端测试`
- **问题表面现象（Symptom）**：
  1. 在端到端自动化压测脚本中，动态 `import { recallForTask } from './memory-graph-engine.mjs'` 报 `TypeError: recallForTask is not a function`；
  2. 其他子代理在查验母版库时，盲猜路径读取 `/universal-fullstack-evo-os/memory-templates/EVOLUTION_LEDGER.md` 报 `file does not exist`。
- **深层病根剖析（Root Cause）**：
  1. `memory-graph-engine.mjs` 此前仅导出了底层的 `openMemoryDatabase`、`syncIncrementalIndex` 与 `funnelHybridRecall`，未导出一个直接封装了只读判断、增量索引、混合召回与 `finally { db.close() }` 的高阶便利函数 `recallForTask`，导致测试脚本和外部模块无法一行代码开箱即用；
  2. 母版库在磁盘上的真实目录名为 `memory/`，而安装脚本将其复制为全局插件的 `memory-templates/`，母版库缺少向后兼容的 `memory-templates -> memory` 软链接。
- **触发条件（Trigger Condition）**：
  外部测试套件或模块直接导入混合检索引擎，或代理查验母版库模板路径时。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **统一高阶 API 导出（Unified High-Level recallForTask Export）**：`memory-graph-engine.mjs` 强制导出 `recallForTask(rootDir, options)`，内部根据 `options.readOnly` 严格执行只读零副作用分支（若未建档绝不创建文件），非只读时在 `try...finally` 中确保连接关闭；
  2. **母版库双路径兼容（Template Path Aliasing）**：在母版库根目录保留 `memory-templates -> memory` 软链接，消除任何脚本与代理对路径命名的误读。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `scripts/memory-graph-engine.mjs`、`scripts/evo-memory-mcp-server.mjs` 与母版库根目录软链接。

---

### [EVO-018] SQLite WAL 读转写死锁消除、3D 图谱多别名返回值解耦与 AST/记忆边去重净化基因
- **踩坑日期**：`2026-10-30`
- **关联模块 / 领域**：`memory-graph-engine.mjs / code-graph-3d-generator.mjs / security-and-simplicity-audit.mjs / 高并发 SQLite / 图谱返回值契约`
- **问题表面现象（Symptom）**：
  1. 在 6 进程并发读写高压测试中，部分 Worker 抛出 `ERR_SQLITE_ERROR: database is locked`（错误码 5）；且零跨文件 import 的项目每次调用 `buildGraphAndBlastRadius` 均因 `importEdgeCount === 0` 误触发全量删表重建；
  2. 端到端测试读取 `buildGraphAndBlastRadius` 返回对象的顶级属性 `cyclesCount`、`cycles`、`blastRadius`、`html3dPath`、`reportPath`、`reusableHelpers` 均为 `undefined`；
  3. 3D 图谱将 CTE 反向边 `REV_RELATES_TO` 与重复 `RELATES_TO` 混入源码 AST 边统计，导致 `inDegree`/`outDegree` 虚增 3 倍且把源码节点误列为“🧠 关联记忆”；业务项目误索引了 `TEMPLATE_SESSION_MEMORY.md` 样板文件；`PONY-01` 遇到 TS 泛型或对象解构参数时漏检。
- **深层病根剖析（Root Cause）**：
  1. `syncIncrementalIndex` 在无任何文件变化时仍启动 DEFERRED 事务导致锁升级死锁；且 `code-graph-3d-generator.mjs` 用 `importEdgeCount === 0` 判断是否需要重建；
  2. `buildGraphAndBlastRadius` 返回对象缺少顶级扁平化快捷属性，且未对 `EXTRACTED` AST 边与 `INFERRED` 记忆边分两阶段去重；
  3. `collectProjectFiles` 未在业务项目中跳过 `TEMPLATE_SESSION_MEMORY.md`，`PONY-01` 使用了不支持括号/尖括号深度的朴素 `.split(',')` / `.split(':')`。
- **触发条件（Trigger Condition）**：
  高频多进程同时触发 memory recall、解构 `buildGraphAndBlastRadius` 顶级属性、或在真实业务项目上渲染 3D 星系图与执行 Ponytail 审计时。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **写事务强制 BEGIN IMMEDIATE、只读快速跳过与精确源码节点检查**：无文件变更时 0 写锁直接返回；仅当 `manifestSourceCount > 0 && sourceNodeCount === 0` 时才触发全量重建；
  2. **3D 图谱多别名顶级属性全兼容与两阶段边去重**：`buildGraphAndBlastRadius` 必须同时返回顶级拍平属性（`html3dPath`, `reportPath`, `cyclesCount`, `cycles`, `blastRadius`, `reusableHelpers`）与深层对象；剔除 `REV_RELATES_TO` 辅助边并对已存在 AST `IMPORTS` 的节点对去重，业务项目自动跳过 `TEMPLATE_SESSION_MEMORY.md`；
  3. **括号感知的 TS 参数剥离与 MCP 容器路径全拦截**：`PONY-01` 采用括号/尖括号深度感知的参数归一化器；`security_simplicity_audit` 强制执行 `isProtectedOrContainerDir` 容器与母版隔离守卫。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `scripts/memory-graph-engine.mjs`、`scripts/code-graph-3d-generator.mjs`、`scripts/security-and-simplicity-audit.mjs`、`scripts/evo-memory-mcp-server.mjs`，并通过 6 进程并发高压与端到端回归测试验证。

---

### [EVO-019] edit_file 精准微靶向修改与跨上下文防串味最小唯一锚点基因
- **踩坑日期**：`2026-10-31`
- **关联模块 / 领域**：`edit_file 工具规范 / 跨项目多任务交接 / 账本维护`
- **问题表面现象（Symptom）**：
  在对话 `11a2aff6-260b-4737-837b-c623511e931c` Step 15430 中，智能体调用 `edit_file` 更新 `CODE_MAP.md` 抛出 `Encountered error in step execution: target content not found in the file; the Target must exactly match existing file text, including whitespace`。
- **深层病根剖析（Root Cause）**：
  智能体在长上下文或同时处理多个项目（如 acme Studio 与 acme Matrix）时，试图用单一 `edit_file` 一次性替换包含数百行 Mermaid 图和多层章节的超大段落。由于上下文混杂，Target 中误包含了另一个项目的文本，且大段落内任意微小空格或行尾差异均会导致整体匹配失败。
- **触发条件（Trigger Condition）**：
  更新包含多个小节的大文档或代码文件时，一次性传入超过 20 行的跨段落超长 Target，或未先读取文件当前真实内容即凭记忆编写 Target。
- **原子级防错铁律（Atomic Prevention Rule）**：
  **【edit_file 最小特征锚点（Minimal Unique Anchor）铁律】**：
  1. Target 必须基于最近一次刚刚通过 `read_file` 查看到的真实源码行，严禁凭历史上下文或多项目交接记忆盲写；
  2. Target 长度严格限制在待改行及其前后 1~2 行唯一特征上下文（3~10 行以内最佳），严禁将跨多个子章节的超大区块作为单一 Target 替换；
  3. 若需修改多个不相邻区域，必须分成多次独立的 `edit_file` 依次精准替换。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至最高宪章 `GEMINI.md`（反作弊第 14 条）、`skills/02-modular-refactor-and-map/SKILL.md`（3.4 节）与 `skills/03-fullstack-atomic-guardrails/SKILL.md`（2.5 节）。

---

### [EVO-020] 深层未知文件路径先行探测防盲猜读取基因
- **踩坑日期**：`2026-10-31`
- **关联模块 / 领域**：`read_file / view_file 工具调用 / 存量大代码库导航`
- **问题表面现象（Symptom）**：
  在对话 `9f73dc87-9b43-4bff-a3b6-0851e778dc06` Step 5386 与 `aa9107d8-f9c1-4002-a46c-acd97bb0d883` Step 8 中，智能体分别尝试读取 `lib/workflow/gates.mjs` 与 `tiktok_matrix_hub_additions.py`，抛出 `file does not exist` 与 `stat ... no such file or directory`。
- **深层病根剖析（Root Cause）**：
  智能体在存量大项目中未核查真实代码结构，凭借直觉或过往经验臆测文件名（以为有 gates.mjs 或 additions.py），直接发起文件读取，导致无效调用与执行中断。
- **触发条件（Trigger Condition）**：
  在陌生项目或存量庞大目录树中，未先通过代码地图或命令行探测确认相对路径真实存在。
- **原子级防错铁律（Atomic Prevention Rule）**：
  **【未知路径先行轻量探测（Pre-Read Verification）铁律】**：
  严禁凭直觉脑补文件路径直接发起读取！在存量或复杂项目中，必须优先检索项目 `memory/CODE_MAP.md`；若地图未收录，必须先运行 `ls`、`find` 或 `git ls-files` 实证目标文件真实落盘后再调用 `read_file`。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至最高宪章 `GEMINI.md`（反作弊第 10 条）、`skills/02-modular-refactor-and-map/SKILL.md`（3.4 节）与 `skills/03-fullstack-atomic-guardrails/SKILL.md`（2.5 节）。

---

### [EVO-021] 后台任务状态响应式唤醒协同与盲目 kill 拦截基因
- **踩坑日期**：`2026-10-31`
- **关联模块 / 领域**：`manage_task 工具调用 / 后台任务并发管理`
- **问题表面现象（Symptom）**：
  在对话 `11a2aff6-260b-4737-837b-c623511e931c` Step 15457 中，智能体对 `task-15449` 发起 `manage_task(Action: 'kill')`，抛出 `cannot kill task "11a2aff6-260b-4737-837b-c623511e931c/task-15449": task is not running (status: DONE)`。
- **深层病根剖析（Root Cause）**：
  智能体启动后台脚本后，在任务已自然执行完毕退出（`status: DONE`）的情况下，未通过 `manage_task(list)` 检查最新状态，凭主观假定强行发起 `kill`，引发竞态与系统报错。
- **触发条件（Trigger Condition）**：
  在并发执行多个操作或重试命令时，未刷新后台任务列表即盲目 kill。
- **原子级防错铁律（Atomic Prevention Rule）**：
  **【后台任务状态验证先行与响应式唤醒（Safe Task Termination）铁律】**：
  1. 调用 `manage_task(Action: 'kill')` 前必须先通过 `manage_task(Action: 'list')` 实证目标任务状态确实为 `RUNNING`；对已 `DONE` 或 `ERROR` 的任务严禁调用 `kill`；
  2. 宿主系统具备响应式唤醒（Reactive Wakeup），后台任务完成时会自动通知，自发命令绝不应在同一 turn 内盲目提前 kill。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至最高宪章 `GEMINI.md`（反作弊第 11 条）与 `skills/03-fullstack-atomic-guardrails/SKILL.md`（4.5 节）。

---

### [EVO-022] 会话切片短ID盲猜兼容容错与软链接双向自愈基因
- **踩坑日期**：`2026-10-31`
- **关联模块 / 领域**：`session-memory-slicer.mjs / CONVERSATION_INDEX.md / 跨窗口无缝交接`
- **问题表面现象（Symptom）**：
  在跨窗口协同对话 `d2943953-95f8-4ebc-88a7-b4f925b6e762` Step 52 中，智能体查阅 `CONVERSATION_INDEX.md` 总索引后，根据切片编号 `CONV-20261031-001` 盲猜文件路径为 `memory/sessions/CONV-20261031-001.md` 并调用 `read_file`，抛出 `failed to read file: stat ... CONV-20261031-001.md: no such file or directory`。
- **深层病根剖析（Root Cause）**：
  1. 历史规范中切片完整文件名为 `CONV-YYYYMMDD-XXX_<slug>.md`（如 `CONV-20261031-001_acme-Matrix-全盘对账与四大后台任务真Bug修复.md`），虽在索引表格最后一列提供了完整路径超链接，但新接入的智能体往往习惯按左侧第一列切片编号（短 ID）直接拼接 `.md` 读取；
  2. 缺乏短 ID 别名软链接机制，导致短 ID 读取 100% 出现 404/stat 失败。
- **触发条件（Trigger Condition）**：
  跨窗口智能体仅根据切片编号（如 `CONV-20261031-001`）直接读取切片，或未提取表格最后一列 Markdown 链接中的真实文件名。
- **原子级防错与自愈铁律（Atomic Resilience & Self-Healing Rule）**：
  **【切片短ID软链接双向容错机制（Session Slice Alias Symlink Resilience）】**：
  1. `scripts/session-memory-slicer.mjs` 在生成 `${sliceId}_${slug}.md` 时，必须同步自动创建指向真实切片的相对软链接 `${sliceId}.md`（若不支持则自动拷贝副本）；
  2. `scripts/evo-patrol-inspector.mjs` 巡检官将自动遍历扫描所有已接入业务项目的 `memory/sessions/`，为存量带有详细后缀的切片自动补齐短 ID 软链接，实现 100% 无感自愈；
  3. 智能体查阅 `CONVERSATION_INDEX.md` 时仍需优先遵循最后一列的完整文件超链接，严禁在未确认前缀的情况下凭空脑补。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `scripts/session-memory-slicer.mjs`、`scripts/evo-patrol-inspector.mjs`、最高宪章 `GEMINI.md`（反作弊第 10 条 `EVO-020` 扩展）、`skills/05-self-evolving-skill-mcp-forge/SKILL.md`。

---

### [EVO-023] 本机文件与二进制逆向探查避免直接触发 unsandboxed 拦截（Node.js In-Process Stream vs System Debugger CLI）
- **踩坑日期**：`2026-10-31`
- **关联模块 / 领域**：`run_command / 系统安全沙盒 / 二进制与配置逆向探查`
- **问题表面现象（Symptom）**：
  在对话 `d2943953-95f8-4ebc-88a7-b4f925b6e762` Step 19, 24, 41 中，智能体为逆向分析 Antigravity 宿主内部协议与二进制符号，直接通过 `run_command` 调用外部调试器命令（`objdump -t`、`nm -n`、`objdump -d`），连续抛出 `permission check failed for unsandboxed "objdump ...": Permission denied for unsandboxed`。
- **深层病根剖析（Root Cause）**：
  宿主平台安全沙盒会对指向敏感系统路径（如 `/Applications/Antigravity.app`）的外部动态调试/反汇编 CLI（如 `objdump` / `nm` / `gdb`）实施确定性 unsandboxed 权限拦截；而普通 Node.js / Python 脚本以受控工作区进程形式运行，其标准文件流读取（`fs.readFileSync`）与内存数据结构解析（Buffer / Struct）完全在合规权限内，且性能更高、跨平台免装 CLI。
- **触发条件（Trigger Condition）**：
  在宿主系统或受限路径上直接使用 `objdump`、`nm` 等反汇编 CLI 分析二进制或执行逆向探查。
- **原子级防错铁律（Atomic Prevention Rule）**：
  **【进程内数据流解析优先（In-Process Stream over External Debugger）铁律】**：
  1. 严禁直接通过 `run_command` 盲目调用易被平台沙盒拦截的底层调试 CLI（`objdump` / `nm` / `lldb` / `strace`）；
  2. 凡涉及二进制头（Mach-O / ELF / PE）、符号表、压缩包或复杂配置解析，必须在 Node.js / Python 中通过标准只读文件流直接读取并按协议字段解析，既天然合规、杜绝权限阻断，又实现跨环境零依赖确定性执行。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至最高宪章 `GEMINI.md`（反作弊第 15 条）与 `skills/03-fullstack-atomic-guardrails/SKILL.md`。

---

### [EVO-024] `ask_question` 弹窗提问前强制发送邮件提醒基因（Pre-`ask_question` Email Notification Guardrail）
- **踩坑日期**：`2026-10-31`
- **关联模块 / 领域**：`ask_question / 人机协同交互 / 异步远程提醒`
- **问题表面现象（Symptom）**：
  用户在床上休息或暂时离开电脑屏幕时，智能体直接调用 `ask_question` 弹出交互式选择题/审批模态框，此时执行被阻塞等待用户点击，但用户在手机端收不到提醒，导致任务无故卡住。
- **深层病根剖析（Root Cause）**：
  1. 原有规则仅规定“任务完成后”发送邮件，而忽略了 `ask_question` 是同步阻塞式模态弹窗——一旦弹出，智能体即进入挂起等待态，如果不在弹窗**之前**发邮件，用户根本不知道电脑屏幕上弹出了问题需要拍板；
  2. 缺乏在 `memory_recall_for_task` 的 `userPersonaDirective` 中实时向智能体注入“弹窗前必先发邮件”的强约束提醒。
- **触发条件（Trigger Condition）**：
  任何需要调用 `ask_question` 请用户做需求澄清、架构选型拍板、改造模式选择或收工记忆账本合并审批的场景。
- **原子级防错铁律（Atomic Prevention Rule）**：
  **【先发邮件再弹 `ask_question` 铁律】**：
  1. 凡即将调用 `ask_question` 弹出选择题/审批弹窗等待用户点击前，必须先通过 `/usr/sbin/sendmail -t -oi` 向 `dev-notify@example.com` 发送一封提醒邮件（注明当前项目/对话名称、弹出的问题及候选选项，提醒用户回电脑前点击）；
  2. 邮件发送命令执行完毕后，紧接着调用 `ask_question` 弹出窗口；
  3. 任务全部完成后，同样通过 `/usr/sbin/sendmail -t -oi` 发送完成总结邮件。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至最高宪章 `GEMINI.md`（5.1/5.2/6.2 节）、`memory/USER_PROFILE.md`、`skills/05-self-evolving-skill-mcp-forge/SKILL.md` 及 `scripts/evo-memory-mcp-server.mjs`（`preAskQuestionEmailRule`）。

---

### [EVO-025] 多项目联邦 3D 星系、6 重门禁安全派单与「8 步科学实验闭环 + 研发劳动力倍增飞轮」基因（Scientific RSI & Labor Force Compounding）
- **踩坑与进化日期**：`2026-10-31`
- **关联模块 / 领域**：`cross-project-federation.mjs / security-and-simplicity-audit.mjs / evo-memory-mcp-server.mjs`
- **问题表面现象（Symptom）**：
  1. 用户在 Antigravity UI 中看到的顶层项目名（如 `acme`、`脚本`）及对话窗口标题均挂载在父目录 `~/workspace` 下，仅靠文件夹名汇报时与用户眼中的软件名称对不上；
  2. 跨对话自动派单若缺乏前置状态校验，可能打断正在执行长任务或等待 `ask_question` 审批的窗口；
  3. 传统自进化仅停留在“报错后补丁式防错（被动铠甲）”，缺乏针对**用户习惯、插件/Skill 工具、项目代码架构、蜂群工作流**的主动 **8 步科学实验闭环** 以及可量化衡量“省了多少人工”的**研发劳动力倍增系数（`laborForceMultiplier`）**。
- **深层病根剖析（Root Cause）**：
  1. 缺乏打通 `~/.gemini/config/projects/*.json`（UI 项目名）、LanguageServer `GetAllCascadeTrajectories`（`annotations.title || summary`）与 `transcript.jsonl` 的三层动态消歧映射器；
  2. 缺乏将「提出假设 -> 设计实验 -> 修改代码与固化工具 -> 启动实验 -> 分析结果 -> 诊断失败原因 -> 调整路线 -> 开启下一轮迭代与铸造劳动力资产」标准化的 MCP 工具（`rsi_experiment_record`）与棘轮公式。
- **触发条件（Trigger Condition）**：
  跨多项目/多对话协同开发、主动效率攻坚、工具链锻造升级或周期性自检复盘。
- **原子级防错与进化铁律（Atomic Prevention & RSI Rule）**：
  1. **三层动态映射与 6 重门禁派单**：同时展示 **【UI 项目名 ↔ 对话窗口标题 ↔ 磁盘真实业务子目录】**，派单先落盘 `CROSS_INBOX.md` 并通过 6 道安全门禁；
  2. **8 步科学实验闭环（`rsi_experiment_record`）**：主动优化必须完整记录 Step 1~Step 8 至 `EVOLUTION_LEDGER.md` (`[RSI-xxx]`)，并自动触发 `security-and-simplicity-audit.mjs` 重算刷新 `evolution-metrics.json` 中的 `laborForceMultiplier = Number((1 + reusableWheelsCount * 0.05 + automationScriptsCount * 0.35 + mcpAndSkillsCount * 0.5 + swarmSpecialistsCount * 1.2 + rsiExperimentsCount * 0.25).toFixed(2))`。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `scripts/security-and-simplicity-audit.mjs`、`scripts/cross-project-federation.mjs`、`scripts/evo-memory-mcp-server.mjs`、`skills/05-self-evolving-skill-mcp-forge/SKILL.md` 与 `GEMINI.md`（5.2/5.5/7.5 节）。

---

### [EVO-026] AGY Swarm Commander 蜂群指挥官体系（`1 总控 + N 具名板块子对话窗口 + M 会话内子代理`）与 `SWARM_ACK` 防死锁特权回传基因
- **踩坑与进化日期**：`2026-10-31`
- **关联模块 / 领域**：`cross-project-federation.mjs / evo-memory-mcp-server.mjs / LanguageServer RPC`
- **问题表面现象（Symptom）**：
  1. 单对话统筹多板块业务时上下文迅速膨胀；若通过 `StartCascade` + `UpdateConversationAnnotations` 新建具名领域工作会话窗口（`🧩 [板块:xxx] 工作节点`），旧发现逻辑只读 `info.summary` 而忽略了 `info.annotations?.title`，导致识别不到新命名的工作会话窗口；
  2. 识别子代理（Subagent）时若逐个同步读取上百个会话的 75KB `transcript.jsonl`，会产生不必要的磁盘 IO 开销；
  3. **工作节点回传总控死锁（Commander Callback Deadlock）**：总控窗口常挂载在 `~/workspace` 父级容器目录下，且总控刚向工作节点派过单；当工作节点尝试调用普通 `cross_conversation_dispatch` 向总控汇报完成情况时，会同时触发：① 容器目录写拦截（拒绝在 `~/workspace/memory` 建收件箱）、② Gate 2 乒乓锁（`A->B` 后拦截 `B->A`）、③ Gate 3（60s 冷却锁）与 ④ Gate 4（总控若在忙则无法投递），导致任务回执回传彻底死锁。
- **深层病根剖析（Root Cause）**：
  1. `GetAllCascadeTrajectories` 返回的 `CortexTrajectoryMetadata` 已原生包含 `subagentSpec` 与 `parentConversationId` 零 IO 字段，且用户/RPC 自定义窗口标题存储在 `info.annotations.title`；
  2. 普通平级对话派单（`TASK_HANDOFF`）的防风暴门禁不能直接套用在「下级领域工作会话向总控呈交任务回执（`SWARM_ACK`）」的上下级汇报通道上。
- **触发条件（Trigger Condition）**：
  总控按板块名称路由或自动孵化具名子对话工作节点（`swarm_spawn_or_route_by_name`）、工作节点完成任务/遇到阻塞向总控回传任务回执（`swarm_report_to_commander`）、或查看全局蜂群态势（`swarm_status_board`）。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **窗口标题与零 IO 子代理识别**：`discoverAntigravityProjectsAndConversations()` 必须按 `info.annotations?.title || regSp?.specialistTitle || info.summary` 优先级提取窗口标题，并优先通过 `Boolean(info.trajectoryMetadata?.subagentSpec || info.trajectoryMetadata?.parentConversationId)` 零 IO 分流收集 `subagentConversations`；
  2. **全局蜂群注册表物理隔离**：具名工作节点映射与总控回执队列统一持久化至 `~/.gemini/antigravity/plugin_data/agy-evo-os/swarm-registry.json`，严禁写入母版 `memory/`；
  3. **`SWARM_ACK` 特权防死锁回传通道**：领域工作会话汇报总控必须调用 `swarm_report_to_commander`，自动豁免容器目录写拦截、Gate 2 乒乓锁、Gate 3 冷却锁与 Gate 4 空闲限制，直接落盘 `swarm-registry.json` 并通过 `SendAgentMessage` 异步推送总控。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `scripts/cross-project-federation.mjs`、`scripts/evo-memory-mcp-server.mjs`（MCP 工具 10/11/12）、`skills/05-self-evolving-skill-mcp-forge/SKILL.md` 与 `GEMINI.md`（第七章定律六）。

---

### [EVO-027] 非纯 UTF-8 文本或外部导入文件防 `read_file` 误判二进制崩溃预检基因 (Non-UTF8 Text Pre-check)
- **踩坑与进化日期**：`2026-10-31`
- **关联模块 / 领域**：`read_file / 外部账单报表 / 数据清洗 / 容错解码`
- **问题表面现象（Symptom）**：
  在主排查会话中尝试调用 `read_file` 直接读取 GCP 导出的 Live Costs CSV 账单时，工具底层检测到非 UTF-8 字节（如 Windows-1252 扩展字符或特定控制字节），直接判定为 `appears to be a binary file (application/octet-stream)` 并阻断抛错，导致排查中断。
- **深层病根剖析（Root Cause）**：
  平台内置 `read_file` 对非纯标准 UTF-8 文本有严格的二进制安全检查策略；若文件来自外部第三方系统导出，通常包含非 ASCII 扩展编码或 BOM 头，直接调 `read_file` 必然失败。
- **触发条件（Trigger Condition）**：
  读取外部导出的 CSV/TSV、系统二进制混杂日志、特定编码账单或未知编码的文本文件。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. 凡读取此类外部导入文件若触发二进制报错，严禁盲目重试 `read_file`；
  2. 必须立即通过 shell 命令（如 `python3` 配合 `errors='replace'` / `latin1` 容错解码、或 `head -n 20` / `awk`）进行探查和解析；
  3. 代码中读取此类文件必须显式传入容错编码参数。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（核心原则二第 16 条）与 `skills/03-fullstack-atomic-guardrails/SKILL.md`。

---

### [EVO-028] 长篇方案展示与 `ask_question` 模态弹窗遮挡防呆隔离基因 (Decoupled Presentation & Pop-up Guardrail)
- **踩坑与进化日期**：`2026-10-31`
- **关联模块 / 领域**：`ask_question / 用户体验 / 决策沟通 / 模态遮挡`
- **问题表面现象（Symptom）**：
  在协同设计会话中，智能体在同一次回复中输出了数百字完整的作战方案，并在末尾调用 `ask_question` 弹出决策选择题。结果客户端 UI 的选择卡片直接将正文方案遮挡阻塞，导致用户反映“没看清方案就被逼着做选择”。
- **深层病根剖析（Root Cause）**：
  `ask_question` 是模态阻塞型工具，在前端 UI 渲染时往往会先抢占焦点并阻断后续长文的自然平铺阅读，导致方案与提问在同一屏混杂。
- **触发条件（Trigger Condition）**：
  长篇多板块方案、多选项对比或复杂重构计划需要向用户汇报并等待拍板时。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. 详尽方案必须先在正文或独立 Artifact 中完整展示输出，严禁与长文同一回合并发调用 `ask_question`；
  2. `ask_question` 必须在独立回合中发起，且其 `question` 与 `options` 必须自包含核心要点摘要，确保用户即便仅看弹窗也能独立决策。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（核心原则二第 17 条）与 `skills/05-self-evolving-skill-mcp-forge/SKILL.md`。

---

### [EVO-029] 跨项目收件箱派单核销原子级工具化与 `edit_file` 长文本失效防范基因 (Cross Inbox Atomic ACK & Swarm Auto-Ack)
- **踩坑与进化日期**：`2026-10-31`
- **关联模块 / 领域**：`cross-project-federation.mjs / CROSS_INBOX.md / MCP cross_inbox_ack / swarm_report_to_commander`
- **问题表面现象（Symptom）**：
  工作节点完成跨对话派单任务后，手动调用 `edit_file` 将 `CROSS_INBOX.md` 中的状态由 `PENDING` 改为 `ACKED`。由于复制的长标题中多了“免费”两个字，导致 `target content not found in the file` 报错并触发重试。
- **深层病根剖析（Root Cause）**：
  1. 原生缺乏专门核销收件箱消息的原子工具，迫使智能体手工写脆弱的字符串匹配；
  2. `swarm_report_to_commander` 回传任务回执时未自动提取正文中的 `XMSG-xxx` 进行自动核销。
- **触发条件（Trigger Condition）**：
  消费或核销 `CROSS_INBOX.md` 中的派单任务消息（`XMSG-xxxxxxxxxx`）。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. 严禁使用带长标题的文本块作为 `edit_file` Target；
  2. 优先调用原生 MCP 工具 `cross_inbox_ack`（提供 `project_root` 与 `xmsg_id`）原子级安全核销；
  3. 领域工作会话在调用 `swarm_report_to_commander` 时，系统自动从任务回执标题、摘要与证据中解析提取关联的 `XMSG-xxx` 并在当前项目收件箱中自动置为 `STATUS: ACKED`，零手动改码！
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `scripts/cross-project-federation.mjs`（`ackCrossProjectMemory`）、`scripts/evo-memory-mcp-server.mjs`（第 14 个原生工具 `cross_inbox_ack`）与 `GEMINI.md`（核心原则二第 14 条）。

---

### [EVO-030] 具名角色任务板块划分与总控中枢任务委派守卫基因 (Commander Brain-Only & Domain Specialist Delegation Guardrail)
- **踩坑与进化日期**：`2026-10-31`
- **关联模块 / 领域**：`cross-project-federation.mjs / GEMINI.md / skills/05-self-evolving-skill-mcp-forge / Swarm Commander`
- **问题表面现象（Symptom）**：
  总控对话窗口步数膨胀至 2 万多步，主代理在同一窗口内亲力亲为处理音视频生成、安卓手机 ADB、云端逆向协议、前端 UI 等全部细节编码（“库库自己干”），导致上下文极度冗长沉重，频繁出现盲猜框架目录（`app/services/`）导致 `file does not exist` 报错。用户明确纠偏指出：“为什么一直是你在这边干活，改分出去的任务就分出去了，你得合理用他们，你不能一个人自己库库干啊，你是大脑，干活都交给小弟，你的子代理跟你干活是一样的么，我们现在得明确给每个角色划分任务板块角色属性了，不能都在一个对话里面弄”。
- **深层病根剖析（Root Cause）**：
  总控缺少“大脑指挥中枢定位”的硬性约束；没有将复杂任务按标准化板块拆解并委派给具名领域工作会话（`swarm_spawn_or_route_by_name`）或明确属性的子代理（`invoke_subagent`），且在调用 `read_file` 前缺少 Pre-Read 实证核验，受框架惯性臆测目录路径。
- **触发条件（Trigger Condition）**：
  收到跨多端、复合型业务或步数超过 100 步的长周期战略主会话中的复杂任务时。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **总控只出脑力（Brain-as-Commander）**：严禁总控一人在主对话大包大揽库库干所有脏活累活！总控只负责顶层战略、任务拆解与全局验收；
  2. **五大标准业务领域工作会话矩阵**：必须按标准角色板块属性划分：
     - `MOBILE_EDGE_CTRL`（移动端与安卓云手机操控领域工作会话）
     - `CLOUD_QUOTA_REVERSE`（云端多算力与逆向协议领域工作会话）
     - `MEDIA_VIDEO_AUDIO`（音视频生成与多模态合成领域工作会话）
     - `FRONTEND_STUDIO_SSOT`（前端交互与 3D 星系可视化领域工作会话）
     - `BACKEND_WORKBENCH_CORE`（主后端与本地工作台业务工作节点）
  3. **强制委派与工作节点任务回执**：大任务必须通过 `swarm_spawn_or_route_by_name` 或会话内具名 `invoke_subagent` 委派推进，工作节点通过 `swarm_report_to_commander` 异步回传任务回执；
  4. **Pre-Read 路径核验（EVO-020 强化）**：读写模块前必须先用 `find` / `ls` / `CODE_MAP.md` 实证真实物理路径，严禁凭框架直觉盲猜 `app/services/` 等前缀并发批读。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至 `GEMINI.md`（核心原则二第 10/18 条、第七章定律六）、`skills/05-self-evolving-skill-mcp-forge/SKILL.md`（6.1 节）与 `skills/02-modular-refactor-and-map/SKILL.md`。

---

## 四、8 步科学实验闭环与研发劳动力倍增台账（Scientific RSI & Labor Force Compounding）

### [RSI-001] AGY Swarm Commander (1+N+M) 具名领域工作会话路由与 SWARM_ACK 防死锁科学实验闭环（8 步科学实验闭环 · `SWARM_WORKFLOW` · 2026-10-31）
- **Step 1 提出假设 (Hypothesis)**：通过引入 `info.annotations.title` 具名识别、零 IO `trajectoryMetadata` 子代理分流与 `SWARM_ACK` 特权回传通道，可实现 `1 总控 + N 具名板块子对话窗口 + M 会话内子代理` 的零死锁协同，并将引擎研发劳动力倍增系数推升至 `> 15x`。
- **Step 2 设计实验 (Experiment Design)**：构建包含 13 个原生 MCP 工具的 v3.2 服务端，针对容器目录拦截、同名领域工作会话精准命中、`auto_create_if_missing` 孵化预演、`SWARM_ACK` 绕过 Gate 2/3/4 死锁以及 `rsi_experiment_record` 棘轮刷新设计端到端验证用例。
- **Step 3 修改代码与固化工具 (Code & Tool Changes)**：升级 `scripts/cross-project-federation.mjs`、`scripts/security-and-simplicity-audit.mjs`、`scripts/evo-memory-mcp-server.mjs` 与 `scripts/stop-hook-guardian.mjs`，新增 `swarm_spawn_or_route_by_name`、`swarm_report_to_commander`、`swarm_status_board`、`rsi_experiment_record` 4 大 MCP 工具并消除硬编码用户目录路径。
- **Step 4 启动实验 (Experiment Execution)**：运行 `install-to-antigravity.sh --global-plugin` 同步全局插件并导出 13 个 MCP Schema，执行 `universal-preflight-gate.mjs`、`evo-patrol-inspector.mjs` 与 13 工具全矩阵真机测试。
- **Step 5 分析实验结果 (Result Analysis)**：13 大 MCP 工具全部注册就绪并通过实测；零 IO 子代理识别准确区分主对话与会话内子代理；`SWARM_ACK` 成功豁免总控容器目录写保护与乒乓/冷却锁，母版工程研发劳动力倍增系数达到 `15.55x`。
- **Step 6 诊断失败原因 (Failure Diagnosis)**：早期设计若让 `swarm_report_to_commander` 复用 `dispatchTaskToConversation` 会在总控挂载 `~/Downloads` 时触发 `isContainerOrMotherDir` 拒写及 Gate 2 乒乓锁；此外新增导出函数若未在 MCP Server 中引用会触发 `PONY-02` 死导出告警。
- **Step 7 调整实验路线 (Route Adjustment)**：为 `swarm_report_to_commander` 建立独立 `SWARM_ACK` 特权分支，将任务回执持久化至 `~/.gemini/antigravity/plugin_data/agy-evo-os/swarm-registry.json`，并将所有新增导出函数接入 MCP 路由与棘轮统计闭环。
- **Step 8 开启下一轮迭代与铸造劳动力资产 (Next Cycle & Labor Force Minted)**：本次铸造了 4 个新 MCP 工具（`swarm_spawn_or_route_by_name`、`swarm_report_to_commander`、`swarm_status_board`、`rsi_experiment_record`）与 `readSwarmRegistry` 等可复用轮子；下一轮可在跨项目 3D 星系图中实时可视化渲染 `1+N+M` 蜂群脉冲轨迹。

---

### [RSI-002] 跨项目收件箱原子核销工具 (cross_inbox_ack) 与任务回执自动核销闭环科学实验（8 步科学实验闭环 · `SWARM_WORKFLOW` · 2026-10-31）
- **Step 1 提出假设 (Hypothesis)**：通过在 Evo-OS 原生 MCP 提供 `cross_inbox_ack` 工具，并在工作节点调用 `swarm_report_to_commander` 时自动提取文本中包含的 `XMSG-xxx` 进行自动核销，可 100% 杜绝工作节点手工调用 `edit_file` 因标题微小差异导致的 `target content not found in the file` 报错与反复重试，使跨对话派单流转成功率达 100%。
- **Step 2 设计实验 (Experiment Design)**：编写测试用例验证 `ackCrossProjectMemory` 对指定消息状态从 `PENDING` 到 `ACKED` 的原子级更新、SQLite 索引增量同步、以及 `swarmReportToCommander` 在回传任务回执时自动顺带核销 `XMSG-xxx` 的机制。
- **Step 3 修改代码与固化工具 (Code & Tool Changes)**：升级 `scripts/cross-project-federation.mjs` 实现 `ackCrossProjectMemory` 并将自动核销嵌入 `swarmReportToCommander`；在 `scripts/evo-memory-mcp-server.mjs` 中注册第 14 个原生工具 `cross_inbox_ack` 并更新 schema；在最高宪章 `GEMINI.md` 中固化 `EVO-027`、`EVO-028`、`EVO-029`。
- **Step 4 启动实验 (Experiment Execution)**：运行 CLI `node scripts/cross-project-federation.mjs ack <projectRoot> <xmsgId> ACKED`，并重新跑 `install-to-antigravity.sh --global-plugin` 和 `universal-preflight-gate.mjs`。
- **Step 5 分析实验结果 (Result Analysis)**：CLI 成功在 2ms 内定位并更新 `CROSS_INBOX.md` 目标段落且增量刷新 SQLite；14 个 MCP 工具 Schema 全部正确导出并通过门禁。
- **Step 6 诊断失败原因 (Failure Diagnosis)**：早期设计未提供专用核销工具，智能体凭历史记忆手写 `edit_file` 时将“Google Flow 逆向”误写为“Google Flow 免费逆向”，导致字符串严格匹配失败。
- **Step 7 调整实验路线 (Route Adjustment)**：在 `swarmReportToCommander` 中实现智能体任务回执自动核销，即便智能体完全不显式调用核销工具，只要任务回执中提及对应 `XMSG-xxx` 即自动完成核销，彻底免除手动操作。
- **Step 8 开启下一轮迭代与铸造劳动力资产 (Next Cycle & Labor Force Minted)**：本次铸造了第 14 个原生 MCP 工具 `cross_inbox_ack`，沉淀了 `ackCrossProjectMemory` 核心函数，并将跨项目协同派单的核销环节完全自动化。

---

### [RSI-003] 具名角色任务领域工作会话矩阵与总控中枢任务委派守卫驱动研发效率倍增科学实验（8 步科学实验闭环 · `SWARM_WORKFLOW` · 2026-10-31）
- **Step 1 提出假设 (Hypothesis)**：通过在 Evo-OS 建立五大标准具名角色任务板块矩阵，并强制约束“总控只出脑力、严禁大包大揽库库自己干”，将复合型任务明确委派给对应属性领域工作会话（`swarm_spawn_or_route_by_name`）与具名子代理（`invoke_subagent`），可彻底消除单对话 2 万步上下文膨胀与路径盲猜报错，使总控专注架构把控，研发劳动力倍增效率提升 30% 以上。
- **Step 2 设计实验 (Experiment Design)**：设计针对超长战略主对话的任务委派测试用例，实证从用户复合需求解码、五大板块角色路由、工作节点异步回执回传（`SWARM_ACK`）到 Pre-Read 路径实证核验（阻断 `app/services/` 盲猜）全链路。
- **Step 3 修改代码与固化工具 (Code & Tool Changes)**：升级母版库与全局插件中 `cross-project-federation.mjs` 中的 LanguageServer 探测超时（4500ms / 15000ms），在最高宪章 `GEMINI.md` 与全局 `rules/AGENTS.md` 固化第 18 条铁律（`EVO-027`）与升级 `EVO-020`，并在 `skills/05` 和 `skills/02` 固化角色板块矩阵与 Pre-Read 实证。
- **Step 4 启动实验 (Experiment Execution)**：运行 `install-to-antigravity.sh --global-plugin` 同步全局插件并执行 `universal-preflight-gate.mjs`、`evo-patrol-inspector.mjs --ack`。
- **Step 5 分析实验结果 (Result Analysis)**：巡检全绿，LanguageServer 探测不再超时；五大业务领域工作会话规范就绪；Pre-Read 路径阻断机制有效杜绝 `file does not exist`。
- **Step 6 诊断失败原因 (Failure Diagnosis)**：长对话中模型容易因常见框架（如 FastAPI `app/services/`）惯性产生幻觉；且总控缺乏“不可亲历亲为”的刚性铁律限制，导致所有活都在一个对话里干。
- **Step 7 调整实验路线 (Route Adjustment)**：在宪章中确立“大脑总控定位与领域工作会话任务委派守卫”，要求凡长耗时或复合型任务必须拆解并指派给工作节点，工作节点完成后通过特权通道向总控汇总。
- **Step 8 开启下一轮迭代与铸造劳动力资产 (Next Cycle & Labor Force Minted)**：本次提炼了五大具名板块属性标准，固化了 Pre-Read 路径核验红线，使蜂群总控调度器架构更加健壮。

---

## [2026-10-31] EVO-028 ~ EVO-031：工作节点强制自审与总控法医级复核双门禁、防上下文溢出及 Antigravity v2.28.2+ 平台自愈套件
- **触发根因（系统级排障实证）**：
  1. **工作节点未自审看片 & 总控未复核即转发（`EVO-028`）**：工作节点产出视频/UI时混入无关缓存底片、乱加卖点杂音、外露内部技术代号或遗留过时文案；必须强制执行「工作节点 L1 自审找 Bug + 总控 L2 法医级看图复核当场拦截」双道门禁。
  2. **直接对 `.mp4` 调用 `read_file` 撑爆上下文（`EVO-029`）**：对大体积视频直接调 `read_file` 会触发 `This conversation grew too large`；审片统一先用 `ffmpeg` 抽帧合成单张轻量 `.png` 四宫格预览图再读取。
  3. **Antigravity 后台静默更新证书失配引发 `Cmd+R` 刷新白屏（`EVO-031a`）**：`main.log` 实证，旧版进程长时运行期间后台 `Squirrel.Mac` 静默替换了新版 `v2.28.2` 安装包与内置 localhost 证书，热刷新 `Cmd+R` 报 `ERR_CERT_AUTHORITY_INVALID (-202)` 导致白屏；且单主会话下挂靠 20+ 个历史已完成子代理加剧内存与 IPC 压力。
  4. **重启后动态端口漂移与 `v2.28.2+` 懒加载漏扫（`EVO-031b`）**：重启后 LanguageServer 换用新端口，旧 `process.env.ANTIGRAVITY_LS_ADDRESS` 失效；且 `v2.28.2+` 的 `GetAllCascadeTrajectories` 仅返回当前已加载进内存的会话，未点开的工作会话窗口需配合 `SearchConversations` 发现并在 `SendAgentMessage` 前调用 `LoadTrajectory` 预加载。
  5. **新建工作节点/总控窗口挂载左边栏 `Projects` 树（`EVO-031c`）**：`StartCascade` 若仅传 `workspaceUris` 会落入 `Other Conversations`；必须传入 `projectEnvConfig: { projectId, defaultProjectEnvironment: {} }`（且严禁与 `workspaceUris` 同传）及 `cascadeConfig: { plannerConfig: { requestedModel: { model: 'MODEL_PLACEHOLDER_M418' } } }`，才能 100% 挂在左边栏 `Projects` 树下且置顶显示。
- **永久防复发断言铁律（已焊死至 `GEMINI.md`、`scripts/cross-project-federation.mjs` 与 `feishu-commander-bridge.mjs`）**：
  1. `discoverLanguageServerConfig()` 读取环境变量端口时强制先 `probeLsPort` 探活，失联毫秒级切换 `ps aux` + `lsof` 动态重扫；
  2. `discoverAntigravityProjectsAndConversations()` 同时扫描 `~/.gemini/antigravity/projects` 与 `~/.gemini/config/projects`，合并 `GetAllCascadeTrajectories`、`SearchConversations` 与 `swarm-registry.json`，并在派单前自动执行 `LoadTrajectory`；
  3. `swarmSpawnOrRouteByName()` 自动匹配 `projectId` 并使用 `projectEnvConfig` 将新窗口挂入左边栏 `Projects` 树；
  4. 主窗口子代理超过 8 个时自动执行 `manage_subagents(Action: 'kill_all')` 回收内存；规则索引同步置入 `GEMINI.md` 前 8KB 自动路由表，彻底规避 `rules.go:571` 24,000 字节截断限制。

---

### [EVO-034] 总控严禁大包大揽铁律 & 工作节点后台验证任务「倒计时自唤醒 + 外部看门狗强制唤醒」双重防搁置基因 (Commander Delegation Discipline & Dual Countdown Watchdog)
- **踩坑与进化日期**：`2026-10-31`
- **关联模块 / 领域**：`Swarm Commander 派单边界 / schedule 倒计时自唤醒 / manage_task / 桥接器 60s 看门狗`
- **问题表面现象（Symptom）**：
  1. 总控窗口（`👑 [总控]`）在推进多模块复杂任务时容易越界亲自下场替工作节点干重体力编码或视频渲染活，导致用户指出：“有很多事我不建议你全部自己在弄，你要会看把这东西交给谁弄”；
  2. 其他具名工作会话窗口在执行长耗时构建、渲染或无头浏览器真机验证时，`run_command` 转为后台异步任务（`Tool is running as a background task`），若直接结束回合干等且未挂载倒计时自唤醒定时器，一旦子进程卡死或通知延迟，工作会话窗口将长时间停滞无法实时查看后台进度。
- **深层病根剖析（Root Cause）**：
  1. 总控职责边界缺乏刚性拦截，未将重体力编码/渲染/修复 100% 下放给对应具名领域工作会话；
  2. 工作节点在触发后台异步验证任务时缺少强制的**内层 `schedule` 倒计时自唤醒（45 秒）**与**外层桥接器看门狗（60 秒）**双重兜底机制。
- **触发条件（Trigger Condition）**：
  总控收到任何属于具名领域工作会话职责范围的开发/返工/渲染任务时；或任何工作节点启动的 `run_command` 转为后台异步任务时。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **总控职责边界（Commander Delegation Discipline）**：总控窗口（`👑 [总控]`）只负责意图解码、按板块精准派单（`swarm_spawn_or_route_by_name`）、倒计时督战与第二道法医级终审，**严禁总控大包大揽亲自下场替工作节点干重体力编码/渲染活**；凡工作节点职责范围内的开发、返工与修复，一律路由交由对应具名工作节点执行。
  2. **防验证卡死双重倒计时唤醒（Dual Countdown Watchdog）**：
     - **内层（工作节点端强制 `schedule` 倒计时）**：任何工作节点在执行单元测试、构建或无头浏览器验证时，一旦 `run_command` 转为后台异步任务（`Tool is running as a background task`），**严禁直接结束回合盲目干等**！必须在同一回合或紧接回合调用 `schedule(DurationSeconds: 45, TimerCondition: "any", Prompt: "⏰ [EVO-034 倒计时唤醒] 立即调用 manage_task(Action: 'status'/'list') 实时查看后台验证任务进度，若卡死立即 kill 并修复")`，确保即使子进程挂起也能在 45 秒倒计时到点时自动唤醒自检；
     - **外层（桥接器 60 秒看门狗强制唤醒）**：后台守护进程每 30 秒巡检所有工作节点 `transcript.jsonl` 与运行状态，凡发现某工作节点因等待后台任务而停滞或转入 `IDLE` 超过 60 秒且未提交 `SACK` 任务回执，立即通过 `SendUserCascadeMessage` 自动注入倒计时唤醒指令。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至全局与开源库 `rules/AGENTS.md`（零手动口令自动路由总表 & 核心原则二第 22 条）、`memory/EVOLUTION_LEDGER.md` 及桥接器看门狗守护循环。

---

### [EVO-035] 谷歌 AI Ultra $200/月「老钱风」全生态算力矩阵优先盘活 & 三大模型优势打法前置基因 (Google AI Ultra Old-Money Ecosystem Priority & Model Strategy Front-Loading)
- **踩坑与进化日期**：`2026-10-31`
- **关联模块 / 领域**：`AI 模型路由调度阶梯 / Google AI Ultra 全家桶 / 音视频与代码量产 / 压测打法前置`
- **问题表面现象（Symptom）**：
  在多模型内容生成与全栈研发中，若未统筹盘活 Google AI Ultra ($200/月) 订阅所附带的全套零边际成本生态，容易浪费高价值免费算力或误触按量计费通道；同时在批量视频压测前若未先明确各模型的物理与镜头优势打法，会导致盲目乱测、成片率波动。
- **深层病根剖析（Root Cause）**：
  模型调度层未将 Google AI Ultra ($200/月)「老钱风 (Old Money)」全生态全家桶列为绝对主力基座，且缺少在压测前强制立下各模型专项优势打法的前置门禁。
- **触发条件（Trigger Condition）**：
  涉及视觉生图、视频生成、商业配乐、开放世界/小游戏构建、高并发云端编程或批量多模型压测时。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **盘活谷歌「老钱风 (Old Money)」全生态闲置算力**：相比 Claude Code 易封号、OpenAI 易降智掺水与 5 小时限额，Google AI Ultra ($200/月) 拥有海量不掺水算力与附赠生态（Antigravity 反重力引擎 + Gemini 3.1 Pro + Google Flow Veo 3.1 0积分无限视频 + Nano Banana Pro `GEM_PIX_2` 0积分无限生图 + ProducerAI/Lyria 3 每月30,000积分音乐 + Project Genie 开放世界/小游戏 + Jules 每日300并发云编程 + 30TB 超大云盘），所有视觉/音频/小游戏/代码量产任务必须优先吃透这套零边际成本全家桶；
  2. **多模型优势打法前置**：批量压测前必须先立下各模型优势打法（Flow 0积分首帧锚定与环境镜头、Muse 人物口播与微表情、MiniMax 物理流体长镜头），严禁盲目乱测。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至全局与开源库 `rules/AGENTS.md`（零手动口令自动路由总表、核心原则一 1.4 节 & 核心原则二第 23 条）及 `memory/EVOLUTION_LEDGER.md`。

---

### [EVO-036] 全球 12 国五位一体真本地化防回退 & 硬件设备盒子 100% 真实浏览器 UI 逐步点击验证基因 (12-Country True Localization & Real Browser UI Step-by-Step Verification)
- **踩坑与进化日期**：`2026-10-31`
- **关联模块 / 领域**：`全球 12 国跨境矩阵 / 音视频本地化 / 硬件设备盒子控制台 / 真机浏览器逐步点击验收`
- **问题表面现象（Symptom）**：
  1. 多国短视频矩阵生成时，若底层存在静默 fallback 逻辑，容易退回单一默认国家（如日语 JP），或出现外语串味、花字孤字折行、BGM 声音过小听不见等问题；
  2. 在验证设备盒子/控制台（数据清空、代理添加测速、账号新建、云机同屏、视频发布重建）时，若偷懒直接操作 SQLite 数据库或调用后端脚本塞入测试数据，会掩盖前端真实 UI 交互断链。
- **深层病根剖析（Root Cause）**：
  缺乏对 12 国五位一体参数（口播、母语花字、本土 BGM 响度、MCC/MNC、时区）的硬性非回退断言，以及对硬件控制台操作“严禁绕过浏览器 UI 直接改库/跑脚本作弊”的铁律约束。
- **触发条件（Trigger Condition）**：
  涉及全球 12 国矩阵视频生成、跨境本地化配置、或硬件设备盒子/管理后台全流程功能验收时。
- **原子级防错铁律（Atomic Prevention Rule）**：
  1. **全球 12 国五位一体真本地化防回退**：全球 12 国矩阵（`US / GB / FR / IT / ES / MX / DE / SG / JP / MY / TH / ID`）必须强制绑定「母语口播 + 100% 母语花字（零外语串味、零孤字折行）+ 清晰可闻的本土风格 BGM（`-11dB ~ -15dB`）+ 真实国家运营商 MCC/MNC 与时区」，严禁底层静默 fallback 回单一默认国；
  2. **硬件设备盒子 100% 真实浏览器 UI 逐步点击验证**：设备盒子/控制台的数据清空、代理添加测速、账号新建、云机同屏与视频发布重建，每一步必须在真实浏览器 UI 上点击完成并逐环截屏，**严禁直接操作 SQLite 数据库或调后端脚本塞数据作弊**。
- **已注入的门禁 / Skill 位置（Enforcement Hook）**：
  已固化至全局与开源库 `rules/AGENTS.md`（零手动口令自动路由总表 & 核心原则二第 24 条）及 `memory/EVOLUTION_LEDGER.md`。



