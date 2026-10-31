---
name: fullstack-atomic-guardrails
description: 全栈编码过程中的原子级防偷懒与防御性编程守卫总纲。在编写、重构或审查前端视图、前后端通信网关、后端业务逻辑、并发与容器/硬件调度、数据库存储及安全隐私代码时强制激活，确保零半成品、零静默崩溃、零并发竞态与零数据丢失。
---

# 全栈原子级防偷懒与防御性编程总纲（Fullstack Atomic Guardrails）

本技能定义了工业级全栈研发过程中的**原子级防御性编程标准**。任何代码编写、功能迭代、缺陷修复与架构重构，均须无条件遵循本总纲，彻底杜绝“仅跑通快乐路径（Happy Path）”、“写伪代码/TODO占位”、“静默吞掉异常”、“忽视并发竞态”与“破坏性数据变更”等工程偷懒行为。

---

## 一、 核心使命与反偷懒铁律（Zero-Lazy Engineering）

1. **严禁只写 Happy Path**：每一个异步调用、I/O 读写、外部接口请求、资源分配，必须同时编写正常分支、边界分支、降级分支与异常兜底分支。
2. **严禁半成品与占位符交付**：禁止在交付代码中遗留未实现的 `TODO`、`FIXME`、硬编码 Mock 数据、空 `catch () {}` 块或仅打印日志却不向上传递/处理的伪异常处理。
3. **契约先行，端到端闭环**：修改任何一端（数据库字段、后端 DTO、接口路由、前端状态）时，必须同步追溯并更新全链路关联方，确保全栈契约 100% 严丝合缝。
4. **Cloudflare `security-audit` 边界威胁扫描与 `.env.example` 契约对齐（v3.0 升级）**：凡涉及环境变量、鉴权、外部命令调用或新增配置项，必须自动调用 MCP `security_simplicity_audit`（或运行 `scripts/security-and-simplicity-audit.mjs`），确定性拦截前端 `NEXT_PUBLIC_/VITE_/REACT_APP_` 敏感密钥暴露（`SEC-01`）、硬编码私钥（`SEC-02`）、Shell 命令拼接注入（`SEC-03`）、JWT 弱默认密钥回退（`SEC-04`）及 `.env.example` 未同步声明（`DRIFT-01`）。

---

## 二、 前端工业级防御标准（Frontend Guardrails）

### 2.1 UI 五态齐全契约（Five-State Completeness）
任何涉及异步数据获取或用户交互提交的视图组件，必须完整实现以下五种状态，缺一不可：
- **Loading（加载态）**：首屏或局部拉取数据时，必须提供骨架屏（Skeleton）或局部加载指示器，防止页面布局抖动（CLS）或白屏闪烁。
- **Empty（空状态）**：当返回列表为空或搜索无匹配结果时，必须渲染语义清晰的空状态插画/提示文案，并提供引导操作按钮（如“新建条目”或“重置筛选条件”），严禁展示空白区域或表头孤岛。
- **Error（人话报错态）**：当请求失败或渲染异常时，必须捕获错误并转化为用户可理解的中文提示（附上重试按钮或排查建议），严禁直接向用户暴露原始堆栈信息、`undefined`、`[object Object]` 或 HTTP 原始状态码英文。
- **Partial（部分成功降级态）**：当聚合页面或多模块并发请求中部分接口失败、部分成功时，必须实施局部错误边界（Error Boundary）隔离；正常模块照常渲染交互，失败模块独立显示降级提示与局部重试按钮，严禁因单一非核心数据失败导致整页崩溃。
- **Submitting（防抖锁死态）**：任何表单提交、危险操作确认或异步触发按钮，在点击瞬间必须立即进入 `loading/disabled` 锁死状态，直至请求完成或失败返回，从根源上杜绝双击/连击引发的重复提交。

### 2.2 弹窗、抽屉与浮层生命周期清理（Lifecycle Cleanup）
- **副作用彻底卸载**：组件卸载（Unmount）或弹窗/抽屉关闭时，必须清理所有 `setInterval`、`setTimeout`、`requestAnimationFrame`、全局 `window/document` 事件监听器、ResizeObserver/IntersectionObserver 以及未完成的订阅流。
- **表单与脏状态重置**：弹窗再次打开或关闭时，必须显式重置表单校验残留状态、临时上传队列与内部错误横幅，禁止将上一次打开的残余数据带入下一次交互。
- **交互关闭一致性**：明确处理按下 `ESC` 键与点击背景遮罩（Mask）的行为；当弹窗处于 `Submitting` 状态或存在未保存的核心脏数据时，必须拦截遮罩点击与 `ESC` 误触关闭，或弹出二次确认提示。

### 2.3 异步请求代际防串台锁（Generation Token & AbortController）
- **竞态防串台（Race Condition Guard）**：在切换标签页、快速输入搜索词、快速翻页或切换详情对象时，必须使用 `AbortController` 主动取消上一代未完成的请求，或维护单调递增的请求代际令牌（`requestGenerationId`）。
- **过期响应丢弃**：响应返回时必须校验当前代际令牌是否等于最新发起的令牌；若不一致，说明该响应属于已过期的历史请求，必须静默丢弃，严禁覆盖最新视图状态。

### 2.4 局部状态无感刷新（Zero-F5 Seamless Refresh）
- **免 F5 状态同步**：增、删、改、状态切换操作成功后，必须通过局部状态更新（State Mutation）、缓存失效重取（Query Invalidation）或增量合并更新当前列表与详情视图，严禁要求用户手动刷新浏览器（F5 / `location.reload()`）才能看到最新结果。
- **分页边界自适应**：当删除当前分页最后一条记录时，前端列表应自动回退至上一页（若页码 > 1）并重新拉取数据，避免停留在空白页码。

### 2.5 视觉呈现、落盘验真、路径防盲猜与精确微靶向修改（Visual Proof, Assertion, Path Verification & Targeted Edits）
- **真机截屏留证**：任何前端视图、UI 交互逻辑或多模态生成/看图功能的真机测试，必须自动截取真实渲染画面保存为图片（如 `<PROJECT_ROOT>/tests/screenshots/`），并在测试总结中提供可点击的截图链接或图片展示。
- **杜绝文字报喜**：严禁仅凭后端打印日志或文字描述宣称“UI已正常展示”，必须提供看得见、摸得着的渲染截图作为铁证（严格执行 `EVO-009`）。
- **产物生成查验绝对串行**：凡通过命令或脚本生成新文件（截图、图标、导出文件），绝对禁止在同一 step 内与生成命令并发调用 `read_file` 预读；必须等生成命令成功执行并退出码为 0、文件真实写盘后，在下一个独立 step 中再调用 `read_file` 查验（严格执行 `EVO-010`，杜绝 `file does not exist` 报错）。
- **生成产物落盘验真断言（Post-Generation Assertion）**：对于任何由自定义脚本动态生成的文件（如截图、转换图标、打包包体），在后续步骤调用 `read_file` 之前，必须在命令返回中显式断言目标文件落盘成功（如脚本打印确认日志、或运行 `test -f <file>` / `ls -la <file>`）；若生成涉及 macOS AppKit 图标渲染，严禁在无头 CLI 环境中调用已废弃且需依赖视图焦点的 `initWithFocusedViewRect:`，应使用 `[icon TIFFRepresentation]` 搭配 `NSBitmapImageRep` 或 macOS 内置 `sips -s format png` 无头导出，杜绝静默写盘失败（严格执行 `EVO-011`）。
- **存量老项目与陌生模块路径实证（Strict Path Verification，`EVO-020`）**：在对存量或大型项目调用 `read_file` / `view_file` / `edit_file` 时，绝对禁止凭经验直觉臆测子目录或组件文件名（如猜 `src/components/layout/Sidebar.tsx`、`lib/workflow/gates.mjs`）；必须先查阅项目的 `memory/CODE_MAP.md`、或使用轻量探测命令（`find` / `ls -la` / `git ls-files`）验证相对路径确实存在后方可读取，彻底杜绝 `file does not exist` 报错。
- **`edit_file` 最小特征锚点微靶向替换（Minimal Unique Anchor Principle，`EVO-019`）**：调用 `edit_file` 修改代码或长文档时，Target 必须来自最近一次通过 `read_file` 读取的真实源码行，严禁凭历史上下文或多项目交接记忆盲写；Target 长度严格限制在待改行及其前后 1~2 行唯一特征上下文（3~10 行以内最佳），严禁一次性将跨多个子章节的数十上百行超大区块作为单一 Target 替换；若改动分散在多处，必须分多次独立调用 `edit_file` 依次精准替换，彻底杜绝 `target content not found in the file` 报错。**特别注意**：核销 `memory/CROSS_INBOX.md` 消息状态时，严禁使用长标题作为 Target，必须优先调用原生 MCP 工具 `cross_inbox_ack` 或在 `swarm_report_to_commander` 汇报中回传 `XMSG-xxx` 自动核销；若手动编辑，Target 严格限定于 `### [XMSG-xxxxxxxxxx]` 及其下一行的状态行。
- **非纯 UTF-8 文本与外部数据文件安全预检（Non-UTF8 Text & External Data File Pre-check，`EVO-025`）**：当读取外部账单、从系统导出的 CSV/TSV/日志等非标准文本文件时，若文件含有特殊编码（如 Windows-1252、乱码或非标准字节），内置 `read_file` 工具会将其误判为 binary file (`application/octet-stream`) 并直接抛错。严禁在此类报错后反复盲目重试 `read_file`；必须立即改用 shell 命令（例如 `python3` 配合 `errors='replace'` / `latin1` 容错解码、或 `head` / `awk` / `grep` / `iconv`）进行安全探查与结构化提取。

---

## 三、 前后端通信与网关标准（Network & Gateway Guardrails）

### 3.1 严格接口契约对齐（Strict Contract Alignment）
- **字段名与类型强一致**：前后端请求参数（Query/Path/Body）与响应载荷（Payload）的命名风格、嵌套结构、枚举值集合、时间格式（统一 ISO-8601 UTC 或毫秒时间戳）必须严格对齐。
- **空值与可选字段防御**：后端返回数组类型字段时，若无数据必须返回空数组 `[]` 而非 `null`；前端解构深层对象时必须使用可选链（`?.`）与空值合并（`??`）进行兜底。

### 3.2 标准 HTTP 状态码语义与零未捕获 500（Semantic HTTP Status Codes）
后端必须严格按照语义返回标准 HTTP 状态码，并配合统一的业务错误码（`code`）、人类可读消息（`message`）与请求追踪 ID（`requestId`）：
- `200 OK` / `201 Created`：业务处理成功，严禁在 HTTP 200 中塞入系统级崩溃异常。
- `400 Bad Request`：请求参数缺失、格式非法、Schema 校验失败，须明确指出具体违规字段。
- `401 Unauthorized`：未登录、Token 缺失、签名无效或凭证已过期，前端网关层统一拦截并引导重新认证。
- `403 Forbidden`：已认证但当前角色/账户无权访问目标资源或执行该操作。
- `404 Not Found`：请求的目标实体、路由或关联资源不存在。
- `409 Conflict`：资源唯一性冲突（如重名）、乐观锁版本冲突或当前状态机不允许执行该流转（如对运行中任务执行非法重复启动）。
- `429 Too Many Requests`：触发接口限流或并发配额上限，响应头应携带 `Retry-After` 提示。
- `503 Service Unavailable`：下游依赖服务、硬件资源池或外部网关暂时不可用，提示客户端稍后重试。
- **严禁未捕获 500**：全局异常过滤器（Global Exception Handler）必须兜底所有未预期异常，记录完整上下文日志与 `requestId`，向客户端返回脱敏后的标准错误结构，严禁直接抛出裸堆栈或导致进程退出。

### 3.3 长连接心跳保活与看门狗自动降级（Long-Connection Resilience）
- **双向心跳保活（Heartbeat）**：WebSocket、WebRTC DataChannel、SSE（Server-Sent Events）连接必须实现应用层双向 `ping/pong` 心跳检测机制，及时识别半开连接（Half-open Connection）与静默断连。
- **看门狗（Watchdog）与指数退避重连**：客户端必须内置看门狗定时器；一旦超过阈值未收到服务端心跳或数据帧，立即判定连接失活，主动销毁旧实例并按指数退避（Exponential Backoff + 随机抖动 Jitter）发起重连。
- **优雅降级通道**：当长连接连续重连失败达到上限或网络环境受阻（如企业防火墙拦截升级握手）时，必须支持自动降级为短轮询（Polling）或提示网络受限状态，恢复后自动切回实时通道。

### 3.4 同源代理穿透与网关配置（Same-Origin Proxy & Gateway）
- **消除跨域隐患**：开发环境与生产环境优先通过反向代理（Reverse Proxy）实现前后端 API 及 WebSocket 同源穿透；确保代理层正确配置 `Upgrade`、`Connection`、`X-Forwarded-For`、`X-Real-IP` 及流式传输所需的 `buffering off` 与超时参数。

---

## 四、 后端、并发与硬件/容器调度标准（Backend, Concurrency & Resource Guardrails）

### 4.1 RBAC 角色权限强隔离与越权防御（RBAC & BOLA Defense）
- **后端强制鉴权**：前端路由隐藏或按钮禁用仅作为体验优化，后端每一个 API 端点必须通过中间件/守卫独立验证用户身份与 RBAC 角色权限。
- **对象级所有权校验（防水平越权/IDOR）**：任何按 ID 查询、修改、删除、启停资源的接口，必须在 SQL/ORM 查询条件中强制带上当前租户/用户所属权过滤（如 `WHERE id = ? AND owner_id = ?`），严禁仅凭客户端传入的资源 ID 直接操作数据。

### 4.2 资源池互斥锁与死锁超时自动破拆（Mutex Lock & Lock TTL）
- **并发临界区互斥**：对有限硬件设备、容器实例、GPU/算力卡、文件句柄或账户余额等共享资源进行分配与状态流转时，必须使用互斥锁（进程内 Mutex 或分布式锁）保护临界区，防止并发超卖或双重占用。
- **锁超时自动释放（Lock TTL）**：任何锁获取操作必须设置最大持有时间（TTL）与获取等待超时（Acquire Timeout），严禁使用无限期阻塞锁。
- **死锁看门狗自动破拆**：必须配备后台巡检/看门狗任务，定期扫描处于“分配中/停止中/处理中”超过最大合理时限的僵尸锁与卡死状态机，自动执行锁破拆、资源回收与状态回滚，并记录告警日志。

### 4.3 运行态配置热同步（Runtime State Hot-Sync）
- **库表与运行态强一致**：当修改数据库中的资源配置、网络策略、限流阈值、调度参数或任务状态时，必须同步触发运行中容器、守护进程或硬件设备的配置热重载（Hot Reload）或信号通知。
- **两阶段状态对齐**：若运行态同步失败，必须回滚数据库变更或将该资源标记为“待同步/同步异常（Out-of-Sync）”并提供一键重同步补偿机制，严禁出现“数据库显示已修改成功，但实际运行的容器/设备仍在使用旧配置”的静默割裂。

### 4.4 外部第三方 API 零信任防御（Zero-Trust External Integration）
- **硬超时控制（Hard Timeout）**：调用任何外部 HTTP/gRPC 接口、大模型服务、对象存储或硬件网关时，必须显式设置连接超时（Connect Timeout）与读取超时（Read Timeout），严禁使用默认无超时的客户端配置。
- **重试退避与熔断（Retry & Circuit Breaker）**：仅对网络抖动或幂等接口的 `429/502/503/504` 错误实施带抖动的指数退避重试；当下游持续故障时触发熔断器快速失败，防止雪崩耗尽本服务线程池。
- **负向缓存（Negative Cache）**：针对高频查询但外部确认不存在的资源或短期不可达的状态，必须写入短 TTL 的负向缓存，防止外部接口被穿透打挂。
- **外部响应强校验**：严禁盲目信任第三方返回的 JSON 结构，解析前必须做 Schema 校验与字段空值防御。

### 4.5 异步与后台任务状态感知与防盲目中断（Background Task & Handle Hygiene，`EVO-021`）
- **状态感知先行（Status Verification First）**：对于智能体自身触发的后台命令或系统异步子任务，严禁在未确认状态前盲目调用终止/清理操作（如 `manage_task(Action: 'kill')`）；必须先通过状态列表接口（如 `manage_task(Action: 'list')`）确认任务确实仍处于 `RUNNING` 状态，防止短耗时任务已自行正常完成退出而触发系统异常（如 `cannot kill task: task is not running (status: DONE)`）。
- **信任响应式唤醒（Reactive Wakeup）**：宿主环境原生支持事件驱动与响应式唤醒，后台任务完成时会自动向智能体发送高优先级系统通知唤醒，无需盲目高频轮询或提前杀进程；非异常/死循环任务绝不允许在同一 turn 内盲目 kill。

### 4.6 本机文件与二进制逆向探查避免直接触发沙盒阻断（In-Process Stream over External Debugger，`EVO-023`）
- **进程内数据流解析优先（In-Process Native Parsing）**：严禁直接通过终端调用裸 `objdump` / `nm` / `lldb` 等敏感调试 CLI 探查宿主 App 安装目录或受限系统路径，此类命令极易触发平台 `permission check failed for unsandboxed` 拦截；凡涉及二进制头部、Go 运行时符号表、压缩格式或系统配置分析，必须在 Node.js / Python 进程内通过只读文件流（如 `fs.readFileSync` 配合 Buffer / Struct）直接按协议结构解析，既免依赖、高效率，又杜绝沙盒权限报错。

### 4.7 工业级 AI 模型多层额度路由与熔断调度阶梯 (Multi-Model Quota Priority & Fallback Ladder)
- **四层额度优先调用阶梯**：
  - **Tier 0（散落网站/逆向免费额度通道绝对优先）**：在 AI 网关、视频/文本生成与多渠道路由中，优先调度与消耗散落在不同网站应用中的逆向免费额度（例如 Google Flow aisandbox 零积分逆向直连、ChatGPT Plus 逆向渠道——**特别提醒：Plus 用户全系高级模型均可调用，严禁误判不支持**），实现零成本高并发运行；
  - **Tier 1（自建本地/内网轻量引擎兜底）**：本地轻量模型服务兜底；
  - **Tier 2（官方付费 API 严格熔断防偷跑）**：官方 Vertex AI / OpenAI 收费 API 严格作为 Tier 0 报错或额度耗尽时的最终熔断后备，且必须带熔断开关与预警机制，**严禁在未获用户显式授权时静默偷调付费接口**。

---

## 五、 数据库与存储标准（Database & Storage Guardrails）

### 5.1 零丢数无损迁移（Zero-Data-Loss Migration）
- **严禁破坏性语句**：在生产与演进代码中，严禁执行 `DROP TABLE`、`TRUNCATE TABLE`、`DROP COLUMN`（未完成双写过渡前）或开启自动销毁重建表的同步选项（如 `synchronize: true` / `auto-drop`）。
- **增量兼容演进**：所有表结构变更必须通过版本化迁移脚本（Migration）执行增量 `ALTER TABLE`；新增字段必须包含默认值（`DEFAULT`）或允许为空（`NULL`），确保新旧版本代码滚动发布期间双向兼容。

### 5.2 写操作事务原子性（Transactional Atomicity）
- **多表写必用事务**：任何涉及两张及以上数据表的写入、状态扣减与流水记录、主从表级联更新，必须包裹在数据库事务（Transaction）中，确保全部成功或全部回滚。
- **禁止事务内长耗时 I/O**：严禁在数据库事务开启期间执行外部网络请求、文件上传下载或容器启停等慢速 I/O 操作，防止长事务锁表拖垮数据库连接池。

### 5.3 初始化与重试接口 100% 幂等性（100% Idempotency）
- **启动初始化幂等**：系统启动脚本、数据库建表/索引迁移、默认管理员与种子数据写入（Seed Data），必须采用 `CREATE IF NOT EXISTS` 或 `INSERT ... ON CONFLICT DO NOTHING / UPSERT` 逻辑；无论服务重启多少次，均不会报错或产生重复脏数据。
- **写接口幂等保护**：创建订单、派发任务、触发流水线等核心写接口，必须支持幂等键（`Idempotency-Key`）或业务唯一索引约束，确保网络重试时只产生一次实际副作用。

### 5.4 老数据读取默认值兜底（Legacy Data Fallback）
- **向后兼容读取**：新增配置项或扩展 JSON 字段后，读取历史存量记录时必须通过反序列化默认值合并（Deep Merge with Defaults）补齐缺失字段，严禁因老数据缺少新字段而引发空指针崩溃（NPE / TypeError）。

### 5.5 临时文件与磁盘/内存定期垃圾回收（Storage & Memory GC）
- **临时文件即用即删**：文件导出、压缩包生成、视频/图像转码、分片上传产生的临时文件，必须在 `finally` 块中立即清理；同时配置后台定时 GC 任务清理超过保留期限的孤立临时文件与孤儿附件。
- **内存缓存有界化**：任何进程内缓存（Map/Dict）必须设置最大容量上限（LRU/LFU）与过期时间（TTL），严禁无界追加导致内存泄漏（OOM）。

---

## 六、 安全与隐私底线（Security & Privacy Baseline）

### 6.1 敏感凭证脱敏与零硬编码（Credential Sanitization）
- **严禁硬编码密钥**：源码、前端打包产物与 Git 历史中严禁硬编码数据库密码、API Secret、私钥或内部令牌；一律通过环境变量或密钥管理服务注入，并在启动时校验必填项。
- **全链路输出脱敏**：API 响应、系统日志、错误上报与前端控制台中，密码哈希、Salt、Token、身份证号、手机号、密钥等敏感字段必须在序列化层强制剥离或掩码脱敏（如 `sk-****1234`）。

### 6.2 防注入与防路径穿越（Injection & Traversal Defense）
- **参数化查询**：所有数据库查询必须 100% 使用参数化预编译语句（Prepared Statements）或安全 ORM 绑定，严禁字符串拼接 SQL。
- **防命令注入与 SSRF**：调用系统命令必须使用参数数组形式（如 `execFile` / `subprocess.run([...], shell=False)`）并严格校验白名单；外部 URL 请求必须校验协议与目标 IP，拦截指向内网元数据地址（如 `169.254.169.254`、`127.0.0.1`）的 SSRF 攻击。
- **防路径穿越（Path Traversal）**：处理用户上传文件名或下载路径参数时，必须使用 `path.basename` 提取纯文件名，并通过 `path.resolve` 校验最终真实路径是否严格位于允许的根目录前缀之下，拦截 `../` 越界访问。

### 6.3 删除前关联引用检查（Referential Integrity before Delete）
- **前置引用校验**：执行删除操作（如删除角色、模板、镜像、节点、分类）前，必须先检查是否存在运行中的任务、子资源或业务单据正在引用该实体；若存在活跃引用，必须拒绝删除并返回 `409 Conflict` 及具体占用详情，严禁直接硬删除产生悬空外键（Dangling Reference）。
- **高危删除审计**：核心业务数据优先采用软删除（`deleted_at` 时间戳 + 唯一索引兼容处理），并记录操作人、操作时间与客户端 IP 审计日志。

---

## 七、 强制自检执行流（Mandatory Self-Check Workflow）

在完成任何功能模块编码或提交代码审查前，必须打开并逐条对照本技能配套的核对表进行原子级验收：
- 核对表路径：[references/atomic-checklists.md](file://~/.gemini/config/plugins/agy-evo-os/skills/03-fullstack-atomic-guardrails/references/atomic-checklists.md)
- 发现任何一项未满足时，必须立即在当前编码周期内补齐防御逻辑，严禁带病流转至下一阶段。
