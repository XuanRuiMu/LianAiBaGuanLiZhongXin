#!/usr/bin/env bash
set -euo pipefail

scriptDir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
infraDir="$(cd "$scriptDir/.." && pwd)"
managementDir="$(cd "$infraDir/.." && pwd)"
migrationRoot="${MIGRATIONS_ROOT:-$managementDir/../和我恋爱吧}"
compose=(docker compose --project-name love-management-fp04b --file "$infraDir/docker-compose.test.yml")

cleanup() {
  MIGRATIONS_ROOT="$migrationRoot" "${compose[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT

for command in docker node curl find; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "缺少命令：$command" >&2
    exit 1
  }
done

test -f "$migrationRoot/database/000_baseline.sql"
test -f "$migrationRoot/backend/scripts/run_migration.js"
test -d "$migrationRoot/backend/database/migrations"
export MIGRATIONS_ROOT="$migrationRoot"
export NODE_PATH="$managementDir/管理后端/node_modules${NODE_PATH:+:$NODE_PATH}"
node -e "require.resolve('pg')"

"${compose[@]}" up -d --wait postgres redis
databaseAddress="$("${compose[@]}" port postgres 5432)"
databasePort="${databaseAddress##*:}"
databaseUrl="postgresql://lovewithme:lovewithme_test_password@127.0.0.1:${databasePort}/lovewithme_test"
migrationDir="$migrationRoot/backend/database/migrations"
migrationCount="$(find "$migrationDir" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
DATABASE_URL="$databaseUrl" node "$migrationRoot/backend/scripts/run_migration.js" "$migrationDir"
DATABASE_URL="$databaseUrl" node "$migrationRoot/backend/scripts/run_migration.js" "$migrationDir"
registeredCount="$("${compose[@]}" exec -T postgres psql -U lovewithme -d lovewithme_test -Atc 'SELECT count(*) FROM schema_migrations')"
test "$registeredCount" = "$migrationCount"

# 真库门禁：tests/真库 下的用例按 tests/测试数据库.ts 的硬规矩，只允许由隔离门禁注入
# TEST_DATABASE_URL 后执行（禁止回退 .env 或跳过），故必须在此处、迁移落地后运行。
# 放在三服务 build 之前，失败可尽早暴露，不必等镜像构建完。
echo "执行管理后端真库门禁：tests/真库"
(
  cd "$managementDir/管理后端"
  TEST_DATABASE_URL="$databaseUrl" npm run --silent test:真库
)

"${compose[@]}" up -d --build --wait management-backend tts-service n8n
backendPort="$("${compose[@]}" port management-backend 3100 | sed 's/.*://')"
ttsPort="$("${compose[@]}" port tts-service 8000 | sed 's/.*://')"
n8nPort="$("${compose[@]}" port n8n 5678 | sed 's/.*://')"
curl --fail --silent --show-error "http://127.0.0.1:${backendPort}/api/jian-kang" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:${ttsPort}/health" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:${n8nPort}/healthz" >/dev/null
loginReady=false
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error \
    -H 'Content-Type: application/json' \
    --data-binary '{"email":"fp04b-ci@example.invalid","password":"fp04b-ci-only"}' \
    "http://127.0.0.1:${n8nPort}/rest/login" >/dev/null; then
    loginReady=true
    break
  fi
  sleep 2
done
test "$loginReady" = true
"${compose[@]}" exec -T n8n node -e "for (const file of ['查询统计','发起问答','触发流程','语音合成']) require('/home/node/.n8n/custom/n8n-nodes-liaolian/dist/nodes/' + file + '.node.js')"
echo "隔离门禁通过：迁移=${registeredCount}，真库门禁已过，三服务健康，n8n节点可加载"
