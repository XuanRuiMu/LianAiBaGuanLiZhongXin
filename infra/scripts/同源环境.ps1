# 恋爱吧管理中心 · 同源环境共享模块（PowerShell）
# 根因：fill-empty 环境合并逻辑曾在本地启动/部署/备份三处脚本各写一份，
# 改一处漏两处即连错库。本模块为唯一事实源，三处脚本点源引用。
# 约束：只做读取与合并，不输出密钥值；缺文件返回空表，不抛错。

function 读取环境文件([string]$路径) {
  $表 = @{}
  if (-not (Test-Path -LiteralPath $路径)) { return $表 }
  Get-Content -LiteralPath $路径 | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $键, $值 = $_.Split('=', 2)
    $值 = $值.Trim()
    if ($值.Length -ge 2 -and (
      ($值.StartsWith("'") -and $值.EndsWith("'")) -or
      ($值.StartsWith('"') -and $值.EndsWith('"'))
    )) {
      $值 = $值.Substring(1, $值.Length - 2)
    }
    $表[$键.Trim()] = $值
  }
  return $表
}

function 合并缺失键($目标, $来源) {
  foreach ($条目 in $来源.GetEnumerator()) {
    if (-not $目标.ContainsKey($条目.Key) -or [string]::IsNullOrWhiteSpace($目标[$条目.Key])) {
      if (-not [string]::IsNullOrWhiteSpace($条目.Value)) {
        $目标[$条目.Key] = $条目.Value
      }
    }
  }
}

function 导出进程环境($配置) {
  foreach ($条目 in $配置.GetEnumerator()) {
    if (-not [string]::IsNullOrWhiteSpace($条目.Value)) {
      [Environment]::SetEnvironmentVariable($条目.Key, $条目.Value, 'Process')
    }
  }
}

function 合并主配置($配置, [string]$管理中心根) {
  $主配置路径 = Join-Path $管理中心根 '和我恋爱吧\.env'
  合并缺失键 $配置 (读取环境文件 $主配置路径)
}
