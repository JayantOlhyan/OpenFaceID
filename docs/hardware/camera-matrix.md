# OpenFaceID Camera Compatibility Matrix (Phase 7)

## 1. Physical Laboratory Hardware Camera Devices

| Device Name | Vendor / Model | Host Machine | Bus Interface | Driver / Media Stack | Tested Resolutions & FPS | Memory per Uncompressed Frame | Validation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **FaceTime HD Camera** | Apple Inc. (`Mac16,12`) | `MAC-01` (Apple M4 MacBook Air) | Built-in MIPI / PCIe | Apple AVFoundation Framework | **1080p** (1920x1080@30fps)<br>**720p** (1280x720@30fps)<br>**480p** (640x480@30fps) | 1080p: **7.91 MB**<br>720p: **3.52 MB**<br>480p: **1.17 MB** | **VERIFIED (PHYSICAL HARDWARE)** |

---

## 2. Reference Camera Target Architectures

| Device Name | Vendor | Typical Interface | Expected Driver | Target Platforms | Hardware Verification Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Logitech C920 HD Pro** | Logitech | USB 2.0 (UVC) | UVC / DirectShow / V4L2 | Windows, macOS, Linux | **HARDWARE UNVERIFIED** |
| **Logitech Brio 4K** | Logitech | USB 3.0 (Type-C) | UVC / Media Foundation | Windows, macOS, Linux | **HARDWARE UNVERIFIED** |
| **Razer Kiyo Pro** | Razer | USB 3.0 (UVC) | DirectShow / V4L2 | Windows, Linux | **HARDWARE UNVERIFIED** |
| **Surface Pro Front Camera**| Microsoft | Integrated PCIe/MIPI | Windows Media Foundation | Windows 11 | **HARDWARE UNVERIFIED** |
| **ThinkPad Integrated Camera**| Sunplus / Realtek | Internal USB 2.0 / MIPI | V4L2 / PipeWire | Linux (Ubuntu/Fedora) | **HARDWARE UNVERIFIED** |

---

## 3. Resolution Gating & Performance Benchmarks

All camera streams are gated by OpenFaceID's `CameraManager` before passing to the vision pipeline:
1. **Nominal Pipeline Target:** `1280x720` (720p) @ `15 - 30 FPS`.
2. **Minimum Supported Resolution:** `640x480` (480p).
3. **Downscaling Strategy:** If the sensor captures at 1080p or 4K, frames are downsampled to a 640px bounding box before feature extraction, minimizing matrix multiplication overhead.
4. **Backpressure Queue Dropping:**
   - Architecture: Strict single-slot buffer (`latestFrameBuffer`).
   - Mechanism: When downstream inference (`FaceDetector` + `ArcFaceEmbedder`) is processing a frame, incoming frames overwrite the buffer slot without queuing.
   - Lab Benchmark: Under an artificial 60 FPS flood over 180 ms (~11 incoming ticks), exactly 2 frames were processed and 9 stale frames were dropped cleanly, preventing heap inflation.
