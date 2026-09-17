#!/usr/bin/env bash
# 恋爱吧管理中心 · 同源环境共享模块（Bash）
# 根因：fill-empty 环境合并逻辑曾在部署/备份脚本各写一份，改一处漏一处即连错库。
# 本模块为唯一事实源，调用方 source 本文件后调用 buQiZhuPeiZhi。
# 约束：仅补空键，不覆盖已有值；缺文件静默返回，不抛错。

buQiZhuPeiZhi() {
  local wenJian="$1" hang jian zhi
  [[ -f "$wenJian" ]] || return 0
  while IFS= read -r hang || [[ -n "$hang" ]]; do
    case "$hang" in \#*|'') continue;; esac
    [[ "$hang" == *"="* ]] || continue
    jian="$(echo "${hang%%=*}" | tr -d '[:space:]')"
    [[ -z "$jian" ]] && continue
    zhi="${hang#*=}"
    zhi="${zhi%$'\r'}"
    if [[ -z "${!jian:-}" ]]; then
      printf -v "$jian" '%s' "$zhi"
      export "$jian"
    fi
  done < "$wenJian"
}
