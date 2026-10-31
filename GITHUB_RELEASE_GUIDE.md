# 🚀 Solo Lab (`antigravity-solo-lab`) · GitHub 开源发布说明与视频内嵌指南

本指南包含：
1. **GitHub 仓库创建与代码一键推送流程（推荐仓库名：`antigravity-solo-lab`）**
2. **如何在 GitHub `README.md` 顶部激活《No.44 · 字符剧场》原生内嵌视频播放器（无需外链，点开直接播放）**
3. **GitHub `v1.0.0` Release Notes（可直接复制粘贴至 GitHub Releases）**
4. **朋友圈 / 小红书 / 抖音 / 视频号 / X (Twitter) 开源宣发文案**

---

## 一、 30 秒创建公开 GitHub 仓库并回填视频第 9 幕真实地址

### 1. 初始化并推送至 GitHub 仓库 (`antigravity-solo-lab`)

```bash
cd /Users/celiu/Downloads/agy-evo-os-opensource

# 1. 初始化 Git 仓库并提交全部脱敏源码
git init
git add .
git commit -m "feat: initial open-source release of Solo Lab for Google Antigravity IDE v1.0.0"

# 2. 使用 GitHub CLI 一键创建公开仓库并推送（或绑定您在网页端创建的仓库地址）
gh repo create antigravity-solo-lab --public --source=. --remote=origin --push
```

### 2. 一键将您自己的 GitHub 地址写进《字符剧场》视频第 9 幕（可选）

目前 [`showcase/solo_lab_character_theater_2k.mp4`](./showcase/solo_lab_character_theater_2k.mp4) 第 9 幕取景框中展示的是通用指引：
- `GitHub 搜索：Solo Lab · 单人实验室（或直接截图本画面发给你的 AI 助手一键安装）`

当您的 GitHub 仓库创建完成后，只需运行一行命令，即可将第 9 幕替换为您的真实仓库地址（例如 `github.com/您的用户名/antigravity-solo-lab`）并自动重渲 2K 成片与秒开版：

```bash
bash showcase/character_theater_44/set-github-url.sh "github.com/<您的GitHub用户名>/antigravity-solo-lab"
```

---

## 二、 如何在 GitHub `README.md` 顶部直接内嵌播放《字符剧场》视频？

**GitHub 原生支持在 `README.md` 中直接内嵌播放 `.mp4` 视频（带声音与全屏控件，无需跳转到 YouTube 或 B 站）！**

1. **为什么本仓库的视频可以直接内嵌？**
   - GitHub 免费账号允许在 Markdown 中直接拖拽上传 `≤ 10 MB` 的 `.mp4` 视频文件；
   - 本仓库专门准备了体积仅 **`4.62 MB`** 的高清秒开版视频：`showcase/solo_lab_character_theater_fast.mp4`（`1080p`，含完整 86 秒旁白与 BGM）。
2. **5 秒激活 GitHub 顶部原生播放器步骤**：
   - **第 1 步**：代码推送到 GitHub 后，在浏览器打开您的仓库首页，点击 `README.md` 右上角的 ✏️ **`Edit file`**（编辑按钮）；
   - **第 2 步**：找到顶部 `## 🎬 顶部内嵌播放：《No.44 · 字符剧场 × 单人实验室》` 章节下方的 `<video ...>` 行；
   - **第 3 步**：将本地文件夹中的 `showcase/solo_lab_character_theater_fast.mp4`（`4.62 MB`）**直接用鼠标拖拽进 GitHub 网页编辑框**；
   - **第 4 步**：等待 2 秒上传完成后，GitHub 会自动插入一行形如 `https://github.com/user-attachments/assets/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` 的独立链接，点击右上角 **`Commit changes`** 保存，该链接就会在 GitHub 仓库首页顶部直接变成**高清原生视频播放器**！

---

## 三、 GitHub Release Notes (`v1.0.0` 发布正文模板)

> **Release Title**: `v1.0.0 — Solo Lab (单人实验室): Google Antigravity 专属 1+N 多窗并发与全栈自进化工作台`  
> **Tag**: `v1.0.0`

### ✨ Release Highlights（核心亮点）

**Solo Lab（单人实验室）** 是专为 **Google Antigravity（谷歌反重力引擎 IDE）** 深度打造的工业级全栈自进化智能体工作台与 `1+N` 多窗口并发底座——**既能让零基础小白用手机飞书发条语音直接遥控家里电脑，也能让技术极客获得 `1+N` 多窗口 RPC 并发沙盒 + SQLite 强事务记忆 + 3D 代码星系**！

1. **🎯 专为 Google Antigravity（谷歌反重力引擎）打造，补齐原生三大缺失拼图**
   - 盘活 **Google AI Ultra** 旗舰算力（`Gemini 4 Argon`、Flow `Veo 3.1 Lite` 0积分视频、生图 0积分、`Gemini Omni`、`Jules` 300并发异步编程）；
   - **拼图 ①（对比 Clawdbot）**：补齐手机飞书免公网 IP 语音/截图双向远程遥控；
   - **拼图 ②（对比 Milvus）**：补齐跨窗口本地持久化 SQLite WAL + FTS5 + 256 维向量记忆库与 3D 交互式代码知识图谱 (`CODE_GRAPH_3D.html`)；
   - **拼图 ③（对比 Claude Code）**：补齐 `1 个总控窗口 + N 个独立领域工作窗口` 自动建窗、跨窗派单唤醒、容量超水位 3 秒无缝热轮转与内部 `≥92 分` 双盲对抗自检闭环。
2. **⚠️ 清晰的跨工具适配边界**
   - **Google Antigravity IDE（100% 满血完全体）**：完整支持 `1+N` 多窗口 ConnectRPC 自动孵化唤醒、飞书双向桥接、3D 星系 Sidecar 与全部 14 大 MCP 引擎；
   - **Claude Code / Cursor / Windsurf（约 60% 基础兼容）**：支持标准 Stdio MCP 协议下的 SQLite 混合向量记忆、3D 代码星系与 2 跳爆炸半径生成、安全与脱水审计及 5 大工程 SOP（不支持反重力专有的多窗口 RPC 自动建窗与唤醒）。

---

## 四、 全平台配套开源宣发文案（朋友圈 / 抖音 / 小红书 / 视频号）

### 📱 版本 A：双受众破圈版（适合朋友圈 / 小红书 / 视频号配《字符剧场》视频）

> **“别人用 AI 是在聊天框里当保姆；而我的电脑里，住着一座基于谷歌反重力引擎（Google Antigravity）24 小时全自动运转的——单人实验室（Solo Lab）。”**
>
> 很多人问我：为什么不用 Claude Code 或普通单窗口聊天，而是专门围绕 **Google Antigravity（谷歌反重力引擎）** 手搓了这套系统？
> 因为 Google AI Ultra 给足了 `Gemini 4 Argon`、零积分视频/生图与云赠金算力，但原生反重力引擎缺了三块最关键的拼图——**手机远程遥控、跨窗口永久记忆、以及多窗口自动并发与挑刺自检**。
>
> 所以我们自己动手，把这三块拼图全造了出来，合体成这套 **《Solo Lab · 单人实验室》** 并正式开源：
>
> 🗣️ **如果你是「零基础小白 / 独立创作者」怎么用？**
> - 完全不用背命令！出门在外或躺在床上，打开手机飞书**发条大白话语音**或**甩张参考截图**，家里电脑上的谷歌反重力引擎自动唤醒开工；
> - 内部自带「生成组 + 挑刺组」左右互搏，自动打开真实浏览器点击测试，**低于 90 分后台自己打回重做，满 92 分才把成片推送到你手机上**！
>
> 🛠️ **如果你是「技术极客 / 全栈工程师」怎么用？**
> - **`1+N` 多窗口 RPC 并发沙盒**：1 个总控窗口自动唤醒 5 大领域工作窗口并发开发，超水位 3 秒无缝热轮转，彻底根除单窗口上下文污染；
> - **SQLite WAL 强事务 + 256 维向量记忆**：6 大项目级隔离活体账本，任务第 0 秒毫秒级召回历史防坑规则与 VETO 否决项，跨窗口永不失忆；
> - **3D 代码知识星系 (`CODE_GRAPH_3D.html`)**：改代码前 3 秒算清 2 跳修改爆炸半径，自动拦截死代码与密钥泄露，实测带来 **14.8 倍**研发效率倍增！
>
> 🎬 附上完全由代码生成的 **《No.44 · 字符剧场 × 单人实验室》** 第一人称介绍大片，现已在 GitHub 100% 开源（MIT 协议，10 秒一键安装）！👇
