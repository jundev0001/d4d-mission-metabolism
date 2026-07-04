$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$LogDir = Join-Path $RepoRoot ".omo\server-logs"
$BackendPort = 8000
$FrontendPort = 5173
$FrontendUrl = "http://127.0.0.1:$FrontendPort/"
$Python = Join-Path $HOME ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Test-PortListening {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $connection
}

function Start-ServiceWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $shell = if (Get-Command pwsh.exe -ErrorAction SilentlyContinue) { "pwsh.exe" } else { "powershell.exe" }
    Start-Process `
        -FilePath $shell `
        -WorkingDirectory $WorkingDirectory `
        -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command")
}

if (-not (Test-Path $Python)) {
    $Python = "python"
}

Write-Host "D4D Mission Metabolism starter" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"

if (Test-PortListening -Port $BackendPort) {
    Write-Host "Backend already listening on $BackendPort; reusing it." -ForegroundColor Yellow
} else {
    $backendLog = Join-Path $LogDir "backend-8000.manual.log"
    $backendCommand = "`$env:PYTHONPATH='src'; & '$Python' -m uvicorn d4d_mission.main:create_app --factory --host 127.0.0.1 --port $BackendPort 2>&1 | Tee-Object -FilePath '$backendLog'"
    Start-ServiceWindow -Title "D4D backend :$BackendPort" -WorkingDirectory $BackendDir -Command $backendCommand
    Write-Host "Backend starting on $BackendPort..."
}

if (Test-PortListening -Port $FrontendPort) {
    Write-Host "Frontend already listening on $FrontendPort; reusing it." -ForegroundColor Yellow
} else {
    $frontendLog = Join-Path $LogDir "frontend-5173.manual.log"
    $frontendCommand = "`$env:VITE_API_BASE_URL='http://127.0.0.1:$BackendPort'; npm run dev -- --host 127.0.0.1 --port $FrontendPort 2>&1 | Tee-Object -FilePath '$frontendLog'"
    Start-ServiceWindow -Title "D4D frontend :$FrontendPort" -WorkingDirectory $FrontendDir -Command $frontendCommand
    Write-Host "Frontend starting on $FrontendPort..."
}

Start-Sleep -Seconds 2
Start-Process $FrontendUrl
Write-Host "Opening $FrontendUrl" -ForegroundColor Green
Write-Host "Close the backend/frontend terminal windows to stop the app."
