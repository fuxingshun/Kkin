$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Logs = Join-Path $Root '.logs'

function Stop-ProcessTreeFromPidFile {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,
    [Parameter(Mandatory = $true)]
    [string] $PidPath
  )

  if (-not (Test-Path -LiteralPath $PidPath)) {
    Write-Host "$Name is not running: missing $PidPath"
    return
  }

  $PidText = (Get-Content -Raw -Path $PidPath).Trim()
  $ProcessId = 0
  if (-not [int]::TryParse($PidText, [ref] $ProcessId)) {
    Remove-Item -LiteralPath $PidPath -Force
    Write-Host "$Name pid file was invalid and has been removed."
    return
  }

  $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($null -eq $Process) {
    Remove-Item -LiteralPath $PidPath -Force
    Write-Host "$Name is already stopped."
    return
  }

  & taskkill.exe /PID $ProcessId /T /F | Out-Null
  Remove-Item -LiteralPath $PidPath -Force
  Write-Host "$Name stopped."
}

Stop-ProcessTreeFromPidFile -Name 'Backend' -PidPath (Join-Path $Logs 'backend.pid')
Stop-ProcessTreeFromPidFile -Name 'Admin' -PidPath (Join-Path $Logs 'admin.pid')
