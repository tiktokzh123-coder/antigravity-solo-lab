# 对话上下文记忆总目录与跨窗口无缝交接索引 (`CONVERSATION_INDEX.md`)

> [!NOTE]
> **账本定位与「按对话拆分 + 按需懒加载」防爆 Token 铁律**：
> 本文件是当前项目的**「对话级上下文记忆总目录（Single Source of Truth for Session Contexts）」**，配合 `<项目根目录>/memory/sessions/` 目录下的**单次对话独立切片档案**使用。
> - **多项目物理隔离铁律**：本文件与 `sessions/*.md` 必须且只能存放在**当前目标项目的 `<项目根目录>/memory/`** 下！
> - **新对话唤醒时的「两级懒加载（Lazy Loading）」读取铁律**：
>   - 每次开启新对话时，AI 优先调用 MCP 工具 `memory_recall_for_task(project_root: "<当前项目路径>")`，或仅读取本总目录 (`CONVERSATION_INDEX.md`) + 最新 1 篇对话切片（Latest Session Slice）；
>   - **严禁一次性读取 `memory/sessions/` 下的全部历史切片**！只有当当前任务涉及到某次历史对话改过的特定模块时，才根据下表索引“按需点读”对应的那 1 篇历史对话切片。

---

## 一、 最新跨窗口无缝交接胶囊（Active Handoff Capsule — 新对话必读）

> 每次对话收尾或切换窗口前，自动刷新此胶囊。新开对话的 AI 读完这 5 行即可无缝接棒：

- **最近一次活跃对话切片**：[`memory/sessions/TEMPLATE_SESSION_MEMORY.md`](./sessions/TEMPLATE_SESSION_MEMORY.md)
- **上次对话刚完成的核心动作**：`项目独立记忆库初始化完成，等待首次任务或存量代码全盘摸排`
- **用户在对话中强调的最新偏好 / 禁忌（别再犯）**：`严格遵循 USER_PROFILE.md 设定的沟通段位输出；每次修改或接管项目必须先查真实源码行号并执行记忆召回与审批闭环`
- **当前未完待续的第一顺位动作（Next Immediate Step）**：`接收用户指令，执行第 0 步 memory_recall_for_task 召回并开展研发或摸排`
- **绑定的安全回滚快照 ID**：`暂无（首次修改代码或接管存量项目前将自动调用 snapshot-and-rollback.sh 创建基线快照）`

---

## 二、 按对话拆分的历史上下文切片总表（Session Context Slices Registry）

<!-- AUTO-SESSION-INDEX:START -->
| 对话切片编号 | 日期与时间 | 对话核心主题摘要 | 用户关键意图与否决项沉淀（一句话精粹） | 关联代码模块 / ADR / EVO | 绑定的快照 ID | 独立切片文件链接（按需点读） |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`CONV-000`** | `出厂基准` | 系统初始化与对话切片模板建立 | 确立「按对话拆分独立上下文切片 + 跨窗口懒加载交接」机制 | `GEMINI.md`, `skills/05` | `baseline` | [`TEMPLATE_SESSION_MEMORY.md`](./sessions/TEMPLATE_SESSION_MEMORY.md) |
<!-- AUTO-SESSION-INDEX:END -->

---

## 三、 对话上下文自动切片与沉淀的 3 大触发规则

1. **触发时机 A — 单次开发/排障/摸排任务收工时**：
   - 在完成验证后，AI 将本次对话的上下文摘要与其余账本更新合并进**同一个 `ask_question` 审批弹窗**；获批后调用 `node ~/.gemini/config/plugins/agy-evo-os/scripts/session-memory-slicer.mjs --root "<当前项目根目录>"` 生成独立对话切片并自动更新本索引。
2. **触发时机 B — 单次对话过长（准备执行 `/compact` 或新开对话窗口前）**：
   - 当单次对话超过 15~20 轮或用户准备切换新聊天窗口时，AI 主动提炼当前对话的「阶段性上下文交接切片」，确保执行 `/compact` 或新开窗口后 **0 信息损耗**。
3. **触发时机 C — 需求方向发生重大转折或推翻重来时**：
   - 当用户在对话中途决定改变产品方向或否定原方案时，立即将前一段探讨及“为什么否定原方案”封存为一个独立对话切片，防止后续再次误入已放弃的死胡同。
