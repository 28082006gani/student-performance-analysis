# Auto Update Script for Student Performance Portal
# Fetches latest changes from Git, installs any new dependencies, and reports status.

$env:Path = "$env:LOCALAPPDATA\Programs\Git\cmd;$env:Path"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Student Performance Portal - Auto Updater  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Ensure we are in repository directory
$repoDir = Split-Path -Parent $PSScriptRoot
Set-Location $repoDir

if (-not (Test-Path ".git")) {
    Write-Host "Error: No Git repository found in $repoDir" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] Checking for remote updates from Git..." -ForegroundColor Yellow
git fetch origin

$LOCAL = git rev-parse HEAD
$REMOTE = git rev-parse "@{u}" 2>$null

if ($LASTEXITCODE -ne 0 -or -not $REMOTE) {
    Write-Host "No upstream branch configured yet. Tracking local branch." -ForegroundColor Yellow
    exit 0
}

if ($LOCAL -eq $REMOTE) {
    Write-Host "[OK] Repository is already up to date. (Commit: $LOCAL)" -ForegroundColor Green
} else {
    Write-Host "[2/3] New updates found! Pulling latest changes..." -ForegroundColor Magenta
    git pull origin main
    
    Write-Host "[3/3] Installing any updated dependencies..." -ForegroundColor Yellow
    npm install
    
    Write-Host "[OK] Successfully updated project to latest version!" -ForegroundColor Green
}
