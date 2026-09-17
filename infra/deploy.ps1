param(
  [ValidateSet('dev', 'test', 'prod')]
  [string]$env = 'dev',
  [switch]$noBuild
)

$ErrorActionPreference = 'Stop'
$脚本目录 = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $脚本目录
. (Join-Path $脚本目录 'scripts\同源环境.ps1')

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error '未找到 docker，请先安装 Docker Desktop'
}

Copy-Item -Force -LiteralPath "envs/.env.$env" -Destination '.env'
Write-Output "已切换环境: $env"

$配置 = 读取环境文件 '.env'
合并主配置 $配置 (Split-Path -Parent $脚本目录)
foreach ($条目 in $配置.GetEnumerator()) {
  [Environment]::SetEnvironmentVariable($条目.Key, $条目.Value, 'Process')
}
$语音端口 = [Environment]::GetEnvironmentVariable('TTS_PORT', 'Process')
if (-not $语音端口) { $语音端口 = '8001' }
$编排端口 = [Environment]::GetEnvironmentVariable('N8N_PORT', 'Process')
if (-not $编排端口) { $编排端口 = '5678' }
$后端端口 = [Environment]::GetEnvironmentVariable('MANAGEMENT_BACKEND_PORT', 'Process')
if (-not $后端端口) { $后端端口 = '3100' }

if (-not $noBuild) {
  $旧偏好 = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { cmd /c 'docker compose build 2>&1' } finally { $ErrorActionPreference = $旧偏好 }
  if ($LASTEXITCODE -ne 0) { throw '构建失败' }
}

$旧偏好 = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
try { cmd /c 'docker compose up -d 2>&1' } finally { $ErrorActionPreference = $旧偏好 }
if ($LASTEXITCODE -ne 0) { throw '启动失败' }

$检查表 = @(
  @{ 地址 = "http://localhost:${后端端口}/api/jian-kang"; 名称 = '管理后端' },
  @{ 地址 = "http://localhost:${语音端口}/health"; 名称 = '语音服务' },
  @{ 地址 = "http://localhost:${编排端口}/healthz"; 名称 = '编排服务' }
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

$旧偏好 = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
try { cmd /c 'docker compose ps 2>&1' } finally { $ErrorActionPreference = $旧偏好 }
Write-Output "部署完成（环境=$env）"
