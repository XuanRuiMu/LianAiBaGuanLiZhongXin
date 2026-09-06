param(
  [ValidateSet('dev', 'test', 'prod')]
  [string]$env = 'dev'
)

$ErrorActionPreference = 'Stop'
$根目录 = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $根目录

Get-Content -LiteralPath "infra\envs\.env.$env" | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $键, $值 = $_.Split('=', 2)
  [Environment]::SetEnvironmentVariable($键.Trim(), $值.Trim(), 'Process')
}

$后端 = @{
  INTERNAL_TOKEN = [Environment]::GetEnvironmentVariable('INTERNAL_TOKEN', 'Process')
  JWT_SECRET = [Environment]::GetEnvironmentVariable('JWT_SECRET', 'Process')
  MYSQL_PASSWORD = [Environment]::GetEnvironmentVariable('MYSQL_ROOT_PASSWORD', 'Process')
  REDIS_PASSWORD = [Environment]::GetEnvironmentVariable('REDIS_PASSWORD', 'Process')
  SOURCE_PG_USERNAME = [Environment]::GetEnvironmentVariable('SOURCE_PG_USERNAME', 'Process')
  SOURCE_PG_PASSWORD = [Environment]::GetEnvironmentVariable('SOURCE_PG_PASSWORD', 'Process')
}
$AI = @{
  INTERNAL_TOKEN = $后端.INTERNAL_TOKEN
  JWT_SECRET = $后端.JWT_SECRET
  REPORT_DIR = "$根目录\ai-service\reports"
  EVENT_SECRET = [Environment]::GetEnvironmentVariable('EVENT_SECRET', 'Process')
}
$语音 = @{
  INTERNAL_TOKEN = $后端.INTERNAL_TOKEN
  JWT_SECRET = [Environment]::GetEnvironmentVariable('JWT_SECRET', 'Process')
}

function 启动进程($变量表, $程序, $参数, $目录) {
  foreach ($键 in $变量表.Keys) {
    [Environment]::SetEnvironmentVariable($键, $变量表[$键], 'Process')
  }
  Start-Process -FilePath $程序 -ArgumentList $参数 -WorkingDirectory $目录 -WindowStyle Hidden
}

启动进程 $后端 'java' @('-jar', 'target\love-analytics-backend-1.0.0.jar') "$根目录\backend-java"
启动进程 $AI "$根目录\ai-service\.venv\Scripts\python.exe" @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000') "$根目录\ai-service"
启动进程 $语音 "$根目录\tts-service\.venv\Scripts\python.exe" @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8001') "$根目录\tts-service"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev' -WorkingDirectory "$根目录\analytics-frontend" -WindowStyle Hidden

Write-Output "本地四服务已以后台进程启动（环境=$env），端口：前端5174 后端8080 AI8000 语音8001"
