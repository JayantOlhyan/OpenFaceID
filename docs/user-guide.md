# OpenFaceID (SightLock) — User Guide

Welcome to **OpenFaceID (SightLock)**, a private, local desktop presence detection and face recognition system.

OpenFaceID monitors your local webcam feed entirely on-device to determine when you are present at your computer, providing privacy-respecting presence automation without sending biometric data to any cloud service.

---

## 1. Quick Start

### Starting the Application
When OpenFaceID launches, it runs as a lightweight local daemon and provides both:
1. **Interactive Desktop UI**: Accessible via your web browser or Electron wrapper at `http://127.0.0.1:4173/` (or via the system menu bar / tray).
2. **System Tray / Menu Bar Icon**: Provides quick status glances, camera pause/resume toggle, and direct navigation to Settings, Security Center, and Diagnostics.

### First-Run Experience (Onboarding)
On first launch, OpenFaceID guides you through a 3-step onboarding wizard:
1. **Welcome & Mission**: Clear explanation of local processing boundaries. OpenFaceID is **not an OS login replacement**, does not intercept OS passwords, and does not send data over any network.
2. **Privacy Disclosure**: Explains how your camera is used, how 512D biometric embeddings are encrypted using AES-256-GCM, and how you can pause camera processing at any time.
3. **Camera Setup & Permission**: Selects your preferred webcam sensor, tests resolution, checks hardware health, and verifies system permissions.

---

## 2. Desktop Interface Overview

The OpenFaceID Desktop interface is organized into intuitive, accessible views:

### 1. Main Dashboard
- **Presence Card**: Shows live authoritative presence state (`AUTHORIZED`, `UNAUTHORIZED`, `EXPIRED`, `AMBIGUOUS`).
- **Session Lifecycle**: Displays exact timestamps for `authorized_at`, `last_confirmed_at`, and `expires_at`.
- **Face & Camera Status**: Confirms live face detection, eye-blink/liveness status, active camera device name, and privacy pause status.
- **HUD Preview**: An uncluttered quick-glance status card designed for fast visual feedback.

### 2. Enrollment
- Guides you through capturing 5 distinct face poses:
  1. Look Straight Ahead (Center)
  2. Turn Head Slightly Left (~15°)
  3. Turn Head Slightly Right (~15°)
  4. Tilt Head Slightly Up (~10°)
  5. Tilt Head Slightly Down (~10°)
- Evaluates real-time face size, position, lighting, image contrast, and eye-blink liveness.
- Requires explicit confirmation before saving the encrypted biometric representation.

### 3. Identity Management
- Shows registered profile metadata (Profile Name, Enrollment Date, Sample Count, Storage Cipher).
- Allows safe re-enrollment or one-click secure profile deletion with file shredding and buffer zeroization.
- **Biometric Privacy Guarantee**: Never displays raw images, face crops, or embedding vectors.

### 4. Settings
- **General**: Configures startup launch, tray visibility, and notification throttling.
- **Camera**: Selects video capture sensor, resolution (`640x480`, `1280x720`, `1920x1080`), and frame rate (15–30 FPS).
- **Recognition Presets**:
  - **Balanced (Default)**: Cosine similarity threshold `0.70` (recommended for general desktop environments).
  - **Strict**: Threshold `0.80` (higher security for sensitive workstations).
  - **Very Strict**: Threshold `0.88` (maximum discrimination requiring consistent front-facing alignment).
- **Liveness Mode**: Select between `passive` (temporal EAR eye-blink tracking + micro-motion) or `active` (pose challenges).

### 5. Security Center
- Live verification checks for:
  - **Model Integrity**: SHA-256 validation of local AI models.
  - **Biometric Encryption**: Verifies AES-256-GCM with hardware keystore or PBKDF2 machine-bound key.
  - **IPC Security**: Enforces local loopback binding (127.0.0.1) and ephemeral bearer token authentication.
  - **Network Policy**: Confirms zero network egress and zero remote telemetry.
  - **Camera Privacy**: Real-time indication of camera capture status.

### 6. Privacy Center & Diagnostics
- Complete transparency on stored local biometrics.
- **Camera Pause**: Immediately suspends camera frame capture and zeros memory buffers.
- **Diagnostics Tools**: Runs automated "Doctor", Security, and Privacy audits.
- **Export Diagnostics**: Generates a sanitized JSON report automatically scanned and scrubbed of any sensitive keys, tokens, or vectors.

---

## 3. Multiple-Face Fail-Closed Policy

If a colleague or passerby enters the camera's field of view (`face_count >= 2`), OpenFaceID immediately transitions to **`PRESENCE_AMBIGUOUS`** and revokes presence authorization.

> [!WARNING]
> For your security and privacy, OpenFaceID will never authorize presence while multiple faces are visible. It will not authorize presence simply because one face matched.

To resume authorization, ensure only you are visible to the webcam.

---

## 4. Privacy Pause

Whenever you want guaranteed privacy:
1. Click **Pause Camera** in the System Tray or Desktop Dashboard.
2. The camera pipeline immediately halts capture.
3. The internal state transitions to `PRIVACY_PAUSED`, and presence authorization immediately fails closed.
4. When ready, click **Resume Camera** to re-initialize camera capture and re-authenticate your presence.

---

## 5. Keyboard Accessibility & Shortcuts
- Fully operable via keyboard navigation (`Tab`, `Shift+Tab`, `Space`, `Enter`).
- Meets WCAG contrast guidelines in both dark and light modes.
- Statuses are communicated with both textual labels and high-contrast icons, never relying on color alone.
