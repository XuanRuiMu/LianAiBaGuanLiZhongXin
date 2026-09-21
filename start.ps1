$ErrorActionPreference = "Stop"
# 恋爱吧管理中心启动脚本：相对路径+健康等待，禁硬编码绝对路径（对齐 和我恋爱吧/start.ps1）
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($root)) {
  throw '启动失败：无法解析项目根目录，请用绝对路径调用 start.ps1'
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  恋爱吧管理中心 - Dev Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# YH-148 终端宿主优先 Windows Terminal，无 wt.exe 时回落传统控制台：对齐 和我恋爱吧/start.ps1
# 工作目录交给 wt 的 -d 参数（Start-Process 不自动加引号，路径含空格时才不会散架），内层命令不再套引号
function 启动开发窗口 {
  param([string]$目录, [string]$标题, [string]$命令 = 'npm run dev')
  if (Get-Command 'wt.exe' -ErrorAction SilentlyContinue) {
    Start-Process -FilePath 'wt.exe' -ArgumentList '-d', "`"$目录`"", 'cmd', '/c', "title $标题 && $命令"
  } else {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "cd /d `"$目录`" && title $标题 && $命令" -WindowStyle Minimized
  }
}

Write-Host "[1/3] 启动管理后端 (端口 3100)..." -ForegroundColor Yellow
启动开发窗口 -目录 "$root\管理后端" -标题 'mgmt-backend-3100'

# 健康等待：后端 /api/jian-kang 通后再起前端（禁吞错）
$后端健康 = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try {
    $响应 = Invoke-WebRequest -Uri 'http://localhost:3100/api/jian-kang' -TimeoutSec 3 -UseBasicParsing
    if ($响应.StatusCode -eq 200) { $后端健康 = $true; break }
  } catch { }
}
if (-not $后端健康) {
  throw '启动失败：管理后端30轮健康等待未通过，请检查后端日志（确认 docker 内 PG/Redis 已启动、管理后端/.env 已配置）'
}

Write-Host "[2/3] 启动管理前端 (端口 5175)..." -ForegroundColor Yellow
启动开发窗口 -目录 "$root\管理前端" -标题 'mgmt-frontend-5175'
Start-Sleep -Seconds 2

Write-Host "[3/3] 启动 tts-service 语音服务 (端口 8001，需本机 Python)..." -ForegroundColor Yellow
启动开发窗口 -目录 "$root\tts-service" -标题 'tts-service-8001' -命令 'python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload'
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  管理前端:    http://localhost:5175" -ForegroundColor Green
Write-Host "  管理后端:    http://localhost:3100   (探活 /api/jian-kang)" -ForegroundColor Green
Write-Host "  tts-service: http://localhost:8001   (探活 /api/tts/health)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "关闭对应终端窗口（Windows Terminal 标签/窗口，或回落的传统 cmd 窗口）即可停止该服务。" -ForegroundColor DarkGray
