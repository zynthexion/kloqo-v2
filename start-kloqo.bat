@echo off
TITLE Kloqo Local Clinic Launcher
cls
echo ======================================================
echo   KLOQO LOCAL CLINIC SYSTEM
echo ======================================================
echo.

:: Check Docker
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop is not running!
    echo Please open Docker Desktop and wait 15 seconds, then try again.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is active.

:: Auto-load pre-compiled images if present
if exist "kloqo-backend.tar.gz" (
    echo [INFO] Importing pre-compiled backend container...
    docker load -i kloqo-backend.tar.gz
    del kloqo-backend.tar.gz
    echo [OK] Backend container imported.
)

if exist "kloqo-clinic-web.tar.gz" (
    echo [INFO] Importing pre-compiled web container...
    docker load -i kloqo-clinic-web.tar.gz
    del kloqo-clinic-web.tar.gz
    echo [OK] Web container imported.
)

if not exist ".env.local" (
    echo [ERROR] .env.local configuration file missing!
    echo Please copy .env.local.example to .env.local and configure clinic settings.
    pause
    exit /b 1
)

echo.
echo [INFO] Starting Kloqo local server...
docker compose -f docker-compose.local.yml up -d

echo.
echo ======================================================
echo   KLOQO IS ONLINE & READY
echo   Opening dashboard at http://localhost:3000
echo ======================================================
echo.

start http://localhost:3000
