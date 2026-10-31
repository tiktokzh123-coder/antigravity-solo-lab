# 🌌 Solo Lab · 单人实验室 (`antigravity-solo-lab`)

> **专为 【Google Antigravity（谷歌反重力引擎 IDE）】 深度打造的全栈自进化智能体工作台与 `1+N` 多窗口并发底座**  
> **零基础小白手机飞书发语音/甩截图直接遥控家里电脑 · 技术极客 `1+N` 多窗口 RPC 并发沙盒 · SQLite WAL 强事务与 256 维向量记忆 · 3D 代码知识星系 (`CODE_GRAPH_3D.html`) · 内部 `≥92 分` 双盲对抗自检**

[![Platform: Google Antigravity IDE](https://img.shields.io/badge/Target_IDE-Google_Antigravity_(%E8%B0%B7%E6%AD%8C%E5%8F%8D%E9%87%8D%E5%8A%9B%E5%BC%95%E6%93%8E)-2563eb?style=for-the-badge)](./rules/AGENTS.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg?style=for-the-badge)](./LICENSE)
[![MCP Tools](https://img.shields.io/badge/Native_MCP_Tools-14_Engines-06b6d4?style=for-the-badge)](./scripts/evo-memory-mcp-server.mjs)
[![Dual Blind QA](https://img.shields.io/badge/Dual_Blind_QA-%E2%89%A592_Score_Pass-f43f5e?style=for-the-badge)](./rules/AGENTS.md)

**[🇨🇳 中文文档](./README.md) | [🇺🇸 English Documentation](./README.en.md) | [🚀 GitHub 发布与全平台宣发指南](./GITHUB_RELEASE_GUIDE.md)**

---

## 🎬 顶部内嵌播放：《No.44 · 字符剧场 × 单人实验室》第一人称介绍片（86 秒有声版）

> 💡 **GitHub 原生内嵌视频播放说明**：
> - **GitHub 支持在 `README.md` 顶部直接内嵌播放 `.mp4` 视频（带进度条与声音，无需跳转外链）**！
> - 本仓库已为您准备好体积仅 **`4.62 MB`**（远低于 GitHub 免费账号 `10 MB` 视频内嵌上限）的高清秒开版视频 [`showcase/solo_lab_character_theater_fast.mp4`](./showcase/solo_lab_character_theater_fast.mp4) 以及 **`2K 60fps` 原画母带版** [`showcase/solo_lab_character_theater_2k.mp4`](./showcase/solo_lab_character_theater_2k.mp4)。
> - **在 GitHub 网页端激活顶部原生播放器只需 5 秒**：打开仓库首页点 `Edit README` -> 将本地 [`showcase/solo_lab_character_theater_fast.mp4`](./showcase/solo_lab_character_theater_fast.mp4) 直接拖入下方视频占位行 -> GitHub 会自动生成 `https://github.com/user-attachments/assets/...` 原生播放器链接，任何人点进仓库第一眼即可直接播放！

<video src="./showcase/solo_lab_character_theater_fast.mp4" controls preload="metadata" width="100%"></video>

- ▶️ **[点击直接播放 / 下载《字符剧场 · 单人实验室》高清秒开版 (`1080p · 4.62 MB`)](./showcase/solo_lab_character_theater_fast.mp4)**
- 🎞️ **[点击直接播放 / 下载《字符剧场 · 单人实验室》2K 60fps 超清母带版 (`2560×1440 · 21.79 MB`)](./showcase/solo_lab_character_theater_2k.mp4)**

---

## ⚠️ 核心定位、运行环境要求与跨工具适配边界（必读）

**Solo Lab（单人实验室）不是普通的提示词模板，而是专为 【Google Antigravity（谷歌反重力引擎 IDE）】 量身定制的工业级本地自进化扩展系统**（默认挂载于 `~/.gemini/config/plugins/agy-evo-os` 与 `~/.gemini/antigravity/`）。

### 1. 为什么专门基于 Google Antigravity（谷歌反重力引擎）打造？
**Google Antigravity** 背靠 **Google AI Ultra** 旗舰算力体系（原生支持 `Gemini 4 Argon`、Flow `Veo 3.1 Lite` 0积分生视频、生图全系 0积分、`Gemini Omni` 低成本多模态、`Jules` 300并发异步编程、`$1,000` 开发者云赠金与每月 `$100` API 额度，算力充沛且稳定）。但**原生反重力引擎缺少三块关键拼图**，而 **Solo Lab** 正好把这三块拼图全部补齐：
1. **补齐「Clawdbot 式」手机远程遥控**：原生反重力只能坐在电脑前敲键盘；安装 Solo Lab 后，出门在外或躺在床上用**手机飞书发条语音或甩张截图**，免公网 IP 直连唤醒家里电脑上的反重力引擎干活。
2. **补齐「Milvus 式」跨窗口永久向量记忆与 3D 图谱**：原生反重力多开窗口容易互相失忆；Solo Lab 内置 **SQLite WAL 强事务状态机 + FTS5 倒排 + 递归 2 跳图谱 + 256 维稠密向量库**，任务第 0 秒自动召回历史防坑规则与 `VETO` 否决项，并生成 **3D 交互式代码星系 (`CODE_GRAPH_3D.html`)**，3 秒算清 2 跳修改爆炸半径。
3. **补齐「Claude Code 式」`1+N` 多窗口自治与 `≥92 分` 双盲自检闭环**：通过深度调用谷歌反重力引擎底层 `LanguageServerService` ConnectRPC 接口（`StartCascade` / `SendUserCascadeMessage` / `LoadTrajectory`），实现 **1 个总控会话自动孵化并调度 N 个独立领域工作窗口并行开发**，且内部自带「生成组 vs 挑刺组」真机浏览器点击实测，**低于 90 分自动打回重做，满 92 分才推送到手机飞书**。

### 2. 环境要求与跨工具适配边界一览表

| 运行宿主环境 | 适配等级 | 可使用的核心功能范围 | 明确受限/不可用的功能说明 |
| :--- | :---: | :--- | :--- |
| **🟢 Google Antigravity IDE**<br>（谷歌反重力引擎桌面端 · **官方唯一满血宿主**）<br>`macOS` / `Linux` + `Node.js ≥ 20` | **100% 满血完全体** | ✅ **全部 14 大原生 MCP 引擎**<br>✅ **`1+N` 多窗口 RPC 自动建窗、跨窗派单唤醒与 `85MB` 容量超水位 3 秒无缝热轮转**<br>✅ **手机飞书免公网双向语音/截图遥控直连总控窗口**<br>✅ **IDE 右侧栏原生 3D 代码星系 (`code_galaxy_3d` Sidecar) + 6 大项目级隔离活体记忆 + `≥92 分` 双盲自检** | 无任何受限，开箱即享 `14.8x` 实测效率倍增。 |
| **🟡 其他支持 MCP 协议的 AI 编程工具**<br>（如 `Claude Code`、`Cursor`、`Windsurf`、`Cline`） | **约 60% 基础兼容** | ✅ 标准 Stdio 协议的 **SQLite WAL + FTS5 + 256 维向量混合记忆检索引擎** (`memory_recall_for_task` / `memory_rebuild_index`)<br>✅ **3D 代码知识星系与 2 跳爆炸半径生成** (`code_graph_blast_radius` / `CODE_GRAPH_3D.html`)<br>✅ **Ponytail 脱水棘轮与安全边界审计** (`security_simplicity_audit`)<br>✅ **5 大全栈工程 SOP 技能规范 (`skills/`)** | ❌ **不支持 `1+N` 自动跨窗口孵化与唤醒**（因 `swarm_spawn_or_route_by_name` 与 `cross_conversation_dispatch` 强依赖谷歌反重力引擎专有的 `Cascade` gRPC/ConnectRPC 本地端口协议）<br>❌ **不支持飞书桥接器自动创建/热切换反重力会话窗口** |

### 3. 硬件与系统基础依赖
- **必需环境**：
  1. 已安装并登录 **[Google Antigravity IDE（谷歌反重力引擎）](https://idx.google.com/)**（推荐开启 Google AI Ultra 订阅以盘活 `Gemini 4 Argon` 与零积分多模态算力）；
  2. **操作系统**：`macOS 13+`（完整支持 APFS 磁盘水位守护、免 TCC 弹窗巡检与本机 `/usr/sbin/sendmail` 邮件提醒）或 `Linux`；
  3. **运行时**：`Node.js ≥ 20.0.0`（推荐 `v22+`）与 `Python 3.10+`；
- **可选依赖**：
  - `ffmpeg`（用于宣传片渲染与视频抽帧自检）；
  - 飞书开放平台企业自建应用 `FEISHU_APP_ID` + `FEISHU_APP_SECRET`（开启 WebSocket 长连接模式，无需公网 IP 或内网穿透即可用手机飞书遥控）。

---

## 👥 双人群 3 分钟看懂怎么用：零基础小白 vs 技术极客

### 🗣️ 一、 我是「零基础小白 / 创作者 / 独立老板」：怎么用它？
你**完全不需要记任何代码命令**，只需要把 **Solo Lab** 安装进你的谷歌反重力引擎，它就能把你的电脑变成一支 **24 小时待命的全自动代工研发团队**：
1. **手机发条语音或甩张截图直接下达任务**：出门喝咖啡或睡前躺在床上，打开手机飞书，像聊微信一样发条语音（比如：*“帮我照着这张截图做个产品展示网页”* 或 *“帮我改一下宣传片里的字幕大小”*），家里电脑上的谷歌反重力引擎会自动被唤醒开始干活。
2. **后台自己写代码、自己打开真机浏览器测试**：系统不会拿半成品和满屏报错来烦你。它会自己在后台拆解步骤、写代码、启动真实无头浏览器点击按钮并截屏检查排版。
3. **内部「生成组 + 挑刺组」满 92 分才交活**：内部挑刺组发现字太小、按钮点不动或画面穿帮（低于 `90 分`）会当场打回重做；只有拿到 **`≥92 分`** 的合格产物，才会连同预览图和成片一起推送到你的手机飞书与邮箱。

### 🛠️ 二、 我是「技术极客 / 全栈架构师」：怎么用它压榨工程极限？
对于重度 Vibe Coder 与全栈工程师，**Solo Lab** 彻底根治了传统单窗口 AI 编程的「跨窗失忆、改 A 崩 B、上下文撑爆卡死、半成品盲交」四大顽疾：
1. **`1+N+M` 双层并发拓扑与零体力活总控协议**：
   - **1 个总控窗口 (`Orchestrator`)**：严禁亲自写业务代码、严禁跑耗时阻塞命令、严禁连读大文件；只负责意图对齐、`≤50 词` 极简派单与四步交叉复核；
   - **5 大标准领域工作窗口 (`Domain Workers`)**：按业务域自动路由或孵化独立反重力窗口并发执行，单窗口 `transcript.jsonl > 15MB`（总控 `> 85MB`）时 3 秒内自动热轮转新窗口，永远告别上下文膨胀降智。
2. **项目级 100% 物理隔离的 6 大活体记忆 + SQLite 强事务混合检索**：
   - 每个业务项目独立维护 `<PROJECT_ROOT>/memory/` 下的 6 大 Markdown 活体账本（`USER_PROFILE` / `PRODUCT_PROGRESS` / `CODE_MAP` / `ARCHITECTURE_DECISIONS` / `EVOLUTION_LEDGER` / `CROSS_INBOX`）；
   - 底层由 `memory.sqlite`（`WAL + busy_timeout=10000 + Savepoint 嵌套事务`）驱动 **FTS5 BM25 倒排 + 递归 2 跳图谱 + 256 维特征哈希稠密向量**混合检索，接手任务第 0 秒毫秒级召回防复发规则与用户 `VETO` 否决项。
3. **3D 交互式代码知识星系 (`CODE_GRAPH_3D.html`) 与 Ponytail 脱水棘轮**：
   - 改代码前自动执行 AST 依赖扫描，3 秒算出 **1 跳直接依赖、2 跳间接爆炸半径、核心枢纽 (`God Nodes`) 与现成可复用工具函数速查表**；
   - 提交前自动执行 `security_simplicity_audit`，拦截硬编码密钥 (`SEC-01..04`)、1 行透传包装函数 (`PONY-01`) 与死导出 (`PONY-02`)。

---

## 🧰 内置 14 大原生 MCP 自动路由工具矩阵 (`ServerName: "agy-evo-os_memory"`)

安装后，谷歌反重力引擎会根据当前任务语义**全自动触发**以下 14 个原生 MCP 工具（支持 `mtimeMs` 毫秒级动态热加载，无需手动输入口令）：

| 序号 | MCP 工具名称 | 自动触发时机 | 解决的核心工程问题 |
| :---: | :--- | :--- | :--- |
| 1 | `memory_recall_for_task` | 接手任务第 0 步 / `/compact` 恢复后 | 混合检索历史防坑基因、`VETO` 否决项与未读收件箱 (`XMSG-xxx`) |
| 2 | `memory_rebuild_index` | 记忆账本更新后 | 增量同步 Markdown 账本至 SQLite 知识图谱与向量库 |
| 3 | `user_profile_update` | 首次破冰建档 / 切换沟通风格 | 落盘用户语言偏好与编程段位 (`L0_BEGINNER / L1_INTERMEDIATE / L2_EXPERT`) |
| 4 | `project_memory_init` | 新项目接入时 | 一键初始化项目级物理隔离的 6 大标准活体记忆档案 |
| 5 | `code_graph_blast_radius` | 修改存量代码前 | 扫描 AST 依赖，计算 **2 跳修改爆炸半径**并生成 `CODE_GRAPH_3D.html` 与可复用函数表 |
| 6 | `code_graph_federated_3d` | 跨多项目协同排查时 | 将多个关联业务仓库与活跃工作窗口聚合成跨项目 3D 联邦总星系图 |
| 7 | `security_simplicity_audit` | 新增函数 / 重构瘦身 / 验收前 | 拦截密钥泄露 (`SEC-01..04`)、1 行透传 (`PONY-01`)、死导出 (`PONY-02`) 与环境漂移 |
| 8 | `cross_project_memory_append` | 修改跨项目共享接口或协议时 | 向关联项目 `memory/CROSS_INBOX.md` 投递 SHA-256 幂等通知 |
| 9 | `cross_inbox_ack` | 处理完跨窗派单后 | 原子级将 `CROSS_INBOX.md` 指定 `XMSG-xxx` 标记为 `ACKED` 并同步 SQLite 状态机 |
| 10 | `cross_conversation_dispatch` | 跨项目唤醒兄弟窗口时 | 通过 6 道安全检查（防自环、防乒乓、冷却期、仅唤醒 IDLE）安全派单唤醒 |
| 11 | `swarm_spawn_or_route_by_name` | 总控窗口按领域并发派单时 | 按业务域精准路由或调用反重力 RPC 自动孵化独立工作窗口并挂载左侧 `Projects` 树 |
| 12 | `swarm_report_to_commander` | 工作窗口完成自测达标后 | 通过 `SWARM_ACK` 异步回传验收证据至总控窗口并自动核销收件箱 |
| 13 | `swarm_status_board` | 查看全局多窗口态势时 | 汇总总控窗口、各工作窗口运行状态、待审回执与研发效率倍增系数 (`laborForceMultiplier`) |
| 14 | `rsi_experiment_record` | 工具链自进化与效率攻坚时 | 按 **8 步科学实验法（假设->设计->改码->实验->分析->诊断->调优->固化资产）** 记录实验台账 |

---

## ⚡ 3 步快速安装与启动指南 (`Quickstart`)

### Step 1：10 秒一键安装至 Google Antigravity（谷歌反重力引擎）

```bash
git clone https://github.com/your-username/antigravity-solo-lab.git
cd antigravity-solo-lab

# 一键将全局规则、14 大 MCP 引擎、5 大分域 Skill SOP 与 3D 星系面板挂载至 ~/.gemini/config/plugins/agy-evo-os
./install.sh

# （可选）为你的具体业务项目初始化 6 大物理隔离活体记忆账本
./install.sh /path/to/your-project
```

### Step 2：启动手机飞书免公网双向语音/截图遥控桥接（推荐）

```bash
cp .env.example .env
# 编辑 .env 填入飞书自建应用 FEISHU_APP_ID 与 FEISHU_APP_SECRET（在飞书后台开启 WebSocket 长连接模式）
npm install
npm run feishu-bridge
```

### Step 3：生成项目的 3D 交互式代码知识星系图 或 一键替换宣传片仓库地址

```bash
# 1. 为任意项目生成 3D 代码星系图 (CODE_GRAPH_3D.html) 并在浏览器打开
npm run graph-3d -- /path/to/your-project --open

# 2. 将《No.44 · 字符剧场》第 9 幕中的开源指引替换为你自己的真实 GitHub 仓库地址并重渲成片
bash showcase/character_theater_44/set-github-url.sh "github.com/your-username/antigravity-solo-lab"
```

---

## 📂 仓库目录结构 (`Directory Structure`)

```text
antigravity-solo-lab/
├── rules/
│   └── AGENTS.md                         # 通用工业级全栈自进化智能体工程规范（反重力全局核心准则）
├── scripts/
│   ├── evo-memory-mcp-server.mjs         # 14 大原生 MCP 工具服务端 (JSON-RPC Stdio + 动态热加载)
│   ├── cross-project-federation.mjs      # Google Antigravity 1+N 多窗 RPC 调度、派单与收件箱引擎
│   ├── memory-graph-engine.mjs           # SQLite WAL + FTS5 + 2跳图谱 + 256维向量混合检索引擎
│   ├── memory-vector-tokenizer.mjs       # 零外部依赖中英代码混合分词与 256 维特征哈希向量化器
│   ├── code-graph-3d-generator.mjs       # 单项目 3D 代码知识星系与 2 跳爆炸半径生成器
│   ├── federated-graph-3d-generator.mjs  # 多项目跨仓联邦 3D 总星系图渲染引擎
│   ├── security-and-simplicity-audit.mjs # 安全边界审计 + Ponytail 脱水棘轮 + RSI 实验台账
│   ├── universal-preflight-gate.mjs      # 全链路真机质量检查与虚假断言拦截器
│   ├── stop-hook-guardian.mjs            # 收工自动刷新 3D 图谱与记忆完整性守护钩子
│   ├── evo-patrol-inspector.mjs          # 跨会话健康巡检与动态端口自愈守护脚本
│   └── mac-disk-guardian.mjs             # APFS 磁盘水位巡检与日志自动轮转守护进程
├── bridges/
│   ├── feishu-commander-bridge.mjs       # 手机飞书 <-> 反重力总控窗口 WSClient 免公网双向桥接器
│   ├── feishu-voice-engine.mjs           # 飞书双向语音识别与 TTS 语音合成引擎
│   ├── swarm-countdown-watchdog.mjs      # 后台任务 45s/60s 双倒计时防搁置看门狗引擎
│   └── permission-auto-granter.mjs       # 全系统权限白名单同步与免弹窗自动预授工具
├── skills/                               # 5 大核心分域标准作业程序 (SOP)
│   ├── 01-intent-and-research/           # 意图解码、并发联网调研与沙盒 PoC 实测 SOP
│   ├── 02-modular-refactor-and-map/      # 乐高式模块化重构与代码地图维护 SOP
│   ├── 03-fullstack-atomic-guardrails/   # 全栈各层防御性编码与 120 项检查点 SOP
│   ├── 04-qa-release-and-ops/            # 真机全链路质检与 30 秒一键快照回滚 SOP
│   └── 05-self-evolving-skill-mcp-forge/ # 活体记忆维护与自建 Skill/MCP 锻造 SOP
├── sidecars/code_galaxy_3d/              # Google Antigravity IDE 右侧栏原生 3D 代码星系交互面板
├── memory-templates/                     # 6 大活体记忆标准初始化模板（100% 通用脱敏版）
├── showcase/
│   ├── solo_lab_character_theater_fast.mp4 # 顶部内嵌《No.44 · 字符剧场》高清秒开版 (4.62 MB)
│   ├── solo_lab_character_theater_2k.mp4   # 《No.44 · 字符剧场》2K 60fps 母带版 (21.79 MB)
│   └── character_theater_44/               # 字符剧场源码与一键替换 GitHub 地址脚本
├── install.sh                            # 10 秒一键安装脚本
├── GITHUB_RELEASE_GUIDE.md               # GitHub 仓库发布说明、视频内嵌指南与全平台宣发文案
└── package.json
```

---

## 📜 开源协议 (License)

本项目基于 [MIT License](./LICENSE) 开源。欢迎所有 **Google Antigravity（谷歌反重力引擎）** 玩家与全栈开发者自由 Fork、定制属于你自己的 **Solo Lab（单人实验室）**！
