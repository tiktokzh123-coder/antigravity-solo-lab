# 🌌 Solo Lab (`antigravity-solo-lab`)

> **An Industrial-Grade Self-Evolving AI Agent Workbench & `1+N` Multi-Window Concurrency Engine Built Exclusively for [Google Antigravity IDE](https://idx.google.com/)**  
> **Zero-Code Mobile Feishu Voice/Screenshot Remote Control · `1+N` Multi-Window ConnectRPC Sandbox · SQLite WAL + 256D Vector Memory · 3D Interactive Code Galaxy (`CODE_GRAPH_3D.html`) · `≥92 Score` Dual-Blind QA**

[![Platform: Google Antigravity IDE](https://img.shields.io/badge/Target_IDE-Google_Antigravity-2563eb?style=for-the-badge)](./rules/AGENTS.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg?style=for-the-badge)](./LICENSE)
[![MCP Tools](https://img.shields.io/badge/Native_MCP_Tools-14_Engines-06b6d4?style=for-the-badge)](./scripts/evo-memory-mcp-server.mjs)
[![Dual Blind QA](https://img.shields.io/badge/Dual_Blind_QA-%E2%89%A592_Score_Pass-f43f5e?style=for-the-badge)](./rules/AGENTS.md)

**[🇨🇳 中文文档](./README.md) | [🇺🇸 English Documentation](./README.en.md) | [🚀 GitHub Release & Video Embed Guide](./GITHUB_RELEASE_GUIDE.md)**

---

## 🎬 Top Inline Video: *No.44 Character Theater × Solo Lab* (86s First-Person Film)

> 💡 **GitHub Native Inline Video Playback**:
> - GitHub natively supports inline `.mp4` video playback right at the top of `README.md`!
> - Drag and drop [`showcase/solo_lab_character_theater_fast.mp4`](./showcase/solo_lab_character_theater_fast.mp4) (`4.62 MB < 10 MB` limit) into the GitHub web editor to generate a native `https://github.com/user-attachments/assets/...` inline video player.

<video src="./showcase/solo_lab_character_theater_fast.mp4" controls preload="metadata" width="100%"></video>

- ▶️ **[Play / Download Fast HD Edition (`1080p · 4.62 MB`)](./showcase/solo_lab_character_theater_fast.mp4)**
- 🎞️ **[Play / Download 2K 60fps Master Edition (`2560×1440 · 21.79 MB`)](./showcase/solo_lab_character_theater_2k.mp4)**

---

## ⚠️ Core Positioning, Requirements & Cross-Tool Compatibility Matrix

**Solo Lab** is built specifically for **Google Antigravity IDE** (`~/.gemini/config/plugins/agy-evo-os` & `~/.gemini/antigravity/`), completing the three missing pieces of native Antigravity:
1. **Clawdbot-Style Mobile Voice/Screenshot Remote Control** via Feishu WebSocket (`Zero Public IP`).
2. **Milvus-Style Persistent Cross-Window Memory** via SQLite WAL + FTS5 + 2-Hop Graph + 256D Dense Vectors & 3D Code Galaxy (`CODE_GRAPH_3D.html`).
3. **Claude Code-Style `1+N` Multi-Window ConnectRPC Orchestration & `≥92 Score` Dual-Blind QA**.

| Host Environment | Compatibility Level | Supported Features | Limitations |
| :--- | :---: | :--- | :--- |
| **🟢 Google Antigravity IDE**<br>(`macOS / Linux` + `Node.js ≥ 20`) | **100% Full Power** | All 14 Native MCP Engines, `1+N` Multi-Window ConnectRPC Auto-Spawning & Hot Rotation, Mobile Feishu Voice/Image Bridge, Native 3D Code Galaxy Sidecar, `≥92 Score` Dual-Blind QA | None (`14.8x` measured productivity multiplier) |
| **🟡 Other MCP Clients**<br>(`Claude Code`, `Cursor`, `Windsurf`, `Cline`) | **~60% Core Memory & 3D Graph** | Standard Stdio MCP SQLite WAL + 256D Vector Memory (`memory_recall_for_task`), 3D Code Galaxy & 2-Hop Blast Radius (`code_graph_blast_radius`), Security & Ponytail Audit (`security_simplicity_audit`), 5 Engineering SOP Skills | Does **not** support `1+N` multi-window ConnectRPC spawning (`swarm_spawn_or_route_by_name`) or Feishu window auto-switching (requires Antigravity's internal `Cascade` RPC server) |

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

## 📜 License

Released under the [MIT License](./LICENSE).
