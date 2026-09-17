#!/usr/bin/env bash
set -euo pipefail

jiaoBenMuLu="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
guanLiGen="$(dirname "$(dirname "$jiaoBenMuLu")")"
cd "$jiaoBenMuLu/.."

set -a
# shellcheck disable=SC1091
[[ -f ./.env ]] && source ./.env
set +a
# shellcheck disable=SC1091
source "$jiaoBenMuLu/同源环境.sh"
buQiZhuPeiZhi "$guanLiGen/和我恋爱吧/.env"

beiFenMuLu="${BACKUP_DIR:-./backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$beiFenMuLu"

rongQi="${DOCKER_POSTGRES:-lovewithme-postgres}"
yongHu="${POSTGRES_USER:-lovewithme}"
ku="${POSTGRES_DB:-lovewithme}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "[演练] 将备份共享库 $rongQi/$ku -> $beiFenMuLu/lovewithme-pg.sql"
  exit 0
fi

docker exec -T -e "PGPASSWORD=$POSTGRES_PASSWORD" "$rongQi" pg_dump -U "$yongHu" --clean --if-exists "$ku" > "$beiFenMuLu/lovewithme-pg.sql"

# YH-149 备份加密异地：gpg加密+校验和，禁明文同盘
if command -v gpg >/dev/null 2>&1 && [[ -n "${BACKUP_GPG_FINGERPRINT:-}" ]]; then
  gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_FINGERPRINT" --output "$beiFenMuLu/lovewithme-pg.sql.gpg" "$beiFenMuLu/lovewithme-pg.sql"
  rm -f "$beiFenMuLu/lovewithme-pg.sql"
fi
sha256sum "$beiFenMuLu"/* > "$beiFenMuLu/SHA256SUMS" 2>/dev/null || true

echo "备份完成: $beiFenMuLu"
ls -lh "$beiFenMuLu"
