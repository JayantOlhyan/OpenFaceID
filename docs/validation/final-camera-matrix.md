# OpenFaceID — Final Camera Hardware Compatibility Matrix

**Document ID**: OFID-VAL-CAM-FINAL-001  
**Phase**: Pre-V1 Final Certification  
**Canonical Version**: `0.2.1-rc.1`  
**Purpose**: Document camera hardware compatibility across operating systems, video capture backends, permissions, and operational constraints.  

---

## 1. Multi-Platform Camera Compatibility Matrix

| Platform | OS | Architecture | Camera Device | Backend | Resolution | FPS | Permission | Detection | Recognition | Liveness | Multi-Face | Hotplug | Sleep/Wake | Performance | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **macOS** | Darwin 25.6.0 | arm64 (Apple Silicon M1) | Apple FaceTime HD Camera (Built-in) | AVFoundation / CoreMedia | 1920x1080, 1280x720, 640x480 | 30 | GRANTED | PASS | PASS | PASS (EAR + Motion) | PASS (`PRESENCE_AMBIGUOUS`) | N/A (Internal) | PASS (Reset on wake) | Latency: 0.628ms; CPU <3.2% | **HARDWARE VERIFIED** | Primary reference hardware (Device ID: `5A0B78EA-4C72-485C-B87D-086EC8E5E180`). Frame backpressure verified. |
| **macOS** | Darwin 25.6.0 | arm64 (Apple Silicon M1) | Generic UVC USB Webcam (Logitech C920 Class) | AVFoundation / USB UVC | 1280x720, 640x480 | 30 | GRANTED | PASS | PASS | PASS | PASS | PASS (Fail-closed on disconnect) | PASS | Latency: ~0.7ms; CPU <3.5% | **HARDWARE VERIFIED** | Standard USB Video Class compliant. Disconnect triggers immediate `CAMERA_DISCONNECTED` fail-closed transition. |
| **macOS** | macOS 12+ | x86_64 (Intel) | Integrated / USB Webcam | AVFoundation | 1280x720 | 30 | GRANTED | PASS (Mock) | PASS (Mock) | PASS (Mock) | PASS (Mock) | UNTESTED | UNTESTED | Automated CI benchmark | **AUTOMATED ONLY** | Verified via headless Node.js CI test suite on GitHub Actions macOS runner. |
| **Windows** | Windows 10/11 | x64 | Integrated Laptop Webcam | DirectShow / MediaFoundation via PowerShell | 1280x720 | 30 | Emulated | PASS (Mock) | PASS (Mock) | PASS (Mock) | PASS (Mock) | UNTESTED | UNTESTED | Code complete in `WindowsAdapter.ts` | **HARDWARE UNVERIFIED** | Physical Windows hardware lab unavailable (`GAP-01` / `RB-02`). Software compilation and unit tests pass. |
| **Windows** | Windows 10/11 | x64 | External USB UVC Webcam | DirectShow / MediaFoundation | 1920x1080 | 30 | Emulated | PASS (Mock) | PASS (Mock) | PASS (Mock) | PASS (Mock) | UNTESTED | UNTESTED | Code complete in `WindowsAdapter.ts` | **HARDWARE UNVERIFIED** | Physical testing on real Windows PC pending lab bench availability. |
| **Linux** | Ubuntu 22.04 / 24.04 LTS | x64 | Built-in / V4L2 Device (`/dev/video0`) | Video4Linux2 (`v4l2-ctl` / GStreamer) | 1280x720 | 30 | System permissions | PASS (Mock) | PASS (Mock) | PASS (Mock) | PASS (Mock) | UNTESTED | UNTESTED | Code complete in `LinuxAdapter.ts` | **HARDWARE UNVERIFIED** | Physical Linux hardware lab unavailable (`GAP-02` / `RB-02`). Software compilation and unit tests pass. |
| **Linux** | Ubuntu 24.04 LTS | x64 | PipeWire / WirePlumber Portal | PipeWire GStreamer Source | 1280x720 | 30 | Portal Prompt | PASS (Mock) | PASS (Mock) | PASS (Mock) | PASS (Mock) | UNTESTED | UNTESTED | Experimental portal integration | **HARDWARE UNVERIFIED** | Physical camera testing required on Wayland/PipeWire desktops. |

---

## 2. Non-Generalization Principle (Section 5)

> [!CAUTION]
> **Strict Hardware Non-Generalization Warning**:
> Successful verification on the integrated Apple FaceTime HD Camera (with dedicated M1 Image Signal Processor hardware tone mapping and noise reduction) **CANNOT** be generalized to all desktop webcams.
> 
> Real-world optical sensors introduce significant operational variance:
> 1. **Sensor Optical Noise in Low Light**: Low-cost USB CMOS sensors exhibit heavy chromatic noise and grain at $<35\text{ lux}$, flattening spatial gradient features ($\nabla L$) and causing similarity scores to drop into the unmatchable range (~0.43).
> 2. **Auto-Exposure & White Balance Cycling**: Aggressive camera ISP gain hunting disrupts temporal Eye Aspect Ratio (EAR) blink detection, triggering transient liveness timeouts.
> 3. **Wide-Angle Optical Distortion**: Cameras with field of view $>90^\circ$ compress peripheral facial landmarks, altering the affine transform used for canonical 112x112 cropping.
> 4. **Virtual Camera / Software Loopbacks**: Standard userspace capture APIs cannot distinguish hardware sensors from virtual drivers (e.g., OBS Virtual Camera). Physical presence cannot be attested if local software loopbacks are active.

---

## 3. Disconnection & Sensor Disruption Protocols

OpenFaceID enforces strict fail-closed state transitions during sensor anomalies:
- **Disconnection Detection**: If frames cease arriving for $>2000\text{ms}$ or the OS device handle is invalidated, `CameraManager` transitions to `CAMERA_DISCONNECTED`.
- **Immediate Deauthorization**: Presence is immediately dropped to `PRESENCE_UNAUTHORIZED`; no cached frame or stale state can sustain an unlocked workstation.
- **Reconnection Recovery**: Upon hardware reconnect, `CameraManager` re-probes permissions and rebinds the video capture stream cleanly without requiring daemon restart.
