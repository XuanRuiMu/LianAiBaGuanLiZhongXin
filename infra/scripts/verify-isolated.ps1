param(
  [string]$MigrationsRoot = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) '..\和我恋爱吧')
)

$ErrorActionPreference = 'Stop'
$脚本目录 = $PSScriptRoot
$infra目录 = Split-Path -Parent $脚本目录
$管理目录 = Split-Path -Parent $infra目录
$迁移根 = [System.IO.Path]::GetFullPath($MigrationsRoot)
$编排文件 = Join-Path $infra目录 'docker-compose.test.yml'
$项目名 = 'love-management-fp04b'
$Node镜像 = 'node:26.10.0-alpine3.24@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80'
$节点卷键 = @{
  '管理前端' = 'frontend'
  '管理后端' = 'backend'
  'n8n-nodes-liaolian' = 'n8n-nodes'
}
$临时根 = Join-Path ([System.IO.Path]::GetTempPath()) "opencode\tts-fp04-uv-verify-$PID"
$临时父目录 = Split-Path -Parent $临时根
$环境名 = @(
  'MIGRATIONS_ROOT',
  'NODE_PATH',
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'UV_CACHE_DIR',
  'UV_PROJECT_ENVIRONMENT',
  'UV_NO_SYNC',
  'UV_NO_DEV',
  'UV_NO_DEFAULT_GROUPS',
  'PYTHONPATH',
  'PYTHONDONTWRITEBYTECODE',
  'COVERAGE_FILE'
)
$环境备份 = @{}
$汇总 = [ordered]@{}
$镜像基线 = [ordered]@{
  'postgres:18.6-alpine3.24@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873' = 'sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873'
  'redis:8.10.1-alpine3.23@sha256:ef216d85ec44f4fdf7c0e6df2d1757a4734ed32fbb278cabd3181b5a27353b79' = 'sha256:ef216d85ec44f4fdf7c0e6df2d1757a4734ed32fbb278cabd3181b5a27353b79'
  'n8nio/n8n:2.40.6@sha256:9c7871d5cc4fc2565bb905e4df5bf7d6a5a4bf2f4313fb99a2b3fa380f331d7c' = 'sha256:9c7871d5cc4fc2565bb905e4df5bf7d6a5a4bf2f4313fb99a2b3fa380f331d7c'
  'python:3.14.7-slim-bookworm@sha256:82bc3c539b8813ada9d68c63b40158fa002f7f33de9bf3312a3dfdc0620dff56' = 'sha256:82bc3c539b8813ada9d68c63b40158fa002f7f33de9bf3312a3dfdc0620dff56'
  'ghcr.io/astral-sh/uv:0.12.18@sha256:3adc3706091ce7c2fe595e669628caedd6d951551b92b258b7e7dbe06d9440bc' = 'sha256:3adc3706091ce7c2fe595e669628caedd6d951551b92b258b7e7dbe06d9440bc'
}

foreach ($名称 in $环境名) {
  $项 = Get-Item -LiteralPath "Env:$名称" -ErrorAction SilentlyContinue
  $环境备份[$名称] = if ($null -eq $项) { $null } else { $项.Value }
  $存在 = $null -ne $项
  $环境备份["$名称.存在"] = $存在
}

function 恢复环境 {
  param([string]$名称)
  if ($环境备份["$名称.存在"]) {
    [Environment]::SetEnvironmentVariable($名称, $环境备份[$名称], 'Process')
  } else {
    [Environment]::SetEnvironmentVariable($名称, $null, 'Process')
  }
}

function 调用编排 {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$参数)
  $原错误偏好 = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & docker compose --project-name $项目名 --file $编排文件 @参数
    $退出码 = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $原错误偏好
  }
  if ($退出码 -ne 0) {
    throw "Docker Compose失败：$($参数 -join ' ')"
  }
}

function 去除终端颜色 {
  param([string]$文本)
  return [regex]::Replace($文本, "$([char]27)\[[0-?]*[ -/]*[@-~]", '')
}

function 调用Node项目 {
  param(
    [Parameter(Mandatory = $true)][string]$项目,
    [Parameter(Mandatory = $true)][string]$命令,
    [hashtable]$环境 = @{},
    [switch]$允许第三方NpmWarning
  )
  $卷键 = $节点卷键[$项目]
  if ([string]::IsNullOrWhiteSpace($卷键)) {
    throw "未登记Node项目卷键：$项目"
  }
  $依赖卷 = "love-management-fp04b-node-$PID-$卷键-dependencies"
  $产物卷 = "love-management-fp04b-node-$PID-$卷键-output"
  $Docker参数 = @(
    'run', '--rm',
    '--add-host', 'host.docker.internal:host-gateway',
    '--mount', "type=bind,source=$管理目录,target=/inputs/管理,readonly",
    '--mount', "type=bind,source=$迁移根,target=/inputs/和我恋爱吧,readonly",
    '--mount', "type=bind,source=$临时根/npm-cache,target=/root/.npm",
    '--mount', "type=volume,source=$依赖卷,target=/inputs/管理/$项目/node_modules",
    '--mount', "type=volume,source=$产物卷,target=/inputs/管理/$项目/dist",
    '--workdir', "/inputs/管理/$项目"
  )
  foreach ($键 in $环境.Keys) {
    $Docker参数 += @('--env', "$键=$($环境[$键])")
  }
  $Docker参数 += @($Node镜像, 'sh', '-lc', $命令)
  $原错误偏好 = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $原始输出 = @(& docker @Docker参数 2>&1)
    $退出码 = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $原错误偏好
  }
  $输出 = @($原始输出 | ForEach-Object { $_.ToString() })
  $输出 | ForEach-Object { [Console]::WriteLine($_) }
  $文本 = 去除终端颜色 ($输出 -join "`n")
  if ($退出码 -ne 0) {
    throw "Node项目失败：$项目，退出码=$退出码"
  }
  $严格警告 = '(?i)(\[Vue warn\]|\[VUE_ROUTER_R\d+\]|\bDeprecationWarning\b|(^|\W)(warning|warnings)(\W|$))'
  if (-not $允许第三方NpmWarning) {
    $严格警告 = '(?i)(\[Vue warn\]|\[VUE_ROUTER_R\d+\]|\bDeprecationWarning\b|\bnpm\s+(?:warn|warning)\b|(^|\W)(warning|warnings)(\W|$))'
  }
  if ($文本 -match $严格警告) {
    throw "Node项目出现 warning：$项目"
  }
  if ($文本 -match '(?im)(^|[|\s])([1-9]\d*)\s+skipped\b|\bskipped\s*[:=]\s*([1-9]\d*)\b') {
    throw "Node项目出现 skip：$项目"
  }
  return $文本
}

function 取数量 {
  param([string]$文本, [string]$模式, [string]$名称)
  $匹配 = [regex]::Match($文本, $模式)
  if (-not $匹配.Success) {
    throw "无法解析$名称"
  }
  return [int]$匹配.Groups[1].Value
}

function 还原并清理 {
  $env:MIGRATIONS_ROOT = $迁移根
  & docker compose --project-name $项目名 --file $编排文件 down --volumes --remove-orphans | Out-Null
  foreach ($卷键 in $节点卷键.Values) {
    foreach ($卷名 in @(
      "love-management-fp04b-node-$PID-$卷键-dependencies",
      "love-management-fp04b-node-$PID-$卷键-output"
    )) {
      $存在卷 = @(& docker volume ls --filter "name=^$卷名$" --format '{{.Name}}')
      if ($存在卷.Count -ne 0) {
        & docker volume rm --force $卷名 | Out-Null
        if ($LASTEXITCODE -ne 0) {
          throw "Node临时卷清理失败：$卷名"
        }
      }
    }
  }
  if (Test-Path -LiteralPath $临时根) {
    Remove-Item -LiteralPath $临时根 -Recurse -Force
  }
  foreach ($名称 in $环境名) {
    恢复环境 $名称
  }
  $容器 = @(& docker ps -a --filter "label=com.docker.compose.project=$项目名" --format '{{.ID}}')
  $网络 = @(& docker network ls --filter "label=com.docker.compose.project=$项目名" --format '{{.ID}}')
  $卷 = @(& docker volume ls --filter "label=com.docker.compose.project=$项目名" --format '{{.Name}}')
  $节点卷残留 = @()
  foreach ($卷键 in $节点卷键.Values) {
    $节点卷残留 += @(& docker volume ls --filter "name=^love-management-fp04b-node-$PID-$卷键-" --format '{{.Name}}')
  }
  if ($容器.Count -ne 0 -or $网络.Count -ne 0 -or $卷.Count -ne 0 -or $节点卷残留.Count -ne 0) {
    throw "隔离资源清理不完整：容器=$($容器.Count)，网络=$($网络.Count)，卷=$($卷.Count)，Node卷=$($节点卷残留.Count)"
  }
}

try {
  foreach ($命令 in @('docker', 'python', 'curl.exe')) {
    if (-not (Get-Command $命令 -ErrorAction SilentlyContinue)) {
      throw "缺少命令：$命令"
    }
  }
  if (-not (Test-Path -LiteralPath $临时父目录 -PathType Container)) {
    throw "临时父目录不存在：$临时父目录"
  }
  foreach ($路径 in @(
    (Join-Path $迁移根 'database\000_baseline.sql'),
    (Join-Path $迁移根 'backend\scripts\run_migration.js'),
    (Join-Path $迁移根 'backend\database\migrations')
  )) {
    if (-not (Test-Path -LiteralPath $路径)) {
      throw "迁移文件不存在：$路径"
    }
  }
  foreach ($路径 in @(
    (Join-Path $管理目录 '管理前端\package-lock.json'),
    (Join-Path $管理目录 '管理后端\package-lock.json'),
    (Join-Path $管理目录 'n8n-nodes-liaolian\package-lock.json'),
    (Join-Path $管理目录 'tts-service\pyproject.toml'),
    (Join-Path $管理目录 'tts-service\uv.lock')
  )) {
    if (-not (Test-Path -LiteralPath $路径 -PathType Leaf)) {
      throw "锁定文件不存在：$路径"
    }
  }

  $env:MIGRATIONS_ROOT = $迁移根
  & docker compose --project-name $项目名 --file $编排文件 down --volumes --remove-orphans | Out-Null
  if (Test-Path -LiteralPath $临时根) {
    Remove-Item -LiteralPath $临时根 -Recurse -Force
  }
  New-Item -ItemType Directory -Path $临时根 | Out-Null

  $前端命令 = 'npm ci --no-audit --no-fund && npm run lint && npm run build && test -s dist/index.html && test -s dist/build-stats.json && npm test -- --maxWorkers=2'
  $前端输出 = 调用Node项目 -项目 '管理前端' -命令 $前端命令
  $汇总.管理前端测试 = 取数量 $前端输出 'Tests\s+(\d+)\s+passed' '管理前端测试数'

  $n8n命令 = @'
set -eu
mkdir -p /tmp/fp04-compat
npm install --prefix /tmp/fp04-compat --no-save --ignore-scripts --no-audit --no-fund n8n@2.40.1 n8n-nodes-base@2.40.1
cat > /tmp/fp04-verify.cjs <<'EOF'
const n8n = require('/tmp/fp04-compat/node_modules/n8n/package.json');
const nodes = require('/tmp/fp04-compat/node_modules/n8n-nodes-base/package.json');
if (n8n.version !== '2.40.1' || nodes.version !== '2.40.1') process.exit(1);
EOF
node /tmp/fp04-verify.cjs
npm ci --no-audit --no-fund
test ! -e node_modules/n8n-nodes-base
cat > /tmp/fp04-project-check.cjs <<'EOF'
const p = require('/inputs/管理/n8n-nodes-liaolian/package.json');
if (p.dependencies?.['n8n-nodes-base'] || p.devDependencies?.['n8n-nodes-base']) process.exit(1);
EOF
node /tmp/fp04-project-check.cjs
npm run build
test -s dist/nodes/公共.js
node --test test/nodes.test.cjs
'@
  $n8n输出 = 调用Node项目 -项目 'n8n-nodes-liaolian' -命令 $n8n命令 -允许第三方NpmWarning
  $汇总.第三方NpmWarning行 = ([regex]::Matches($n8n输出, '(?im)^npm warn\b')).Count
  $汇总.第三方NpmERESOLVE = ([regex]::Matches($n8n输出, '(?im)^npm warn ERESOLVE\b')).Count
  $汇总.第三方N包弃用 = ([regex]::Matches($n8n输出, '(?im)^npm warn deprecated [^\s]')).Count
  $汇总.n8n测试 = 取数量 $n8n输出 'tests\s+(\d+)' 'n8n测试数'
  $汇总.n8n通过 = 取数量 $n8n输出 'pass\s+(\d+)' 'n8n通过数'
  if ($汇总.n8n测试 -ne 10 -or $汇总.n8n通过 -ne 10) {
    throw "n8n节点测试必须为10项全通过：测试=$($汇总.n8n测试)，通过=$($汇总.n8n通过)"
  }

  $python命令 = (Get-Command python).Source
  $python版本 = & $python命令 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
  if ($LASTEXITCODE -ne 0 -or $python版本 -ne '3.14') {
    throw "原生 Python 必须为3.14：$python版本"
  }
  & $python命令 -m pip install --disable-pip-version-check --no-warn-script-location --target (Join-Path $临时根 'tool') uv==0.12.18
  if ($LASTEXITCODE -ne 0) {
    throw '临时 uv 安装失败'
  }
  $uv = Join-Path $临时根 'tool\bin\uv.exe'
  $tts目录 = Join-Path $管理目录 'tts-service'
  $env:UV_CACHE_DIR = Join-Path $临时根 'uv-cache'
  $env:UV_PROJECT_ENVIRONMENT = Join-Path $临时根 'venv'
  $env:PYTHONDONTWRITEBYTECODE = '1'
  $env:COVERAGE_FILE = Join-Path $临时根 '.coverage'
  [Environment]::SetEnvironmentVariable('UV_NO_SYNC', $null, 'Process')
  [Environment]::SetEnvironmentVariable('UV_NO_DEV', $null, 'Process')
  [Environment]::SetEnvironmentVariable('UV_NO_DEFAULT_GROUPS', $null, 'Process')

  & $uv lock --directory $tts目录 --check
  if ($LASTEXITCODE -ne 0) { throw 'uv lock 校验失败' }
  & $uv export --directory $tts目录 --frozen --all-groups --no-emit-project --no-header --output-file (Join-Path $临时根 'requirements.lock')
  if ($LASTEXITCODE -ne 0) { throw 'uv export 失败' }
  $锁导出哈希 = (Get-FileHash -LiteralPath (Join-Path $临时根 'requirements.lock') -Algorithm SHA256).Hash
  $登记导出哈希 = (Get-FileHash -LiteralPath (Join-Path $tts目录 'requirements.lock') -Algorithm SHA256).Hash
  if ($锁导出哈希 -ne $登记导出哈希) {
    throw 'uv.lock 导出与 requirements.lock 不一致'
  }
  & $uv sync --directory $tts目录 --frozen --group dev --python $python命令
  if ($LASTEXITCODE -ne 0) { throw 'uv dev依赖组同步失败' }
  $插件探针 = "import importlib.metadata as m,sys; assert sys.version_info[:2] == (3,14); assert m.version('pytest') == '9.1.1'; assert m.version('pytest-asyncio') == '1.4.0'; assert m.version('httpx2') == '2.13.1'; print(sys.version); print('pytest='+m.version('pytest')); print('pytest-asyncio='+m.version('pytest-asyncio')); print('httpx2='+m.version('httpx2'))"
  & $uv run --directory $tts目录 --frozen --group dev --no-sync --python $python命令 python -c $插件探针
  if ($LASTEXITCODE -ne 0) { throw 'pytest-asyncio 锁定环境探针失败' }
  $junit = Join-Path $临时根 'tts-junit.xml'
  $覆盖率文件 = Join-Path $临时根 'tts-coverage.xml'
  & $uv run --directory $tts目录 --frozen --group dev --no-sync --python $python命令 python -m pytest -W error::DeprecationWarning -W error --strict-config --strict-markers --junitxml=$junit "--cov-report=xml:$覆盖率文件" -q
  if ($LASTEXITCODE -ne 0) { throw 'TTS pytest失败、存在skip或warning' }
  [xml]$junit报告 = [System.IO.File]::ReadAllText($junit)
  [xml]$覆盖率报告 = [System.IO.File]::ReadAllText($覆盖率文件)
  $套件 = @($junit报告.SelectNodes('//testsuite'))
  $汇总.TTS测试 = ($套件 | Measure-Object -Property tests -Sum).Sum
  $汇总.TTS失败 = ($套件 | Measure-Object -Property failures -Sum).Sum
  $汇总.TTS错误 = ($套件 | Measure-Object -Property errors -Sum).Sum
  $汇总.TTS跳过 = ($套件 | Measure-Object -Property skipped -Sum).Sum
  $汇总.TTS覆盖率 = [double]::Parse($覆盖率报告.coverage.'line-rate', [System.Globalization.CultureInfo]::InvariantCulture) * 100
  if ($汇总.TTS测试 -ne 64 -or $汇总.TTS失败 -ne 0 -or $汇总.TTS错误 -ne 0 -or $汇总.TTS跳过 -ne 0 -or $汇总.TTS覆盖率 -ne 100) {
    throw "TTS门禁计数不符：测试=$($汇总.TTS测试)，失败=$($汇总.TTS失败)，错误=$($汇总.TTS错误)，跳过=$($汇总.TTS跳过)，覆盖率=$($汇总.TTS覆盖率)"
  }

  $env:MIGRATIONS_ROOT = $迁移根
  $调用结果 = @(调用编排 config --quiet)
  if ($LASTEXITCODE -ne 0) { throw '隔离Compose配置校验失败' }
  调用编排 -参数 @('up', '-d', '--wait', 'postgres', 'redis')
  $数据库地址 = @(调用编排 port postgres 5432)
  $数据库端口 = [int](($数据库地址 | Select-Object -Last 1).Split(':')[-1])
  $连接串 = "postgresql://lovewithme:lovewithme_test_password@host.docker.internal:$数据库端口/lovewithme_test"
  $迁移目录 = Join-Path $迁移根 'backend\database\migrations'
  $迁移数 = @(Get-ChildItem -LiteralPath $迁移目录 -File -Filter '*.sql').Count
  $迁移命令 = "npm ci --no-audit --no-fund >/dev/null && node /inputs/和我恋爱吧/backend/scripts/run_migration.js /inputs/和我恋爱吧/backend/database/migrations && node /inputs/和我恋爱吧/backend/scripts/run_migration.js /inputs/和我恋爱吧/backend/database/migrations"
  调用Node项目 -项目 '管理后端' -命令 $迁移命令 -环境 @{ DATABASE_URL = $连接串 } | Out-Null
  $查询参数 = @('exec', '-T', 'postgres', 'psql', '-U', 'lovewithme', '-d', 'lovewithme_test', '-Atc', 'SELECT count(*) FROM schema_migrations')
  $登记数 = [int]((@(调用编排 @查询参数) | Select-Object -Last 1).Trim())
  if ($登记数 -ne $迁移数) {
    throw "迁移登记数不符：$登记数/$迁移数"
  }
  $汇总.迁移数 = $登记数

  调用编排 -参数 @('up', '-d', '--build', '--wait', 'management-backend', 'tts-service', 'n8n')
  $后端端口 = [int]((@(调用编排 port management-backend 3100) | Select-Object -Last 1).Split(':')[-1])
  $语音端口 = [int]((@(调用编排 port tts-service 8000) | Select-Object -Last 1).Split(':')[-1])
  $编排端口 = [int]((@(调用编排 port n8n 5678) | Select-Object -Last 1).Split(':')[-1])
  & curl.exe --fail --silent --show-error "http://127.0.0.1:$后端端口/api/jian-kang" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw '管理后端健康失败' }
  & curl.exe --fail --silent --show-error "http://127.0.0.1:$语音端口/health" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw '语音服务健康失败' }
  & curl.exe --fail --silent --show-error "http://127.0.0.1:$编排端口/healthz" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'n8n健康失败' }
  $登录体 = '{"emailOrLdapLoginId":"fp04b-ci@example.invalid","password":"fp04b-ci-only"}'
  $登录成功 = $false
  for ($轮 = 1; $轮 -le 30; $轮++) {
    try {
      Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$编排端口/rest/login" -ContentType 'application/json' -Body $登录体 -TimeoutSec 5 | Out-Null
      $登录成功 = $true
      break
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  if (-not $登录成功) { throw 'n8n实例所有者登录失败' }

  $后端命令 = 'npm ci --no-audit --no-fund && npm run lint && npm run build && test -s dist/启动.js && npm test -- --maxWorkers=2'
  $后端输出 = 调用Node项目 -项目 '管理后端' -命令 $后端命令 -环境 @{ TEST_DATABASE_URL = $连接串; DATABASE_URL = $连接串; NODE_OPTIONS = '--max-old-space-size=3072' }
  $汇总.管理后端测试 = 取数量 $后端输出 'Tests\s+(\d+)\s+passed' '管理后端测试数'
  if ($汇总.管理后端测试 -lt 289) {
    throw "管理后端测试数量下降：$($汇总.管理后端测试)"
  }

  $节点检查 = "for (const file of ['查询统计','发起问答','触发流程','语音合成']) require('/home/node/.n8n/custom/n8n-nodes-liaolian/dist/nodes/' + file + '.node.js')"
  调用编排 -参数 @('exec', '-T', 'n8n', 'node', '-e', $节点检查)
  $节点包检查 = "const p=require('/home/node/.n8n/custom/n8n-nodes-liaolian/package.json'); if (p.dependencies?.['n8n-nodes-base'] || p.devDependencies?.['n8n-nodes-base']) process.exit(1)"
  调用编排 -参数 @('exec', '-T', 'n8n', 'node', '-e', $节点包检查)

  $编排镜像 = @(调用编排 config --images)
  $服务镜像 = @(
    'postgres:18.6-alpine3.24@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873',
    'redis:8.10.1-alpine3.23@sha256:ef216d85ec44f4fdf7c0e6df2d1757a4734ed32fbb278cabd3181b5a27353b79',
    'n8nio/n8n:2.40.6@sha256:9c7871d5cc4fc2565bb905e4df5bf7d6a5a4bf2f4313fb99a2b3fa380f331d7c'
  )
  foreach ($引用 in $服务镜像) {
    if ($编排镜像 -notcontains $引用) {
      throw "隔离Compose镜像偏离锁定值：$引用"
    }
    $实际仓库摘要 = @(& docker image inspect $引用 --format '{{json .RepoDigests}}')
    if ($LASTEXITCODE -ne 0) {
      throw "镜像不可用：$引用"
    }
    $摘要文本 = $实际仓库摘要 -join ''
    if (-not $摘要文本.Contains($镜像基线[$引用])) {
      throw "镜像摘要不符：$引用"
    }
  }
  $Node摘要 = $Node镜像.Substring($Node镜像.IndexOf('@') + 1)
  $Node仓库摘要 = @(& docker image inspect $Node镜像 --format '{{json .RepoDigests}}')
  if ($LASTEXITCODE -ne 0 -or -not (($Node仓库摘要 -join '').Contains($Node摘要))) {
    throw "Node基础镜像摘要不符：$Node镜像"
  }
  foreach ($引用 in @(
    'python:3.14.7-slim-bookworm@sha256:82bc3c539b8813ada9d68c63b40158fa002f7f33de9bf3312a3dfdc0620dff56',
    'ghcr.io/astral-sh/uv:0.12.18@sha256:3adc3706091ce7c2fe595e669628caedd6d951551b92b258b7e7dbe06d9440bc'
  )) {
    $实际仓库摘要 = @(& docker image inspect $引用 --format '{{json .RepoDigests}}')
    if ($LASTEXITCODE -ne 0 -or -not (($实际仓库摘要 -join '').Contains($镜像基线[$引用]))) {
      throw "基础镜像摘要不符：$引用"
    }
  }

  调用编排 -参数 @('exec', '-T', 'postgres', 'postgres', '--version')
  调用编排 -参数 @('exec', '-T', 'redis', 'redis-server', '--version')
  调用编排 -参数 @('exec', '-T', 'tts-service', 'python', '-VV')
  调用编排 -参数 @('exec', '-T', 'n8n', 'node', '--version')
  调用编排 -参数 @('exec', '-T', 'n8n', 'n8n', '--version')

  $汇总.镜像 = $镜像基线
  [pscustomobject]$汇总 | Format-List
  "隔离门禁通过：前端=$($汇总.管理前端测试)，后端=$($汇总.管理后端测试)，TTS=$($汇总.TTS测试)，n8n=$($汇总.n8n通过)，迁移=$($汇总.迁移数)"
} finally {
  还原并清理
}
