#!/usr/bin/env bash
set -euo pipefail

huanJing="dev"
gouJian="true"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env)
      huanJing="${2:?缺少环境名}"; shift 2;;
    --no-build)
      gouJian="false"; shift;;
    -h|--help)
      echo "用法: ./deploy.sh --env dev|test|prod [--no-build]"; exit 0;;
    *)
      echo "未知参数: $1" >&2; exit 1;;
  esac
done

case "$huanJing" in
  dev|test|prod) ;;
  *) echo "环境必须是 dev|test|prod，当前: $huanJing" >&2; exit 1;;
esac

jiaoBenMuLu="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$jiaoBenMuLu"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker，请先安装 Docker" >&2; exit 1
fi

cp "envs/.env.$huanJing" .env
echo "已切换环境: $huanJing"

set -a
# shellcheck disable=SC1091
source ./.env
set +a

# shellcheck disable=SC1091
source "$jiaoBenMuLu/scripts/同源环境.sh"
buQiZhuPeiZhi "$jiaoBenMuLu/../../和我恋爱吧/.env"

if [[ "$gouJian" == "true" ]]; then
  docker compose build
fi

docker compose up -d

echo "等待服务健康..."
等待健康() {
  diZhi="$1"
  mingCheng="$2"
  i=1
  while [ "$i" -le 30 ]; do
    if curl -fsS --max-time 5 "$diZhi" >/dev/null 2>&1; then
      echo "  $mingCheng 健康"
      return 0
    fi
    if [ "$i" -eq 30 ]; then
      echo "  $mingCheng 健康检查超时，请查看 docker compose logs" >&2
      return 1
    fi
    sleep 10
    i=$((i + 1))
  done
}
等待健康 "http://localhost:${MANAGEMENT_BACKEND_PORT:-3100}/api/jian-kang" "管理后端"
等待健康 "http://localhost:${TTS_PORT:-8001}/health" "语音服务"
等待健康 "http://localhost:${N8N_PORT:-5678}/healthz" "编排服务"

docker compose ps
echo "部署完成（环境=$huanJing）"
