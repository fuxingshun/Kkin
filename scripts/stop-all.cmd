@echo off
set "KIN_SCRIPT=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=$env:KIN_SCRIPT; $marker=':powershell'; $text=[IO.File]::ReadAllText($p,[Text.Encoding]::UTF8); $i=$text.LastIndexOf($marker); if ($i -lt 0) { throw 'PowerShell block not found.' }; $script:KinScriptPath=$p; $code=$text.Substring($i + $marker.Length); Invoke-Expression $code"
set "KIN_EXIT=%ERRORLEVEL%"
set "KIN_SCRIPT="
pause
exit /b %KIN_EXIT%
:powershell
$ErrorActionPreference = "Stop"

$scriptPath = $script:KinScriptPath
if (-not $scriptPath) {
    $scriptPath = $MyInvocation.MyCommand.Path
}

$scriptDir = Split-Path -Parent $scriptPath
$projectRoot = Split-Path -Parent $scriptDir
$logsDir = Join-Path $projectRoot ".logs"

function Write-Step {
    param([string]$Message)
    Write-Host "[KinEcho] $Message"
}

function Stop-ProcessSafe {
    param([int]$ProcessId)

    if ($ProcessId -le 0 -or $ProcessId -eq $PID) {
        return
    }

    try {
        $taskkillOutput = & taskkill /PID $ProcessId /T /F 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Step "Stopped PID=$ProcessId"
        }
    }
    catch {
    }
}

function Stop-ByPidFile {
    param([string]$Name)

    $pidFile = Join-Path $logsDir "$Name.pid"
    if (-not (Test-Path -LiteralPath $pidFile)) {
        return
    }

    $rawPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($rawPid -match "^\d+$") {
        Stop-ProcessSafe -ProcessId ([int]$rawPid)
    }

    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

function Stop-ByPorts {
    param([int[]]$Ports)

    $pids = New-Object System.Collections.Generic.HashSet[int]
    $lines = netstat -ano -p tcp

    foreach ($line in $lines) {
        if ($line -match "^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$") {
            $port = [int]$matches[1]
            $processId = [int]$matches[2]
            if ($Ports -contains $port) {
                [void]$pids.Add($processId)
            }
        }
    }

    foreach ($processId in $pids) {
        Stop-ProcessSafe -ProcessId $processId
    }
}

Write-Step "Stopping KinEcho services"

$pidNames = @(
    "backend",
    "fay",
    "asr",
    "elderly",
    "family",
    "admin",
    "miniapp-backend",
    "miniapp-fay",
    "miniapp-asr",
    "miniapp-avatar-static",
    "miniapp-avatar-h5",
    "miniapp-avatar-electron-child",
    "miniapp-avatar-electron",
    "miniapp-builder"
)

foreach ($name in $pidNames) {
    Stop-ByPidFile -Name $name
}

Stop-ByPorts -Ports @(3000, 3001, 3002, 5000, 5010, 8000, 8765, 10002, 10003, 10197)

Write-Step "Stop completed."
