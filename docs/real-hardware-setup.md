# OpenFaceID — Real Hardware Setup & Device Configuration Guide

## 1. Supported Hardware & Cameras

OpenFaceID supports standard USB, integrated MIPI/UVC, and virtual webcams across macOS, Windows, and Linux:

| Hardware Type | Supported Resolutions | Recommended FPS | Connectivity |
| :--- | :--- | :--- | :--- |
| **Built-in FaceTime HD Cameras** (MacBook Air / Pro, iMac) | 1280x720, 1920x1080 | 30 FPS | Internal MIPI / PCIe |
| **Standard USB UVC Webcams** (Logitech C920/Brio, Anker, Dell) | 1280x720, 1920x1080, 4K | 30 / 60 FPS | USB 2.0 / USB 3.0 |
| **Windows Hello Webcams (RGB Sensor)** | 1920x1080 | 30 FPS | USB / Internal |
| **Linux V4L2 USB Webcams** | 640x480, 1280x720 | 15 / 30 FPS | USB /dev/video* |
| **Virtual Cameras** (OBS Virtual Camera, Camo, Iriun Webcam) | Configurable | 30 FPS | Software Bridge |

---

## 2. Operating System Permissions Setup

### macOS (Ventura, Sonoma, Sequoia)
1. **Grant Camera Access**:
   - Open **System Settings > Privacy & Security > Camera**.
   - Ensure your web browser (e.g. Chrome, Safari, Brave) or Terminal has the toggle enabled.
2. **Command-Line Verification**:
   ```bash
   # Probe camera devices
   npm run cli camera list

   # Test video capture pipeline
   npm run cli camera test
   ```
3. **Resetting Permissions (Troubleshooting)**:
   ```bash
   tccutil reset Camera
   ```

### Windows 10 & 11
1. Open **Settings > Privacy & security > Camera**.
2. Set **Camera access** to **On**.
3. Under **Let desktop apps access your camera**, ensure the toggle is **On**.

### Linux (Ubuntu, Fedora, Arch, Debian)
1. Ensure your user belongs to the `video` and `render` groups:
   ```bash
   sudo usermod -a -G video $USER
   sudo usermod -a -G render $USER
   ```
2. Check that `/dev/video*` devices are detected:
   ```bash
   ls -la /dev/video*
   ```
3. Log out and log back in for group changes to take effect.

---

## 3. Model Architecture & Offline Operation

OpenFaceID is **100% offline-first**. All inference logic runs locally in RAM with zero external server dependencies:

- **Face Detection**: BlazeFace (Google Research, Apache-2.0 License). 896 multi-scale anchors with IoU Non-Maximum Suppression.
- **Embedding Generation**: ArcFace / MobileFaceNet (Apache-2.0 / MIT License). 512-dimensional L2-normalized vectors.
- **Liveness Detection**:
  - **Light Mode**: Dual-signal passive anti-spoofing (Eye Aspect Ratio blink detection + spatial micro-motion variance).
  - **Strong Mode**: Active challenge-response (head turn left/right, chin tilt, blink validation).

No telemetry or biometric vectors are ever transmitted across network sockets.

---

## 4. Performance Expectations on Standard Workstations

| Metric | Target (Laptop CPU) | Target (Apple Silicon M-Series) |
| :--- | :--- | :--- |
| **Camera Capture Rate** | 15–30 FPS | 30 FPS |
| **Inference Rate** | 8–15 FPS | 15–30 FPS |
| **Face Detection Latency** | $< 25 \text{ ms}$ | $< 8 \text{ ms}$ |
| **Embedding Latency** | $< 20 \text{ ms}$ | $< 4 \text{ ms}$ |
| **Total Pipeline Latency** | $< 50 \text{ ms}$ | $< 15 \text{ ms}$ |
| **RAM Usage** | $< 80 \text{ MB}$ | $< 60 \text{ MB}$ |
| **Presence Background CPU** | $< 2\%$ | $< 1\%$ |

---

## 5. Troubleshooting Common Issues

### Issue 1: "No Camera Available" or "Permission Denied"
- Verify that no other application (Zoom, Teams, Photo Booth) has an exclusive hardware lock on the webcam.
- In desktop browsers, click the lock/camera icon in the URL bar (`http://127.0.0.1:41793`) and select **Always Allow**.

### Issue 2: "Hold steady, image is blurry" during enrollment
- Clean the webcam lens with a microfiber cloth.
- Increase ambient room illumination; dark rooms cause webcam exposure time to increase, inducing motion blur.

### Issue 3: "Presentation attack suspected"
- In Light mode, keeping your head completely frozen without natural eye micro-movements or blinks for multiple seconds triggers the static-photo attack detector. Natural head movement will satisfy the passive liveness gate.
