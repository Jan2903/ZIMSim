@echo off
setlocal
title ZIMSim DB Navigator Bridge

echo ========================================================
echo   ZIMSim DB Navigator Bridge (Local Proxy)
echo   Fuer GitHub Pages und Web-Browser
echo ========================================================
echo.

set "PY_CMD="

where python >nul 2>nul
if %errorlevel% equ 0 (
    set "PY_CMD=python"
) else (
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        set "PY_CMD=py"
    )
)

if not defined PY_CMD (
    echo [-] Fehler: Python wurde auf diesem System nicht gefunden.
    echo     Bitte installieren Sie Python: https://www.python.org
    echo     oder fuegen Sie python.exe zum System-PATH hinzu.
    echo.
    pause
    exit /b 1
)

%PY_CMD% "%~dp0zimsim_bridge.py"
if %errorlevel% neq 0 (
    echo.
    echo [-] Bridge beendet oder unerwarteter Fehler.
    pause
)
