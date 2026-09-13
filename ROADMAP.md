# OpenFaceID Technical Roadmap

## 1. Overview

This roadmap reflects engineering realities and empirical validation status. OpenFaceID prioritizes technical truth, security fail-closed guarantees, and user privacy over speculative deadlines.

---

## 2. Roadmap Phases

### Current Focus (Phase 9 — Open-Source Ecosystem & Contributor Readiness)

* :white_check_mark: **macOS Hardware Certification**: Verified runtime on physical Apple Silicon hardware (MAC-01).
* :white_check_mark: **Public API & Contract Stability**: Documented stability tiers (`Stable`, `Experimental`, `Internal`), automated contract tests (`tests/unit/api_contracts.test.ts`).
* :white_check_mark: **Architectural Boundary Enforcement**: Automated static tests preventing illegal package layering and enforcing zero runtime npm dependencies.
* :white_check_mark: **Developer Experience**: Standardized CLI exit codes (0–7), machine-readable pure `--json` output, comprehensive runnable examples (`examples/`).
* :white_check_mark: **Contributor Tooling**: Standardized issue templates, PR checklist, biometric test-data policy, and hardware validation reporting formats.

---

### Next Phase (Phase 10 — Multi-Platform Hardware Lab & Dataset Evaluation)

* :hourglass_flowing_sand: **Windows Physical Hardware Validation**:
  * Execute physical webcam tests across Intel/AMD Windows 11 machines.
  * Validate Media Foundation capture and DPAPI keystore performance on real hardware.
  * Qualify Windows from `HARDWARE UNVERIFIED` to `VERIFIED`.
* :hourglass_flowing_sand: **Linux Physical Hardware Validation**:
  * Execute physical webcam tests across Ubuntu (X11 & Wayland) and Fedora.
  * Validate Video4Linux2 (V4L2) frame capture, buffer zeroization, and Secret Service keyring storage.
  * Qualify Linux from `HARDWARE UNVERIFIED` to `VERIFIED`.
* :hourglass_flowing_sand: **Standardized Biometric Benchmarking**:
  * Formal evaluation of in-tree analytical algorithms against public synthetic datasets.
  * Publish measured False Match Rate (FMR), False Non-Match Rate (FNMR), APCER, and BPCER curves.

---

### Future Roadmap (Phase 11+ — Neural Model Backends & Packaging)

* :dart: **Pluggable Neural Model Backends**:
  * Implement `ONNXFaceDetector` and `ONNXFaceEmbedder` implementing `IFaceDetector` and `IFaceEmbedder`.
  * Enable optional local ONNX Runtime inference for users desiring neural network embeddings without changing Core or Presence state logic.
* :dart: **Platform-Native Vision Frameworks**:
  * macOS `Vision.framework` face detection backend.
  * Windows Media Foundation Face Detection backend.
* :dart: **Automated Release Packaging**:
  * Multi-platform CI artifact generation (signed DMG, NSIS `.exe`, Debian `.deb`, AppImage).

---

### Exploratory Research (Long-Term)

* :microscope: **Multi-Spectral Infrared (IR) Support**: Researching webcam sensor fusion with dedicated USB infrared depth sensors for true hardware-grade anti-spoofing.
* :microscope: **WebNN Hardware Acceleration**: Investigating native NPU acceleration on Apple Silicon (Neural Engine) and Intel/AMD Core Ultra NPUs.
* :microscope: **Hardware Security Enclave Attestation**: Investigating TPM 2.0 / Apple Secure Enclave signing of presence tokens.

---

## 3. Release Blockers & Deferred Items

| Blocker ID | Description | Current Status | Resolution Requirement |
| :--- | :--- | :--- | :--- |
| **RB-01** | Apple Developer ID Signing & Notarization | **DEFERRED** | Requires active Apple Developer Program team credentials and notarization certificate. Currently distributed as unsigned local build. |
| **RB-02** | Physical Windows & Linux Hardware Lab | **DEFERRED** | Requires physical test hardware running Windows 11 and Linux to record empirical camera captures. Code is implemented; hardware validation deferred to community contributors or physical lab acquisition. |
