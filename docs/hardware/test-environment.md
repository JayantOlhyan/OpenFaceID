# OpenFaceID Hardware Test Environment Specification

## Physical Host Inventory (Phase 7)

In strict accordance with Phase 7 methodology, only physical machines directly tested in the engineering laboratory are recorded as tested. Unverified machines are cataloged as target reference architectures.

---

### Host MAC-01 (Primary Physical Laboratory Host)

| Specification Field | Recorded Value |
| :--- | :--- |
| **Machine ID** | `MAC-01` |
| **Hardware Model** | Apple MacBook Air (Model Identifier: `Mac16,12`) |
| **Operating System** | macOS Darwin |
| **OS Version** | `25.6.0` (macOS Sequoia Preview / Darwin arm64) |
| **Architecture** | `arm64` (Apple Silicon 64-bit) |
| **CPU** | Apple M4 (10 cores: 4 Performance Cores @ 4.4 GHz + 6 Efficiency Cores @ 2.8 GHz) |
| **RAM** | 16 GB Unified LPDDR5X Memory |
| **GPU** | Apple M4 Integrated 10-core GPU (Metal 3 supported) |
| **Primary Camera** | Built-in FaceTime HD Camera (Hardware ID: `5A0B78EA-4C72-485C-B87D-086EC8E5E180`) |
| **Camera Driver / Subsystem** | Apple AVFoundation Framework (`system_profiler SPCameraDataType`) |
| **Camera Resolutions & Formats**| 1920x1080@30fps, 1280x720@30fps, 640x480@30fps (NV12 / RGBA) |
| **Observed Actual FPS** | 29.8 FPS nominal (at 30 FPS target) |
| **OpenFaceID Version** | `v0.2.0-rc.1` |
| **Evaluated Git Commit** | `0fba170` |
| **Node.js Runtime** | `v25.2.1` (V8 13.x, native `--experimental-strip-types`) |
| **Desktop Environment** | macOS Aqua Desktop |
| **Display Server / Windowing** | Quartz Compositor / CoreGraphics |
| **Secure Keystore** | macOS Native Keychain Services (`/usr/bin/security`) |
| **Physical Status** | **VERIFIED & PHYSICALLY CERTIFIED** |

---

### Reference Architecture WIN-01 (Target Windows Specification)

| Specification Field | Target Reference Specification | Physical Status |
| :--- | :--- | :--- |
| **Machine ID** | `WIN-01` | Target Spec |
| **Hardware Model** | Dell XPS 15 / Surface Laptop Studio | Not Physically Attached |
| **Operating System** | Windows 11 Pro 64-bit (Build 22631+) | **HARDWARE UNVERIFIED** |
| **Architecture** | `x86_64` (x64) or `ARM64` | **HARDWARE UNVERIFIED** |
| **CPU** | Intel Core i7-13700H / AMD Ryzen 7 7840HS | **HARDWARE UNVERIFIED** |
| **RAM** | 16 GB DDR5 | **HARDWARE UNVERIFIED** |
| **Camera** | Integrated 1080p IR/RGB Webcam or Logitech Brio 4K | **HARDWARE UNVERIFIED** |
| **Camera Driver** | DirectShow / Windows Media Foundation (MSMF) | **CODE IMPLEMENTED** |
| **Display Server** | Desktop Window Manager (DWM) | **HARDWARE UNVERIFIED** |
| **Secure Keystore** | Windows Credential Manager / DPAPI (`cmdkey.exe`) | **CODE IMPLEMENTED** |

---

### Reference Architecture LINUX-01 (Target Linux Specification)

| Specification Field | Target Reference Specification | Physical Status |
| :--- | :--- | :--- |
| **Machine ID** | `LINUX-01` | Target Spec |
| **Hardware Model** | ThinkPad T14 / Framework Laptop 13 | Not Physically Attached |
| **Operating System** | Ubuntu 24.04 LTS / Fedora 40 Workstation | **HARDWARE UNVERIFIED** |
| **Architecture** | `x86_64` / `aarch64` | **HARDWARE UNVERIFIED** |
| **CPU** | AMD Ryzen 7 PRO 7840U / Intel Core Ultra 7 | **HARDWARE UNVERIFIED** |
| **RAM** | 16 GB LPDDR5 | **HARDWARE UNVERIFIED** |
| **Camera** | USB Video Class (UVC) webcam via `/dev/video0` | **HARDWARE UNVERIFIED** |
| **Camera Driver** | Video4Linux2 (V4L2) / PipeWire media node | **CODE IMPLEMENTED** |
| **Display Server** | Wayland (GNOME Shell 46) / X11 (X.Org 1.21) | **CODE IMPLEMENTED** |
| **Secure Keystore** | Secret Service API (gnome-keyring / KWallet via D-Bus) | **CODE IMPLEMENTED** |
| **Notifications** | org.freedesktop.Notifications (`notify-send`) | **CODE IMPLEMENTED** |
