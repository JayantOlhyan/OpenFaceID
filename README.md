# OpenFaceID (SightLock)

> **Face recognition for every desktop.**
> *Open-source, privacy-first, cross-platform face recognition and presence system.*

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen.svg)](docs/platform-support.md)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20Local%20%7C%20Zero%20Cloud-success.svg)](PRIVACY.md)
[![Security](https://img.shields.io/badge/security-AES--256--GCM%20%7C%20OS%20Keyring-blueviolet.svg)](SECURITY.md)

---

## What is OpenFaceID?

**OpenFaceID** (code-named **SightLock**) brings an Apple Face ID-like experience to ordinary desktop computers using standard 2D webcams across **macOS**, **Windows**, and **Linux**.

All biometric processing occurs **100% locally in volatile RAM**. Your face image is never uploaded to the cloud, never shared with third parties, and never persisted to disk. Only encrypted mathematical feature embeddings (ArcFace 512D vectors) are retained on your device, sealed with **AES-256-GCM** authenticated encryption backed by native operating system keyrings.

---

## Critical Security Boundary & Philosophy

> [!CAUTION]
> **OpenFaceID is webcam-based face recognition. It is NOT equivalent to hardware-backed biometric authentication such as Apple Face ID or Windows Hello.**
> A standard computer webcam is a 2D optical sensor lacking structured-light infrared (IR) dot projectors or time-of-flight depth cameras.
> **Recognition and authentication are separate concepts.**
>
> OpenFaceID **strictly distinguishes** between:
> 1. **Recognition**: *"Does this camera image match an enrolled biometric identity?"*
> 2. **Presence**: *"Is an authorized person currently sitting in front of the computer?"*
> 3. **Authentication**: *"Cryptographic authorization granted by the operating system kernel."*
>
> OpenFaceID **never** stores plaintext operating system passwords, **never** injects artificial keystrokes to mimic lock-screen unlocking, and **never** claims to be 100% spoof-proof. OS login screen bypass is deliberately out of scope.

---

## Current Platform Verification Status (Phase 3)

| Platform | Real Camera Capture | Face Detection (BlazeFace) | Face Recognition (ArcFace) | Liveness PAD | Desktop Daemon & Tray | OS Packaging |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **macOS (Darwin)** | **VERIFIED** (WebRTC / AVFoundation) | **VERIFIED** (896 Anchors, IoU NMS) | **VERIFIED** (512D Cosine Metric) | **VERIFIED** (Light Passive + Strong Active) | **VERIFIED** (Daemon + Tray + HUD) | **VERIFIED** (.app Bundle + ZIP) |
| **Windows 10 / 11** | **VERIFIED** (WebRTC / WMF) | **VERIFIED** (896 Anchors, IoU NMS) | **VERIFIED** (512D Cosine Metric) | **VERIFIED** (Light Passive + Strong Active) | **CODE IMPLEMENTED** (Daemon + Tray) | **CODE IMPLEMENTED** (.cmd + Registry) |
| **Linux (X11 / Wayland)** | **VERIFIED** (WebRTC / V4L2) | **VERIFIED** (896 Anchors, IoU NMS) | **VERIFIED** (512D Cosine Metric) | **VERIFIED** (Light Passive + Strong Active) | **CODE IMPLEMENTED** (Daemon + Tray) | **CODE IMPLEMENTED** (.desktop + tar.gz) |

---

## Key Features

- **Authoritative Desktop Daemon (`DesktopEngine`)**: Runs continuously in the background, surviving dashboard window closures. Manages power events (sleep/wake), camera hot-plug disconnections, and dynamic loop throttling.
- **System Tray & Menu Bar Integration**: Native tray menu for instant status visibility, Privacy Pause toggle, manual "Recognize Now", and direct workstation locking.
- **Quick Glance HUD**: Floating keyboard-summonable heads-up display (`⌘⇧L` on macOS, `Ctrl+Shift+L` on Windows/Linux) for sub-second presence verification without opening the full dashboard.
- **Hardware Privacy Pause**: One-click software kill-switch that completely halts camera hardware access, releases optical sensors, and zeroizes active RAM buffers.
- **Hardened Local IPC Security**: Local REST and Server-Sent Events (SSE) server bound strictly to `127.0.0.1:41793` guarded by 192-bit cryptographic bearer tokens (`crypto.timingSafeEqual`) to prevent drive-by browser script tampering.
- **Cross-Platform by Architecture**: Native adapters for **macOS** (Keychain, `pmset`, IOKit), **Windows** (DPAPI, `LockWorkStation`, GetLastInputInfo), and **Linux** (`loginctl`, FreeDesktop Secret Service, `xprintidle`).
- **RAM-Only Processing**: Camera frames are processed in-memory and immediately zeroized and discarded (`frame.zeroize()`). No photos are ever saved to disk.
- **Guided Multi-Pose Enrollment**: 5-step guided enrollment (Look Center, Turn Left, Turn Right, Look Up, Look Down) generates robust 512D composite ArcFace embeddings.
- **Multi-Tier Liveness Detection**:
  - `Off`: Direct fast recognition.
  - `Light`: Passive anti-spoofing via Eye Aspect Ratio (EAR) blink detection, high-frequency texture gradient analysis, and micro-motion variance to reject printed photo attacks.
  - `Strong`: Active challenge-response requiring randomized head rotation or tilt.
- **Continuous Presence Automation**: Automatically locks your workstation when you walk away after a configurable timeout (e.g. 20s).
- **Multi-Identity Gallery**: Enroll multiple people or appearance variations (e.g., *Jayant*, *Jayant with Glasses*).
- **Automated Desktop Packaging**: Build standalone distribution bundles (`dist/OpenFaceID.app` for macOS, `openfaceid.desktop` for Linux, and `OpenFaceID.cmd` for Windows).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│              OpenFaceID Desktop Shell & UI Layer                         │
│   ┌───────────────────────────┐         ┌───────────────────────────┐   │
│   │   System Tray / Menu Bar  │         │   Quick Glance HUD (⌘⇧L)  │   │
│   └─────────────┬─────────────┘         └─────────────┬─────────────┘   │
│                 │                                     │                 │
│   ┌─────────────▼─────────────────────────────────────▼─────────────┐   │
│   │          Desktop Dashboard (Vite + React 19 + Theme Tokens)      │   │
│   └───────────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────────────┼─────────────────────────────────┘
                                        │ Authenticated REST + SSE (127.0.0.1:41793)
                                        │ Bearer Token Guard (timingSafeEqual)
┌───────────────────────────────────────▼─────────────────────────────────┐
│                     DesktopEngine (Authoritative Daemon)                │
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌────────────┐ │
│  │ Power & Sleep Observer  │  │ Hot-Plug Disconnect   │  │ Privacy    │ │
│  │ (pmset / lock state)    │  │ Recovery Manager      │  │ Pause Gate │ │
│  └─────────────┬───────────┘  └───────────┬───────────┘  └─────┬──────┘ │
│                │                          │                    │        │
│  ┌─────────────▼───────────┐  ┌───────────▼───────────┐  ┌─────▼──────┐ │
│  │  Recognition Machine    │  │   Presence Machine    │  │ Security   │ │
│  │  (Multi-Stage Pipeline) │  │  (Authorized Presence)│  │ & Keystore │ │
│  └─────────────┬───────────┘  └───────────┬───────────┘  └─────┬──────┘ │
│                │                          │                    │        │
│  ┌─────────────▼───────────┐  ┌───────────▼───────────┐  ┌─────▼──────┐ │
│  │      Vision Engine      │  │     Camera Engine     │  │ AES-256-GCM│ │
│  │  • BlazeFace Detector   │  │  • WebRTC Enumeration │  │ Zero-Trace │ │
│  │  • 5-Point Landmarks    │  │  • RAM-Only Grabber   │  │ Shredder   │ │
│  │  • ArcFace Embedder     │  │  • Dynamic Throttler  │  │            │ │
│  │  • Liveness Evaluator   │  │  • Zeroize on Discard │  │            │ │
│  └─────────────────────────┘  └───────────────────────┘  └────────────┘ │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────┐
│                        Platform Adapter Layer                           │
│          [MacOSAdapter]       [WindowsAdapter]       [LinuxAdapter]     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Platform Support Matrix

| Capability | macOS (Apple Silicon / Intel) | Windows 10 / 11 | Linux (X11 / Wayland) |
| :--- | :--- | :--- | :--- |
| **Face Detection & Recognition** | Full (Local) | Full (Local) | Full (Local) |
| **Modular Liveness (Off/Light/Strong)**| Full | Full | Full |
| **Continuous Authorized Presence** | Full | Full | Full |
| **Screen Lock Automation** | `pmset displaysleepnow` | `LockWorkStation` | `loginctl lock-session` |
| **Lock State Detection** | IORegistry `CGSSessionScreenIsLocked` | Session Notification | D-Bus `ScreenSaver` / `loginctl` |
| **Secure Master Keystore** | macOS Keychain | Windows Credential Mgr / DPAPI | Secret Service (`libsecret`) |
| **Quick Glance Floating HUD** | `⌘⇧L` | `Ctrl+Shift+L` | `Ctrl+Shift+L` |
| **Desktop Background Daemon** | Verified | Code Implemented | Code Implemented |
| **Native Application Packaging** | `.app` Bundle + ZIP | `.cmd` Launcher + Registry | `.desktop` Launcher + tar.gz |

---

## Quick Start

### 1. Prerequisites
- Node.js 20.x or newer (Tested on Node.js v25.2.1)
- Built-in or external USB webcam

### 2. Clone & Run
```bash
# Clone the repository
git clone https://github.com/JayantOlhyan/OpenFaceID.git
cd OpenFaceID

# Run comprehensive test suite (55 tests)
npm test

# Check system status via CLI
npm run cli status

# Launch the authoritative Desktop Daemon and UI
npm run desktop
```

Visit **`http://127.0.0.1:41793`** to access the dashboard, enroll your face, and configure security policies.

### 3. Packaging Standalone Binaries
```bash
# Package for macOS (creates dist/OpenFaceID.app and dist/OpenFaceID-0.1.0-macos.zip)
npm run package:macos

# Package for Linux (creates dist/linux/openfaceid.desktop and tarball)
npm run package:linux

# Package for Windows (creates dist/windows/OpenFaceID.cmd and autostart registry script)
npm run package:windows
```

---

## CLI Usage

OpenFaceID includes a complete command-line interface:

```bash
# Show general system status
openfaceid status

# Desktop daemon commands
openfaceid desktop status
openfaceid desktop tray
openfaceid desktop hud
openfaceid desktop pause
openfaceid desktop resume
openfaceid desktop autostart enable

# List and test connected cameras
openfaceid camera list
openfaceid camera test

# Manage biometric identities
openfaceid identity list
openfaceid identity enroll "Jayant"
openfaceid identity delete usr_01jk98

# Run real-time recognition or liveness test
openfaceid recognition test
openfaceid liveness test

# Run vision benchmark
openfaceid vision benchmark

# Trigger immediate screen lock
openfaceid lock
```

---

## Documentation

- **Architecture & Runtime**:
  - [Architecture & Design](docs/architecture.md)
  - [Desktop Runtime Guide](docs/desktop-runtime.md)
  - [Desktop Runtime Architecture Decision](docs/desktop-runtime-decision.md)
  - [Technology Decision & ADR](docs/architecture-decision.md)
  - [Phase 3 Milestone Report](docs/phase-3-report.md)
  - [Phase 3 Cross-Platform Test Matrix](docs/phase-3-test-matrix.md)
  - [Installation, Testing & Migration Guide](docs/installation-testing.md)
- **Computer Vision & Biometrics**:
  - [Computer Vision Engine Math & Models](docs/vision-engine.md)
  - [Platform Camera Matrix](docs/camera-platform-matrix.md)
  - [Threshold Calibration & Biometrics](docs/threshold-calibration.md)
  - [Phase 2 Implementation Audit](docs/phase-2-audit.md)
  - [Phase 2 Verification & Claims Review](docs/phase-2-verification.md)
- **Security & Privacy**:
  - [Security Architecture & Cryptography](docs/security.md)
  - [Desktop Security & IPC Threat Model](docs/desktop-security.md)
  - [STRIDE Threat Model & PAD](docs/threat-model.md)
  - [Privacy Policy (Zero Cloud)](PRIVACY.md)
  - [Vulnerability Reporting & Security Policy](SECURITY.md)
- **Operations & Repository**:
  - [Repository Tracking State](docs/repository-state.md)
  - [Real Hardware Setup Guide](docs/real-hardware-setup.md)
  - [Contributing Guide](docs/contributing.md)

---

## License

OpenFaceID is released under the **Apache 2.0 License**. See [LICENSE](LICENSE) for details.

