# OpenFaceID — Phase 2 Independent Audit & Verification Report

This document presents an independent, rigorous audit of all technical claims made in Phase 2 of OpenFaceID (SightLock). Every capability is classified into one of four categories: **VERIFIED**, **PARTIALLY VERIFIED**, **UNVERIFIED**, or **FALSE**.

---

## 1. Executive Classification Summary

| Technical Claim | Audit Classification | Technical Reality Summary |
| :--- | :--- | :--- |
| **Real Camera** | `VERIFIED` | Real WebRTC `getUserMedia()` in desktop UI + AVFoundation device probe in `CameraManager`. Zero synthetic canvas mocks in live UI. |
| **Real Face Detection** | `PARTIALLY VERIFIED` | BlazeFace 896-anchor topology and IoU NMS (0.30) implemented in pure TypeScript. However, score regression uses YCbCr skin chrominance and facial contrast heuristics rather than a loaded `.onnx`/`.tflite` binary weight file. |
| **Real Embedding** | `PARTIALLY VERIFIED` | Canonical 112x112 affine alignment and 512D unit $L_2$-normalized vector extraction are mathematically implemented. However, it is a deterministic spatial receptive field projection, NOT pretrained weights from CASIA-WebFace or MS1MV2. |
| **Real Recognition** | `VERIFIED` | Genuine cosine similarity matching on 512D unit hypersphere with multi-frame temporal window voting against enrolled galleries. |
| **Real Liveness** | `VERIFIED` | 8-state state machine driven by real signals: temporal landmark variance, micro-motion thresholds, and active head-turn challenge angles. EAR is an eye-to-nose proportion proxy. |
| **RAM-Only Processing** | `VERIFIED` | `MemorySanitizer.zeroizeBuffer()` called on frame discard; zero camera frames or vectors written to disk. |
| **Encrypted Identity Storage** | `VERIFIED` | AES-256-GCM authenticated encryption with unique IVs, salt, and isolated identity storage files. |
| **OS Keyring** | `PARTIALLY VERIFIED` | macOS Keychain CLI (`/usr/bin/security`) tested. Falls back safely to hardened `0o600` master keyfile when running in headless environments where Keychain authorization is denied. |
| **No Biometric Network Egress** | `VERIFIED` | Local API binds strictly to `127.0.0.1`; zero outbound network sockets or telemetry requests exist in the codebase. |

---

## 2. In-Depth Technical Audits

### 2.1 ArcFace 512D Embedding Claim (Mandatory Audit)

- **Claim**: "ArcFace 512D Embedding: Multi-scale convolutional spatial feature extraction produces 512-dimensional vectors."
- **Classification**: `PARTIALLY VERIFIED`
- **Detailed Findings**:
  1. **Dimension & Normalization**: The output vector is strictly 512-dimensional and unit-length normalized ($\|\mathbf{v}\|_2 = 1.0 \pm 10^{-6}$). Cosine similarity properties hold.
  2. **Preprocessing**: The face patch is cropped and aligned to canonical 112x112 dimensions using affine eye-angle rotation.
  3. **Architecture & Weights**: The feature extraction in `packages/vision/src/embedder.ts` computes spatial gradient energy and mean luminance across a 7x7 spatial grid, projecting into sinusoidal frequency channels.
  4. **CRITICAL DISTINCTION**: It does **NOT** execute a pretrained ResNet-50 / MobileFaceNet deep neural network weight tensor trained on CASIA-WebFace or Glint360k. It is a deterministic mathematical receptive field projector designed to run cross-platform without external binary runtimes.
  5. **Remediation**: The project must never claim "pretrained ArcFace deep weights" without explicitly clarifying this architectural distinction. Future phases will introduce optional ONNX Runtime / WebAssembly bindings for binary weights (`w600k_r50.onnx`).

### 2.2 BlazeFace Face Detection Claim

- **Claim**: "896 multi-scale anchors 16x16 stride 8, 8x8 stride 16, 128x128 input, 6 keypoints, IoU NMS."
- **Classification**: `PARTIALLY VERIFIED`
- **Detailed Findings**:
  1. **Anchor Grid**: Exactly 896 anchor boxes are generated (16x16 feature map = 512 anchors at stride 8; 8x8 feature map = 384 anchors at stride 16), matching the Google Research BlazeFace topology.
  2. **Input Tensor**: Images are scaled to canonical 128x128 RGB space and normalized to $[-1.0, 1.0]$.
  3. **Non-Maximum Suppression**: True IoU intersection-over-union suppression with configurable threshold ($0.30$).
  4. **Landmarks**: Produces 6 facial keypoints (left eye, right eye, nose tip, mouth left, mouth right, chin).
  5. **Score Regression**: Instead of running convolutional anchor regression layers from a binary `.tflite` model, confidence is computed using YCbCr skin locus chrominance and eye-socket vs mouth contrast differences.

### 2.3 Liveness Detection Claim

- **Claim**: "8-state liveness machine, EAR blink detection, micro-motion variance, texture naturalness, active challenges."
- **Classification**: `VERIFIED` (with geometric EAR qualification)
- **Detailed Findings**:
  1. **No Fake / Random Decisions**: There is no `Math.random() > 0.5` gating liveness in production code. Liveness decisions are computed from camera frame history and landmark movement.
  2. **Anti-Spoofing (Static Photo)**: In Light mode, a static photo with zero landmark coordinate movement yields motion variance $< 0.008$ and is correctly rejected with `LIVENESS_FAILED`.
  3. **Active Challenges**: Strong mode issues real randomized challenges (`TURN_LEFT_15`, `TURN_RIGHT_15`, `TILT_UP_10`), measuring yaw/pitch delta across consecutive frames.
  4. **EAR Qualification**: The Eye Aspect Ratio uses an eye-to-nose vertical proportion proxy rather than 68-point eyelid mesh tracking because the 6-point detector does not provide eyelid contours.

### 2.4 Camera Hardware Discovery & RAM Security

- **Claim**: "Real camera access, no synthetic loops in production, RAM-only zeroization."
- **Classification**: `VERIFIED`
- **Detailed Findings**:
  1. **Desktop UI**: `apps/desktop/index.html` uses `navigator.mediaDevices.getUserMedia()` to stream real hardware camera video directly into a `<video>` element with an overlay `<canvas>` tracking real facial landmarks.
  2. **Memory Zeroization**: `MemorySanitizer.zeroizeBuffer()` is invoked on frame discard. Camera frames are never serialized to disk or transmitted across network interfaces.

### 2.5 Code Quality & Dummy Data Audit

- **Identified Items for Phase 3 Remediation**:
  1. `apps/desktop/serve.js` line 130 had a placeholder `new Float32Array(512).fill(0.04419)` in the HTTP enrollment route. **Must be removed and wired to the real vision engine in Phase 3.**
  2. `apps/cli/bin/openfaceid.ts` line 178 used hardcoded synthetic landmarks for `vision benchmark`. **Must be updated to use real detection on sample frame fixtures.**
  3. `packages/presence/src/PresenceTracker.ts` triggered `USER_PRESENT` on raw face detection rather than requiring recognized identity and verified liveness. **Must enforce the multi-stage authorization condition.**

---

## 3. Conclusion

Phase 2 successfully replaced the simulated UI animations with real hardware camera streams, real temporal recognition matching, and real cryptographic storage. However, full transparency requires documenting that the computer vision algorithms in TypeScript are mathematical feature extractors and anchor estimators rather than loaded binary neural network weights. Phase 3 builds upon these verified foundations.
