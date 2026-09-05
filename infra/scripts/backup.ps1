param(
  [string]$备份目录 = "",
  [switch]$演练
)

$ErrorActionPreference = 'Stop'
$脚本目录 = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath (Join-Path $脚本目录 '..')

$配置 = @{}
Get-Content -LiteralPath '.env' | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $键, $值 = $_.Split('=', 2)
  $配置[$键.Trim()] = $值.Trim()
}

if (-not $备份目录) {
  $备份目录 = "./backups/$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}
New-Item -ItemType Directory -Force -Path $备份目录 | Out-Null

if ($演练) {
  Write-Output "[演练] 将备份 MySQL -> $备份目录/mysql.sql"
  Write-Output "[演练] 将备份 PostgreSQL -> $备份目录/source-postgres.sql"
  exit 0
}

$env:MYSQL_PWD = $配置['MYSQL_ROOT_PASSWORD']
docker compose exec -T mysql8 mysqldump -uroot "$($配置['MYSQL_DATABASE'])" | Set-Content -Encoding utf8 "$备份目录/mysql.sql"
docker compose exec -T source-postgres pg_dump -U postgres "$($配置['SOURCE_POSTGRES_DB'])" | Set-Content -Encoding utf8 "$备份目录/source-postgres.sql"

Write-Output "备份完成: $备份目录"
Get-ChildItem -LiteralPath $备份目录
