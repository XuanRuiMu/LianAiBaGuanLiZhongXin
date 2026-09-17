param(
  [string]$备份目录 = "",
  [switch]$演练
)

$ErrorActionPreference = 'Stop'
$脚本目录 = Split-Path -Parent $MyInvocation.MyCommand.Path
$管理中心根 = Split-Path -Parent (Split-Path -Parent $脚本目录)
Set-Location -LiteralPath (Join-Path $脚本目录 '..')
. (Join-Path $脚本目录 '同源环境.ps1')

$配置 = 读取环境文件 '.env'
合并主配置 $配置 $管理中心根

if (-not $备份目录) {
  $备份目录 = "./backups/$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}
New-Item -ItemType Directory -Force -Path $备份目录 | Out-Null

$容器 = $配置['DOCKER_POSTGRES']
if (-not $容器) { $容器 = 'lovewithme-postgres' }
$用户 = $配置['POSTGRES_USER']
if (-not $用户) { $用户 = 'lovewithme' }
$库 = $配置['POSTGRES_DB']
if (-not $库) { $库 = 'lovewithme' }

if ($演练) {
  Write-Output "[演练] 将备份共享库 $容器/$库 -> $备份目录/lovewithme-pg.sql"
  exit 0
}

$PSNativeCommandUseErrorActionPreference = $false
$密码 = $配置['POSTGRES_PASSWORD']
docker exec -T -e "PGPASSWORD=$密码" $容器 pg_dump -U $用户 --clean --if-exists "$库" | Set-Content -Encoding utf8 "$备份目录/lovewithme-pg.sql"
if ($LASTEXITCODE -ne 0) { throw '共享库备份失败' }

Write-Output "备份完成: $备份目录"
Get-ChildItem -LiteralPath $备份目录
