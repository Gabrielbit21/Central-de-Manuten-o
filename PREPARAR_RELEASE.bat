@echo off
setlocal
cd /d "%~dp0"
echo.
echo Preparando Central de Manutencao SE v1.9.0...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\prepare-release.ps1"
if errorlevel 1 (
  echo.
  echo ERRO: a preparacao nao foi concluida.
  echo Nao publique a v1.9.0 ainda.
  pause
  exit /b 1
)
echo.
pause
