# OpenFaceID (SightLock) — Research Document

This document provides a thorough analysis of cross-platform desktop face recognition, presence detection, camera pipelines, computer vision models, presentation attack detection (PAD), and operating system security APIs.

---

## 1. Reference Project Analysis: Glance (`jonnyoo/glance`)

### 1.1 Overview
Glance is an open-source macOS-only application designed to bring a "Face ID-like" auto-unlock experience to Mac computers using their built-in FaceTime HD / front-facing webcams.

### 1.2 Design Strengths
- **Product Aesthetics**: Minimalist macOS system-like UI, notch-adjacent floating interface, smooth visual indicators.
- **Fast Enrollment Flow**: 5-step guided enrollment (Look Center, Turn Left, Turn Right, Look Up, Look Down).
- **Local Embedding Concept**: Recognizes the importance of not storing raw photographic face images; instead stores feature vectors.

### 1.3 Critical Architectural & Security Pitfalls
- **Mac-Only Monolith**: Written exclusively in Swift and tightly coupled to Apple's proprietary `Vision.framework` (`VNDetectFaceLandmarksRequest` and `VNGenerateFacePrintRequest`). Zero portability to Windows or Linux.
- **Insecure Password Automation**: To unlock the Mac, Glance required the user to input their plaintext macOS user password, stored it in the Keychain, and literally typed it into the lock screen via AppleScript / macOS Accessibility APIs or a helper script.
  - *Risk*: Keystroke injection to simulate authentication is brittle, can be intercepted or misdirected (e.g. into active chat windows if the display wakes prematurely), and violates the operating system's security boundaries.
- **Inadequate Anti-Spoofing (Liveness)**: Glance relied on basic frame-to-frame landmark displacement. A video loop played on an iPad or printed photos waved in front of the lens could easily satisfy the motion threshold.
- **Conflation of Concepts**: Failed to distinguish between *Recognition* (camera image similarity), *Presence* (user is physically at workstation), and *Authentication* (cryptographic authorization by the OS).
- **Hardware Assumption**: Strongly coupled to MacBook displays with camera notches.

### 1.4 Lessons for OpenFaceID
1. **Never store plaintext OS passwords** and never simulate user keystrokes to unlock OS lock screens.
2. **Explicitly decouple Recognition, Presence, and Authentication**.
3. **Cross-platform by design**: The vision and core engine must be 100% platform-independent. Platform-specific functionality (lock, keystore, idle time, camera permissions) must live strictly behind abstract adapters (`PlatformAdapter`).
4. **Multi-tier Liveness Engine**: Implement ISO/IEC 30107-3 compliant Presentation Attack Detection (passive blink/texture analysis and active challenge-response).

---

## 2. Cross-Platform Camera Frameworks

| Framework / API | Platforms | Strengths | Weaknesses | Architectural Fit |
| :--- | :--- | :--- | :--- | :--- |
| **MediaDevices / getUserMedia** (WebRTC/Chromium) | macOS, Windows, Linux | Universal, standardized, hardware-accelerated, handles device permissions natively | Bound to browser/webview runtime context | **Primary UI/Desktop Capture Engine** |
| **AVFoundation** | macOS | Direct hardware access, low latency, controls exposure, white balance, focal points | Apple platforms only (Objective-C/Swift) | **macOS Native Adapter** |
| **Media Foundation (MF)** | Windows | Native Windows 10/11 camera pipeline, supports IR cameras where present | Complex COM APIs | **Windows Native Adapter** |
| **Video4Linux2 (V4L2)** | Linux | Standard Linux kernel interface (`/dev/video*`), zero dependencies | Requires user in `video` group, no unified permission UI | **Linux Native Adapter** |
| **Node.js Native Stream (uvcc / v4l2 bindings)** | macOS, Linux | Headless/daemon capture without active UI window | Native compilation requirements | **Daemon / CLI Engine Fallback** |

### Decision
OpenFaceID uses a dual-layer camera strategy:
1. **Desktop Shell / UI**: Web standard `navigator.mediaDevices.getUserMedia()` with custom frame sampler in a Web Worker or Canvas context for zero-latency preview and 30 FPS capture.
2. **Core Daemon / CLI**: Abstract `CameraStream` interface that consumes native OS camera feeds or localhost frame buffers, throttled dynamically (15 FPS during active enrollment/recognition, 1–2 FPS during background presence monitoring).

---

## 3. Face Detection & Landmark Models

| Model | Input Size | Landmarks | Latency (CPU) | Precision | Licensing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BlazeFace** (Google) | 128x128 / 256x256 | 5 (eyes, nose, mouth corners) | **~2–4 ms** | High for frontal / moderate angles | Apache-2.0 |
| **YuNet** | 160x120 - 640x480 | 5 keypoints | ~5–8 ms | High scale variance | MIT |
| **SCRFD** (InsightFace) | 640x640 | 5 keypoints | ~10–15 ms | Very high | Apache-2.0 / non-commercial caveat in older weights |
| **MediaPipe Face Mesh** | 192x192 | 468 points | ~12–18 ms | Very high 3D mesh | Apache-2.0 |

### Decision
OpenFaceID adopts **BlazeFace / YuNet 5-point landmark architecture** as the default face detector:
- Ultra-low latency (<5ms on standard desktop CPUs).
- Provides exact 5-point coordinates required for affine face alignment:
  1. Left Eye (\(p_1\))
  2. Right Eye (\(p_2\))
  3. Nose Tip (\(p_3\))
  4. Left Mouth Corner (\(p_4\))
  5. Right Mouth Corner (\(p_5\))
- Generates bounding box coordinates \([x, y, w, h]\) and detection confidence \(c \in [0, 1]\).

---

## 4. Face Embedding Models & Similarity Metrics

### 4.1 Embedding Models
1. **MobileFaceNet (ArcFace backbone)**:
   - Input: \(112 \times 112\) aligned RGB image.
   - Output: 512-dimensional (or 128-dimensional) L2-normalized feature vector \(\mathbf{v} \in \mathbb{R}^d\), where \(\|\mathbf{v}\|_2 = 1.0\).
   - Training loss: ArcFace (Additive Angular Margin Loss), ensuring large intra-class compactness and inter-class discrepancy on the hypersphere.
   - License: MIT / Apache-2.0.
   - Inference: Runs via ONNX Runtime / WebAssembly SIMD in ~8–15 ms on CPU.

### 4.2 Distance & Similarity Metrics
Because embeddings are unit-normalized (\(\|\mathbf{u}\| = \|\mathbf{v}\| = 1\)):
$$\text{Cosine Similarity}(\mathbf{u}, \mathbf{v}) = \mathbf{u} \cdot \mathbf{v} = \sum_{i=1}^{d} u_i v_i$$
$$\text{Euclidean Distance } D(\mathbf{u}, \mathbf{v}) = \sqrt{2 - 2 \cdot (\mathbf{u} \cdot \mathbf{v})}$$

- Match threshold: \(\text{Cosine Similarity} \ge \theta_{\text{match}}\) (default: \(0.72\), configurable \(0.60 - 0.85\)).

---

## 5. Presentation Attack Detection (Liveness)

Standard 2D webcams lack structured light IR or time-of-flight (ToF) depth sensors. Therefore, software-based anti-spoofing is mandatory.

### 5.1 Presentation Attack Types
1. **Photo Attack**: Printed photograph (paper, cardboard) held before the camera.
2. **Video Replay Attack**: High-resolution video playback on a smartphone, tablet, or monitor.
3. **Cut-out Mask Attack**: 2D photo with eye holes cut out to simulate blinking.

### 5.2 Anti-Spoofing Techniques Evaluated
1. **Eye Aspect Ratio (EAR) Blink Detection**:
   $$EAR = \frac{\|p_2 - p_6\| + \|p_3 - p_5\|}{2 \|p_1 - p_4\|}$$
   A natural blink causes \(EAR\) to drop below \(0.20\) and recover within 150–350 ms.
2. **Micro-Motion & Inter-Frame Optical Flow**:
   Natural human faces exhibit involuntary micro-tremors, breathing motion, and saccades. A printed photograph is either perfectly stationary or exhibits rigid-body planar displacement.
3. **Texture / Specular Gradient Analysis**:
   Screens emit digital refresh moiré patterns and have specular reflections from ambient lighting distinct from natural skin diffusion.
4. **Active Challenge-Response**:
   Randomized prompt requesting specific head movement (e.g., *"Turn head 15° left"*, *"Blink twice"*), with temporal timeout window.

---

## 6. Operating System Security APIs & Keystores

### 6.1 macOS
- **Secure Key Storage**: macOS Keychain Services (`Security.framework`). The master encryption key is generated via cryptographically secure RNG and stored in the user's login keychain (`security add-generic-password`).
- **Screen Lock**: Native `pmset displaysleepnow` or CoreGraphics private/framework call `SACLockScreenImmediate()`.
- **Lock State Detection**: `ioreg -n Root -d1 -a` querying `CGSSessionScreenIsLocked` or Quartz notification listeners.
- **Idle Time**: `IOHIDSystem` property `HIDIdleTime`.
- **Permissions**: Transparency, Consent, and Control (TCC) system (`kTCCServiceCamera`).

### 6.2 Windows
- **Secure Key Storage**: Windows Data Protection API (DPAPI) and Windows Credential Manager (`wincred.h` / `CryptProtectData`).
- **Screen Lock**: `user32.dll!LockWorkStation()`.
- **Lock State Detection**: Terminal Services Session Notification (`WTSRegisterSessionNotification`) listening for `WTS_SESSION_LOCK` / `WTS_SESSION_UNLOCK`.
- **Idle Time**: `user32.dll!GetLastInputInfo()`.
- **Permissions**: Windows 10/11 `CapabilityAccessManager` for webcam access.

### 6.3 Linux
- **Secure Key Storage**: FreeDesktop Secret Service specification (`org.freedesktop.secrets`), implemented by GNOME Keyring and KDE KWallet (accessible via `libsecret` / `secret-tool`).
- **Screen Lock**:
  - systemd: `loginctl lock-session`
  - FreeDesktop / Screensaver D-Bus: `org.freedesktop.ScreenSaver.Lock`
  - GNOME: `org.gnome.ScreenSaver.Lock`
  - X11 fallback: `xdg-screensaver lock`
- **Lock State Detection**: D-Bus signal listener on `org.freedesktop.ScreenSaver.ActiveChanged` or `loginctl show-session -p LockedHint`.
- **Idle Time**: `xprintidle` under X11; `org.gnome.Mutter.IdleMonitor` under GNOME Wayland; `ext-idle-notify-v1` under modern Wayland compositors.

### 6.4 The PAM (Pluggable Authentication Modules) Risk on Linux
- Writing a PAM module (`pam_openfaceid.so`) directly into `/etc/pam.d/common-auth` or `/etc/pam.d/gdm-password` carries catastrophic failure modes:
  1. A crash or unhandled exception in the vision engine or camera driver can brick user login completely.
  2. If marked `sufficient` without hardware liveness, a printed photo can grant root or desktop access.
  3. Memory leaks in long-running display managers.
- **Strategy**: Tiered Linux support. OpenFaceID strictly segregates application-level recognition and presence automation from PAM. Any optional PAM module must be an isolated, explicitly opted-in companion package, never enabled by default.
