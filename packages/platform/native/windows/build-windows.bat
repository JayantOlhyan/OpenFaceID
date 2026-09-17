@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo  Compiling OpenFaceID Windows Credential Provider DLL
echo  Compiler: Microsoft Visual C++ (MSVC)
echo ============================================================

REM 1. Locate Visual Studio / MSVC Build Tools if vcvarsall has not been run
if "%VCINSTALLDIR%"=="" (
  for %%p in (
    "%ProgramFiles%\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
    "%ProgramFiles%\Microsoft Visual Studio\2019\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
    "%ProgramFiles%\Microsoft Visual Studio\2019\Professional\VC\Auxiliary\Build\vcvars64.bat"
    "%ProgramFiles%\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
  ) do (
    if exist %%p (
      echo Found MSVC Environment at %%p
      call %%p
      goto :found_vcvars
    )
  )
)

:found_vcvars

where cl.exe >nul 2>&1
if %errorlevel% neq 0 (
  echo Error: MSVC Compiler (cl.exe) not found on PATH.
  echo Please run this script from the Developer Command Prompt for Visual Studio.
  exit /b 1
)

set SCRIPT_DIR=%~dp0
set SRC=%SCRIPT_DIR%OpenFaceIDCredentialProvider.cpp
set DEF=%SCRIPT_DIR%OpenFaceIDCredentialProvider.def
set OUT_DIR=%SCRIPT_DIR%..\..\..\dist\windows
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
set OUT_DLL=%OUT_DIR%\OpenFaceIDCredentialProvider.dll

echo Compiling %SRC% -> %OUT_DLL%...

cl.exe /nologo /O2 /W4 /WX- /std:c++17 /EHsc /LD ^
  "%SRC%" ^
  /Fe"%OUT_DLL%" ^
  /link /DEF:"%DEF%" ^
  kernel32.lib user32.lib advapi32.lib ole32.lib secur32.lib shlwapi.lib

if %errorlevel% neq 0 (
  echo Compilation FAILED!
  exit /b %errorlevel%
)

echo.
echo ============================================================
echo  Build Successful!
echo  DLL: %OUT_DLL%
echo ============================================================
