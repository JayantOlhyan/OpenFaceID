# OpenFaceID Comprehensive Hardware Test Results (Phase 7)

## Multi-Platform Hardware Results Summary

**Document Version:** 1.0.0  
**Evaluation Date:** September 13, 2026  
**Git Baseline Commit:** `0fba170`  
**Governing Standard:** ISO/IEC 19795-1 (Biometrics) & ISO/IEC 30107-3 (Presentation Attack Detection)

---

## 1. Machine `MAC-01` (macOS Darwin arm64 / Apple M4)

### Hardware & Environment
- **Machine Identifier:** `MAC-01`
- **Host System:** Apple MacBook Air (Model Identifier: `Mac16,12`), Apple M4 SoC (10 cores), 16 GB Unified LPDDR5X RAM
- **Operating System:** macOS Darwin `25.6.0` (arm64)
- **Primary Camera:** Built-in FaceTime HD Camera (`5A0B78EA-4C72-485C-B87D-086EC8E5E180`) via AVFoundation
- **Git Commit Tested:** `0fba170`

### Test Suite Execution & Results
- **Hardware Doctor (`npm run hardware:doctor`):** PASS (Discovered 1 camera, Keychain available, 0.3 GB free RAM).
- **Camera Validation (`npm run hardware:camera`):** PASS (Supported 1080p, 720p, 480p; backpressure queue dropped 9 frames cleanly under 60 FPS flood).
- **Analytical Embedding Latency (`npm run hardware:recognition`):** PASS (512D ArcFace mean latency: `0.429 ms`, P95: `1.066 ms`; gallery search: `0.014 ms` for 5 identities).
- **Liveness & PAD (`npm run hardware:liveness`):** PASS (Static photo attack: `APCER = 0.0%`; bona fide micro-motion: `BPCER = 0.0%`; active challenge timeout: fail-closed).
- **Authoritative Presence (`npm run hardware:presence`):** PASS (0 faces = Unauthorized, 1 face = Authorized, 2+ faces = Ambiguous fail-closed, Privacy Pause = Unauthorized).
- **Recovery & Stale State (`npm run hardware:recovery`):** PASS (Camera disconnect revokes presence; camera reconnect requires fresh auth; sleep/wake session wiped).
- **Notification Fix Verification (`tests/unit/notifications.test.ts`):** PASS (10/10 tests pass; zero "Event triggered" or "OpenFaceID Alert").
- **1-Hour Stability Soak:** PASS (0 errors, 0 memory leaks, stable 44.8 MB RSS, package temperature < 42°C).

### Performance Metrics
- **Frame Processing Headroom:** > 60 FPS theoretical capacity (nominal operation at 15-30 FPS).
- **Steady-State CPU:** 1.8% – 3.2% CPU during active presence monitoring.
- **Steady-State Memory:** 44.1 MB – 44.8 MB RSS.

### Security Invariants
- **Fail-Closed Multi-Face:** VERIFIED (Zero authorization with 2+ faces).
- **RAM Pixel Zeroization:** VERIFIED (`.zeroize()` called immediately post-embedding).
- **Network Egress:** VERIFIED (0 bytes transmitted outside localhost).

### Known Limitations
- Application package lacks paid Apple Developer ID notarization (requires manual Gatekeeper quarantine removal on first launch).

---

## 2. Machine `WIN-01` (Windows 11 / Windows 10 x64 / ARM64)

### Target Environment & Classification
- **Machine Identifier:** `WIN-01` (Reference Specification)
- **Status:** **CODE IMPLEMENTED — HARDWARE UNVERIFIED**
- **Operating System:** Windows 11 64-bit
- **Camera Backend:** DirectShow / Windows Media Foundation
- **Git Commit Tested:** `0fba170` (CI compilation verified)

### Findings & Implementation Status
- **Pure TypeScript Engine:** Verified runnable in CI across Windows runners without native compilation.
- **PowerShell Platform Adapter:** Implemented for camera query, DPAPI storage, screen locking, and toast notifications.
- **Hardware Limitations:** No physical Windows machine was attached to the local test environment. No physical webcam frames, physical USB hot-plugging, or physical Modern Standby wake cycles were measured.

---

## 3. Machine `LINUX-01` (Ubuntu 24.04 LTS / Wayland & X11)

### Target Environment & Classification
- **Machine Identifier:** `LINUX-01` (Reference Specification)
- **Status:** **CODE IMPLEMENTED — HARDWARE UNVERIFIED**
- **Operating System:** Ubuntu 24.04 LTS (x86_64 / aarch64)
- **Camera Backend:** Video4Linux2 (`/dev/video*`) & PipeWire
- **Git Commit Tested:** `0fba170` (CI compilation verified)

### Findings & Implementation Status
- **Linux Platform Adapter:** Implemented with `v4l2-ctl` enumeration, `loginctl` screen locking, `notify-send` D-Bus notifications, and systemd user service generation.
- **Packaging:** Native `.deb` packaging script (`scripts/package-deb.sh`) validated in CI.
- **Hardware Limitations:** Physical V4L2 device nodes, PipeWire video portal streams, and Wayland compositor tray behaviors were not physically exercised in the test lab.
