# OpenFaceID Physical Hardware Testing Guide

## 1. Overview

While automated CI runners verify software builds, unit tests, and synthetic mathematical algorithms, OpenFaceID operates on physical computers with real optical camera sensors.

This document provides instructions for contributors testing OpenFaceID on physical hardware, with standardized result reporting to qualify platforms from `HARDWARE UNVERIFIED` to `VERIFIED`.

---

## 2. Hardware Testing Prerequisites

* **Operating System**:
  * macOS 12+ (Monterey, Ventura, Sonoma, Sequoia)
  * Windows 10 / 11 (64-bit)
  * Linux (Kernel 5.15+, Ubuntu 22.04+, Fedora 38+, Arch)
* **Camera Sensor**:
  * Built-in laptop webcam (USB/UVC or MIPI) or external USB 2.0/3.0 webcam.
  * Minimum resolution: 640x480 (recommended: 1280x720 at 30 FPS).
* **OS Camera Permissions**:
  * User must grant camera access when prompted by the operating system.

---

## 3. Hardware Test Protocol

### Step 1: Doctor Diagnostic Check
```bash
node --experimental-strip-types apps/cli/bin/openfaceid.ts doctor
```
* **Verify**: Camera permission status reports `granted`, capture device enumerated.

### Step 2: Camera Capture Test
```bash
node --experimental-strip-types apps/cli/bin/openfaceid.ts camera test
```
* **Verify**: Capture frame grabs succeed, measured capture FPS is reported, and RAM buffer zeroization completes without errors.

### Step 3: Face Enrollment
```bash
node --experimental-strip-types apps/cli/bin/openfaceid.ts identity enroll "Tester"
```
* **Verify**: 5-pose guided capture progresses through Center, Slight Left, Slight Right, Slight Up, Slight Down.
* **Verify**: Profile saved to `~/.openfaceid/identities/` with file permissions `0600`.

### Step 4: Live Recognition Evaluation
```bash
node --experimental-strip-types apps/cli/bin/openfaceid.ts recognition test
```
* **Verify**: Real-time terminal output detects face, passes quality, verifies liveness, and matches enrolled identity.

### Step 5: Fail-Closed Manual Scenarios

1. **Absence Scenario**: Step away from camera field of view. Presence should transition from `USER_PRESENT` to `USER_LEFT` after configured timeout (default: 20s).
2. **Multiple-Face Scenario**: Introduce a second person into the frame. Presence should immediately drop to `PRESENCE_UNAUTHORIZED` with reason `Multiple faces detected in frame`.
3. **Camera Block Scenario**: Cover camera lens. State should drop to `NO_FACE` or `CAMERA_DISCONNECTED` without crashing.
4. **Privacy Pause Scenario**: Trigger privacy pause (`openfaceid desktop pause`). Camera LED must extinguish immediately.

---

## 4. Standardized Hardware Validation Result Format

Contributors testing on physical machines (especially Windows and Linux) should record results in the following format and attach them to a hardware compatibility issue or PR:

```markdown
### Hardware Test Report

* **Machine ID**: (e.g., `WIN-01`, `LNX-01`, `MAC-02`)
* **Computer Model**: (e.g., Dell XPS 15 9520, ThinkPad T14 Gen 3, MacBook Air M2)
* **CPU Architecture**: (e.g., x86_64, aarch64)
* **Operating System**: (e.g., Windows 11 Pro 23H2, Ubuntu 24.04 LTS Kernel 6.8)
* **Camera Hardware**: (e.g., Integrated 720p HD Webcam, Logitech C920 USB)
* **Git Commit**: `0e207d0` (or target commit hash)
* **Test Date**: YYYY-MM-DD

#### Test Execution Matrix

| Test Step | Result | Measured Metric | Notes |
| :--- | :--- | :--- | :--- |
| `doctor` | PASS / FAIL | N/A | Permissions granted |
| `camera test` | PASS / FAIL | Measured FPS: xx.x | RAM zeroized |
| `identity enroll` | PASS / FAIL | 5 poses captured | Encrypted profile created |
| `recognition test` | PASS / FAIL | Similarity: 0.xx | Liveness confirmed |
| Multi-Face Drop | PASS / FAIL | Latency: < 50ms | Authorization revoked |
| Absence Timeout | PASS / FAIL | Timeout: 20s | Presence dropped |
| Privacy Pause | PASS / FAIL | LED extinguished | Capture halted |

#### Limitations & Hardware Quirks Observed
* (Document any driver latencies, high CPU utilization, or permission dialog issues)
```
