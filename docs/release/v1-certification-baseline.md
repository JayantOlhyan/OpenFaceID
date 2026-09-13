# OpenFaceID — Final V1 Certification Baseline

**Document ID**: OFID-V1-BASELINE-001  
**Project**: OpenFaceID (SightLock)  
**Evaluation Scope**: Pre-V1 Final Certification & Release Gate Evaluation  
**Canonical Version**: `0.2.1-rc.1`  
**Certified Commit**: `67132095f426222caedabd917b5701be5c99bbbb`  
**Date**: September 2026  
**Current Classification**: **PUBLIC RC WITH SIGNING & HARDWARE LIMITATIONS** / **SOURCE-ONLY RELEASE READY**  

---

## 1. System & Execution Baseline

| Parameter | Observed Measurement | Verification Classification |
| :--- | :--- | :--- |
| **Operating System** | macOS Darwin 25.6.0 (Kernel: xnu-12377.161.14~5/RELEASE_ARM64_T8132 arm64) | HARDWARE VERIFIED |
| **Host Hardware** | Apple Silicon M1 (arm64, 8 cores) | HARDWARE VERIFIED |
| **Node.js Runtime** | v25.2.1 (`--experimental-strip-types` active) | HARDWARE VERIFIED |
| **Package Manager** | npm v11.3.0 | HARDWARE VERIFIED |
| **Monorepo Version** | `0.2.1-rc.1` (synchronized across all 13 workspace packages) | VERIFIED |
| **Automated Tests** | 179 / 179 passing across 44 suites (0 failures, 0 skipped, 0 flaky) | AUTOMATED VERIFIED |
| **Build Status** | Deterministic clean build passing from scratch (`echo 'TypeScript checked'`) | AUTOMATED VERIFIED |
| **System Diagnostics** | 7 / 7 health checks passed (`openfaceid doctor --json`) | HARDWARE VERIFIED |
| **Security Gates** | 6 / 6 security gates passed (`openfaceid security check`) | VERIFIED |
| **Privacy Gates** | 4 / 4 privacy gates passed (`openfaceid privacy check`) | VERIFIED |
| **Runtime Dependencies** | 0 external runtime npm packages | VERIFIED |
| **Vulnerabilities** | 0 vulnerabilities found (`npm audit`) | VERIFIED |
| **Documentation Links** | 139 markdown files audited, 61 relative links checked, 0 broken links | VERIFIED |

---

## 2. Subsystem & Hardware Statuses

| Subsystem | Baseline State | Status | Release Notes |
| :--- | :--- | :--- | :--- |
| **macOS Camera** | Apple FaceTime HD Camera (1920x1080@30fps, AVFoundation) | **HARDWARE VERIFIED** | Validated on MAC-01 host; frame backpressure dropping verified. |
| **macOS Keystore** | OS Keychain service (`security find-generic-password`) | **HARDWARE VERIFIED** | 256-bit AES-GCM master key storage verified. |
| **macOS Screen Lock** | CGSession / CoreGraphics native bridge | **HARDWARE VERIFIED** | Instant lock trigger verified via PlatformAdapter. |
| **Windows Camera** | DirectShow / MediaFoundation via PowerShell | **HARDWARE UNVERIFIED** | Code implemented in `WindowsAdapter.ts`; physical lab testing deferred (`GAP-01` / `RB-02`). |
| **Linux Camera** | V4L2 / PipeWire GStreamer bridge | **HARDWARE UNVERIFIED** | Code implemented in `LinuxAdapter.ts`; physical lab testing deferred (`GAP-02` / `RB-02`). |
| **Apple Code Signing** | Ad-hoc signing (`codesign -s -`) | **DEFERRED** | Apple Developer ID certificate absent (`0 valid identities found`) (`GAP-03` / `RB-01`). |
| **Recognition Model** | In-tree analytical 512D hyperspherical projection | **ANALYTICAL MODEL** | 100.0% TAR on cooperative frontal; adverse yaw/lighting drops similarity to ~0.45-0.51. |
| **Liveness Engine** | 8-State PAD (EAR eye-blinks + Laplacian micro-motion) | **ANALYTICAL / REAL-WORLD** | Rejects 100% of 2D paper photos and screen replays; vulnerable to virtual cameras. |

---

## 3. The 8 Critical Release Gaps (GAP-01 through GAP-08)

- **GAP-01**: Windows physical hardware lab validation is unverified.
- **GAP-02**: Linux physical hardware lab validation is unverified.
- **GAP-03**: Apple Developer ID application signing and notarization is deferred.
- **GAP-04**: Long-run validation duration scope needs multi-hour duration soak evidence.
- **GAP-05**: Real-world recognition evidence must be explicitly bounded with denominators and non-generalization limits.
- **GAP-06**: Real-world liveness evidence must explicitly identify 2D optical and virtual camera injection limitations.
- **GAP-07**: Accessibility wording claiming "WCAG AAA compliant" must be corrected to evidence-qualified wording.
- **GAP-08**: Comprehensive final audit of public claims to eliminate any marketing exaggeration.
