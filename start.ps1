$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$Host.UI.RawUI.WindowTitle = "Araz Jewellery ERP"

Write-Host ""
Write-Host "  ========================================" -ForegroundColor DarkYellow
Write-Host "   Araz Jewellery ERP - One Click Start" -ForegroundColor Yellow
Write-Host "  ========================================" -ForegroundColor DarkYellow
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js is not installed or not in PATH." -ForegroundColor Red
  Write-Host "Download it from https://nodejs.org and try again."
  Read-Host "Press Enter to close"
  exit 1
}

if (-not (Test-Path ".env")) {
  Write-Host "Creating .env ..."
  'DATABASE_URL="file:./dev.db"' | Set-Content -Path ".env" -Encoding utf8
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies (first run only)..."
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}

Write-Host "Preparing database..."
$needSeed = -not (Test-Path (Join-Path "prisma" "dev.db"))
npx prisma generate | Out-Null
npx prisma db push
if ($LASTEXITCODE -ne 0) { throw "Database setup failed" }

if ($needSeed) {
  Write-Host "Seeding demo data..."
  npx tsx prisma/seed.ts
}

Write-Host ""
Write-Host "Starting app at http://localhost:3000" -ForegroundColor Green
Write-Host "Keep this window open. Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

Start-Job { Start-Sleep -Seconds 6; Start-Process "http://localhost:3000" } | Out-Null
npm run dev
