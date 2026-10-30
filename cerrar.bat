@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Centra Markets - Detener Servidor

echo ========================================================
echo        CENTRA MARKETS - DETENER SERVIDOR
echo ========================================================
echo.

echo [INFO] Buscando procesos activos en el puerto 3000...
set KILLED=0

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    if not "%%a"=="" (
        echo [INFO] Deteniendo proceso PID %%a...
        taskkill /F /PID %%a >nul 2>nul
        set KILLED=1
    )
)

echo.
if "!KILLED!"=="1" (
    echo ========================================================
    echo [EXITO] Servidor Centra Markets detenido correctamente.
    echo ========================================================
) else (
    echo [INFO] No habia ningun servidor activo en el puerto 3000.
)

echo.
echo Esta ventana se cerrara en 3 segundos...
ping 127.0.0.1 -n 4 >nul
exit /b 0