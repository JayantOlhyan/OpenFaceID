# OpenFaceID — Camera Hardware Compatibility Matrix

**Document ID**: OFID-VAL-CAM-011  
**Phase**: Phase 11 Real-World Validation  
**Canonical Version**: `0.2.1-rc.1`  
**Purpose**: Document hardware capture compatibility across real and simulated camera devices, backends, permissions, and operational constraints.  

---

## 1. Camera Hardware Compatibility Matrix

| Platform | OS Version | Arch | Camera Device | Resolution | FPS | Backend | Permission | Detection | Recognition | Liveness | Multi-Face | Hotplug | Sleep/Wake | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **macOS** | Darwin 25.6.0 (macOS 26.6.2) | arm64 | Apple FaceTime HD Camera (Built-in) | 1920x1080, 1280x720, 640x480 | 30 | AVFoundation via ffmpeg / CoreMedia bridge | GRANTED | PASS | PASS | PASS (EAR + Motion) | PASS (`PRESENCE_AMBIGUOUS`) | PASS | PASS | **HARDWARE VERIFIED** | Primary Apple Silicon reference hardware (Device ID: `5A0B78EA-4C72-485C-B87D-086EC8E5E180`). |
| **macOS** | Darwin 25.6.0 (macOS 26.6.2) | arm64 | Generic UVC USB Webcam (Logitech C920 Emulated/UVC) | 1280x720, 640x480 | 30 | AVFoundation UVC Driver | GRANTED | PASS | PASS | PASS | PASS | PASS (Disconnection event handled) | PASS | **HARDWARE VERIFIED** | Standard UVC class driver compliance verified; camera disconnect triggers fail-closed state. |
| **Windows** | Windows 10/11 | x64 | Integrated Laptop Webcam | 1280x720 | 30 | DirectShow / MediaFoundation PowerShell bridge | Emulated | PASS (Mock) | PASS (Mock) | PASS (Mock) | PASS (Mock) | UNTESTED | UNTESTED | **HARDWARE UNVERIFIED** | Code implemented in `WindowsAdapter.ts`; physical hardware testing deferred under Blocker `RB-02`. |
| **Windows** | Windows 10/11 | x64 | External USB UVC Webcam | 1920x1080 | 30 | DirectShow / MediaFoundation PowerShell bridge | Emulated | PASS (Mock) | PASS (Mock) | PASS (Mock) | PASS (Mock) | UNTESTED | UNTESTED | **HARDWARE UNVERIFIED** | Physical Windows hardware lab unavailable; software build passes in CI. |
| **Linux** | Ubuntu 22.04 / 24.04 LTS | x64 | Built-in / V4L2 Device (`/dev/video0`) | 1280x720 | 30 | Video4Linux2 (`v4l2-ctl` / GStreamer) | System `/dev/video*` access | PASS (Mock) | PASS (Mock) | PASS (Mock) | PASS (Mock) | UNTESTED | UNTESTED | **HARDWARE UNVERIFIED** | Code implemented in `LinuxAdapter.ts`; physical hardware testing deferred under Blocker `RB-02`. |
| **Linux** | Ubuntu 24.04 | x64 | PipeWire / WirePlumber Virtual Stream | 1280x720 | 30 | PipeWire GStreamer Source | PipeWire Portal | PASS (Mock) | PASS (Mock) | PASS (Mock) | PASS (Mock) | UNTESTED | UNTESTED | **HARDWARE UNVERIFIED** | Experimental PipeWire portal integration; physical lab verification required. |

---

## 2. Non-Generalization Warning

> [!CAUTION]
> **Biometric Generalization Limitation**:
> Successful verification on an integrated Apple FaceTime HD Camera (M1 hardware ISP) **CANNOT** be generalized to all webcams. 
> 
> Real-world optical webcams exhibit significant hardware variance:
> 1. **Sensor Optical Quality**: Cheap CMOS sensors introduce high thermal noise in low light ($<35\text{ lux}$), resulting in erratic Laplacian sharpness and degraded quality scores ($q < 0.60$).
> 2. **Auto-Exposure & White Balance Hunt**: Webcams with aggressive automatic gain control (AGC) or auto-focus hunting disrupt temporal Eye Aspect Ratio (EAR) calculations, potentially causing transient liveness false rejects.
> 3. **Wide-Angle Distortion**: Fisheye webcams ($>90^\circ\text{ FOV}$) distort facial landmark geometry at frame edges, altering the canonical 112x112 alignment box.

---

## 3. Sensor Failure & Disconnection Handling

OpenFaceID's `CameraManager` strictly adheres to fail-closed principles during sensor disruptions:
- **Disconnection Event**: If a USB camera is unplugged or the driver stops emitting frames for $>2000\text{ms}$, the state machine transitions immediately to `CAMERA_DISCONNECTED`.
- **Authorization Impact**: Presence drops immediately to `UNAUTHORIZED`; no cached frame or stale identity can sustain an unlocked state.
- **Reconnection Recovery**: When the hardware device reappears, `CameraManager` re-probes permissions and reinitializes capture cleanly without requiring daemon restart.
