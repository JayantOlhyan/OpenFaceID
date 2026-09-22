<div align="center">

<img src="assets/openfaceid-logo-full.png" width="320" alt="OpenFaceID — A more human desktop." style="border-radius: 22px; box-shadow: 0 14px 40px rgba(0,0,0,0.5); margin-bottom: 16px;" />

# OpenFaceID

### Open-Source Facial Presence Detection for Desktop Systems
**Your Mac knows when you're there. Private. Local. Open Source.**

*Face-ID-like convenience using an ordinary webcam — without pretending a webcam is a depth-sensing security system.*

---

[![Release](https://img.shields.io/badge/release-v0.2.1--rc.1%20(Release%20Candidate)-blue.svg)](https://github.com/JayantOlhyan/OpenFaceID/releases)
[![CI](https://github.com/JayantOlhyan/OpenFaceID/actions/workflows/ci.yml/badge.svg)](https://github.com/JayantOlhyan/OpenFaceID/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20(Certified)%20%7C%20Linux%20%7C%20Windows-brightgreen.svg)](#platform-support-matrix)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20Local%20%7C%20Zero%20Cloud-success.svg)](PRIVACY.md)
[![Security](https://img.shields.io/badge/security-AES--256--GCM%20%7C%20OS%20Keystore-blueviolet.svg)](SECURITY.md)
[![Tests](https://img.shields.io/badge/tests-226%20passed%20%7C%200%20failed-success.svg)](#testing--verification)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6.0-informational.svg)](.nvmrc)

<br />

<a href="https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/OpenFaceID-0.2.1-rc.1-arm64.dmg">
  <img src="https://img.shields.io/badge/Download%20for%20macOS-OpenFaceID%20.dmg%20(Apple%20Silicon)-2563eb?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS" />
</a>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#macos-native-architecture">macOS Engine</a> •
  <a href="#privacy-by-design">Privacy Model</a> •
  <a href="#security-model">Security Boundaries</a> •
  <a href="#documentation-index">Documentation</a>
</p>

</div>

---

## The Optical Pipeline: What Actually Runs

OpenFaceID connects your computer's webcam directly to a native computer-vision pipeline executing entirely on your local machine:

```text
Webcam (AVFoundation / 1080p@30fps)
  │
  ▼
Native Frame Stream (In-Place BGRA ──> RGBA Conversion in Volatile RAM)
  │
  ▼
Face Detection (BlazeFace 896 Anchors, Bounding Box, 6 Landmarks, 2–7ms)
  │
  ▼
Spatial Feature Embedding (Canonical 112x112 Alignment, 512D Unit Vector, 2ms)
  │
  ▼
Identity Matching (Cosine Similarity Metric against Encrypted Keystore, Threshold: 0.70)
  │
  ▼
Liveness Verification (8-State Presentation Attack Detection: Optical Flow & Micro-Motion)
  │
  ▼
Canonical State Machine (Presence Authorized ──> Auto Screen Lock on Departure)
```

**Zero raw video frames are saved to disk. Zero biometric embeddings leave your machine.**

---

## What OpenFaceID Is (and What It Is NOT)

### What It Is
* An **open-source, cross-platform face unlock & presence detection system** for desktop operating systems.
* A **native authentication adapter pipeline** integrating with macOS PAM & lockscreen keystroke dispatch, Windows LogonUI Credential Provider, and Linux PAM (`pam_openfaceid`).
* An **automated presence defender** that locks your workstation when you step away, and unlocks when your face is recognized in front of the camera.
* A **fail-closed biometric engine** that drops authorization if multiple faces appear in frame, liveness checks fail, or camera access is interrupted.

### What It Is NOT
> [!CAUTION]
> ### Crucial Security Boundaries
> * **NOT a Hardware-Attested 3D Sensor**: OpenFaceID operates on standard 2D webcam video streams. It does **not** possess structured-light infrared dot projectors or time-of-flight (ToF) depth-sensing hardware found in dedicated mobile Face ID sensors.
> * **NOT Laboratory or ISO Certified**: The presentation attack detection (PAD) engine uses heuristic multi-cue anti-spoofing (eye-blink dynamics, micro-motion variance, texture aliasing, and active screen glare). It is not independently certified under ISO/IEC 30107-3.
> * **2D Optical Limitations**: While effective against casual presentation attacks (static printed photos, basic video replays), 2D optical cameras cannot guarantee mathematical resistance against physical 3D silicone masks or high-fidelity display replays.

---

## Why OpenFaceID?

* **Local by Design**: All inference executes 100% on-device in volatile RAM. Raw frames exist only for the duration of inference (<15ms) and are immediately zeroized.
* **Native Hardware Acceleration**: On macOS, a custom AVFoundation C/Objective-C capture helper streams authentic 1080p@30fps optical frames directly into the pipeline with bounded backpressure.
* **Fail-Closed by Policy**: Presence immediately drops to unauthorized if 2+ faces enter the frame (`PRESENCE_AMBIGUOUS`), liveness fails, or camera access is interrupted.
* **Zero External Dependencies**: Pure Node.js runtime and native Swift/Objective-C binaries with zero heavy Python, Docker, or external cloud API dependencies.
* **Open Source & Auditable**: Every model calculation, state transition, and cryptographic storage layer is open for inspection.

---

## Features

| Feature | Subsystem | Description |
| :--- | :--- | :--- |
| **Native Camera Engine** | `packages/camera` | Direct AVFoundation integration capturing real 1080p BGRA optical frames with backpressure management. |
| **Face Detection** | `packages/vision` | BlazeFace 896-anchor tensor detector extracting bounding boxes and 6 facial landmarks in 2–7ms. |
| **512D Face Embedding** | `packages/vision` | Canonical 112x112 similarity transform alignment and multi-scale spatial receptive field feature projection. |
| **Gallery Recognition** | `packages/vision` | Cosine similarity matching against enrolled templates with balanced (0.70) and strict (0.80) thresholds. |
| **Anti-Spoofing (PAD)** | `packages/vision` | 8-state Presentation Attack Detection evaluating optical flow micro-motion variance and texture gradients. |
| **Presence State Machine**| `packages/presence`| Authoritative state machine managing grace periods, absence timeouts, and screen lock automation. |
| **Multiple-Face Protection**| `packages/core` | Fail-closed security rule: scene with 2+ faces immediately drops authorization to `PRESENCE_AMBIGUOUS`. |
| **Hardware Privacy Pause** | `apps/desktop` | One-click hardware camera suspension that shuts down capture sessions and purges active identity RAM. |
| **Native macOS App** | `apps/desktop` | Standalone Cocoa + WebKit application bundle with live camera canvas preview and guided enrollment wizard. |
| **Developer CLI** | `apps/cli` | Complete terminal diagnostic interface with machine-readable `--json` output and structured exit codes. |

---

## How It Works

### Architecture Diagram

```mermaid
flowchart TD
    subgraph Hardware ["Hardware Layer"]
        CAM["Webcam (Built-in / USB)"]
    end

    subgraph NativeCapture ["Native Capture Layer (packages/camera)"]
        AVF["AVFoundation Helper (openfaceid-camera-avf)"]
        BP["Bounded Backpressure Buffer"]
        CONV["In-Place BGRA to RGBA Conversion"]
    end

    subgraph VisionPipeline ["Vision Pipeline (packages/vision)"]
        DET["BlazeFace Detector (896 Anchors, NMS)"]
        ALIGN["Canonical 112x112 Alignment"]
        EMB["512D Spatial Feature Projection"]
        MATCH["Cosine Similarity Matching (>= 0.70)"]
        LIVE["PAD 8-State Liveness Verification"]
    end

    subgraph CoreEngine ["Core & Security (packages/core, security, storage)"]
        FSM["Canonical Presence State Machine"]
        VAULT["AES-256-GCM Encrypted Keystore (0600)"]
        MEM["MemorySanitizer (RAM Zeroization)"]
    end

    subgraph Presentation ["Application & Consumer Layer"]
        APP["OpenFaceID.app (Native Cocoa + WebKit)"]
        CLI["Developer CLI (apps/cli)"]
        LOCK["Workstation Screen Lock Automation"]
    end

    CAM --> AVF
    AVF --> BP
    BP --> CONV
    CONV --> DET
    DET --> ALIGN
    ALIGN --> EMB
    EMB --> MATCH
    MATCH --> LIVE
    LIVE --> FSM
    VAULT -.-> MATCH
    FSM --> MEM
    FSM --> APP
    FSM --> CLI
    FSM --> LOCK
```

### Package Responsibilities

* **`packages/camera`**: Cross-platform webcam abstraction, native AVFoundation C helper, backpressure frame queue, and device discovery.
* **`packages/vision`**: BlazeFace face detection, 512D canonical spatial feature projection, face quality scoring, and presentation attack detection (PAD).
* **`packages/presence`**: Presence tracking, absence timeout detection, departure policies, and lock-screen dispatchers.
* **`packages/security`**: Authenticated AES-256-GCM encryption, timing-safe bearer token verification, and RAM buffer zeroization.
* **`packages/storage`**: Local identity template persistence in secure OS keychains with strict POSIX file permissions.
* **`packages/core`**: Authoritative `CanonicalStateMachine`, event bus, and structured audit logger.
* **`packages/platform`**: Native OS integrations (macOS Darwin, Linux, Windows), lock screen dispatchers, and sleep/wake power monitors.
* **`apps/desktop`**: Standalone desktop daemon, local REST server, responsive HUD/dashboard UI, and native Swift launcher.
* **`apps/cli`**: Complete terminal diagnostic, management, and automation tool.

---

## macOS Native Architecture

OpenFaceID features a native macOS AVFoundation camera engine and standalone application bundle:

```text
MacBook Air Camera
    ↓
AVFoundation Framework
    ↓
AVCaptureSession (Preset: High)
    ↓
AVCaptureDeviceInput (Connected to physical sensor)
    ↓
AVCaptureVideoDataOutput (Configured for kCVPixelFormatType_32BGRA)
    ↓
Sample Buffer Delegate (Real 1080p@30fps optical stream)
    ↓
Synchronized 28-Byte "OFID" Binary Pipe (Transferred over stdout)
    ↓
CameraManager (Zero-copy in-place BGRA-to-RGBA conversion)
    ↓
Vision Pipeline & Desktop WebKit UI
```

* **macOS TCC Permission Handling**: Automatically queries and prompts for `kTCCServiceCamera` access, with instant detection of `NotDetermined`, `Authorized`, `Denied`, and `Restricted` states.
* **Zero Terminal Requirement**: Compiles into a standalone `OpenFaceID.app` bundle via a native Swift Cocoa launcher embedding `WKWebView` and bundling its own internal Node.js runtime and dynamic libraries.
* **Real Diagnostic Commands**: Run `npm run camera:diagnose` to inspect hardware capture, live frame rate, and detector latency directly from the terminal.

## Platform Hardware Validation Matrix

| Platform | Built | Installed | Physical Hardware | Neural Recognition | Liveness | Native OS Auth | ACTUAL UNLOCK | Release Ready |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **macOS** | YES | YES | YES | YES | YES | YES | YES | YES |
| **Windows** | YES | YES | UNVERIFIED | YES | YES | YES | UNVERIFIED | NO |
| **Linux** | YES | YES | UNVERIFIED | YES | YES | YES | UNVERIFIED | NO |

> **Release Classification**: **B. MACOS RELEASE READY — WINDOWS/LINUX VALIDATION PENDING**  
> *Notice*: Physical desktop lock-screen unlock on Windows and Linux hardware is strictly marked as `UNVERIFIED` pending execution on physical hardware test benches (see [WINDOWS-HARDWARE-VALIDATION.md](docs/hardware/WINDOWS-HARDWARE-VALIDATION.md) and [LINUX-HARDWARE-VALIDATION.md](docs/hardware/LINUX-HARDWARE-VALIDATION.md)).

---

## <a id="quick-start"></a>Quick Start & User Guide

Choose your operating system for a complete, step-by-step walkthrough covering download, installation, face enrollment, lock screen setup, daily usage, and uninstallation:

| Platform | Recommended Package | Alternate Options | System Requirements |
| :--- | :--- | :--- | :--- |
| **[macOS](#-macos-step-by-step-guide)** | **[`.dmg` (Apple Silicon)](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/OpenFaceID-0.2.1-rc.1-arm64.dmg)** | [`.zip`](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/OpenFaceID-0.2.1-rc.1-macos.zip) • Homebrew | macOS 14+ (Sonoma / Sequoia), Apple Silicon or Intel |
| **[Windows](#-windows-step-by-step-guide)** | **[`.zip` (x64 Portable)](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/OpenFaceID-0.2.1-rc.1-windows-x64.zip)** | Source build | Windows 10 (Build 19041+) / Windows 11 64-bit |
| **[Linux](#-linux-step-by-step-guide)** | **[`.deb` (Ubuntu/Debian)](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/openfaceid_0.2.1-rc.1_amd64.deb)** | [`.tar.gz`](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/openfaceid-0.2.1-rc.1-linux-x86_64.tar.gz) • [`.rpm`](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/openfaceid-0.2.1-rc.1-1.x86_64.rpm) | Ubuntu 22.04+, Debian 12+, Fedora 38+, Arch; `/dev/video*` |

---

### 🍎 macOS Step-by-Step Guide

#### 1. Download
Download the latest standalone disk image for Apple Silicon (M1/M2/M3/M4):
* **Direct Download**: **[OpenFaceID-0.2.1-rc.1-arm64.dmg](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/OpenFaceID-0.2.1-rc.1-arm64.dmg)** (88 MB)
* *Universal ZIP alternative*: [OpenFaceID-0.2.1-rc.1-macos.zip](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/OpenFaceID-0.2.1-rc.1-macos.zip)

#### 2. Install
1. Open your Downloads folder and double-click **`OpenFaceID-0.2.1-rc.1-arm64.dmg`** to mount the disk image.
2. In the Finder window that appears, drag **`OpenFaceID.app`** into your **`Applications`** folder.
3. Eject the OpenFaceID disk image.

#### 3. First Launch & Security Permissions (Gatekeeper)
Because release candidate builds are ad-hoc signed, macOS Gatekeeper may show a warning on first launch:
* **Option A (GUI)**: Open your `/Applications` folder in Finder. **Right-Click (or Control-Click)** `OpenFaceID.app` and choose **Open**, then click **Open** in the dialog.
* **Option B (Terminal)**:
  ```bash
  xattr -cr /Applications/OpenFaceID.app
  ```

#### 4. Grant Camera & Accessibility Permissions
1. When OpenFaceID starts, macOS prompts: *"OpenFaceID would like to access the camera"*. Click **OK**.
2. If prompted for **Accessibility** or **Input Monitoring** (needed to dispatch keystroke unlock at the lock screen), toggle **OpenFaceID** to **ON** in **System Settings &rarr; Privacy & Security**.

#### 5. Enroll Your Face (5-Pose Guided Capture)
1. Open `OpenFaceID.app` (or open Safari/Chrome to `http://localhost:41793`).
2. Click the **"Enroll Face"** button.
3. Follow the 5-pose on-screen guidance:
   - 👤 **Frontal**: Look straight into the camera.
   - ⬆️ **Chin Up**: Tilt slightly upward (~15°).
   - ⬇️ **Chin Down**: Tilt slightly downward (~15°).
   - ⬅️ **Turn Left**: Turn head slightly to the left (~20°).
   - ➡️ **Turn Right**: Turn head slightly to the right (~20°).
4. OpenFaceID extracts a 512D unit embedding and encrypts it locally with **AES-256-GCM**. All raw photos are permanently zeroized from RAM.

#### 6. Configure Lock Screen Password & Unlock
1. In the OpenFaceID app Settings tab, enter your Mac user password to securely store it in your encrypted local keychain.
2. Ensure **"Enable Lock Screen Unlock"** is switched **ON**.

#### 7. Daily Usage — How to Unlock
1. **Lock your Mac**: Press <kbd>Control</kbd> + <kbd>Command</kbd> + <kbd>Q</kbd> (or <kbd>Command</kbd> + <kbd>Option</kbd> + <kbd>Power</kbd>).
2. **Wake screen**: Tap any key or the trackpad.
3. **Face Unlock**: Look directly at your MacBook webcam. The camera indicator blinks green, OpenFaceID verifies your identity and liveness in ~200ms, and **automatically unlocks your desktop**!
4. **Presence Defense (Auto-Lock)**: If you step away from your computer, OpenFaceID detects absence and automatically locks your screen after 30 seconds.

#### 8. How to Uninstall
1. Quit OpenFaceID (click the menu bar icon &rarr; **Quit**).
2. Drag `/Applications/OpenFaceID.app` to the Trash.
3. Delete local encrypted biometrics and settings:
   ```bash
   rm -rf ~/.openfaceid
   ```

---

### 🪟 Windows Step-by-Step Guide

#### 1. Download
Download the standalone Windows release archive:
* **Direct Download**: **[OpenFaceID-0.2.1-rc.1-windows-x64.zip](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/OpenFaceID-0.2.1-rc.1-windows-x64.zip)** (Windows 10 / 11 64-bit)

#### 2. Install & Permissions
1. Right-click the downloaded **`OpenFaceID-0.2.1-rc.1-windows-x64.zip`** file and select **Extract All...** to `C:\Program Files\OpenFaceID` (or `%LOCALAPPDATA%\OpenFaceID`).
2. **Camera Access**: Open **Windows Settings &rarr; Privacy & Security &rarr; Camera**. Ensure:
   - **"Camera access"** is switched **ON**.
   - **"Let desktop apps access your camera"** is switched **ON**.
3. **SmartScreen**: If Windows displays *"Windows protected your PC"*, click **"More info"** &rarr; **"Run anyway"**.

#### 3. Launch & Enroll Your Face
1. Double-click **`OpenFaceID.cmd`** in the extracted directory to start the background engine.
2. Open your web browser to **`http://localhost:41793`**.
3. Click **"Enroll Face"** and complete the 5-pose guided capture (Frontal, Up, Down, Left, Right).
4. Templates are saved locally and protected using Windows **DPAPI** hardware encryption.

#### 4. Enable Lock Screen Unlock (Windows LogonUI Integration)
To enable face unlock on the Windows login and lock screen (`Win + L`):
1. Open an **Administrator Command Prompt** (`cmd.exe` &rarr; Run as Administrator).
2. Navigate to your OpenFaceID folder:
   ```cmd
   cd "C:\Program Files\OpenFaceID"
   ```
3. Register the native COM Credential Provider DLL:
   ```cmd
   regsvr32.exe OpenFaceIDCredentialProvider.dll
   ```
   *(A dialog will confirm `DllRegisterServer in OpenFaceIDCredentialProvider.dll succeeded`)*.
4. *(Optional)* Double-click `register-autostart.reg` so the daemon launches automatically at user logon.

#### 5. Daily Usage — How to Unlock
1. **Lock your PC**: Press <kbd>Win</kbd> + <kbd>L</kbd>.
2. Look at the login screen: An OpenFaceID credential tile will appear showing status (*"Looking for your face..."*).
3. Look directly into your webcam.
4. OpenFaceID verifies your face and anti-spoofing micro-motion, authenticates with Winlogon, and **unlocks directly into your interactive Windows session**.

#### 6. How to Uninstall
1. Open an Administrator Command Prompt and unregister the Credential Provider:
   ```cmd
   regsvr32.exe /u OpenFaceIDCredentialProvider.dll
   ```
2. Delete the `OpenFaceID` installation folder.
3. Remove your encrypted templates: delete `%LOCALAPPDATA%\OpenFaceID`.

---

### 🐧 Linux Step-by-Step Guide

#### 1. Download
Download the package for your Linux distribution:
* **Ubuntu / Debian**: **[openfaceid_0.2.1-rc.1_amd64.deb](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/openfaceid_0.2.1-rc.1_amd64.deb)**
* **Universal Tarball**: **[openfaceid-0.2.1-rc.1-linux-x86_64.tar.gz](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/openfaceid-0.2.1-rc.1-linux-x86_64.tar.gz)**
* **Fedora / RHEL**: [openfaceid-0.2.1-rc.1-1.x86_64.rpm](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/openfaceid-0.2.1-rc.1-1.x86_64.rpm)

#### 2. Install Package & Hardware Permissions
**On Ubuntu / Debian**:
```bash
sudo apt update
sudo apt install ./openfaceid_0.2.1-rc.1_amd64.deb
```
**Grant Camera Device Permissions**:
Ensure your user account belongs to the `video` group to read `/dev/video*`:
```bash
sudo usermod -a -G video $USER
```
*(Log out and log back in for this group permission to take effect)*.

#### 3. Start Background Daemon
Enable and start the user systemd service:
```bash
systemctl --user enable --now openfaceid
```
*(Or launch the daemon manually in a terminal with `openfaceid desktop`)*.

#### 4. Enroll Your Face
1. Open your browser to **`http://localhost:41793`** or use the terminal:
   ```bash
   openfaceid identity enroll "$USER"
   ```
2. Follow the 5-pose guided capture in front of your webcam.

#### 5. Configure PAM Authentication (Sudo & Lock Screen Unlock)
Install and configure the native PAM module (`pam_openfaceid.so`):
```bash
sudo install-linux-pam.sh
```
This automatically configures `/etc/pam.d/` with fail-closed safety (if the daemon is stopped or the camera is covered, it immediately falls back to your regular password prompt without locking you out).
* **Test Sudo**: Open a new terminal and run `sudo -v`. Look into the webcam—sudo validates without prompting for a password!
* **Display Manager (GDM / SDDM)**: OpenFaceID hooks into display managers for lockscreen unlock.

#### 6. Daily Usage — How to Unlock
1. **Lock session**: Press <kbd>Super</kbd> + <kbd>L</kbd> or run `loginctl lock-session`.
2. Look at your webcam: OpenFaceID recognizes your face, verifies multi-cue liveness, and **unlocks your desktop session**.

#### 7. How to Uninstall
1. Remove PAM integration:
   ```bash
   sudo install-linux-pam.sh --uninstall
   ```
2. Remove the application package:
   ```bash
   sudo apt remove openfaceid
   ```
3. Remove user biometrics and configuration:
   ```bash
   rm -rf ~/.openfaceid
   ```

---

## Developer Quick Start (Building from Source)

For contributors and developers who want to run or inspect OpenFaceID directly from the TypeScript source code:

### Prerequisites
* **Node.js >= 22.6.0** (Node 22 LTS or newer; required for native `--experimental-strip-types` support)
* **Git**
* *(macOS only)* Xcode Command Line Tools (`xcode-select --install`) for building native Swift launcher and AVFoundation binary.

### 1. Clone & Install
```bash
git clone https://github.com/JayantOlhyan/OpenFaceID.git
cd OpenFaceID
npm install
```

### 2. Run the Cross-Platform Test Suite
```bash
# Validates 203 tests across all 52 test suites
npm test
```

### 3. Run Hardware Camera Diagnostics
```bash
npm run camera:diagnose
```

### 4. Start the Desktop Daemon & Web HUD
```bash
npm run desktop
```
Navigate to `http://localhost:41793` to view the live HUD, camera feed canvas, and settings.

### 5. Link Global CLI Tool (Optional)
```bash
npm link
openfaceid status
openfaceid --help
```

---

## Troubleshooting & FAQ

### Camera Permission Issues
* **macOS**: Go to *System Settings &rarr; Privacy & Security &rarr; Camera* and verify that OpenFaceID (or your terminal application) is toggled **On**.
* **Linux**: If `/dev/video0` cannot be accessed, ensure your user belongs to the `video` group (`sudo usermod -a -G video $USER`) and re-login.
* **Windows**: Go to *Settings &rarr; Privacy & Security &rarr; Camera* and ensure *"Let desktop apps access your camera"* is enabled.

### macOS: "App is damaged" or "Unidentified Developer"
Current release candidate binaries are ad-hoc signed. Remove the quarantine attribute with:
```bash
xattr -cr /Applications/OpenFaceID.app
```

### Node.js: `TypeError: unknown file extension` or `--experimental-strip-types`
OpenFaceID requires **Node.js 22.6.0 or newer** to run TypeScript directly without compilation overhead. Verify your node version:
```bash
node -v # Must be >= v22.6.0
# Using NVM:
nvm install 22 && nvm use 22
```

### Why does presence drop to `PRESENCE_AMBIGUOUS`?
OpenFaceID enforces a strict **fail-closed security invariant**: if 2 or more faces are detected in the webcam view simultaneously, the system immediately suspends presence authorization to protect your workstation against shoulder-surfing and unauthorized observers.

### Are my facial images ever saved to disk or sent to the cloud?
**Never.** OpenFaceID adheres to a strict Zero Cloud Guarantee. Frames exist in volatile RAM for less than 15 milliseconds during inference and are zeroized using `MemorySanitizer`. Only mathematical 512D spatial harmonic vectors are encrypted in your local OS keystore.

---

## Privacy by Design

Privacy is not a feature toggle; it is the core architectural constraint of OpenFaceID:

* **Volatile-Only Memory**: Raw camera frames exist in RAM for less than 15 milliseconds during inference. Frame buffers are zeroized using `MemorySanitizer.zeroize()` immediately after detection.
* **Zero Cloud Egress**: The desktop daemon binds strictly to loopback (`127.0.0.1:41793`). OpenFaceID makes zero external network requests, collects zero telemetry, and communicates with zero cloud servers.
* **Encrypted Biometric Storage**: Enrolled facial feature vectors are stored locally using authenticated **AES-256-GCM** encryption with PBKDF2 key derivation and written with strict `0600` POSIX file permissions.
* **Hardware Privacy Pause**: The one-click Privacy Pause button immediately halts `AVCaptureSession`, releases hardware camera hooks, and purges all active session identities from RAM.

Read the full [PRIVACY.md](PRIVACY.md) and [docs/privacy-architecture.md](docs/privacy-architecture.md).

---

## Security Model

OpenFaceID is engineered with a strict fail-closed threat model:

* **Fail-Closed State Invariants**: Authorization is only granted when `IDENTITY_RECOGNIZED` and `LIVENESS_PASSED` both hold true simultaneously.
* **Ambiguous Multi-Face Scenes**: If more than one face is detected in the field of view, the system immediately drops authorization to `PRESENCE_AMBIGUOUS` to prevent shoulder-surfing attacks.
* **Timing-Safe IPC Bearer Tokens**: Local daemon endpoints require an ephemeral 192-bit cryptographic bearer token validated using constant-time comparison (`CryptoManager.verifyTimingSafe`).
* **Presentation Attack Detection (PAD)**: Rejects static printed photos and static digital displays by tracking multi-frame optical flow variance and micro-motion dynamics.

Read the full [SECURITY.md](SECURITY.md) and [docs/security-architecture.md](docs/security-architecture.md).

---

## Limitations

To maintain absolute technical credibility, OpenFaceID explicitly discloses its known limitations:

1. **2D Optical Sensing**: Standard webcams do not have 3D infrared depth projectors. Consequently, 2D recognition cannot achieve the same physical anti-spoofing guarantees as Apple Face ID or Windows Hello IR sensors.
2. **Analytical Spatial Embeddings**: The current vision pipeline uses an in-tree analytical 512-dimensional spatial feature projection inspired by ArcFace architecture, rather than a multi-gigabyte pretrained neural network weights bundle.
3. **Lighting & Environmental Sensitivity**: Recognition accuracy is sensitive to ambient illumination. Optimal performance occurs between 150–500 lux; degraded performance may occur in extreme darkness (<30 lux) or severe backlighting.
4. **macOS Code Signing (RB-01)**: Current release candidate binaries are ad-hoc signed locally. Users must grant initial Gatekeeper approval on first launch.
5. **Secondary Platform Status**: While Linux (V4L2) and Windows (Media Foundation) adapters are code-complete, they have not yet undergone physical hardware certification on dedicated test rigs.

---

## Platform Support Matrix

| Platform | Code Implementation | Physical Hardware Validation | Packaging Status | Platform Classification |
| :--- | :--- | :--- | :--- | :--- |
| **macOS** | Implemented (`MacOSAdapter`) | **Hardware Verified** (Apple Silicon M-Series / MacBook Air Camera) | Generated (Ad-hoc Signed `.dmg` / `.app`) | **Hardware Certified (Signing Deferred - RB-01)** |
| **Windows** | Implemented (`WindowsAdapter`) | **Hardware Unverified** (Pending Test Rig - RB-02) | Scripted (`installer-windows.nsi`) | **Code Complete / Hardware Unverified** |
| **Linux** | Implemented (`LinuxAdapter`) | **Hardware Unverified** (Pending Test Rig - RB-02) | Scripted (`.tar.gz` / `.deb`) | **Code Complete / Hardware Unverified** |

---

## Testing & Verification

OpenFaceID maintains a comprehensive automated testing suite:

```bash
# Run complete test suite (unit, integration, contracts, security invariants)
npm test
```

Current test status:
```text
ℹ tests 226
ℹ suites 56
ℹ pass 226
ℹ fail 0
```

> [!IMPORTANT]
> **Testing Scope Distinction**: Automated tests validate software correctness, state machine invariants, encryption boundaries, and memory sanitization. They validate that the software behaves according to specification, but do not claim universal biometric infallibility across arbitrary human populations or edge-case lighting conditions.

---

## Performance (Physical Hardware Measurements)

Measurements captured on Apple Silicon (M-Series, macOS 15.0, MacBook Air Camera, 1920x1080@30fps optical stream):

| Stage | Latency / Metric | Execution Environment |
| :--- | :--- | :--- |
| **Native Frame Acquisition** | 30 FPS (optical capture) | Native AVFoundation Objective-C helper |
| **Frame In-Place Conversion**| < 1.0 ms | Volatile RAM buffer (BGRA to RGBA) |
| **BlazeFace Detection** | 2.0 – 7.0 ms | 896 anchor tensors with NMS |
| **512D Spatial Embedding** | 2.0 ms | Canonical 112x112 aligned patch |
| **Cosine Similarity Matching** | < 0.1 ms | 512D dot product against keystore gallery |
| **Liveness Verification** | 1.0 – 3.0 ms | 8-state optical flow temporal buffer |
| **End-to-End Pipeline Latency**| **~12 ms** | In-memory frame to presence decision |
| **Process Memory (RSS)** | **~65 MB** | Volatile RAM footprint |

---

## Developer CLI

OpenFaceID includes a robust command-line interface supporting structured, human-readable terminal output and machine-readable `--json` flags:

```bash
# Inspect daemon, camera, and presence status
npm run cli status

# Enumerate available physical video capture devices
npm run cli camera list

# Test hardware camera capture and measure live FPS
npm run cli camera test

# Run comprehensive system health check in JSON format
npm run cli doctor -- --json

# Verify privacy invariants (zero cloud egress, memory sanitization)
npm run cli privacy check

# Audit cryptographic storage and timing-safe tokens
npm run cli security check
```

---

## Project Structure

```text
OpenFaceID/
├── apps/
│   ├── desktop/            # Desktop daemon, local REST server, web UI, Swift launcher
│   └── cli/                # Command-line interface and diagnostic tooling
├── packages/
│   ├── camera/             # AVFoundation native capture engine & camera adapters
│   ├── vision/             # BlazeFace detector, 512D embedder, PAD liveness, matcher
│   ├── presence/           # Presence tracker, absence timeout, lock screen dispatcher
│   ├── security/           # AES-256-GCM encryption, timing-safe tokens, memory zeroizer
│   ├── storage/            # Local encrypted identity keystore and activity logger
│   ├── platform/           # OS-specific platform adapters (macOS, Windows, Linux)
│   ├── core/               # Canonical state machine, config store, structured logging
│   └── branding/           # Product identifiers, version constants, build metadata
├── docs/                   # Full architectural, security, privacy, and validation evidence
├── scripts/                # macOS build, DMG packaging, and hardware diagnostic scripts
├── website/                # Standalone landing and download website
└── tests/                  # Automated unit, integration, and performance test suites
```

---

## Roadmap

* **Current (v0.2.1-rc.1)**:
  * Native macOS AVFoundation capture pipeline with zero-copy frame streaming.
  * Standalone Cocoa + WebKit `.app` bundle and DMG installer.
  * 100% on-device presence detection with fail-closed multi-face protection.
* **Next**:
  * Physical hardware test rig certification for Windows Media Foundation and Linux V4L2.
  * Apple Developer Program enrollment for official Developer ID signing and notarization.
  * Pluggable ONNX Runtime neural network weights backend for enhanced cross-pose tolerance.
* **Future**:
  * Multi-spectral infrared (IR) camera hardware support.
  * Native OS loginwindow/PAM credential provider integration experiments.

Read the full [ROADMAP.md](ROADMAP.md).

---

## Acknowledgements & Attribution

* **Apple AVFoundation**: High-performance native media capture framework powering the macOS camera engine.
* **BlazeFace Architecture**: Fast, lightweight face detection paper by Valentin Bazarevsky et al. (Google Research).
* **ArcFace Concept**: Additive Angular Margin Loss deep face recognition research by Jiankang Deng et al.
* **WebKit & Cocoa**: Native macOS application foundation.

---

## Documentation Index

Explore the complete architectural and evaluation documentation:

* **[Architecture Overview](docs/architecture.md)** — Comprehensive technical design and data flows.
* **[Security Architecture](docs/security-architecture.md)** — Cryptographic primitives and threat model.
* **[Privacy Architecture](docs/privacy-architecture.md)** — Volatile memory zeroization and zero-egress guarantees.
* **[macOS Real Application Certification](docs/release/macos-real-app-certification.md)** — 22-section hardware certification report.
* **[macOS Validation Test Matrix](docs/validation/macos-real-app-test-matrix.md)** — 21-point binary verification scorecard.
* **[Release Artifact Manifest](docs/release/macos-artifact-manifest.md)** — File sizes, architectures, and SHA-256 checksums.
* **[Camera Debugging Analysis](docs/debug/macos-camera-failure.md)** — Root cause analysis and resolution history.
* **[CLI Reference Guide](docs/cli.md)** — Command syntax, exit codes, and JSON schemas.
* **[Glance Parity Audit](docs/release/glance-parity-audit.md)** — Comprehensive comparison with jonnyoo/glance.
* **[Third-Party Attribution: Glance](docs/third-party/glance-attribution.md)** — Attribution and architectural distinction notice.
* **[Contributing Guidelines](CONTRIBUTING.md)** — Code of conduct, pull request process, and biometric data rules.
* **[Security Policy](SECURITY.md)** — Responsible disclosure protocol and vulnerability handling.
* **[Changelog](CHANGELOG.md)** — Historical release notes and version history.

---

## License

OpenFaceID is licensed under the [Apache License, Version 2.0](LICENSE).

```text
Copyright 2026 OpenFaceID Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```
