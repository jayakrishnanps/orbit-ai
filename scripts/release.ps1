# Orbit AI — Release Script
# Usage: npm run app
# Cleans previous build, compiles webpack, creates NSIS installer, then launches it.

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host ""
    Write-Host ">>> $msg" -ForegroundColor Cyan
}

function Write-Success($msg) {
    Write-Host $msg -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
}

# ── Step 1: Clean previous installer output ──────────────────────────────────
Write-Step "Cleaning previous build output..."
$distDir = Join-Path $PSScriptRoot "..\dist-installer"
if (Test-Path $distDir) {
    Remove-Item -Recurse -Force $distDir
    Write-Success "  Removed dist-installer/"
} else {
    Write-Host "  Nothing to clean."
}

# ── Step 2: Build webpack bundles via electron-forge ────────────────────────
Write-Step "Building webpack bundles (electron-forge package)..."
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot

try {
    & npm run predist
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "electron-forge package failed (exit code $LASTEXITCODE)"
        exit 1
    }
    Write-Success "  Webpack bundles built successfully."

    # ── Step 3: Create NSIS installer via electron-builder ──────────────────
    Write-Step "Creating Windows installer (electron-builder)..."
    & npx electron-builder --win
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "electron-builder failed (exit code $LASTEXITCODE)"
        exit 1
    }
    Write-Success "  Installer created successfully."

} finally {
    Pop-Location
}

# ── Step 4: Find and launch the installer ───────────────────────────────────
Write-Step "Launching installer..."
$installer = Get-ChildItem (Join-Path $projectRoot "dist-installer") -Filter "Orbit AI Setup *.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($installer) {
    Write-Success "  Found: $($installer.FullName)"
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host "  Orbit AI installer is starting. Follow the wizard steps:" -ForegroundColor Yellow
    Write-Host "  1. Accept the license"                                       -ForegroundColor Yellow
    Write-Host "  2. Choose your install location"                             -ForegroundColor Yellow
    Write-Host "  3. Click Install"                                            -ForegroundColor Yellow
    Write-Host "  4. App will launch automatically when finished"             -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host ""
    Start-Process $installer.FullName
} else {
    Write-Fail "Installer EXE not found in dist-installer/"
    exit 1
}
