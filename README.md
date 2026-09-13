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

## Current Platform Verification Status (Phase 5)

| Platform | Real Camera Capture | Face Detection (BlazeFace) | Face Recognition (ArcFace) | Liveness PAD | Desktop Daemon & UI | OS Packaging | Hardware Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **macOS (Darwin)** | **VERIFIED** (AVFoundation native) | **VERIFIED** (896 Anchors, IoU NMS) | **VERIFIED** (512D Cosine Metric) | **VERIFIED** (Light Passive + Strong Active) | **VERIFIED** (Daemon + Tray + HUD + Web UI) | **VERIFIED** (.app, .dmg, .zip) | **VERIFIED** |
| **Windows 10 / 11** | **CODE IMPLEMENTED** (Media Foundation) | **VERIFIED** (896 Anchors, IoU NMS) | **VERIFIED** (512D Cosine Metric) | **VERIFIED** (Light Passive + Strong Active) | **CODE IMPLEMENTED** (Daemon + Web UI) | **CODE IMPLEMENTED** (.cmd + NSIS) | **UNVERIFIED (PHYSICAL)** |
| **Linux (X11 / Wayland)** | **CODE IMPLEMENTED** (V4L2) | **VERIFIED** (896 Anchors, IoU NMS) | **VERIFIED** (512D Cosine Metric) | **VERIFIED** (Light Passive + Strong Active) | **CODE IMPLEMENTED** (Daemon + Web UI) | **PARTIALLY VERIFIED** (.deb + .tar.gz) | **UNVERIFIED (PHYSICAL)** |

---

## Phase 5 Feature Taxonomy

- **Implemented & Verified (macOS Physical Hardware)**:
  - **Authoritative Canonical State Machine (`packages/core/src/state/canonical.ts`)**: Single source of truth for the entire desktop lifecycle. UI, HUD, Tray, and CLI act strictly as state consumers.
  - **Hard Fail-Closed Multiple-Face Policy**: Automatic transition to `PRESENCE_AMBIGUOUS` whenever `face_count >= 2`. Presence is immediately revoked; zero authorization bypass.
  - **Session-Bound Presence Lifecycle**: Authorization tracked via `authorized_at`, `last_confirmed_at`, and `expiration_at`. System sleep explicitly revokes presence sessions upon wake.
  - **Modern Accessible Desktop Product UI**: Full onboarding wizard (Welcome, Privacy Disclosure, Camera Setup), 5-pose guided enrollment, real-time presence dashboard, Quick Glance HUD, Security Center, Privacy Center, and calibration presets.
  - **Sanitized Diagnostic Export**: Automated secret scanner scrubs all biometric vectors, base64 image frames, tokens, keys, and private credentials before archive creation.
  - **Camera Hot-Plug & Sleep/Wake Recovery**: Automatic non-blocking recovery loop re-establishing camera capture without restarting the application.
  - **Cryptographic Model Integrity**: SHA-256 validation of local vision model weights at boot.
  - **AES-256-GCM Encrypted Identity Store**: 512D hyperspherical embeddings sealed with random IV and authentication tag; secure file shredding on deletion.
- **Experimental & Code-Implemented (Secondary Platforms)**:
  - Windows Media Foundation capture backend and DPAPI keystore adapter.
  - Linux Video4Linux2 (V4L2) capture backend and Secret Service keyring adapter.
- **Unverified / Unsupported**:
  - Direct PAM authentication or OS login-screen unlocking (deliberately excluded from security scope).
  - Apple Developer ID signing & notarization (unsigned local developer build).

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

- **Phase 5 Productization & Verification**:
  - [User Guide](docs/user-guide.md)
  - [Installation & Setup Guide](docs/installation.md)
  - [Guided 5-Pose Enrollment Guide](docs/enrollment.md)
  - [Troubleshooting & Canonical Errors FAQ](docs/troubleshooting.md)
  - [Biometric Privacy Architecture](docs/privacy.md)
  - [Security Center Architecture](docs/security-center.md)
  - [Phase 5 Acceptance Matrix](docs/phase-5-acceptance-matrix.md)
  - [Phase 5 Long-Run Soak Benchmark Report](docs/phase-5-long-run-report.md)
  - [Phase 5 Final Engineering Report](docs/phase-5-report.md)
- **Architecture & Runtime**:
  - [Architecture & Design](docs/architecture.md)
  - [Desktop Runtime Guide](docs/desktop-runtime.md)
  - [Phase 4 Verification Report](docs/phase-4-report.md)
  - [Phase 3 Milestone Report](docs/phase-3-report.md)
- **Computer Vision & Biometrics**:
  - [Computer Vision Engine Math & Models](docs/vision-engine.md)
  - [Platform Camera Matrix](docs/camera-platform-matrix.md)
  - [Threshold Calibration & Biometrics](docs/threshold-calibration.md)
- **Security & Privacy**:
  - [STRIDE Threat Model & Trust Boundaries](docs/threat-model.md)
  - [IPC Security Audit & Fuzzing](docs/ipc-security-audit.md)
  - [Zero Cloud Privacy Policy](PRIVACY.md)
  - [Security Vulnerability Policy](SECURITY.md)
- **Operations & Contributing**:
  - [Contributing Guide](CONTRIBUTING.md)
  - [Changelog](CHANGELOG.md)

---

## License

OpenFaceID is released under the **Apache 2.0 License**. See [LICENSE](LICENSE) for details.

