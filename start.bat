@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 ou plus recent est necessaire.
  echo Installez-le depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)
node "%~dp0scripts\launch.mjs" %*
set "LAUNCH_EXIT=%ERRORLEVEL%"
if not "%LAUNCH_EXIT%"=="0" pause
exit /b %LAUNCH_EXIT%
