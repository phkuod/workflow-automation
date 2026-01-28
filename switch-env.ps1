<#
.SYNOPSIS
    Switch between development and production environments.

.DESCRIPTION
    This script copies the appropriate .env file to backend/.env and frontend/.env
    based on the selected environment.

.PARAMETER Environment
    The target environment: 'dev' or 'prod'

.EXAMPLE
    .\switch-env.ps1 dev
    .\switch-env.ps1 prod
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'prod', 'development', 'production')]
    [string]$Environment
)

$projectRoot = $PSScriptRoot

# Normalize environment name
$envName = switch ($Environment) {
    'dev' { 'development' }
    'prod' { 'production' }
    default { $Environment }
}

$sourceFile = Join-Path $projectRoot ".env.$envName"

if (-not (Test-Path $sourceFile)) {
    Write-Host "❌ Error: $sourceFile not found!" -ForegroundColor Red
    exit 1
}

# Copy to backend
$backendEnv = Join-Path $projectRoot "backend\.env"
Copy-Item $sourceFile $backendEnv -Force
Write-Host "✅ Copied to backend/.env" -ForegroundColor Green

# Copy to frontend (for Vite)
$frontendEnv = Join-Path $projectRoot "frontend\.env"
Copy-Item $sourceFile $frontendEnv -Force
Write-Host "✅ Copied to frontend/.env" -ForegroundColor Green

# Display current settings
Write-Host ""
Write-Host "🔧 Environment switched to: $envName" -ForegroundColor Cyan
Write-Host "───────────────────────────────────────" -ForegroundColor DarkGray
Get-Content $sourceFile | ForEach-Object {
    if ($_ -notmatch '^#' -and $_.Trim() -ne '') {
        Write-Host "   $_" -ForegroundColor Yellow
    }
}
Write-Host "───────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "💡 Restart your dev server to apply changes." -ForegroundColor Magenta
