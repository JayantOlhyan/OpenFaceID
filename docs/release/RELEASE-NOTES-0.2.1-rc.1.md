# OpenFaceID v0.2.1-rc.1 Release Notes

**Release Candidate 1** — `v0.2.1-rc.1`  
**Date**: September 2026  
**License**: Apache-2.0  
**Repository**: [https://github.com/JayantOlhyan/OpenFaceID](https://github.com/JayantOlhyan/OpenFaceID)  

---

## What is OpenFaceID?

OpenFaceID (SightLock) is **local webcam facial presence detection and biometric recognition software** for desktop operating systems. It provides continuous presence monitoring (detecting when the user steps away, locking the workstation), quick-glance authentication assistance, and privacy-first local biometric processing.

### What OpenFaceID is NOT:
- OpenFaceID is **not** an Apple Face ID or Windows Hello hardware replacement.
- OpenFaceID does **not** feature structured light / dot projectors or dedicated infrared sensor hardware.
- OpenFaceID does **not** run inside a Secure Enclave or TPM coprocessor.
- OpenFaceID does **not** bypass operating system login or intercept system passwords.

---

## Key Capabilities

1. **Continuous Presence Monitoring**:
   - High-efficiency temporal state machine tracking presence: `ACTIVE_RECOGNIZED`, `GRACE_PERIOD`, `PRESENCE_LOST`, `PRESENCE_AMBIGUOUS`, `UNAUTHORIZED`.
   - Configurable grace period and automatic lock actions via native platform adapters.
2. **Local-First & Zero-Telemetry**:
   - Zero external network requests or cloud telemetry.
   - Raw video frames and cropped face images are held in volatile RAM only and zeroized upon pipeline completion.
   - Enrolled biometric vectors are encrypted using AES-256-GCM with keys stored in the OS secure keystore.
3. **Multi-Stage Vision Pipeline**:
   - In-tree TypeScript analytical formulations for face detection (BlazeFace 896-anchor geometry), feature extraction (ArcFace-inspired 512D unit hypersphere projection), and presentation attack detection.
4. **8-State Presentation Attack Detection (PAD)**:
   - Temporal Eye Aspect Ratio (EAR) blink tracking combined with spatial Laplacian micro-motion variance and optional active head pose challenges.
5. **Unified CLI & Desktop Suite**:
   - Full-featured command-line tool (`openfaceid status`, `doctor`, `security check`, `privacy check`, `identity enroll`, `identity list`, `lock`).
   - Lightweight desktop tray menu and Quick Glance presence indicator.

---

## Supported Platforms & Hardware Certification

| Operating System | Architecture | Hardware Validation Status | Notes |
| :--- | :--- | :--- | :--- |
| **macOS 12+** | Apple Silicon (`arm64`) | **HARDWARE VERIFIED** | Real FaceTime HD & external USB webcam validated. |
| **macOS 12+** | Intel (`x86_64`) | **AUTOMATED ONLY** | Emulation / CI pipeline validated. |
| **Windows 10/11** | `x64` | **CODE IMPLEMENTED / HARDWARE UNVERIFIED** | Blocker RB-02: Physical lab testing deferred. |
| **Linux (Ubuntu/Debian)** | `x64` | **CODE IMPLEMENTED / HARDWARE UNVERIFIED** | Blocker RB-02: Physical lab testing deferred. |

---

## Known Limitations & Release Blockers

1. **Apple Developer ID Code Signing (Blocker RB-01)**:
   - Release binaries are unsigned or ad-hoc signed (`codesign -s -`).
   - macOS Gatekeeper will require right-clicking the app and selecting *Open*, or running `xattr -dr com.apple.quarantine /Applications/OpenFaceID.app`.
2. **Physical Windows & Linux Lab Verification (Blocker RB-02)**:
   - While cross-platform code paths (DirectShow/MediaFoundation via PowerShell on Windows, V4L2/GStreamer on Linux) are implemented and unit tested, physical hardware lab validation with real cameras on Windows/Linux is pending available test benches.
3. **Analytical Vision Formulation**:
   - The current release uses pure in-tree TypeScript analytical formulations rather than heavy pre-trained neural network weights. While this eliminates all third-party binary dependencies and yields sub-millisecond latency (<0.8ms), discrimination across extreme head poses (>35° yaw/pitch) and adverse lighting (<15 lux) is constrained compared to billion-parameter neural networks.
4. **Standard 2D Webcams**:
   - 2D RGB sensors lack 3D depth geometry. Anti-spoofing relies on temporal EAR eye-blinks, frame micro-variance, and active challenge head nods.

---

## Verification & Test Results

- **Automated Test Regression**: 179 / 179 passing across 44 test suites (0 skipped, 0 flaky).
- **Diagnostics Health**: 7 / 7 checks passing in `openfaceid doctor`.
- **Security Verification**: 6 / 6 security gates passing in `openfaceid security check`.
- **Privacy Verification**: 4 / 4 privacy gates passing in `openfaceid privacy check`.
- **Long-Run Soak Test**: 1,500 consecutive cycles completed with zero memory leak (<267 MB RSS).
- **Supply Chain**: 0 external runtime npm dependencies; 0 vulnerabilities found by `npm audit`.

---

## Installation Quickstart

### macOS
Download `OpenFaceID-0.2.1-rc.1-arm64.dmg` from the release artifacts, mount it, and move `OpenFaceID.app` to `/Applications`.

### Linux
```bash
sudo dpkg -i openfaceid_0.2.1-rc.1_amd64.deb
```

### CLI Quickstart
```bash
# Verify system readiness
openfaceid doctor

# Check security & privacy invariants
openfaceid security check
openfaceid privacy check

# Enroll facial profile
openfaceid identity enroll "My User"

# View status
openfaceid status
```

---

## Contributing & Support

We welcome contributions, bug reports, and hardware validation results on Windows and Linux!
- **Issues & Discussions**: [GitHub Issues](https://github.com/JayantOlhyan/OpenFaceID/issues)
- **Contributing Guide**: [CONTRIBUTING.md](../../CONTRIBUTING.md)
- **Security Reports**: Email maintainer at `jayantolhyan@gmail.com`
