#!/usr/bin/env bash
set -euo pipefail

beiFenMuLu="${1:?用法: ./restore.sh <备份目录>}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "[演练] 管理中心只读，拒绝向共享库恢复；恢复请在和我恋爱吧侧执行"
  exit 0
fi

echo "管理中心只读：禁止向共享库恢复，恢复请在和我恋爱吧侧执行" >&2
exit 1
