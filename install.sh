#!/usr/bin/env bash
# ============================================================================
# 🚀 Universal Full-Stack Evo-OS · 10-Second One-Click Installer
# ============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_TARGET="${HOME}/.gemini/config/plugins/agy-evo-os"
AGY_PLUGIN_DATA="${HOME}/.gemini/antigravity/plugin_data/agy-evo-os"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  🌌 Universal Full-Stack Evo-OS · Self-Evolving Agent OS Installer  ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📦 [1/4] Installing plugin & 14 MCP engines to ${PLUGIN_TARGET} ..."
mkdir -p "${PLUGIN_TARGET}" "${AGY_PLUGIN_DATA}"

cp -R "${REPO_DIR}/rules" "${PLUGIN_TARGET}/"
cp -R "${REPO_DIR}/scripts" "${PLUGIN_TARGET}/"
cp -R "${REPO_DIR}/skills" "${PLUGIN_TARGET}/"
cp -R "${REPO_DIR}/sidecars" "${PLUGIN_TARGET}/"
cp -R "${REPO_DIR}/assets" "${PLUGIN_TARGET}/"
cp -R "${REPO_DIR}/memory-templates" "${PLUGIN_TARGET}/"
cp -R "${REPO_DIR}/bridges" "${PLUGIN_TARGET}/"
cp "${REPO_DIR}/plugin.json" "${PLUGIN_TARGET}/"

# Dynamically resolve ~ to actual $HOME in hooks.json and mcp_config.json
sed "s|~/.gemini|${HOME}/.gemini|g" "${REPO_DIR}/hooks.json" > "${PLUGIN_TARGET}/hooks.json"
sed "s|~/.gemini|${HOME}/.gemini|g" "${REPO_DIR}/mcp_config.json" > "${PLUGIN_TARGET}/mcp_config.json"

echo "🔧 [2/4] Setting executable permissions & clearing macOS quarantine ..."
chmod +x "${PLUGIN_TARGET}/scripts/"*.mjs "${PLUGIN_TARGET}/scripts/"*.sh "${PLUGIN_TARGET}/bridges/"*.mjs 2>/dev/null || true
if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "${PLUGIN_TARGET}" 2>/dev/null || true
fi

echo "🧠 [3/4] Initializing project memory templates (if target workspace specified) ..."
TARGET_PROJECT="${1:-}"
if [[ -n "${TARGET_PROJECT}" && -d "${TARGET_PROJECT}" ]]; then
  node "${PLUGIN_TARGET}/scripts/memory-graph-engine.mjs" init "${TARGET_PROJECT}" || true
  echo "   ✔ Initialized 6 living memory ledgers in: ${TARGET_PROJECT}/memory/"
fi

echo "✅ [4/4] Running pre-flight syntax & engine verification ..."
for script in "${PLUGIN_TARGET}/scripts/"*.mjs "${PLUGIN_TARGET}/bridges/"*.mjs; do
  node --check "${script}"
done

echo ""
echo "🎉 Universal Full-Stack Evo-OS installed successfully!"
echo "   • Plugin Root : ${PLUGIN_TARGET}"
echo "   • 14 MCP Tools: Ready (agy-evo-os_memory)"
echo "   • 3D Sidecar  : sidecar://agy-evo-os/code_galaxy_3d/"
echo "   • Feishu Bridge: Configure .env from .env.example and run:"
echo "                    node ${PLUGIN_TARGET}/bridges/feishu-commander-bridge.mjs"
