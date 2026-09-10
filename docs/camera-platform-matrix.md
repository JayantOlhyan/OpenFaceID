# OpenFaceID — Platform Camera Matrix

## Overview
This document specifies the camera capture architectures, backends, device selection strategies, reconnect behaviors, and permission models across macOS, Windows, and Linux.

---

## Hardware Support Matrix

| Platform | Primary Backend | Secondary / Fallback | Tested Status | Camera Selection | Reconnect Handling | Supported Pixel Formats |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **macOS** | **AVFoundation** (`AVCaptureSession` / `AVCaptureDeviceDiscoverySession`) | WebRTC (`navigator.mediaDevices.getUserMedia`) / `ffmpeg -f avfoundation` | **VERIFIED** (Desktop WebRTC & AVFoundation probe) | By Unique Device ID / Localization UID (`uniqueID`) | Hardware disconnect notification via `AVCaptureDeviceWasDisconnectedNotification` | NV12, YUV420p, BGRA, RGBA |
| **Windows** | **Windows Media Foundation (WMF)** (`IMFMediaSource` / `MediaFrameReader`) | DirectShow (`VideoCapture` / WebRTC) | **PARTIALLY VERIFIED** (WebRTC / PowerShell device probe) | Symbolic Link / Device ID (`MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_SYMBOLIC_LINK`) | Windows Device Arrival / Removal WM_DEVICECHANGE broadcast | NV12, YUY2, RGB24, RGBA |
| **Linux** | **Video4Linux2 (V4L2)** (`/dev/video*` ioctl) | PipeWire (`libpipewire` / WebRTC) | **PARTIALLY VERIFIED** (V4L2 device node discovery) | Device path (`/dev/video0`, `/dev/video1`) or USB vendor:product sysfs | `udev` netlink monitor or polling `/sys/class/video4linux` | YUYV, MJPEG, NV12, RGBA |

---

## Permission Architectures

### 1. macOS (Darwin)
- **Security Framework**: Transparency, Consent, and Control (TCC) system database (`kTCCServiceCamera`).
- **Permission Checking**:
  - Native: `[AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo]`
    - `AVAuthorizationStatusNotDetermined` (Prompt required)
    - `AVAuthorizationStatusRestricted` (Parental/MDM lock)
    - `AVAuthorizationStatusDenied` (Explicitly blocked in System Settings > Privacy & Security > Camera)
    - `AVAuthorizationStatusAuthorized` (Granted)
  - Browser / Desktop Shell: `navigator.permissions.query({ name: 'camera' })`
- **User Remediation Guidance**:
  - Direct user to: *System Settings > Privacy & Security > Camera*
  - Command line prompt: `tccutil reset Camera <bundle-id>` (developer reset)

### 2. Windows 10 / 11
- **Security Framework**: Windows Privacy Settings (`CapabilityAccessManager`).
- **Permission Checking**:
  - Query registry: `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam`
  - Browser / Desktop Shell: `navigator.permissions.query({ name: 'camera' })`
- **User Remediation Guidance**:
  - Direct user to: *Settings > Privacy & security > Camera*
  - Ensure "Let desktop apps access your camera" toggle is turned ON.

### 3. Linux (X11 / Wayland)
- **Security Framework**: POSIX Unix permissions and group membership (`video` group).
  - Check `/dev/video*` permissions: `ls -l /dev/video*`
  - Ensure current user is in `video` or `render` group: `id -Gn | grep -q video`
- **Desktop Portals**: Under Wayland (GNOME / KDE), Camera portal via `xdg-desktop-portal` and PipeWire permissions prompt.
- **User Remediation Guidance**:
  - Run: `sudo usermod -a -G video $USER` followed by log out / log in.

---

## Frame Acquisition & Backpressure Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                 Hardware Sensor (15-30 FPS)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ Raw YUV/RGB Frame Buffer
┌──────────────────────────────▼──────────────────────────────┐
│                        FrameSampler                         │
│  • Adaptive Throttling: 30 FPS (active) -> 1-2 FPS (idle)    │
│  • Backpressure Drop: Discard stale buffer if infer busy    │
│  • Format Conversion: RGBA Uint8ClampedArray                │
└──────────────────────────────┬──────────────────────────────┘
                               │ In-Memory Frame Reference
┌──────────────────────────────▼──────────────────────────────┐
│                    Computer Vision Engine                   │
│  • BlazeFace Detection -> Quality Gate -> ArcFace Embedding │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                       Memory Sanitizer                      │
│  • Immediate RAM Zeroize: frame.zeroize()                   │
│  • Zero disk writes, zero network egress                    │
└─────────────────────────────────────────────────────────────┘
```
