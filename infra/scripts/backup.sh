#!/usr/bin/env bash
set -euo pipefail

jiaoBenMuLu="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$jiaoBenMuLu/.."

set -a
# shellcheck disable=SC1091
source ./.env
set +a

beiFenMuLu="${BACKUP_DIR:-./backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$beiFenMuLu"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "[演练] 将备份 MySQL -> $beiFenMuLu/mysql.sql"
  echo "[演练] 将备份 PostgreSQL -> $beiFenMuLu/source-postgres.sql"
  exit 0
fi

docker compose exec -T mysql8 mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" > "$beiFenMuLu/mysql.sql"
docker compose exec -T source-postgres pg_dump -U postgres "$SOURCE_POSTGRES_DB" > "$beiFenMuLu/source-postgres.sql"

echo "备份完成: $beiFenMuLu"
ls -lh "$beiFenMuLu"
