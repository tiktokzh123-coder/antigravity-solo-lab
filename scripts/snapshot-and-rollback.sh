#!/usr/bin/env bash
# ============================================================================
# 通用一键安全快照与 1 秒无损回滚工具 (Universal Snapshot & Rollback Tool)
# ============================================================================
# 适用范围：任意 Web / 全栈项目（零特定业务耦合，自动排除体积庞大的依赖与缓存目录）
# 支持子命令：
#   1. backup [标签名]               - 创建当前项目源码快照并更新 latest 指针
#   2. rollback [快照文件名|latest]  - 1 秒内将项目源码无损恢复至指定或最近快照
#   3. list                          - 列出所有可用的历史快照恢复点
# ============================================================================

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 智能定位项目根目录（支持从项目根目录或 scripts/ 子目录调用）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${PROJECT_ROOT:-}" ]]; then
  ROOT_DIR="$(cd "${PROJECT_ROOT}" && pwd)"
elif [[ "$(basename "${SCRIPT_DIR}")" == "scripts" ]]; then
  PARENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
  if [[ "$(basename "${PARENT_DIR}")" == ".agents" || "$(basename "${PARENT_DIR}")" == ".agent" ]]; then
    ROOT_DIR="$(cd "${PARENT_DIR}/.." && pwd)"
  else
    ROOT_DIR="${PARENT_DIR}"
  fi
else
  ROOT_DIR="$(pwd)"
fi

BACKUP_DIR="${ROOT_DIR}/.backups"
LATEST_POINTER="${BACKUP_DIR}/latest"
MANIFEST_LOG="${BACKUP_DIR}/manifest.log"

# 打印帮助信息
print_usage() {
  echo -e "${BOLD}${CYAN}======================================================================${NC}"
  echo -e "${BOLD}⏱️  通用一键安全快照与 1 秒无损回滚工具 (snapshot-and-rollback.sh)${NC}"
  echo -e "${BOLD}${CYAN}======================================================================${NC}"
  echo -e "用法:"
  echo -e "  ${GREEN}$0 backup [标签名]${NC}               创建源码安全快照 (默认标签: manual)"
  echo -e "  ${GREEN}$0 rollback [快照文件名|latest]${NC}  1 秒无损回滚到最近一次或指定快照"
  echo -e "  ${GREEN}$0 list${NC}                          列出所有可用恢复点及最新指针状态"
  echo -e ""
  echo -e "示例:"
  echo -e "  $0 backup before-refactor"
  echo -e "  $0 list"
  echo -e "  $0 rollback latest"
}

# 子命令 1：创建源码快照
cmd_backup() {
  local raw_label="${1:-manual}"
  # 清洗标签名，仅保留字母、数字、下划线、中划线与中文字符
  local safe_label
  safe_label="$(echo "${raw_label}" | tr ' /:\\' '----' | tr -cd '[:alnum:]_-')"
  if [[ -z "${safe_label}" ]]; then
    safe_label="snapshot"
  fi

  mkdir -p "${BACKUP_DIR}"

  local timestamp
  timestamp="$(date '+%Y%m%d-%H%M%S')"
  local archive_name="snapshot-${timestamp}-${safe_label}.tar.gz"
  local archive_path="${BACKUP_DIR}/${archive_name}"

  echo -e "${CYAN}📦 正在为项目创建安全快照...${NC}"
  echo -e "   项目根目录: ${ROOT_DIR}"
  echo -e "   目标快照包: .backups/${archive_name}"

  # 在项目根目录打包，自动排除依赖包、版本库、构建产物及备份目录自身
  tar -czf "${archive_path}" \
    --exclude='./.backups' \
    --exclude='./backups' \
    --exclude='./node_modules' \
    --exclude='*/node_modules' \
    --exclude='./.git' \
    --exclude='./dist' \
    --exclude='./build' \
    --exclude='./out' \
    --exclude='./coverage' \
    --exclude='./.next' \
    --exclude='./.nuxt' \
    --exclude='./.venv' \
    --exclude='./venv' \
    --exclude='*/__pycache__' \
    --exclude='./.DS_Store' \
    -C "${ROOT_DIR}" .

  # 更新最新快照指针与元数据日志，并保存快照时刻的文件清单用于回滚时清理新增冗余文件
  tar -tzf "${archive_path}" | sed 's|^\./||' | sort -u > "${archive_path}.files"
  echo "${archive_name}" > "${LATEST_POINTER}"
  local file_size
  file_size="$(du -h "${archive_path}" | awk '{print $1}')"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] CREATE ${archive_name} (size=${file_size}, label=${safe_label})" >> "${MANIFEST_LOG}"

  echo -e "${GREEN}✅ 快照创建成功！${NC}"
  echo -e "   • 快照文件: ${BOLD}.backups/${archive_name}${NC} (${file_size})"
  echo -e "   • 最新指针: 已更新指向 ${BOLD}${archive_name}${NC}"
}

# 子命令 2：1 秒无损回滚
cmd_rollback() {
  local target="${1:-latest}"
  local archive_name=""
  local archive_path=""

  if [[ ! -d "${BACKUP_DIR}" ]]; then
    echo -e "${RED}❌ 错误: 未找到备份目录 (${BACKUP_DIR})，请先执行 backup 创建快照。${NC}" >&2
    exit 1
  fi

  if [[ "${target}" == "latest" ]]; then
    if [[ -f "${LATEST_POINTER}" ]]; then
      archive_name="$(cat "${LATEST_POINTER}" | tr -d '[:space:]')"
    else
      # 若指针文件不存在，自动按修改时间寻找最新的快照包
      archive_name="$(ls -1t "${BACKUP_DIR}"/snapshot-*.tar.gz 2>/dev/null | head -n 1 | xargs basename 2>/dev/null || true)"
    fi
  else
    archive_name="$(basename "${target}")"
  fi

  if [[ -z "${archive_name}" ]]; then
    echo -e "${RED}❌ 错误: 当前没有任何可用的快照恢复点。${NC}" >&2
    exit 1
  fi

  archive_path="${BACKUP_DIR}/${archive_name}"
  if [[ ! -f "${archive_path}" ]]; then
    echo -e "${RED}❌ 错误: 找不到指定的快照文件: ${archive_path}${NC}" >&2
    exit 1
  fi

  echo -e "${YELLOW}⏳ 正在校验快照归档完整性: ${archive_name} ...${NC}"
  if ! tar -tzf "${archive_path}" >/dev/null 2>&1; then
    echo -e "${RED}❌ 错误: 快照文件损坏或格式无效，已中止回滚！${NC}" >&2
    exit 1
  fi

  echo -e "${CYAN}⚡ 正在执行 1 秒源码回滚至项目根目录: ${ROOT_DIR}${NC}"
  tar -xzf "${archive_path}" -C "${ROOT_DIR}"

  # 若存在快照文件清单，清理快照之后新创建的未跟踪源码文件
  if [[ -f "${archive_path}.files" ]]; then
    while IFS= read -r cur_file; do
      local rel_f="${cur_file#./}"
      if [[ -n "${rel_f}" && -f "${ROOT_DIR}/${rel_f}" ]]; then
        if ! grep -Fxq "${rel_f}" "${archive_path}.files"; then
          rm -f "${ROOT_DIR}/${rel_f}"
          echo -e "   🧹 已清理快照后新增文件: ${rel_f}"
        fi
      fi
    done < <(cd "${ROOT_DIR}" && find . -maxdepth 4 -type f \
      -not -path './.backups*' -not -path './node_modules*' \
      -not -path './.git*' -not -path './memory/.memory-store*')
  fi

  echo "${archive_name}" > "${LATEST_POINTER}"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ROLLBACK_TO ${archive_name}" >> "${MANIFEST_LOG}"

  echo -e "${GREEN}🎉 源码快照回滚完成！项目文件已恢复至快照状态: ${BOLD}${archive_name}${NC}"
  echo -e "${YELLOW}ℹ️  边界说明: 本地源码与配置已精确恢复；若此前已触发远端发布/外部接口/独立数据库写入，请按推进与结束规则核对外部状态。${NC}"
}

# 子命令 3：列出所有可用恢复点
cmd_list() {
  echo -e "${BOLD}${CYAN}======================================================================${NC}"
  echo -e "${BOLD}🗂️  项目可用快照恢复点列表 (.backups/)${NC}"
  echo -e "${BOLD}${CYAN}======================================================================${NC}"

  if [[ ! -d "${BACKUP_DIR}" ]]; then
    echo -e "${YELLOW}⚪ 当前尚未创建任何快照。可使用 '$0 backup [标签名]' 创建第一个恢复点。${NC}"
    return 0
  fi

  local latest_name=""
  if [[ -f "${LATEST_POINTER}" ]]; then
    latest_name="$(cat "${LATEST_POINTER}" | tr -d '[:space:]')"
  fi

  shopt -s nullglob
  local archives=("${BACKUP_DIR}"/snapshot-*.tar.gz)
  shopt -u nullglob

  if [[ ${#archives[@]} -eq 0 ]]; then
    echo -e "${YELLOW}⚪ 备份目录为空。可使用 '$0 backup [标签名]' 创建恢复点。${NC}"
    return 0
  fi

  local idx=1
  for archive in $(ls -1t "${BACKUP_DIR}"/snapshot-*.tar.gz); do
    local name
    name="$(basename "${archive}")"
    local size
    size="$(du -h "${archive}" | awk '{print $1}')"
    local mtime
    mtime="$(stat -f '%Sm' -t '%Y-%m-%d %H:%M:%S' "${archive}" 2>/dev/null || stat -c '%y' "${archive}" 2>/dev/null | cut -d'.' -f1)"

    if [[ "${name}" == "${latest_name}" ]]; then
      echo -e "  ${GREEN}${BOLD}[#${idx}] ${name}${NC}  (${size})  创建于: ${mtime}  ${GREEN}👈 [LATEST 当前最新]${NC}"
    else
      echo -e "  [#${idx}] ${name}  (${size})  创建于: ${mtime}"
    fi
    idx=$((idx + 1))
  done
  echo -e "${CYAN}----------------------------------------------------------------------${NC}"
  echo -e "💡 提示: 执行 ${BOLD}$0 rollback latest${NC} 可在 1 秒内恢复到最新快照状态。"
}

# 主入口分发
SUBCOMMAND="${1:-help}"
shift || true

case "${SUBCOMMAND}" in
  backup)
    cmd_backup "$@"
    ;;
  rollback)
    cmd_rollback "$@"
    ;;
  list)
    cmd_list
    ;;
  -h|--help|help)
    print_usage
    ;;
  *)
    echo -e "${RED}❌ 未知子命令: ${SUBCOMMAND}${NC}" >&2
    print_usage
    exit 1
    ;;
esac
