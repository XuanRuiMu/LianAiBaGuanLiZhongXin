param(
  [ValidateSet('dev', 'test', 'prod')]
  [string]$env = 'dev',
  [switch]$noBuild
)

$ErrorActionPreference = 'Stop'
$脚本目录 = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $脚本目录

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error '未找到 docker，请先安装 Docker Desktop'
}

Copy-Item -Force -LiteralPath "envs/.env.$env" -Destination '.env'
Write-Output "已切换环境: $env"

Get-Content -LiteralPath '.env' | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $键, $值 = $_.Split('=', 2)
  [Environment]::SetEnvironmentVariable($键.Trim(), $值.Trim(), 'Process')
}
$后端端口 = [Environment]::GetEnvironmentVariable('BACKEND_PORT', 'Process')
if (-not $后端端口) { $后端端口 = '8080' }
$AI端口 = [Environment]::GetEnvironmentVariable('AI_PORT', 'Process')
if (-not $AI端口) { $AI端口 = '8000' }
$语音端口 = [Environment]::GetEnvironmentVariable('TTS_PORT', 'Process')
if (-not $语音端口) { $语音端口 = '8001' }

if (-not $noBuild) {
  docker compose build
  if ($LASTEXITCODE -ne 0) { throw '构建失败' }
}

docker compose up -d
if ($LASTEXITCODE -ne 0) { throw '启动失败' }

$检查表 = @(
  @{ 地址 = "http://localhost:${后端端口}/health"; 名称 = '后端' },
  @{ 地址 = "http://localhost:${AI端口}/health"; 名称 = 'AI服务' },
  @{ 地址 = "http://localhost:${语音端口}/health"; 名称 = '语音服务' }
)
foreach ($项 in $检查表) {
  $就绪 = $false
  for ($i = 1; $i -le 30; $i++) {
    try {
      Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri $项.地址 | Out-Null
      $就绪 = $true
      break
    } catch {
      Start-Sleep -Seconds 10
    }
  }
  if (-not $就绪) { throw "$($项.名称) 健康检查超时，请查看 docker compose logs" }
  Write-Output "  $($项.名称) 健康"
}

docker compose ps
Write-Output "部署完成（环境=$env）"
