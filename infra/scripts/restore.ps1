param(
  [Parameter(Mandatory = $true)]
  [string]$备份目录,
  [switch]$演练
)

$ErrorActionPreference = 'Stop'

if ($演练) {
  Write-Output '[演练] 管理中心只读，拒绝向共享库恢复；恢复请在和我恋爱吧侧执行'
  exit 0
}

throw '管理中心只读：禁止向共享库恢复，恢复请在和我恋爱吧侧执行'
