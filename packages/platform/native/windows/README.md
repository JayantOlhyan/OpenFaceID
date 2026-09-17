# OpenFaceID Windows Credential Provider

This directory contains the native C++ Windows Credential Provider COM dynamic link library (`OpenFaceIDCredentialProvider.dll`) implementing `ICredentialProvider` and `ICredentialProviderCredential2` for Windows 10/11 lock screen and logon integration.

## Architecture

```
Windows LogonUI.exe
       │
       ▼ (COM InprocServer32)
OpenFaceIDCredentialProvider.dll
       │
       ▼ (Named Pipe: \\.\pipe\OpenFaceIDAuth)
OpenFaceID Background Service / Daemon
       │
       ▼
Camera → BlazeFace → Embedder → Liveness
       │
       ▼ (JSON Response: AUTH_SUCCESS)
OpenFaceIDCredentialProvider.dll
       │
       ▼ (KERB_INTERACTIVE_UNLOCK_LOGON)
Workstation Unlocked
```

## Compilation (MSVC / Visual Studio)

From an elevated Developer Command Prompt for Visual Studio 2022:

```cmd
cl.exe /O2 /LD /EHsc /DUNICODE /D_UNICODE ^
    OpenFaceIDCredentialProvider.cpp ^
    /link /DLL /DEF:OpenFaceIDCredentialProvider.def ^
    ole32.lib shlwapi.lib advapi32.lib ^
    /OUT:OpenFaceIDCredentialProvider.dll
```

## Installation

1. Copy `OpenFaceIDCredentialProvider.dll` to `C:\Program Files\OpenFaceID\`.
2. Apply the registry registration:
   ```cmd
   reg import register.reg
   ```
3. Restart `LogonUI` or lock the workstation (`Win + L`) to observe the OpenFaceID tile.
