# OpenFaceID — Phase 11 Baseline Specification
## Real-World Validation + Cross-Platform Certification Baseline

**Document ID**: OFID-VAL-BASELINE-011  
**Project**: OpenFaceID (SightLock)  
**Phase**: Phase 11 of 11  
**Baseline Date**: September 2026  
**Canonical Version**: `0.2.1-rc.1`  
**Certified Commit**: `5182545b8d10ac016bdf544e81f983a64737f49b`  
**Git Tag**: `v0.2.1-rc.1`  
**Current Status**: **PUBLIC RC WITH SIGNING & HARDWARE LIMITATIONS**  

---

## 1. System Environment Baseline

| Parameter | Observed Value | Classification |
| :--- | :--- | :--- |
| **Operating System** | macOS (Darwin 25.6.0 arm64, Apple Silicon T8132) | HARDWARE VERIFIED |
| **Node.js Runtime** | v25.2.1 (`--experimental-strip-types` active) | HARDWARE VERIFIED |
| **npm Package Manager** | v11.3.0 | HARDWARE VERIFIED |
| **Monorepo Version** | `0.2.1-rc.1` (synchronized across 13 packages) | VERIFIED |
| **Automated Test Suite** | 179 passing tests across 44 test suites (0 failures, 0 skipped, 0 flaky) | AUTOMATED VERIFIED |
| **Build Reproducibility** | Deterministic clean build from scratch in isolated directory | AUTOMATED VERIFIED |
| **Runtime Dependencies** | 0 third-party packages (Pure Node.js standard library) | VERIFIED |
| **npm audit** | 0 vulnerabilities found | VERIFIED |
| **Documentation Health** | 130 markdown files audited, 53 relative links checked, 0 broken links | VERIFIED |

---

## 2. Functional & Subsystem Baselines

| Subsystem | Metric / Configuration | Evidence / Artifact | Baseline Status |
| :--- | :--- | :--- | :--- |
| **Face Detection** | BlazeFace analytical formulation (896 anchors) | `packages/vision/src/detector.ts` | ANALYTICAL / AUTOMATED |
| **Feature Embedding** | 512D hyperspherical projection ($\|\mathbf{v}\| = 1.0$) | `packages/vision/src/embedder.ts` | ANALYTICAL / AUTOMATED |
| **Liveness Engine** | 8-State PAD (EAR eye-blinks + Laplacian micro-motion) | `packages/vision/src/liveness.ts` | ANALYTICAL / AUTOMATED |
| **Matching Thresholds** | Balanced ($\tau = 0.70$), Strict ($\tau = 0.80$), Very Strict ($\tau = 0.88$) | `packages/core/src/config/defaults.ts` | AUTOMATED VERIFIED |
| **Pipeline Latency** | Median: 0.628ms, P95: 0.760ms, P99: 0.827ms | `tests/performance/microbenchmarks.test.ts` | HARDWARE VERIFIED (M1) |
| **Memory Soak Plateau** | 1,500 continuous cycles, stable RSS < 267 MB, 0 leaks | `tests/performance/soak.test.ts` | HARDWARE VERIFIED (M1) |
| **macOS Camera** | Built-in FaceTime HD webcam capture, AVFoundation | `scripts/hardware/camera-test.js` | HARDWARE VERIFIED (MAC-01) |
| **Windows Camera** | DirectShow / MediaFoundation PowerShell bridge | `packages/platform/src/WindowsAdapter.ts` | HARDWARE UNVERIFIED |
| **Linux Camera** | V4L2 / PipeWire / GStreamer capture bridge | `packages/platform/src/LinuxAdapter.ts` | HARDWARE UNVERIFIED |
| **Security Gates** | 6/6 gates passed (`openfaceid security check`) | `docs/security/phase-10-security-certification.md` | VERIFIED |
| **Privacy Gates** | 4/4 gates passed (`openfaceid privacy check`) | `docs/security/final-privacy-certification.md` | VERIFIED |

---

## 3. Active Release Blockers Audit

### RB-01: Apple Developer ID Signing & Notarization
- **Current Status**: **`DEFERRED`**
- **Empirical Audit Result**:
  ```bash
  $ security find-identity -v -p codesigning
       0 valid identities found
  ```
  No Developer ID certificates are installed in the host keychain. Release binaries currently employ ad-hoc code signing (`codesign -s -`).
- **Required Resolution Path**:
  1. Active Apple Developer Program organization enrollment.
  2. Issuance of `Developer ID Application` certificate.
  3. Installation of certificate and private key in CI/release keychain.
  4. Execution of hardened runtime signing and `xcrun notarytool submit`.
  5. Ticket stapling via `xcrun stapler staple`.
- **Release Impact**: Prevents out-of-the-box double-click execution on macOS without manual Gatekeeper override (`xattr -dr com.apple.quarantine`). Does NOT affect source-only execution or CLI usage.

### RB-02: Physical Windows & Linux Hardware Lab Validation
- **Current Status**: **`DEFERRED`**
- **Empirical Audit Result**:
  Host environment is Apple Silicon macOS (`Darwin 25.6.0 arm64`). Dedicated physical Windows 11 and Ubuntu Linux desktop workstations with integrated webcams are physically unavailable on this host.
- **Required Resolution Path**:
  Physical testing with real USB and integrated webcams on dedicated Windows and Linux workstations running the `scripts/hardware/*` test suite.
- **Release Impact**: Prevents claiming cross-platform hardware certification. Does NOT prevent source distribution or automated software CI validation.

---

## 4. Phase 11 Validation Standard Definitions

In adherence to Non-Negotiable Rule 15, the following evaluation categories are strictly separated across all Phase 11 artifacts:

1. **`AUTOMATED`**: Validated by automated Node.js test scripts using headless assertions.
2. **`SIMULATED`**: Validated using simulated platform environments or mocked OS system calls.
3. **`ANALYTICAL`**: Derived from deterministic mathematical formulations rather than pre-trained neural network weights.
4. **`SYNTHETIC`**: Evaluated against mathematically generated, non-biometric test distributions (e.g., Gaussian random noise vectors).
5. **`HARDWARE`**: Validated using real physical sensors and operating system subsystems on the test host.
6. **`REAL-WORLD`**: Evaluated against real human faces, physical webcams, and realistic ambient environmental conditions under an opt-in privacy protocol.
7. **`USER STUDY`**: Evaluated with human participants assessing usability, friction, and error recovery.
