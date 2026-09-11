@echo off
setlocal

set "DIR=%~dp0.."
set "WIN_DIR=%DIR%\dist\windows"

echo === Building OpenFaceID Windows Desktop Package ===

if exist "%WIN_DIR%" rmdir /s /q "%WIN_DIR%"
mkdir "%WIN_DIR%"

REM 1. Windows Launcher Script
(
echo @echo off
echo set "ROOT_DIR=%%~dp0..\.."
echo set "NODE_ENV=production"
echo set "OFID_DESKTOP_STANDALONE=true"
echo node --experimental-strip-types "%%ROOT_DIR%%\apps\desktop\serve.js" %%*
) > "%WIN_DIR%\OpenFaceID.cmd"

REM 2. Registry Autostart File
(
echo Windows Registry Editor Version 5.00
echo.
echo [HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run]
echo "OpenFaceID"="\"C:\\Program Files\\OpenFaceID\\OpenFaceID.cmd\""
) > "%WIN_DIR%\register-autostart.reg"

echo Created %WIN_DIR%\OpenFaceID.cmd
echo Created %WIN_DIR%\register-autostart.reg
echo === Windows Packaging Complete ===
