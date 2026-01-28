<#
.SYNOPSIS
    Start the Workflow Automation application in development mode.

.DESCRIPTION
    This script starts both backend and frontend servers for development.

.EXAMPLE
    .\start-dev.ps1
#>

$projectRoot = $PSScriptRoot

Write-Host "🚀 Starting Workflow Automation (Development)" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists, if not copy from .env.development
$backendEnv = Join-Path $projectRoot "backend\.env"
if (-not (Test-Path $backendEnv)) {
    $devEnv = Join-Path $projectRoot ".env.development"
    if (Test-Path $devEnv) {
        Copy-Item $devEnv $backendEnv
        Write-Host "📝 Created backend/.env from .env.development" -ForegroundColor Yellow
    }
}

$frontendEnv = Join-Path $projectRoot "frontend\.env"
if (-not (Test-Path $frontendEnv)) {
    $devEnv = Join-Path $projectRoot ".env.development"
    if (Test-Path $devEnv) {
        Copy-Item $devEnv $frontendEnv
        Write-Host "📝 Created frontend/.env from .env.development" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Starting servers..." -ForegroundColor Green

# Start backend in background
$backendPath = Join-Path $projectRoot "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev" -WindowStyle Normal

# Start frontend in background  
$frontendPath = Join-Path $projectRoot "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Servers starting..." -ForegroundColor Green
Write-Host "   Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Close the terminal windows to stop the servers." -ForegroundColor Magenta
