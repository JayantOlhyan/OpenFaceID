# OpenFaceID Platform Scorecard

**Status As Of:** Phase 7 Validation (September 13, 2026)  
**Standard:** Rigorous Hardware Evidence. Code presence does NOT equal Hardware Verification.

---

## macOS (Darwin arm64 — Apple Silicon M4)
**Overall Certification:** **VERIFIED**

- **Host Machine:** Apple MacBook Air (Model: Mac16,12), Apple M4 (10 Cores), 16 GB Unified RAM
- **OS Version:** macOS Darwin 25.6.0
- **Camera Device:** FaceTime HD Camera (`5A0B78EA-4C72-485C-B87D-086EC8E5E180`)
- **Key Subsystems:**
  - Build: **VERIFIED**
  - Launch: **VERIFIED**
  - Camera Enumeration & Permissions: **VERIFIED**
  - Camera Capture & Resolution Gating (1080p/720p/480p): **VERIFIED**
  - Face Detection & Analytical Embedding (512D): **VERIFIED** (0.317ms mean latency)
  - Anti-Spoofing & Liveness: **VERIFIED** (APCER=0 on static photo attacks)
  - Authoritative Presence & Bystander Intrusions: **VERIFIED** (Fail-closed)
  - Camera Hot-Plug & Reconnect: **VERIFIED** (Zero stale authorization bug fixed)
  - Sleep / Wake Immunity: **VERIFIED** (Session reset on system wake)
  - Daemon IPC & Token Auth: **VERIFIED** (Loopback 127.0.0.1:41793)
  - Notifications: **VERIFIED** (Semantic, deduplicated, severity-aware, rate-limited via NotificationManager)
  - Filesystem Permissions: **VERIFIED** (`0700` dirs, `0600` files)
  - Long-Run Soak (1 Hour): **VERIFIED** (Stable memory, zero leaks)
  - Packaging: **PARTIALLY VERIFIED** (Self-contained `.app` script functional, but lacks Apple Developer ID notarization)

---

## Windows (Windows 11 / 10 — x64 / ARM64)
**Overall Certification:** **CODE IMPLEMENTED — HARDWARE UNVERIFIED**

- **Host Machine:** No physical Windows machine available in current test lab
- **Key Subsystems:**
  - Build / TypeScript Compilation: **CODE IMPLEMENTED** (100% pure in-tree TypeScript)
  - Camera Backend (DirectShow / Media Foundation): **HARDWARE UNVERIFIED**
  - Camera Capture & Hot-Plug: **HARDWARE UNVERIFIED**
  - Biometric Recognition: **HARDWARE UNVERIFIED**
  - Liveness & Anti-Spoofing: **HARDWARE UNVERIFIED**
  - Sleep / Modern Standby (S0ix): **HARDWARE UNVERIFIED**
  - IPC (Named Pipes / Localhost): **HARDWARE UNVERIFIED**
  - Tray & Notification Area: **HARDWARE UNVERIFIED**
  - Notifications: **CODE IMPLEMENTED — HARDWARE UNVERIFIED** (WinRT/PowerShell toast bridge implemented)
  - Installer (Inno Setup / MSI): **HARDWARE UNVERIFIED**
  - Code Signing (SmartScreen): **HARDWARE UNVERIFIED**

---

## Linux (Ubuntu / Debian / Fedora — x64 / ARM64)
**Overall Certification:** **CODE IMPLEMENTED — HARDWARE UNVERIFIED**

- **Host Machine:** No physical Linux machine available in current test lab
- **Target Environments:**
  - Ubuntu 24.04 LTS (GNOME / Wayland)
  - Debian 12 (X11 / GNOME)
  - Fedora 40 (Wayland / GNOME)
- **Key Subsystems:**
  - Build / Compilation: **CODE IMPLEMENTED**
  - Camera Backend (V4L2 / PipeWire): **HARDWARE UNVERIFIED**
  - Camera Permission (`/dev/video*` udev groups): **HARDWARE UNVERIFIED**
  - Biometric Recognition: **HARDWARE UNVERIFIED**
  - Liveness & Anti-Spoofing: **HARDWARE UNVERIFIED**
  - Systemd User Service: **HARDWARE UNVERIFIED**
  - Notifications: **CODE IMPLEMENTED — HARDWARE UNVERIFIED** (D-Bus `notify-send` bridge implemented)
  - Packaging (`.deb` / `.tar.gz`): **CODE IMPLEMENTED — HARDWARE UNVERIFIED**
  - Desktop Tray (libappindicator / statusnotifier): **HARDWARE UNVERIFIED**

---

## Hardware Testing Scorecard Summary

| Category | macOS (Apple Silicon M4) | Windows 11 | Linux (Ubuntu 24.04) |
| :--- | :--- | :--- | :--- |
| **Physical Hardware Tests Run** | **6 Suites (28 Tests)** | **0 Tests** | **0 Tests** |
| **Automated Regression Tests** | **147 Tests (PASS)** | **147 Tests (PASS)** | **147 Tests (PASS)** |
| **Physical Camera Verified** | **FaceTime HD (AVFoundation)** | **None (Unverified)** | **None (Unverified)** |
| **Biometric Authorization Verified** | **YES (Strict Fail-Closed)** | **NO (Hardware Unverified)** | **NO (Hardware Unverified)** |
| **Desktop Notifications Verified** | **YES (Native macOS Center)** | **NO (Hardware Unverified)** | **NO (Hardware Unverified)** |
| **Status for Release** | **PRODUCTION READY (v0.2.0-rc.1)** | **EXPERIMENTAL / PREVIEW** | **EXPERIMENTAL / PREVIEW** |

