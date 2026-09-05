#!/usr/bin/env bash
set -euo pipefail

beiFenMuLu="${1:?用法: ./restore.sh <备份目录>}"

jiaoBenMuLu="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$jiaoBenMuLu/.."

set -a
# shellcheck disable=SC1091
source ./.env
set +a

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "[演练] 将从 $beiFenMuLu/mysql.sql 恢复 MySQL"
  echo "[演练] 将从 $beiFenMuLu/source-postgres.sql 恢复 PostgreSQL"
  exit 0
fi

test -f "$beiFenMuLu/mysql.sql" || { echo "缺失 $beiFenMuLu/mysql.sql" >&2; exit 1; }
test -f "$beiFenMuLu/source-postgres.sql" || { echo "缺失 $beiFenMuLu/source-postgres.sql" >&2; exit 1; }

docker compose exec -T mysql8 mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < "$beiFenMuLu/mysql.sql"
docker compose exec -T source-postgres psql -U postgres -d "$SOURCE_POSTGRES_DB" -f - < "$beiFenMuLu/source-postgres.sql"

echo "恢复完成: $beiFenMuLu"
