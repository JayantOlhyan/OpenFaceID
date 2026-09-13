# OpenFaceID Windows Hardware Validation Report

## Evaluation Status: **CODE IMPLEMENTED — HARDWARE UNVERIFIED**

**Evaluation Target:** Windows 11 / Windows 10 (x64 & ARM64)  
**Date:** September 13, 2026  
**Git Baseline:** `0fba170`  
**Governing Rule:** No physical Windows desktop was attached to the local test laboratory during Phase 7. In accordance with Section 2 and Section 37 of the Phase 7 engineering specification, **NO hardware test results are manufactured**.

---

## 1. Subsystem Implementation vs. Physical Validation Matrix

| Subsystem / Feature | Code Implementation Status | Physical Hardware Status | Evidence & Notes |
| :--- | :--- | :--- | :--- |
| **Pure TypeScript Runtime** | **IMPLEMENTED** | **VERIFIED IN CI** | Node.js 22.x/25.x runs analytical engine without native binary compilation. |
| **Camera Enumeration** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | Implemented in `WindowsAdapter.ts` using PowerShell `Get-CimInstance Win32_PnPEntity`. |
| **Camera Capture Pipeline** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | Media Foundation / DirectShow video capture stream abstraction. |
| **Camera Hot-Plug / Reconnect** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | Logic implemented in `canonical.ts`, but physical USB hub disconnection unverified. |
| **Modern Standby (S0ix) / Sleep** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | `resetOnWake()` implemented; physical Windows power state transition unverified. |
| **Localhost IPC Server** | **IMPLEMENTED** | **VERIFIED IN CI** | Loopback TCP socket on `127.0.0.1:41793` tested across Node environments. |
| **Credential Manager (DPAPI)** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | Implemented via `cmdkey.exe` with base64 ciphertext storage. |
| **Desktop Toast Notifications** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | Implemented via PowerShell XML WinRT toast bridge (`NotificationManager`). |
| **Packaging & Distribution** | **PARTIAL** | **HARDWARE UNVERIFIED** | Portable `.zip` and batch launcher available; Inno Setup installer not certified. |
| **Code Signing & SmartScreen** | **UNIMPLEMENTED** | **BLOCKED** | Release binaries lack an Extended Validation (EV) code signing certificate. |

---

## 2. Windows-Specific Technical Prerequisites for Physical Validation

When physical Windows test hardware (`WIN-01`) is provisioned, the following validation protocol must be executed:
1. **Camera Discovery:** Validate enumerating integrated webcams on Intel/AMD platforms via Media Foundation.
2. **UAC & Execution Policy:** Verify that PowerShell-based platform adapters execute under standard restricted ExecutionPolicy (`RemoteSigned` / `Bypass` for script runner).
3. **SmartScreen Behavior:** Document user warnings when launching unsigned desktop executables on Windows 11.
4. **Sleep/Wake Modern Standby:** Verify that wake events from S0ix low-power states trigger `resetOnWake()` and do not preserve stale authorized presence.

---

## 3. Official Classification
- **Release Verdict:** **EXPERIMENTAL / PREVIEW ONLY**
- **Production Certification:** **NOT CERTIFIED** (Pending physical lab hardware validation).
