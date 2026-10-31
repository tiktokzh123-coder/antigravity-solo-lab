#!/usr/bin/env bash
# ==============================================================================
# Solo Lab × No.44 字符剧场 · 一键替换第 9 幕真实 GitHub 仓库地址并重新渲染成片
# 用法：
#   bash showcase/character_theater_44/set-github-url.sh "github.com/your-org/solo-lab"
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "用法: bash $0 <GitHub仓库地址>"
  echo "示例: bash $0 \"github.com/your-username/solo-lab\""
  exit 1
fi

REPO_URL="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 正在将字符剧场第 9 幕仓库地址更新为: ${REPO_URL}"
SOLO_LAB_REPO_URL="${REPO_URL}" node "${SCRIPT_DIR}/build_character_theater_44.mjs" --repo="${REPO_URL}"
echo "✅ 渲染完成！最新 2K 成片已输出至 showcase/solo_lab_character_theater_2k.mp4"
