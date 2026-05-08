$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Logs = Join-Path $Root '.logs'
$BackendLog = Join-Path $Logs 'backend.log'
$BackendErr = Join-Path $Logs 'backend.err.log'
$AdminLog = Join-Path $Logs 'admin.log'
$AdminErr = Join-Path $Logs 'admin.err.log'
$BackendPid = Join-Path $Logs 'backend.pid'
$AdminPid = Join-Path $Logs 'admin.pid'

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

Push-Location $Root
try {
  & npm run server:build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $ServerJar = Join-Path $Root 'server-java\target\kinecho-server.jar'
  if (-not (Test-Path -LiteralPath $ServerJar)) {
    throw "Missing server jar: $ServerJar"
  }

  $Backend = Start-Process `
    -FilePath 'java' `
    -ArgumentList @('-jar', $ServerJar) `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $BackendLog `
    -RedirectStandardError $BackendErr `
    -PassThru `
    -WindowStyle Hidden
  Set-Content -Path $BackendPid -Value $Backend.Id

  $Admin = Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList @('/c', 'npm run dev:admin') `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $AdminLog `
    -RedirectStandardError $AdminErr `
    -PassThru `
    -WindowStyle Hidden
  Set-Content -Path $AdminPid -Value $Admin.Id

  Write-Host "KinEcho services started."
  Write-Host "Backend PID: $($Backend.Id), logs: $BackendLog"
  Write-Host "Admin PID: $($Admin.Id), logs: $AdminLog"
} finally {
  Pop-Location
}
