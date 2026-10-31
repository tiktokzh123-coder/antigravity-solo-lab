#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# 🚀 Solo Lab (antigravity-solo-lab) · 一键登录 GitHub + 自动替换第9幕真实地址 + 自动建仓上传
# ==============================================================================

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_NAME="${1:-antigravity-solo-lab}"

cd "$REPO_DIR"

echo "🔍 [1/4] 检查 GitHub CLI (gh) 登录状态..."
if ! gh auth status >/dev/null 2>&1; then
  echo "🌐 正在唤起您的本机 Chrome 浏览器（可直接选择 Continue with Google 登录 GitHub）..."
  gh auth login --hostname github.com --git-protocol https --web
fi

GH_USER="$(gh api user -q .login)"
REAL_REPO_URL="github.com/${GH_USER}/${REPO_NAME}"
echo "✅ 已登录 GitHub 账号: @${GH_USER}"
echo "🎯 目标公开仓库地址: https://${REAL_REPO_URL}"

echo "🎬 [2/4] 正在将《No.44 · 字符剧场》第 9 幕取景框替换为真实仓库地址 (${REAL_REPO_URL}) 并重新合成视频..."
bash "$REPO_DIR/showcase/character_theater_44/set-github-url.sh" "$REAL_REPO_URL"

echo "📝 [3/4] 正在同步更新 README.md 与 README.en.md 中的克隆链接..."
sed -i '' "s|github.com/your-username/antigravity-solo-lab|${REAL_REPO_URL}|g" "$REPO_DIR/README.md" "$REPO_DIR/README.en.md" || true

if [ ! -d "$REPO_DIR/.git" ]; then
  git init
  git branch -M main
fi

git add .
git commit -m "feat: release Solo Lab (${REPO_NAME}) for Google Antigravity IDE v1.0.0" || true

echo "🚀 [4/4] 正在创建公开仓库 https://${REAL_REPO_URL} 并上传全部代码与视频..."
if gh repo view "${GH_USER}/${REPO_NAME}" >/dev/null 2>&1; then
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/${GH_USER}/${REPO_NAME}.git"
  git push -u origin main --force
else
  gh repo create "${REPO_NAME}" --public --source=. --remote=origin --push \
    --description "Solo Lab (单人实验室): 专为 Google Antigravity（谷歌反重力引擎 IDE）打造的全栈自进化智能体工作台与 1+N 多窗口并发底座"
fi

echo ""
echo "🎉 ============================================================================"
echo "✅ 开源发布大功告成！"
echo "🔗 您的 GitHub 仓库地址: https://${REAL_REPO_URL}"
echo "💡 提示：打开 https://${REAL_REPO_URL} 点击 Edit README，将 showcase/solo_lab_character_theater_fast.mp4 (4.62MB) 拖入顶部即可激活 GitHub 原生视频播放器！"
echo "=============================================================================="
