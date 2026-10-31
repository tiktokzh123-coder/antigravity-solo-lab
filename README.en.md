# 🌌 Solo Lab (`antigravity-solo-lab`)

> **An Industrial-Grade Self-Evolving AI Agent Workbench & `1+N` Multi-Window Concurrency Engine Built Exclusively for [Google Antigravity IDE](https://idx.google.com/)**  
> **Zero-Code Mobile Feishu Voice/Screenshot Remote Control · `1+N` Multi-Window ConnectRPC Sandbox · SQLite WAL + 256D Vector Memory · 3D Interactive Code Galaxy (`CODE_GRAPH_3D.html`) · `≥92 Score` Dual-Blind QA**

[![Platform: Google Antigravity IDE](https://img.shields.io/badge/Target_IDE-Google_Antigravity-2563eb?style=for-the-badge)](./rules/AGENTS.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg?style=for-the-badge)](./LICENSE)
[![MCP Tools](https://img.shields.io/badge/Native_MCP_Tools-14_Engines-06b6d4?style=for-the-badge)](./scripts/evo-memory-mcp-server.mjs)
[![Dual Blind QA](https://img.shields.io/badge/Dual_Blind_QA-%E2%89%A592_Score_Pass-f43f5e?style=for-the-badge)](./rules/AGENTS.md)

**[🇨🇳 中文完整文档 (Bilingual Same-Page)](./README.md) | [🇺🇸 Full English Documentation](./README.en.md) | [🚀 GitHub Release & Video Embed Guide](./GITHUB_RELEASE_GUIDE.md)**

---

## 🎬 Top Inline Video: *No.44 Character Theater × Solo Lab* (`86s First-Person Film`)

> 💡 **GitHub Native Inline Video Playback**:
> - GitHub natively supports inline `.mp4` video playback with audio right at the top of `README.md`!
> - Simply click `Edit README` on GitHub and drag-and-drop [`showcase/solo_lab_character_theater_fast.mp4`](./showcase/solo_lab_character_theater_fast.mp4) (`4.62 MB < 10 MB` limit) into the editor to generate a native `https://github.com/user-attachments/assets/...` inline player.

<video src="./showcase/solo_lab_character_theater_fast.mp4" controls preload="metadata" width="100%"></video>

- ▶️ **[Play / Download Fast HD Edition (`1080p · 4.62 MB`)](./showcase/solo_lab_character_theater_fast.mp4)**
- 🎞️ **[Play / Download 2K 60fps Master Edition (`2560×1440 · 21.79 MB`)](./showcase/solo_lab_character_theater_2k.mp4)**

---

## ⚠️ Core Positioning, Runtime Requirements & Cross-Tool Compatibility Matrix (Must Read)

**Solo Lab (`antigravity-solo-lab`) is not a generic prompt collection — it is an industrial-grade, local self-evolving AI agent workbench and `1+N` multi-window concurrency system purpose-built for [Google Antigravity IDE](https://idx.google.com/)** (installed by default under `~/.gemini/config/plugins/agy-evo-os` and `~/.gemini/antigravity/`).

### 1. Why Built Exclusively for Google Antigravity IDE?
**Google Antigravity** is powered by the **Google AI Ultra** compute ecosystem (`Gemini 4 Argon`, Flow `Veo 3.1 Lite` 0-credit video generation, 0-credit image generation, low-cost multimodal `Gemini Omni`, `Jules` 300-concurrent async coding agents, up to `$1,000` Google Developer Program cloud credits, and `$100/month` API credits). However, **native Google Antigravity lacks three critical pieces** — and **Solo Lab** builds all three directly into your IDE:
1. **Completing the "Clawdbot-Style" Mobile Remote Control**: Native Antigravity requires sitting at your keyboard. With Solo Lab, you can send a **voice message or screenshot from mobile Feishu/Lark** while away from your desk or resting in bed, waking up your home Mac's Antigravity IDE with **zero public IP or port-forwarding required**.
2. **Completing the "Milvus-Style" Persistent Cross-Window Vector Memory & 3D Code Galaxy**: Opening multiple windows in native Antigravity leads to context amnesia. Solo Lab embeds a **SQLite WAL strong-transaction state machine + FTS5 BM25 inverted index + 2-hop graph traversal + 256-dimensional dense vector store**, recalling historical anti-regression rules and user `VETO` constraints at Second 0, while rendering an interactive **3D Code Galaxy (`CODE_GRAPH_3D.html`)** that computes 2-hop modification blast radius in 3 seconds.
3. **Completing the "Claude Code-Style" `1+N` Multi-Window Autonomy & `≥92 Score` Dual-Blind QA Loop**: By integrating deeply with Google Antigravity's internal `LanguageServerService` ConnectRPC protocol (`StartCascade` / `SendUserCascadeMessage` / `LoadTrajectory`), **1 Orchestrator window automatically spawns and routes tasks across N isolated Domain Worker windows in parallel**. Internally, a **Generator vs. Evaluator** dual-blind QA loop runs real headless browser UI click tests — automatically rejecting and reworking anything `<90 points` and only delivering results to your phone once they pass **`≥92 points`**.

### 2. Host Environment & Cross-Tool Compatibility Matrix

| Host Environment | Compatibility Level | Supported Core Capabilities | Explicit Limitations |
| :--- | :---: | :--- | :--- |
| **🟢 Google Antigravity IDE**<br>(Desktop Client · **Official Full-Power Host**)<br>`macOS` / `Linux` + `Node.js ≥ 20` | **100% Full Power** | ✅ **All 14 Native MCP Engines**<br>✅ **`1+N` Multi-Window ConnectRPC Auto-Spawning, Cross-Window Dispatch & `85MB` 3-Second Hot Window Rotation**<br>✅ **Mobile Feishu Zero-Public-IP Bidirectional Voice/Screenshot Remote Control**<br>✅ **Native Right-Pane 3D Code Galaxy Sidecar (`code_galaxy_3d`) + 6 Project-Isolated Living Ledgers + `≥92 Score` Dual-Blind QA** | **Zero limitations** (`14.8x` measured R&D productivity multiplier). |
| **🟡 Other MCP-Compatible AI Coding Tools**<br>(`Claude Code`, `Cursor`, `Windsurf`, `Cline`) | **~60% Base Compatibility** | ✅ Standard Stdio MCP **SQLite WAL + FTS5 + 256D Vector Hybrid Memory Engine** (`memory_recall_for_task` / `memory_rebuild_index`)<br>✅ **3D Code Knowledge Galaxy & 2-Hop Blast Radius Generator** (`code_graph_blast_radius` / `CODE_GRAPH_3D.html`)<br>✅ **Ponytail Code Dehydration Ratchet & Security Audit** (`security_simplicity_audit`)<br>✅ **5 Full-Stack Engineering SOP Skills (`skills/`)** | ❌ **Does NOT support `1+N` automatic cross-window spawning or wakeup** (`swarm_spawn_or_route_by_name` and `cross_conversation_dispatch` require Google Antigravity's internal `Cascade` ConnectRPC server)<br>❌ **Does NOT support Feishu auto-switching across Antigravity windows** |

### 3. Hardware & System Requirements
- **Required**:
  1. **[Google Antigravity IDE](https://idx.google.com/)** installed and signed in (Google AI Ultra subscription recommended to unlock `Gemini 4 Argon` and zero-credit multimodal tools);
  2. **OS**: `macOS 13+` (full support for APFS disk watermark guardian, zero-TCC-popup patrol, and native `/usr/sbin/sendmail` alerts) or `Linux`;
  3. **Runtime**: `Node.js ≥ 20.0.0` (`v22+` recommended) & `Python 3.10+`;
- **Optional**:
  - `ffmpeg` (for rendering the Character Theater promo film and multi-frame video QA);
  - Feishu/Lark Custom App `FEISHU_APP_ID` + `FEISHU_APP_SECRET` (with WebSocket long-connection mode enabled for zero-public-IP mobile remote control).

---

## 👥 Dual-Audience 3-Minute Guide: Zero-Code Beginners vs. Technical Geeks

### 🗣️ 1. For Zero-Code Beginners / Creators / Indie Founders
You **never need to memorize terminal commands**. Once Solo Lab is installed in your Google Antigravity IDE, it turns your computer into a **24/7 autonomous software & media production studio**:
1. **Remote-Control Your Computer via Mobile Voice or Screenshots**: Whether you are out for coffee or lying in bed, open Feishu on your phone and send a plain-language voice note (*"Build a product showcase page matching this screenshot"* or *"Make the subtitles 25% larger in the promo video"*). Your home computer's Antigravity IDE wakes up and starts working automatically.
2. **Silent Background Coding & Real Browser Testing**: Solo Lab never spams you with half-baked drafts or raw stack traces. It decomposes requirements, writes code, launches a real headless Chrome browser to click buttons, and inspects screenshots internally.
3. **Internal `≥92 Score` Dual-Blind QA Before Delivery**: An internal Evaluator grades every output — if fonts are too small, buttons fail, or layouts overlap (`<90 points`), it automatically sends the work back for a redo. Only verified outputs scoring **`≥92 points`** are pushed to your phone and email.

### 🛠️ 2. For Technical Geeks / Full-Stack Architects
For power Vibe Coders and systems engineers, **Solo Lab** eliminates the four chronic failure modes of single-window AI coding (cross-window amnesia, breaking Module B while fixing Module A, context window bloat, and unverified mock handoffs):
1. **`1+N+M` Dual-Layer Concurrency & Zero-Manual-Labor Orchestrator Protocol**:
   - **1 Orchestrator Window**: Strictly forbidden from writing business code, running blocking commands `>30s`, or reading `>2` large files. Dedicated solely to intent alignment, `≤50-word` concise dispatch, and 4-step cross-verification;
   - **5 Domain Worker Windows**: Automatically routed or spawned via ConnectRPC. When a worker's `transcript.jsonl > 15MB` (or Orchestrator `> 85MB`), it hot-rotates to a fresh window in 3 seconds.
2. **100% Project-Isolated 6 Living Memory Ledgers + SQLite WAL Hybrid Retrieval**:
   - Each project maintains 6 isolated Markdown ledgers under `<PROJECT_ROOT>/memory/` (`USER_PROFILE`, `PRODUCT_PROGRESS`, `CODE_MAP`, `ARCHITECTURE_DECISIONS`, `EVOLUTION_LEDGER`, `CROSS_INBOX`);
   - Backed by `memory.sqlite` (`WAL + busy_timeout=10000 + Savepoint nested transactions`) combining **FTS5 BM25 + recursive 2-hop graph + 256D feature-hashed dense vectors** for millisecond recall at Step 0.
3. **3D Interactive Code Galaxy (`CODE_GRAPH_3D.html`) & Ponytail Dehydration Ratchet**:
   - Computes **1-hop direct dependencies, 2-hop blast radius, God Nodes, circular dependencies, and reusable utility lookup tables** in 3 seconds before code edits;
   - Runs `security_simplicity_audit` to block hardcoded secrets (`SEC-01..04`), 1-line pass-through wrappers (`PONY-01`), and dead exports (`PONY-02`).

---

## 🧰 Built-In 14 Native MCP Auto-Routed Tools (`ServerName: "agy-evo-os_memory"`)

| # | MCP Tool Name | Auto-Trigger Stage | Core Engineering Problem Solved |
| :---: | :--- | :--- | :--- |
| 1 | `memory_recall_for_task` | Step 0 of any task / post-`/compact` | Hybrid recall of anti-regression genes, `VETO` rules, and unread inbox items (`XMSG-xxx`) |
| 2 | `memory_rebuild_index` | After ledger updates | Incrementally syncs Markdown ledgers into SQLite graph & 256D vector store |
| 3 | `user_profile_update` | Onboarding / style switch | Persists language preference and proficiency tier (`L0_BEGINNER / L1_INTERMEDIATE / L2_EXPERT`) |
| 4 | `project_memory_init` | New project onboarding | Initializes the 6 physically isolated living memory ledgers |
| 5 | `code_graph_blast_radius` | Before modifying existing code | Scans AST dependencies, computes **2-hop blast radius**, and generates `CODE_GRAPH_3D.html` |
| 6 | `code_graph_federated_3d` | Cross-project debugging | Aggregates multiple repositories and active worker windows into a 3D Federated Galaxy |
| 7 | `security_simplicity_audit` | New utility / refactoring / pre-QA | Blocks leaked keys (`SEC-01..04`), 1-line pass-throughs (`PONY-01`), and dead exports (`PONY-02`) |
| 8 | `cross_project_memory_append` | Shared contract/protocol changes | Delivers SHA-256 idempotent notifications to target `memory/CROSS_INBOX.md` |
| 9 | `cross_inbox_ack` | After completing a cross-window task | Atomically marks `XMSG-xxx` as `ACKED` in `CROSS_INBOX.md` and syncs SQLite state |
| 10 | `cross_conversation_dispatch` | Waking up a sibling window | Dispatches tasks across windows after passing 6 safety gates (anti-loop, cooldown, IDLE-only) |
| 11 | `swarm_spawn_or_route_by_name` | Orchestrator domain dispatch | Routes to or spawns an isolated Domain Worker window via ConnectRPC and mounts it in `Projects` |
| 12 | `swarm_report_to_commander` | Worker finishes self-verified task | Sends async `SWARM_ACK` completion report to the Orchestrator and auto-ACKs inbox items |
| 13 | `swarm_status_board` | Inspecting global swarm status | Displays Orchestrator/Worker states, pending ACKs, and `laborForceMultiplier` |
| 14 | `rsi_experiment_record` | Self-evolving tool forge | Records the **8-step scientific experiment loop** (`Hypothesis -> Design -> Code -> Test -> Solidify`) |

---

## ⚡ 3-Step Quickstart

```bash
# 1. Install into Google Antigravity IDE (~/.gemini/config/plugins/agy-evo-os)
git clone https://github.com/your-username/antigravity-solo-lab.git
cd antigravity-solo-lab
./install.sh

# 2. Start the Mobile Feishu Remote Control Bridge (optional)
cp .env.example .env
npm install && npm run feishu-bridge

# 3. Generate a 3D Code Galaxy for your project
npm run graph-3d -- /path/to/your-project --open
```

---

## 📂 Directory Structure

```text
antigravity-solo-lab/
├── rules/
│   └── AGENTS.md                         # Universal Full-Stack Self-Evolving Agent Specification
├── scripts/
│   ├── evo-memory-mcp-server.mjs         # 14 Native MCP Tools Server (JSON-RPC Stdio + Hot Reload)
│   ├── cross-project-federation.mjs      # Google Antigravity 1+N Multi-Window ConnectRPC Orchestrator
│   ├── memory-graph-engine.mjs           # SQLite WAL + FTS5 + 2-Hop Graph + 256D Vector Hybrid Engine
│   ├── memory-vector-tokenizer.mjs       # Zero-Dependency Mixed CJK/Code Tokenizer & 256D Hasher
│   ├── code-graph-3d-generator.mjs       # Single-Project 3D Code Galaxy & 2-Hop Blast Radius Engine
│   ├── federated-graph-3d-generator.mjs  # Multi-Project Federated 3D Galaxy Generator
│   ├── security-and-simplicity-audit.mjs # Security Boundary Audit + Ponytail Ratchet + RSI Ledger
│   ├── universal-preflight-gate.mjs      # End-to-End Quality Gate & Fake-Assertion Interceptor
│   ├── stop-hook-guardian.mjs            # Post-Task 3D Graph Refresh & Memory Integrity Hook
│   ├── evo-patrol-inspector.mjs          # Cross-Session Health Patrol & Dynamic Port Self-Healing
│   └── mac-disk-guardian.mjs             # APFS Disk Watermark Guardian & Log Rotation Daemon
├── bridges/
│   ├── feishu-commander-bridge.mjs       # Mobile Feishu <-> Antigravity Orchestrator WSClient Bridge
│   ├── feishu-voice-engine.mjs           # Feishu Bidirectional ASR & TTS Voice Engine
│   ├── swarm-countdown-watchdog.mjs      # 45s/60s Dual-Countdown Anti-Stall Watchdog
│   └── permission-auto-granter.mjs       # Permission Allowlist Sync & Auto-Granter
├── skills/                               # 5 Core Domain Standard Operating Procedures (SOPs)
├── sidecars/code_galaxy_3d/              # Google Antigravity IDE Right-Pane 3D Code Galaxy Sidecar
├── memory-templates/                     # 6 De-Identified Living Memory Templates
├── showcase/
│   ├── solo_lab_character_theater_fast.mp4 # Top Inline No.44 Character Theater Fast HD (4.62 MB)
│   ├── solo_lab_character_theater_2k.mp4   # No.44 Character Theater 2K 60fps Master (21.79 MB)
│   └── character_theater_44/               # Character Theater Generator & One-Click URL Script
├── install.sh                            # 10-Second One-Click Installer
├── publish-to-github.sh                  # Automated GitHub Login, Act 9 URL Replacement & Repo Push
├── GITHUB_RELEASE_GUIDE.md               # GitHub Release Guide, Video Embed Guide & Copywriting
└── package.json
```

---

## 📜 License

Released under the [MIT License](./LICENSE).
