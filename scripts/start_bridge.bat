@echo off
title ZIMSim DB Navigator Bridge
echo ========================================================
echo   ZIMSim DB Navigator Bridge (Local Proxy)
echo   Fuer GitHub Pages & Web-Browser
echo ========================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [-] Fehler: Python wurde auf diesem System nicht gefunden.
    echo     Bitte installieren Sie Python (https://www.python.org)
    echo     oder fuegen Sie es zum System-PATH hinzu.
    echo.
    pause
    exit /b 1
)

python "%~dp0zimsim_bridge.py"
if %errorlevel% neq 0 (
    echo.
    echo [-] Bridge unerwartet beendet.
    pause
)
