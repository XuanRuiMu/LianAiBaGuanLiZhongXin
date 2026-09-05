param(
  [Parameter(Mandatory = $true)]
  [string]$备份目录,
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

if ($演练) {
  Write-Output "[演练] 将从 $备份目录/mysql.sql 恢复 MySQL"
  Write-Output "[演练] 将从 $备份目录/source-postgres.sql 恢复 PostgreSQL"
  exit 0
}

if (-not (Test-Path -LiteralPath "$备份目录/mysql.sql")) { throw "缺失 $备份目录/mysql.sql" }
if (-not (Test-Path -LiteralPath "$备份目录/source-postgres.sql")) { throw "缺失 $备份目录/source-postgres.sql" }

$env:MYSQL_PWD = $配置['MYSQL_ROOT_PASSWORD']
Get-Content -Raw -LiteralPath "$备份目录/mysql.sql" | docker compose exec -T mysql8 mysql -uroot "$($配置['MYSQL_DATABASE'])"
Get-Content -Raw -LiteralPath "$备份目录/source-postgres.sql" | docker compose exec -T source-postgres psql -U postgres -d "$($配置['SOURCE_POSTGRES_DB']) -f -"

Write-Output "恢复完成: $备份目录"
