# OpenFaceID — Native Desktop Runtime Architecture

This document describes the native desktop runtime architecture of OpenFaceID (SightLock), detailing the lifecycle engine, background service mode, system tray/menu-bar integration, sleep/wake recovery, power management, and desktop windowing.

---

## 1. Architectural Overview

OpenFaceID operates as an operating-system utility rather than an ephemeral browser tab. The architecture cleanly separates the background engine from the user-facing presentation layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop UI / HUD                         │
│   (Dashboard, Guided Enrollment, Quick Glance HUD [⌘⇧L])   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Authenticated Local Socket (Bearer Token)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Authoritative DesktopEngine                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│  │ Lifecycle FSM   │ │ Privacy Pause   │ │ Power Monitor │  │
│  └─────────────────┘ └─────────────────┘ └───────────────┘  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│  │ PresenceEngine  │ │ CameraManager   │ │ Vision Core   │  │
│  └─────────────────┘ └─────────────────┘ └───────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Native System APIs
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Platform Adapters                        │
│   macOS (Menu Bar / TCC) │ Windows (Tray / DPAPI) │ Linux   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Desktop Application Lifecycle

The desktop runtime follows a deterministic initialization sequence:

1. **Launch**: Process starts, loads centralized branding, binds logging to privacy-safe stdout.
2. **Initialize Storage**: Loads `ConfigStore`, verifies encrypted `IdentityStore`, accesses platform keystore (Keychain / DPAPI / Secret Service).
3. **Hardware Discovery**: Queries `CameraManager` for physical video capture devices. Checks platform permission status (TCC on macOS, CapabilityBroker on Windows, `/dev/video*` on Linux).
4. **Safe Degraded Mode**: If no camera is attached or camera permission is denied, the engine does **not** crash. It enters `CameraLifecycleState = 'DISCONNECTED'` or `'ERROR'`, sets tray status to `⚠ Camera Unavailable`, and dispatches a native desktop notification to guide the user.
5. **Vision Engine Initialization**: Initializes `BlazeFaceDetector`, `ArcFaceEmbedder`, `FaceQualityAnalyzer`, `FaceRecognizer`, and `LivenessDetector`.
6. **Active Protection**: Starts frame grabber pipeline, registers presence state tracker, and activates system tray menu.

---

## 3. Background Daemon Mode

When the user closes the main dashboard window:
- The desktop window hides or terminates its webview.
- The authoritative `DesktopEngine` **continues running persistently** in the background.
- System tray (Windows) or Menu Bar item (macOS) remains active.
- Presence detection and liveness monitoring continue operating according to user policy.
- Workstation auto-lock triggers when absence timeout is reached, regardless of whether the dashboard UI is open.

---

## 4. System Tray / Menu Bar Integration

The system tray reflects real engine state using standardized indicators:

| Tray Indicator | System State | Description |
| :--- | :--- | :--- |
| `● Active` | Protection Active | Camera active, face detection and presence running normally |
| `○ Paused` | Privacy Pause | Camera and recognition manually suspended by user |
| `⚠ Camera Unavailable` | Degraded | Camera disconnected or OS permission denied |
| `⏳ Loading Model` | Initializing | Vision models or storage loading into memory |
| `✕ Engine Error` | Error | Internal subsystem fault; degraded safe state |

### Context Menu Actions
- **Open Dashboard**: Restores and focuses the primary configuration window.
- **Recognize Now**: Triggers an instant single-frame recognition pass.
- **Pause / Resume Protection**: Toggles Privacy Pause mode.
- **Lock Workstation Now**: Dispatches native screen lock.
- **Diagnostics**: Dumps real-time FPS, hardware resolution, and memory usage.
- **Quit OpenFaceID**: Shuts down camera, zeroizes memory, and exits cleanly.

---

## 5. Sleep, Wake & Power Management

Desktop computers frequently enter sleep mode (lid close, display timeout, system sleep). OpenFaceID handles power cycles cleanly:

1. **Sleep Detection**: The power monitor tracks monotonic timestamp deltas. When the elapsed interval between ticks exceeds 4000ms for a 1000ms timer, a system sleep event is detected.
2. **Camera Release**: Upon sleep detection, the active capture stream is suspended to prevent kernel driver stalls.
3. **Wake Recovery**: When the system wakes, `DesktopEngine` queries the camera bus, verifies device handle validity, and smoothly resumes frame sampling with exponential backoff if the hardware is still re-enumerating.

---

## 6. Camera Hot-Plug & Disconnect Recovery

If an external USB webcam is unplugged while protection is active:
1. The camera capture loop detects stream termination.
2. An event `CAMERA_DISCONNECTED` is emitted on the internal `EventBus`.
3. The engine transitions to `DISCONNECTED` state and shows a native notification (`"Camera disconnected. Reconnect device to resume protection."`).
4. A background polling loop checks for device re-attachment every 2.5 seconds.
5. When the device is plugged back in, the engine automatically re-opens the capture stream and resumes recognition without requiring an application restart.

---

## 7. Privacy Pause Mode

Users often need to disable camera monitoring temporarily for privacy (e.g., during video calls or private tasks).
- Accessible via:
  - Header button in Dashboard UI
  - Menu Bar / System Tray context menu
  - CLI command: `openfaceid desktop pause`
  - Local API endpoint: `POST /api/v1/privacy/pause`
- **Guarantees**:
  - Camera capture pipeline is immediately halted.
  - Video tracks are disabled.
  - Active identities and confidence meters are wiped from memory.
  - Presence tracker is reset to `UNKNOWN`.
  - Tray status updates to `○ Paused`.

---

## 8. Quick Glance HUD

Summoned instantly via global shortcut `Cmd+Shift+L` (macOS) or `Ctrl+Shift+L` (Windows/Linux):
- Floating translucent overlay in the top-right corner.
- Shows real-time protection status, active camera, presence state, and time elapsed since last verified match.
- Closes with `Escape` or clicking `✕`.
