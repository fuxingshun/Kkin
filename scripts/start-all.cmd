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
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

function Write-Step {
    param([string]$Message)
    Write-Host "[KinEcho] $Message"
}

function Resolve-Python {
    $candidates = @(
        $env:KIN_PYTHON,
        (Join-Path $env:USERPROFILE "anaconda3\python.exe"),
        "C:\ProgramData\anaconda3\python.exe"
    ) | Where-Object { $_ }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        return $pythonCommand.Source
    }

    throw "Python was not found. Install Python first or set KIN_PYTHON."
}

function Test-PortListening {
    param([int]$Port)

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $connected = $async.AsyncWaitHandle.WaitOne(750, $false)

        if (-not $connected) {
            $client.Close()
            return $false
        }

        $client.EndConnect($async)
        $client.Close()
        return $true
    }
    catch {
        return $false
    }
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -Port $Port) {
            return $true
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return $true
            }
        }
        catch {
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

function Save-Pid {
    param(
        [string]$Name,
        [int]$ProcessId
    )

    Set-Content -LiteralPath (Join-Path $logsDir "$Name.pid") -Value $ProcessId -Encoding ascii
}

function ConvertTo-CmdLiteral {
    param([string]$Value)

    return '"' + ($Value -replace '"', '""') + '"'
}

function Get-SanitizedEnvironment {
    $environment = New-Object "System.Collections.Generic.Dictionary[string,string]" ([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($key in [System.Environment]::GetEnvironmentVariables().Keys) {
        $name = [string]$key
        $environment[$name] = [System.Environment]::GetEnvironmentVariable($name, "Process")
    }

    return $environment
}

function Start-NativeProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [int[]]$ReadyPorts,
        [string]$ReadyUrl,
        [int]$ReadyTimeoutSeconds = 30,
        [hashtable]$EnvironmentOverrides
    )

    $stdoutLog = Join-Path $logsDir "$Name.log"
    $stderrLog = Join-Path $logsDir "$Name.err.log"

    if ($ReadyPorts -and ($ReadyPorts | Where-Object { Test-PortListening -Port $_ }).Count -eq $ReadyPorts.Count) {
        Write-Step "$Name is already running. Skip."
        return
    }

    if ($ReadyPorts -and ($ReadyPorts | Where-Object { Test-PortListening -Port $_ }).Count -gt 0) {
        Write-Step "$Name has partial ports in use. Run scripts\stop-all.cmd first if it looks unhealthy."
        return
    }

    $commandParts = @("cd /d $(ConvertTo-CmdLiteral -Value $WorkingDirectory)")

    if ($EnvironmentOverrides) {
        foreach ($key in $EnvironmentOverrides.Keys) {
            $commandParts += "set $(ConvertTo-CmdLiteral -Value ($key + '=' + $EnvironmentOverrides[$key]))"
        }
    }

    $commandLine = (ConvertTo-CmdLiteral -Value $FilePath)
    if ($Arguments) {
        $commandLine += " " + (($Arguments | ForEach-Object { ConvertTo-CmdLiteral -Value $_ }) -join " ")
    }
    $commandLine += " >> $(ConvertTo-CmdLiteral -Value $stdoutLog) 2>> $(ConvertTo-CmdLiteral -Value $stderrLog)"
    $commandParts += $commandLine

    $cmdExe = $env:ComSpec
    if (-not $cmdExe) {
        $cmdExe = (Get-Command cmd -ErrorAction Stop).Source
    }

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $cmdExe
    $startInfo.Arguments = "/d /c " + (ConvertTo-CmdLiteral -Value ($commandParts -join " && "))
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true

    $sanitizedEnvironment = Get-SanitizedEnvironment
    foreach ($key in @($startInfo.EnvironmentVariables.Keys)) {
        $startInfo.EnvironmentVariables.Remove($key) | Out-Null
    }
    foreach ($key in $sanitizedEnvironment.Keys) {
        $startInfo.EnvironmentVariables[$key] = $sanitizedEnvironment[$key]
    }

    $process = [System.Diagnostics.Process]::Start($startInfo)
    Save-Pid -Name $Name -ProcessId $process.Id
    Write-Step "Started $Name with PID=$($process.Id)"

    foreach ($port in ($ReadyPorts | Where-Object { $_ })) {
        if (-not (Wait-ForPort -Port $port -TimeoutSeconds $ReadyTimeoutSeconds)) {
            Write-Step "$Name timed out waiting for port $port. Check $stdoutLog and $stderrLog"
            return
        }
    }

    if ($ReadyUrl -and -not (Wait-ForHttp -Url $ReadyUrl -TimeoutSeconds $ReadyTimeoutSeconds)) {
        Write-Step "$Name health check timed out. Check $stdoutLog and $stderrLog"
        return
    }
}

$pythonExe = Resolve-Python
$backendDir = Join-Path $projectRoot "server"
$fayDir = Join-Path $projectRoot ".external\fay"
$asrDir = Join-Path $projectRoot ".external\fay\asr\funasr"
$elderlyDistDir = Join-Path $projectRoot "dist\elderly"
$familyDistDir = Join-Path $projectRoot "dist\family"
$adminDistDir = Join-Path $projectRoot "dist\admin"
$webEntryRoot = "apps\web"
$elderlyEntry = Join-Path $webEntryRoot "elderly.html"
$avatarEntry = Join-Path $webEntryRoot "elderly-avatar.html"
$familyEntry = Join-Path $webEntryRoot "family.html"
$adminEntry = Join-Path $webEntryRoot "admin.html"
$frontendEnv = Join-Path $projectRoot ".env.local"
$backendEnv = Join-Path $backendDir ".env"

if (-not (Test-Path -LiteralPath $frontendEnv)) {
    throw "Missing frontend env file: $frontendEnv"
}

if (-not (Test-Path -LiteralPath $backendEnv)) {
    throw "Missing backend env file: $backendEnv"
}

if (-not (Test-Path -LiteralPath (Join-Path $backendDir "app.py"))) {
    throw "Backend entry was not found: server\app.py"
}

if (-not (Test-Path -LiteralPath (Join-Path $fayDir "main.py"))) {
    throw "Fay entry was not found: $fayDir"
}

if (-not (Test-Path -LiteralPath (Join-Path $asrDir "ASR_server.py"))) {
    throw "FunASR entry was not found: $asrDir"
}

if (-not (Test-Path -LiteralPath (Join-Path $elderlyDistDir $elderlyEntry))) {
    throw "Missing dist\elderly\$elderlyEntry. Run npm run build:elderly once before scripts\start-all.cmd."
}

if (-not (Test-Path -LiteralPath (Join-Path $elderlyDistDir $avatarEntry))) {
    throw "Missing dist\elderly\$avatarEntry. Run npm run build:elderly once before scripts\start-all.cmd."
}

if (-not (Test-Path -LiteralPath (Join-Path $familyDistDir $familyEntry))) {
    throw "Missing dist\family\$familyEntry. Run npm run build:family once before scripts\start-all.cmd."
}

if (-not (Test-Path -LiteralPath (Join-Path $adminDistDir $adminEntry))) {
    throw "Missing dist\admin\$adminEntry. Run npm run build:admin once before scripts\start-all.cmd."
}

Write-Step "Project root: $projectRoot"
Write-Step "Python: $pythonExe"

Start-NativeProcess `
    -Name "backend" `
    -FilePath $pythonExe `
    -Arguments @("app.py") `
    -WorkingDirectory $backendDir `
    -ReadyPorts @(8000) `
    -ReadyUrl "http://127.0.0.1:8000/api/health"

Start-NativeProcess `
    -Name "fay" `
    -FilePath $pythonExe `
    -Arguments @("main.py", "start", "-config_center", "d19f7b0a-2b8a-4503-8c0d-1a587b90eb69") `
    -WorkingDirectory $fayDir `
    -ReadyPorts @(5000, 10002, 10003) `
    -ReadyUrl "http://127.0.0.1:5000" `
    -EnvironmentOverrides @{ KMP_DUPLICATE_LIB_OK = "TRUE"; OMP_NUM_THREADS = "1"; MKL_THREADING_LAYER = "GNU" }

Start-NativeProcess `
    -Name "asr" `
    -FilePath $pythonExe `
    -Arguments @("ASR_server.py", "--host", "0.0.0.0", "--port", "10197", "--ngpu", "0") `
    -WorkingDirectory $asrDir `
    -ReadyPorts @(10197) `
    -ReadyTimeoutSeconds 120 `
    -EnvironmentOverrides @{ KMP_DUPLICATE_LIB_OK = "TRUE"; OMP_NUM_THREADS = "1"; MKL_THREADING_LAYER = "GNU" }

Start-NativeProcess `
    -Name "elderly" `
    -FilePath $pythonExe `
    -Arguments @("-m", "http.server", "3000", "--bind", "127.0.0.1") `
    -WorkingDirectory $elderlyDistDir `
    -ReadyPorts @(3000) `
    -ReadyUrl "http://127.0.0.1:3000/apps/web/elderly.html"

Start-NativeProcess `
    -Name "family" `
    -FilePath $pythonExe `
    -Arguments @("-m", "http.server", "3001", "--bind", "127.0.0.1") `
    -WorkingDirectory $familyDistDir `
    -ReadyPorts @(3001) `
    -ReadyUrl "http://127.0.0.1:3001/apps/web/family.html"

Start-NativeProcess `
    -Name "admin" `
    -FilePath $pythonExe `
    -Arguments @("-m", "http.server", "3002", "--bind", "127.0.0.1") `
    -WorkingDirectory $adminDistDir `
    -ReadyPorts @(3002) `
    -ReadyUrl "http://127.0.0.1:3002/apps/web/admin.html"

Write-Host ""
Write-Step "Startup check completed."
Write-Host "  Elderly: http://127.0.0.1:3000/apps/web/elderly.html"
Write-Host "  Avatar:  http://127.0.0.1:3000/apps/web/elderly-avatar.html"
Write-Host "  Family:  http://127.0.0.1:3001/apps/web/family.html"
Write-Host "  Admin:   http://127.0.0.1:3002/apps/web/admin.html"
Write-Host "  Backend: http://127.0.0.1:8000/api/health"
Write-Host "  Fay:     http://127.0.0.1:5000"
Write-Host "  ASR:     ws://127.0.0.1:10197"
Write-Host ""
Write-Step "Run scripts\stop-all.cmd to stop all services."
