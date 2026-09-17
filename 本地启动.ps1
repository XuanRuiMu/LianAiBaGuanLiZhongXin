param(
  [ValidateSet('dev', 'test', 'prod')]
  [string]$env = 'dev'
)

$ErrorActionPreference = 'Stop'
# YH-147 启动脚本相对路径+显式报错+健康等待：禁换机器即挂吞错
$根目录 = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($根目录)) {
  throw '启动失败：无法解析脚本根目录，请用绝对路径调用本地启动.ps1'
}
Set-Location -LiteralPath $根目录
. (Join-Path $根目录 'infra\scripts\同源环境.ps1')

function 取有效端口($键, $默认) {
  $原始 = [Environment]::GetEnvironmentVariable($键, 'Process')
  $数值 = 0
  if (-not [int]::TryParse($原始, [ref]$数值) -or $数值 -lt 1 -or $数值 -gt 65535) {
    $数值 = $默认
  }
  [Environment]::SetEnvironmentVariable($键, "$数值", 'Process')
  return $数值
}

$主配置路径 = Join-Path (Split-Path -Parent $根目录) '和我恋爱吧\.env'
$主配置 = 读取环境文件 $主配置路径
foreach ($条目 in $主配置.GetEnumerator()) {
  $现 = [Environment]::GetEnvironmentVariable($条目.Key, 'Process')
  if ([string]::IsNullOrWhiteSpace($现) -and -not [string]::IsNullOrWhiteSpace($条目.Value)) {
    [Environment]::SetEnvironmentVariable($条目.Key, $条目.Value, 'Process')
  }
}

$覆写 = 读取环境文件 (Join-Path $根目录 "infra\envs\.env.$env")
foreach ($条目 in $覆写.GetEnumerator()) {
  if (-not [string]::IsNullOrWhiteSpace($条目.Value)) {
    [Environment]::SetEnvironmentVariable($条目.Key, $条目.Value, 'Process')
  }
}

$后端端口 = 取有效端口 'MANAGEMENT_BACKEND_PORT' 3100
$前端端口 = 取有效端口 'FRONT_PORT' 5175
$语音端口 = 取有效端口 'TTS_PORT' 8001

$允许来源 = [Environment]::GetEnvironmentVariable('ALLOWED_ORIGINS', 'Process')
$来源表 = @()
if (-not [string]::IsNullOrWhiteSpace($允许来源)) {
  $来源表 = @($允许来源.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
}
foreach ($候选 in @("http://localhost:$前端端口", "http://127.0.0.1:$前端端口")) {
  if ($来源表 -notcontains $候选) { $来源表 += $候选 }
}
[Environment]::SetEnvironmentVariable('ALLOWED_ORIGINS', ($来源表 -join ','), 'Process')

$数据库地址 = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
if (-not [string]::IsNullOrWhiteSpace($数据库地址)) {
  throw "启动失败：本地不得直连数据库，DATABASE_URL 必须留空由服务器后端持有；本地仅当前端+语音途经远端后端访问数据"
}
$缓存地址 = [Environment]::GetEnvironmentVariable('REDIS_URL', 'Process')
if ([string]::IsNullOrWhiteSpace($缓存地址)) {
  $缓存密码 = [Environment]::GetEnvironmentVariable('REDIS_PASSWORD', 'Process')
  if ($缓存密码) {
    $编码缓存密码 = [uri]::EscapeDataString($缓存密码)
    $缓存地址 = "redis://:${编码缓存密码}@localhost:6379"
    [Environment]::SetEnvironmentVariable('REDIS_URL', $缓存地址, 'Process')
  }
}

$缺失 = @()
foreach ($键 in @('VITE_API_BASE_URL', 'JWT_SECRET')) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($键, 'Process'))) {
    $缺失 += $键
  }
}
if ($缺失.Count -gt 0) {
  throw "启动失败：缺少必要环境变量 $($缺失 -join '、')，VITE_API_BASE_URL 指向服务器管理后端，JWT_SECRET 与服务器同源"
}

$后端目录 = Join-Path $根目录 '管理后端'
$前端目录 = Join-Path $根目录 '管理前端'
$语音目录 = Join-Path $根目录 'tts-service'
$后端入口 = Join-Path $后端目录 'dist\启动.js'
if (-not (Test-Path -LiteralPath $后端入口)) {
  throw "启动失败：管理后端未构建，请先在管理后端执行 npm run build"
}

function 测试健康($地址) {
  try {
    $响应 = Invoke-WebRequest -Uri $地址 -TimeoutSec 5 -UseBasicParsing
    return $响应.StatusCode -eq 200
  } catch {
    return $false
  }
}

$后端基地址 = [Environment]::GetEnvironmentVariable('VITE_API_BASE_URL', 'Process')
if ([string]::IsNullOrWhiteSpace($后端基地址)) {
  $后端基地址 = "http://localhost:$后端端口"
}
$后端健康 = "$($后端基地址.TrimEnd('/'))/api/jian-kang"
if (-not (测试健康 $后端健康)) {
  throw "启动失败：管理后端不可达（$后端健康），本地只起前端+语音，后端请部署到服务器后重试；直连本地后端请设 VITE_API_BASE_URL=http://localhost:$后端端口 并确认后端已启动"
}
Write-Output "管理后端远端健康（$后端健康），本地跳过后端启动"
$前端进程号 = ''
if (测试健康 "http://localhost:$前端端口/") {
  Write-Output "管理前端已有健康实例运行（端口=$前端端口），跳过启动"
} else {
  $前端进程 = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev', '--', '--port', "$前端端口", '--host', '127.0.0.1') -WorkingDirectory $前端目录 -WindowStyle Hidden -PassThru
  $前端进程号 = $前端进程.Id
}
$语音进程号 = ''
if (测试健康 "http://localhost:$语音端口/health") {
  Write-Output "语音服务已有健康实例运行（端口=$语音端口），跳过启动复用现存服务"
} else {
  $蟒蛇 = Join-Path $语音目录 '.venv\Scripts\python.exe'
  if (-not (Test-Path -LiteralPath $蟒蛇)) { $蟒蛇 = 'python' }
  $语音进程 = Start-Process -FilePath $蟒蛇 -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', "$语音端口") -WorkingDirectory $语音目录 -WindowStyle Hidden -PassThru
  $语音进程号 = $语音进程.Id
}

Write-Output "管理中心已启动（环境=$env）：后端=$后端健康 前端=http://localhost:$前端端口 语音=http://localhost:$语音端口"
Write-Output "新建进程号：前端=$前端进程号 语音=$语音进程号（为空表示复用现存实例；后端部署服务器，本地不拉进程）"
