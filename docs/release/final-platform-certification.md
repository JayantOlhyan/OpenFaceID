# OpenFaceID — Final Cross-Platform Certification Report

**Document ID**: OFID-REL-PLATFORM-FINAL-001  
**Phase**: Pre-V1 Final Certification  
**Canonical Version**: `0.2.1-rc.1`  
**Purpose**: Rigorously categorize platform maturity by distinguishing Code Support, OS CI Emulation, and Physical Hardware Validation.  

---

## 1. Cross-Platform Certification Matrix

In accordance with Section 19 and Non-Negotiable Rule 15, the table below clearly separates:
- **Code Support**: Source implementation exists in `packages/platform/` and handles OS-specific APIs.
- **OS CI Emulation**: Automated builds, unit tests, and headless workflows execute successfully on GitHub Actions runners for that OS.
- **Physical Hardware Validation**: The software has been physically executed on real computer hardware with real camera sensors, keychains, and screens.

| Operating System | Architecture | Code Support Status | OS CI Emulation Status | Physical Hardware Validation Status | Platform Release Classification |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **macOS (Apple Silicon)** | `arm64` (M1/M2/M3/M4) | **VERIFIED** | **VERIFIED** | **HARDWARE VERIFIED** | **HARDWARE VERIFIED (Signing Deferred - RB-01)** |
| **macOS (Intel)** | `x86_64` | **VERIFIED** | **VERIFIED** | **HARDWARE UNVERIFIED** | **AUTOMATED ONLY** |
| **Windows 10 / 11** | `x64` | **VERIFIED** | **VERIFIED** | **HARDWARE UNVERIFIED** | **CODE COMPLETE / HARDWARE UNVERIFIED (Blocker RB-02)** |
| **Linux (Ubuntu / Debian)** | `x64` | **VERIFIED** | **VERIFIED** | **HARDWARE UNVERIFIED** | **CODE COMPLETE / HARDWARE UNVERIFIED (Blocker RB-02)** |

---

## 2. Platform-Specific Detailed Findings

### 2.1 macOS (Apple Silicon arm64)
- **Host Test Machine**: Apple Silicon M1 (`Darwin 25.6.0 arm64`).
- **Physical Camera**: Built-in Apple FaceTime HD Camera (`5A0B78EA-4C72-485C-B87D-086EC8E5E180`) validated with real-time video capture, 1080p/720p/480p resolution matrix, and frame backpressure dropping.
- **Keyring Security**: Native macOS Keychain (`security find-generic-password` / `add-generic-password`) validated for 256-bit AES-GCM master key storage.
- **Session Locking**: Instant screen lock validated via CoreGraphics / CGSession native bridge.
- **Signing Caveat**: Binaries currently use ad-hoc code signing (`codesign -s -`); Apple Developer ID signing and notarization is deferred (`RB-01`).

### 2.2 Windows 10 / 11 (x64)
- **Code Implementation**: `packages/platform/src/WindowsAdapter.ts` implements DirectShow / MediaFoundation capture via PowerShell, DPAPI cryptographic keyring, and `user32.dll LockWorkStation`.
- **CI Status**: Multi-matrix GitHub Actions Windows runner builds and tests passing.
- **Physical Hardware Status**: **HARDWARE UNVERIFIED**. A physical Windows lab bench with real webcams was not available on this host. OpenFaceID explicitly refuses to claim Windows hardware certification until physical lab tests are executed.

### 2.3 Linux (Ubuntu / Debian x64)
- **Code Implementation**: `packages/platform/src/LinuxAdapter.ts` implements V4L2 and PipeWire video capture via GStreamer, SecretService / GNOME Keyring, and `loginctl lock-session`.
- **CI Status**: Multi-matrix GitHub Actions Ubuntu runner builds and tests passing.
- **Physical Hardware Status**: **HARDWARE UNVERIFIED**. A physical Linux workstation with real V4L2 webcams was not available on this host. OpenFaceID explicitly refuses to claim Linux hardware certification until physical lab tests are executed.

---

## 3. Impact on V1.0.0 Release Gate

Section 28 of the V1 specification requires:
```text
For a CROSS-PLATFORM v1 claim:
[ ] macOS physical hardware verified
[ ] Windows physical hardware verified
[ ] Linux physical hardware verified
```
Because Windows and Linux physical hardware remain **`HARDWARE UNVERIFIED`**, OpenFaceID **CANNOT** claim stable cross-platform production release status (`v1.0.0`). The project is classified as:
**`PUBLIC RC WITH SIGNING & HARDWARE LIMITATIONS`** / **`SOURCE-ONLY RELEASE READY`**
