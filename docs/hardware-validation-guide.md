# OpenFaceID Hardware Validation Guide

This guide provides reproducible, step-by-step procedures for validating OpenFaceID (SightLock) on physical desktop hardware.

---

## 1. Supported Environments & Prerequisites

### Certified Platforms
- **macOS:** macOS Sonoma (14.x) or Sequoia (15.x / Darwin 25.x), Apple Silicon (M1/M2/M3/M4) or Intel x64.
- **Windows (Experimental):** Windows 11 / 10 64-bit, USB Webcam or Integrated Web Camera.
- **Linux (Experimental):** Ubuntu 24.04 LTS / Debian 12 / Fedora 40 with V4L2 and X11 or Wayland.

### Prerequisites
- Node.js v22.x or higher (v25.2.1 recommended for built-in `--experimental-strip-types`).
- Physical USB Webcam or integrated laptop webcam (minimum 640x480 @ 15 FPS).
- Camera permission enabled in OS privacy settings.

---

## 2. Quick Hardware Validation Suite

OpenFaceID provides built-in automated hardware diagnostic commands:

```bash
# 1. Inspect host OS, CPU, memory, and physical camera devices
npm run hardware:doctor

# 2. Test camera enumeration, resolutions, and backpressure queue
npm run hardware:camera

# 3. Test analytical embedding latency and gallery linear scaling
npm run hardware:recognition

# 4. Test anti-spoofing defense against static photo attacks and challenge timeouts
npm run hardware:liveness

# 5. Test authoritative presence policies, bystander intrusions, and privacy pause
npm run hardware:presence

# 6. Test camera disconnect/reconnect and sleep/wake state resets (Zero Stale Auth)
npm run hardware:recovery

# 7. Compile unified telemetry report
npm run hardware:report
```

All test runs automatically record machine-readable JSON artifacts to `data/hardware/`.

---

## 3. Manual Physical Hardware Test Procedures

### Test 1: First-Run Camera Setup & Permission Gating
1. Launch the desktop daemon:
   ```bash
   npm run dev:desktop
   ```
2. Navigate to `http://127.0.0.1:41793`.
3. If OS camera permission has never been granted, verify that the browser/OS prompts for permission.
4. **Denial Test:** Revoke camera permission in macOS Settings (`Privacy & Security -> Camera`).
   - *Expected Behavior:* Engine immediately detects denial, transitions status to `CAMERA_UNAVAILABLE`, and displays error code `ERR_CAM_PERMISSION_DENIED`. No authorization occurs.
5. **Restoration Test:** Grant permission in Settings.
   - *Expected Behavior:* Engine recovers video stream and transitions to `CAMERA_READY`.

### Test 2: Guided 5-Pose Enrollment Flow
1. Run CLI enrollment:
   ```bash
   npm run cli -- enroll --name "Primary User"
   ```
2. Follow guided pose targets:
   - Center (Frontal)
   - Left (Yaw -20°)
   - Right (Yaw +20°)
   - Up (Pitch +15°)
   - Down (Pitch -15°)
3. *Expected Behavior:* System extracts high-quality embeddings, saves an encrypted biometric profile to `~/.openfaceid/identities/usr_*.enc` with mode `0600`, and records profile metadata (model ID, 512D dimension).

### Test 3: Bystander / Multiple-Face Intrusion (Section 28)
1. Sit in front of the camera and verify `PRESENCE_AUTHORIZED` status.
2. Have a second person enter the camera frame (or hold up a second real face).
3. *Expected Behavior:* The authoritative daemon immediately detects 2 faces, transitions state to `PRESENCE_AMBIGUOUS`, and revokes authorization.
4. When the second person leaves, the system returns to 1 face and restores authorization.

### Test 4: Camera Hot-Plug & Disconnect (Section 17 & 29)
1. While authenticated (`PRESENCE_AUTHORIZED`), physically unplug the USB webcam (or toggle camera off via privacy shutter).
2. *Expected Behavior:*
   - Authorization drops to `PRESENCE_UNAUTHORIZED` within 1 second.
   - UI reflects `Camera Unavailable`.
3. Reconnect the camera.
4. *Expected Behavior:*
   - Camera stream resumes.
   - **CRITICAL:** Prior authorization is NOT inherited blindly. State remains `PRESENCE_UNAUTHORIZED` until fresh liveness and identity matching succeed.

### Test 5: Sleep / Wake Cycle (Section 18 & 29)
1. While authenticated, put the computer to sleep (close laptop lid or select Apple Menu -> Sleep).
2. Wait 30 seconds, then wake the computer.
3. *Expected Behavior:*
   - `CanonicalStateMachine.resetOnWake()` forces session expiration.
   - Screen remains locked or status indicates `PRESENCE_UNAUTHORIZED` until the enrolled user looks directly into the camera.

---

## 4. Evidence Collection & Reporting

When conducting certification on a new machine:
1. Export system diagnostics:
   ```bash
   curl -H "Authorization: Bearer $(cat ~/.openfaceid/token)" http://127.0.0.1:41793/api/v1/diagnostics > diagnostics.json
   ```
2. Verify that `diagnostics.json` does NOT contain raw vectors or private keys:
   ```bash
   grep -E "embedding|privateKey|token" diagnostics.json
   ```
   *(Must return zero matches or only [REDACTED] strings).*
3. Commit test results to `data/hardware/` and document observations in `docs/platform-scorecard.md`.
