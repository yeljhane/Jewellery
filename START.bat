@echo off
title Avenue JOAILLERIE ERP
cd /d "%~dp0"

echo.
echo  ========================================
echo   Avenue JOAILLERIE ERP - One Click Start
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Download it from https://nodejs.org and try again.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Creating .env ...
  > ".env" echo DATABASE_URL="file:./dev.db"
)

if not exist "node_modules\" (
  echo Installing dependencies ^(first run only^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo Preparing database...
set NEED_SEED=0
if not exist "prisma\dev.db" set NEED_SEED=1
call npx prisma generate >nul 2>&1
call npx prisma db push
if errorlevel 1 (
  echo [ERROR] Database setup failed.
  pause
  exit /b 1
)

if "%NEED_SEED%"=="1" (
  echo Seeding demo data...
  call npx tsx prisma\seed.ts
)

echo.
echo Starting app...
echo Browser will open at http://localhost:3000
echo Keep this window open while using the app.
echo Press Ctrl+C to stop.
echo.

start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

call npm run dev
if errorlevel 1 pause
