#!/usr/bin/env bash
# ============================================================================
# 🚀 AGY Evo-OS (Universal Full-Stack Evo-OS) — 反重力引擎一键挂载与多项目隔离管理器
# ============================================================================
# 支持三种工作模式：
#   1. 全局插件模式（默认推荐）：
#      bash install-to-antigravity.sh --global-plugin
#      -> 安装到 ~/.gemini/config/plugins/agy-evo-os/ （以 A 开头，稳居 Installed 列表第 1 位！）
#      -> 引擎能力（宪章/5大技能/钩子/MCP）全局可用，且在反重力界面可一键开关；
#      -> 记忆库（memory/*.md + memory.sqlite）严格按每个项目目录 100% 物理隔离！
#
#   2. 单项目独立挂载模式（仅在指定项目生效）：
#      bash install-to-antigravity.sh --project "/path/to/your/project"
#      -> 将 .agents/ (rules, skills, scripts, hooks.json) 与独立 memory/ 挂载到单个项目；
#      -> 即使关闭全局插件，该指定项目依然独立享有完整全栈工作集群与自进化能力！
#
#   3. 全局开关切换与状态巡检：
#      bash install-to-antigravity.sh --disable-global   # 关闭全局响应（仅保留已挂载的单项目生效）
#      bash install-to-antigravity.sh --enable-global    # 开启全局响应
#      bash install-to-antigravity.sh --status           # 查看全局插件与所有项目的挂载隔离状态
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_OS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_ID="agy-evo-os"
GLOBAL_PLUGIN_DIR="${HOME}/.gemini/config/plugins/${PLUGIN_ID}"
LEGACY_PLUGIN_DIR="${HOME}/.gemini/config/plugins/universal-fullstack-evo-os"
AGY_CONFIG_JSON="${HOME}/.gemini/config/config.json"

call_lsrpc_if_available() {
  local method="$1"
  local body="$2"
  if [[ -n "${ANTIGRAVITY_LS_ADDRESS:-}" && -n "${ANTIGRAVITY_CSRF_TOKEN:-}" ]]; then
    curl -sS -X POST \
      "http://${ANTIGRAVITY_LS_ADDRESS}/exa.language_server_pb.LanguageServerService/${method}" \
      -H "Content-Type: application/json" \
      -H "x-codeium-csrf-token: ${ANTIGRAVITY_CSRF_TOKEN}" \
      -d "${body}" >/dev/null 2>&1 || true
  fi
}

install_global_plugin() {
  # 清理旧版超长目录名（避免 >64 字符 MCP 工具名超限与排在第 18 位被折叠）
  if [[ -d "${LEGACY_PLUGIN_DIR}" ]]; then
    echo "🧹 正在清理旧版超长目录插件 (universal-fullstack-evo-os -> agy-evo-os)..."
    call_lsrpc_if_available "DeletePlugin" '{"pluginId":"universal-fullstack-evo-os"}'
    rm -rf "${LEGACY_PLUGIN_DIR}"
  fi

  echo "📦 [1/4] 正在创建反重力全局插件目录: ${GLOBAL_PLUGIN_DIR}"
  mkdir -p "${GLOBAL_PLUGIN_DIR}/assets"
  mkdir -p "${GLOBAL_PLUGIN_DIR}/rules"
  mkdir -p "${GLOBAL_PLUGIN_DIR}/skills"
  mkdir -p "${GLOBAL_PLUGIN_DIR}/scripts"
  mkdir -p "${GLOBAL_PLUGIN_DIR}/sidecars"
  mkdir -p "${GLOBAL_PLUGIN_DIR}/memory-templates/sessions"
  mkdir -p "${GLOBAL_PLUGIN_DIR}/memory/sessions"

  echo "📜 [2/4] 正在同步主宪章 (rules/AGENTS.md)、5 大核心技能 (skills/)、Sidecar 与核心脚本 (scripts/)..."
  cp -f "${SOURCE_OS_DIR}/GEMINI.md" "${GLOBAL_PLUGIN_DIR}/rules/AGENTS.md"
  cp -f "${SOURCE_OS_DIR}/README_小白一键看懂与接入指南.md" "${GLOBAL_PLUGIN_DIR}/README.md"
  cp -R "${SOURCE_OS_DIR}/skills/"* "${GLOBAL_PLUGIN_DIR}/skills/"
  cp -f "${SOURCE_OS_DIR}/scripts/"* "${GLOBAL_PLUGIN_DIR}/scripts/"
  if [[ -d "${SOURCE_OS_DIR}/sidecars" ]]; then
    cp -R "${SOURCE_OS_DIR}/sidecars/"* "${GLOBAL_PLUGIN_DIR}/sidecars/"
  fi
  chmod +x "${GLOBAL_PLUGIN_DIR}/scripts/"*.mjs "${GLOBAL_PLUGIN_DIR}/scripts/"*.sh "${GLOBAL_PLUGIN_DIR}/sidecars/"*/*.mjs 2>/dev/null || true

  rm -f "${GLOBAL_PLUGIN_DIR}/memory-templates/sessions/"CONV-*.md "${GLOBAL_PLUGIN_DIR}/memory/sessions/"CONV-*.md 2>/dev/null || true
  for f in USER_PROFILE.md PRODUCT_PROGRESS.md CODE_MAP.md ARCHITECTURE_DECISIONS.md EVOLUTION_LEDGER.md CONVERSATION_INDEX.md; do
    cp -f "${SOURCE_OS_DIR}/memory/${f}" "${GLOBAL_PLUGIN_DIR}/memory-templates/${f}"
    cp -f "${SOURCE_OS_DIR}/memory/${f}" "${GLOBAL_PLUGIN_DIR}/memory/${f}"
  done
  cp -f "${SOURCE_OS_DIR}/memory/sessions/TEMPLATE_SESSION_MEMORY.md" "${GLOBAL_PLUGIN_DIR}/memory-templates/sessions/TEMPLATE_SESSION_MEMORY.md"
  cp -f "${SOURCE_OS_DIR}/memory/sessions/TEMPLATE_SESSION_MEMORY.md" "${GLOBAL_PLUGIN_DIR}/memory/sessions/TEMPLATE_SESSION_MEMORY.md"

  echo "🎨 [3/4] 正在生成高清矢量图标 (assets/logo.svg)、插件清单 (plugin.json)、MCP 与 Stop 守护钩子..."
  cat > "${GLOBAL_PLUGIN_DIR}/assets/logo.svg" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" fill="none">
  <defs>
    <linearGradient id="shieldGrad" x1="16" y1="16" x2="112" y2="112" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="50%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>
    <linearGradient id="nodeGrad" x1="36" y1="36" x2="92" y2="92" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
  </defs>
  <path d="M64 14L22 31V61C22 88.5 40.1 107.8 64 115C87.9 107.8 106 88.5 106 61V31L64 14Z" fill="url(#shieldGrad)" stroke="#93C5FD" stroke-width="3"/>
  <path d="M44 64L58 46L84 52L74 82L44 64Z" stroke="url(#nodeGrad)" stroke-width="3.5" stroke-linejoin="round" fill="none"/>
  <line x1="58" y1="46" x2="74" y2="82" stroke="#E0F2FE" stroke-width="2.5" stroke-dasharray="4 3"/>
  <circle cx="58" cy="46" r="6.5" fill="#FDE047"/>
  <circle cx="84" cy="52" r="6.5" fill="#38BDF8"/>
  <circle cx="44" cy="64" r="6.5" fill="#FFFFFF"/>
  <circle cx="74" cy="82" r="6.5" fill="#4ADE80"/>
</svg>
EOF

  cat > "${GLOBAL_PLUGIN_DIR}/plugin.json" <<EOF
{
  "name": "agy-evo-os",
  "displayName": "AGY Evo-OS v3.2 (全栈自进化工业级蜂群工作集群引擎)",
  "version": "3.2.0",
  "description": "工业级全栈防偷懒研发与自进化操作系统 v3.2：内置 AGY Swarm Commander 蜂群指挥官体系(1总控+N具名领域工作会话窗口+M子代理)、8步科学实验闭环与研发劳动力复利倍增飞轮(EVO-025/026)、双自适应沟通层(L0小白/L1进阶/L2极客)、单项目+多项目联邦3D交互知识星系图、跨项目记忆收件箱(CROSS_INBOX)与6重门禁派单唤醒及13大原生MCP工具。",
  "logo": "assets/logo.svg",
  "suggestedPrompts": [
    "调用 swarm_status_board 查看当前 1 总控 + N 具名领域工作会话 + M 子代理的全局蜂群态势与研发劳动力倍增系数。",
    "调用 code_graph_federated_3d 生成跨项目 3D 联邦知识总星系图，并在浏览器中打开。",
    "调用 security_simplicity_audit 对当前项目做一次安全边界、Ponytail 化繁为简与研发劳动力倍增体检。"
  ]
}
EOF

  cat > "${GLOBAL_PLUGIN_DIR}/mcp_config.json" <<EOF
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": [
        "${GLOBAL_PLUGIN_DIR}/scripts/evo-memory-mcp-server.mjs"
      ]
    }
  }
}
EOF

  cat > "${GLOBAL_PLUGIN_DIR}/hooks.json" <<EOF
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ${GLOBAL_PLUGIN_DIR}/scripts/stop-hook-guardian.mjs",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
EOF

  local mcp_schema_dir="${HOME}/.gemini/antigravity/mcp/${PLUGIN_ID}_memory"
  mkdir -p "${mcp_schema_dir}"
  if [[ -f "${SOURCE_OS_DIR}/mcp/instructions.md" ]]; then
    cp -f "${SOURCE_OS_DIR}/mcp/instructions.md" "${mcp_schema_dir}/instructions.md"
  fi
  node "${GLOBAL_PLUGIN_DIR}/scripts/evo-memory-mcp-server.mjs" --dump-schemas "${mcp_schema_dir}" >/dev/null

  echo "⚙️  [4/4] 正在向反重力配置中心注册并启用插件..."
  toggle_global_plugin "true"
  call_lsrpc_if_available "RefreshMcpServers" '{}'
  node "${GLOBAL_PLUGIN_DIR}/scripts/memory-graph-engine.mjs" index --root "${SOURCE_OS_DIR}" >/dev/null
  echo "✅ 全局插件 [${PLUGIN_ID}] 已成功安装并启用（在 Customizations -> Installed 标签页排在第 1 位）！"
}

toggle_global_plugin() {
  local enabled_val="$1"
  call_lsrpc_if_available "JetboxWriteState" "{\"userConfig\":{\"plugins\":{\"${PLUGIN_ID}\":{\"enabled\":${enabled_val}}}}}"
  if [[ -f "${AGY_CONFIG_JSON}" ]]; then
    cp -f "${AGY_CONFIG_JSON}" "${AGY_CONFIG_JSON}.bak"
    node -e '
      const fs = require("node:fs");
      const file = process.argv[1];
      const pluginId = process.argv[2];
      const enabled = process.argv[3] === "true";
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      data.plugins = data.plugins || {};
      delete data.plugins["universal-fullstack-evo-os"];
      data.plugins[pluginId] = {
        ...(data.plugins[pluginId] || {}),
        enabled
      };
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
    ' "${AGY_CONFIG_JSON}" "${PLUGIN_ID}" "${enabled_val}"
  fi
  if [[ "${enabled_val}" == "true" ]]; then
    echo "🟢 全局插件状态已设为: ENABLED (全局开启，各项目 memory/ 独立隔离)"
  else
    echo "⚪ 全局插件状态已设为: DISABLED (全局关闭，仅已单独挂载 .agents/ 的项目生效)"
  fi
}

install_to_single_project() {
  local target_proj="$1"
  if [[ -z "${target_proj}" || ! -d "${target_proj}" ]]; then
    echo "❌ 错误：目标项目目录不存在: ${target_proj}"
    exit 1
  fi
  target_proj="$(cd "${target_proj}" && pwd)"
  echo "🎯 正在为单个项目独立挂载 Evo-OS: ${target_proj}"

  mkdir -p "${target_proj}/.agents/rules"
  mkdir -p "${target_proj}/.agents/skills"
  mkdir -p "${target_proj}/.agents/scripts"
  mkdir -p "${target_proj}/memory/sessions"

  cp -f "${SOURCE_OS_DIR}/GEMINI.md" "${target_proj}/.agents/rules/AGENTS.md"
  cp -R "${SOURCE_OS_DIR}/skills/"* "${target_proj}/.agents/skills/"
  cp -f "${SOURCE_OS_DIR}/scripts/"* "${target_proj}/.agents/scripts/"
  chmod +x "${target_proj}/.agents/scripts/"*.mjs "${target_proj}/.agents/scripts/"*.sh 2>/dev/null || true

  cat > "${target_proj}/.agents/hooks.json" <<EOF
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ${target_proj}/.agents/scripts/stop-hook-guardian.mjs",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
EOF

  for f in USER_PROFILE.md PRODUCT_PROGRESS.md CODE_MAP.md ARCHITECTURE_DECISIONS.md EVOLUTION_LEDGER.md CONVERSATION_INDEX.md; do
    if [[ ! -f "${target_proj}/memory/${f}" ]]; then
      cp -f "${SOURCE_OS_DIR}/memory/${f}" "${target_proj}/memory/${f}"
      echo "  ➕ 初始化独立账本: memory/${f}"
    else
      echo "  ⏩ 保留已有账本: memory/${f}"
    fi
  done
  if [[ ! -f "${target_proj}/memory/sessions/TEMPLATE_SESSION_MEMORY.md" ]]; then
    cp -f "${SOURCE_OS_DIR}/memory/sessions/TEMPLATE_SESSION_MEMORY.md" "${target_proj}/memory/sessions/TEMPLATE_SESSION_MEMORY.md"
  fi

  node "${target_proj}/.agents/scripts/auto-code-mapper.mjs" --root "${target_proj}" --output "${target_proj}/memory/CODE_MAP.md" >/dev/null 2>&1 || true
  node "${target_proj}/.agents/scripts/memory-graph-engine.mjs" index --root "${target_proj}"
  echo "✅ 单项目独立挂载完成！项目 [${target_proj}] 现已拥有专属的 .agents/ 引擎与 memory/.memory-store/memory.sqlite 隔离记忆库。"
}

show_status() {
  echo "============================================================================"
  echo "📊 AGY Evo-OS — 反重力引擎挂载与多项目隔离状态"
  echo "============================================================================"
  if [[ -d "${GLOBAL_PLUGIN_DIR}" ]]; then
    local is_enabled
    is_enabled="$(node -e '
      const fs = require("node:fs");
      try {
        const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        const p = d.plugins && d.plugins[process.argv[2]];
        console.log(p && p.enabled === false ? "DISABLED" : "ENABLED");
      } catch { console.log("UNKNOWN"); }
    ' "${AGY_CONFIG_JSON}" "${PLUGIN_ID}")"
    echo "🌐 1. 全局插件目录: ${GLOBAL_PLUGIN_DIR}"
    echo "   - 插件 ID:  ${PLUGIN_ID} (在 Customizations -> Installed 标签页排第 1 位)"
    echo "   - 当前状态: ${is_enabled}"
  else
    echo "🌐 1. 全局插件目录: 未安装"
  fi
  echo ""
  echo "🗂️  2. 反重力已注册项目的独立记忆库 (memory.sqlite) 隔离状态:"
  node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const projDir = path.join(process.env.HOME, ".gemini/config/projects");
    if (!fs.existsSync(projDir)) process.exit(0);
    for (const f of fs.readdirSync(projDir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const p = JSON.parse(fs.readFileSync(path.join(projDir, f), "utf8"));
        const res = (p.projectResources && p.projectResources.resources) || [];
        for (const r of res) {
          const uri = (r.gitFolder && r.gitFolder.folderUri) || r.folderUri;
          if (!uri || !uri.startsWith("file://")) continue;
          const folder = decodeURIComponent(uri.replace("file://", ""));
          const hasAgents = fs.existsSync(path.join(folder, ".agents", "rules", "AGENTS.md"));
          const hasMemory = fs.existsSync(path.join(folder, "memory", "PRODUCT_PROGRESS.md"));
          const hasSqlite = fs.existsSync(path.join(folder, "memory", ".memory-store", "memory.sqlite"));
          console.log(`   • [${p.name}] -> ${folder}`);
          console.log(`     ├─ 单项目 .agents 挂载: ${hasAgents ? "✅ 已独立挂载" : "➖ 使用全局插件/未挂载"}`);
          console.log(`     └─ 独立隔离记忆库:      ${hasMemory ? (hasSqlite ? "✅ memory/ + memory.sqlite 已就绪" : "✅ memory/ 已就绪") : "⚪ 尚未初始化 (首次调用自动创建)"}`);
        }
      } catch {}
    }
  '
  echo "============================================================================"
}

MODE="${1:---global-plugin}"
case "${MODE}" in
  --global-plugin)
    install_global_plugin
    ;;
  --project)
    install_to_single_project "${2:-}"
    ;;
  --enable-global)
    toggle_global_plugin "true"
    ;;
  --disable-global)
    toggle_global_plugin "false"
    ;;
  --status)
    show_status
    ;;
  *)
    echo "用法:"
    echo "  bash $0 --global-plugin              # 安装并启用反重力全局插件（推荐）"
    echo "  bash $0 --project /path/to/project   # 仅挂载到指定的单个项目目录"
    echo "  bash $0 --disable-global             # 关闭全局插件（仅保留已挂载的单项目生效）"
    echo "  bash $0 --enable-global              # 开启全局插件"
    echo "  bash $0 --status                     # 查看全局与各项目的隔离状态"
    exit 1
    ;;
esac
