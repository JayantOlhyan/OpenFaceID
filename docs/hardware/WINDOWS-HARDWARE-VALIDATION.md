# Windows Hardware Validation Procedure & Checklist

**Document Version**: 1.0.0 (v0.2.1-rc.1)  
**Status**: `PHYSICALLY UNVERIFIED` (Requires physical Windows test bench)  
**Target Environments**: Windows 10 (Build 19041+) / Windows 11 64-bit  

---

## 1. Objective & Physical Verification Scope

The Windows integration is implemented at both the native Winlogon layer (`ICredentialProvider` / `ICredentialProviderCredential2`) and the background service layer (`WindowsAdapter`). 

Because the primary development and build runner operates on macOS Apple Silicon, **actual desktop unlock on Windows hardware must be formally executed and recorded on physical Windows hardware before marking the platform as PHYSICALLY VERIFIED**.

---

## 2. Prerequisites & Build Test

Execute on a machine running Windows 10/11 x64 with Visual Studio 2022 (MSVC v143+):

1. **Clone the exact release commit**:
   ```cmd
   git clone https://github.com/JayantOlhyan/OpenFaceID.git
   cd OpenFaceID
   git checkout <RELEASE_COMMIT_SHA>
   ```

2. **Compile Native Credential Provider DLL**:
   Run the Developer Command Prompt for VS 2022 as Administrator:
   ```cmd
   call packages\platform\native\windows\build-windows.bat
   ```
   - Verify that `dist\windows\OpenFaceIDCredentialProvider.dll` is produced without compiler warnings or linking errors.
   - Verify export entrypoints:
     ```cmd
     dumpbin /exports dist\windows\OpenFaceIDCredentialProvider.dll
     ```
     *Must export*: `DllCanUnloadNow`, `DllGetClassObject`, `DllRegisterServer`, `DllUnregisterServer`.

3. **Build Inno Setup Installer**:
   Compile `packaging\windows\openfaceid.iss` with Inno Setup 6.x to generate `OpenFaceID-0.2.1-rc.1-x64-Setup.exe`.

---

## 3. Physical Hardware Execution Checklist

| Step # | Verification Item | Action / Command | Expected Pass Criteria | Result |
|:---|:---|:---|:---|:---|
| **W-01** | **DLL Registration** | `regsvr32.exe dist\windows\OpenFaceIDCredentialProvider.dll` | Returns `DllRegisterServer in ... succeeded.` | [ ] |
| **W-02** | **Registry Entries** | Check `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Authentication\Credential Providers\{7B8F9A12-3D4E-4A5F-8C9B-0E1F2A3B4C5D}` | Registry key exists and points to `OpenFaceID Credential Provider` | [ ] |
| **W-03** | **Daemon Initialization** | Start desktop daemon: `npm run desktop` or `OpenFaceID.exe` | Daemon starts, binds Named Pipe `\\.\pipe\OpenFaceIDAuth` | [ ] |
| **W-04** | **Camera Enumeration** | `node apps/cli/bin/openfaceid.ts camera list` | Enumerates connected physical webcam (DirectShow/MediaFoundation) | [ ] |
| **W-05** | **Biometric Enrollment** | Open `http://localhost:41793` and complete 5-pose face enrollment | Saves encrypted identity in `%LOCALAPPDATA%\OpenFaceID\identities\` | [ ] |
| **W-06** | **Named Pipe Security** | Connect client to `\\.\pipe\OpenFaceIDAuth` | Challenge handshake returns valid JSON with `status` field | [ ] |
| **W-07** | **LogonUI Presentation** | Press `Win + L` to lock Windows workstation | OpenFaceID tile icon and status ("Looking for your face...") appears on Windows lock screen | [ ] |
| **W-08** | **Face Detection on Lock** | Look directly into the webcam while on lock screen | Camera activity LED illuminates; daemon registers face match | [ ] |
| **W-09** | **Liveness Enforcement** | Hold static photograph of enrolled user in front of camera | Liveness fails; LogonUI tile reports rejection; workstation remains locked | [ ] |
| **W-10** | **ACTUAL DESKTOP UNLOCK** | Authorized user looks into webcam | Named Pipe handshake succeeds; `CredentialsChanged` triggers; Windows desktop unlocks to session | [ ] |
| **W-11** | **Unregister / Cleanup** | `regsvr32.exe /u dist\windows\OpenFaceIDCredentialProvider.dll` | Reverts cleanly; tile removed from LogonUI without system instability | [ ] |

---

## 4. Certification Criteria

The platform may only be upgraded from `IMPLEMENTED / UNVERIFIED` to `SUPPORTED / PHYSICALLY VERIFIED` once all 11 checklist gates (`W-01` through `W-11`) are checked and validated with physical video/log evidence on real hardware.
