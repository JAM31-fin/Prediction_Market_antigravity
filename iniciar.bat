@echo off
setlocal
cd /d "%~dp0"
title Centra Markets - Prediction Platform

echo ========================================================
echo        CENTRA MARKETS - PLATAFORMA DE PREDICCION
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor descarga e instala Node.js desde https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] Primera ejecucion detectada. Instalando dependencias...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Error durante npm install. Revisa tu conexion.
        echo.
        pause
        exit /b 1
    )
)

echo [INFO] Iniciando servidor Centra Markets en http://localhost:3000 ...
echo [INFO] Abriendo navegador en 3 segundos...
echo.
echo Presiona Ctrl + C en esta ventana o ejecuta detener.bat para cerrar.
echo ========================================================
echo.

start "" cmd /c "ping 127.0.0.1 -n 4 >nul & start http://localhost:3000"
call npm run dev

if %ERRORLEVEL% neq 0 (
    echo.
    echo [AVISO] El servidor se ha detenido.
    pause
)