# OPENFACEID — FINAL V1 RELEASE DECISION REPORT

**Document ID**: OFID-REPORT-V1-FINAL-DECISION  
**Project**: OpenFaceID (SightLock)  
**Repository**: `https://github.com/JayantOlhyan/OpenFaceID`  
**Host Architecture**: macOS Darwin 25.6.0 (arm64 Apple Silicon M4)  
**Decision Gate Date**: September 13, 2026  
**Standards Context**: Informed by ISO/IEC 30107-3 (PAD) & ISO/IEC 19795-1 (Biometrics)

---

## 1. Executive Summary

This document represents the definitive engineering release gate decision regarding whether OpenFaceID can transition from its current public release candidate status (`v0.2.1-rc.1`) to a general availability `v1.0.0` stable release.

In strict adherence to the project's engineering principles:
1. **Zero fabricated hardware evidence**: Physical testing on Windows and Linux hardware test benches cannot be conducted on this Apple Silicon host. Therefore, Windows and Linux hardware remain classified as **`UNVERIFIED`** (`RB-02`).
2. **Zero manufactured signing credentials**: Apple Developer ID binary signing and Gatekeeper notarization cannot be executed without an active paid Apple Developer account. Binary signing remains classified as **`DEFERRED`** (`RB-01`).
3. **Evidence-bounded claims**: Recognition is accurately scoped to cooperative frontal desktop usage (100.0% TAR, 240/240 probes at $\tau = 0.70$; 0 false accepts across 500 disjoint impostor probes). Adverse optical conditions fail-closed.
4. **Transparent model truth**: The vision engine is explicitly classified as an **analytical model**, suitable for desktop presence awareness and workflow automation, but **not intended or certified for security-sensitive authentication (OS login or financial auth)**.

**Final Verdict**: OpenFaceID is **`NOT ELIGIBLE FOR v1.0.0`**. The project remains classified as **`PUBLIC RC WITH SIGNING & HARDWARE LIMITATIONS`** / **`SOURCE-ONLY RELEASE READY`** (`v0.2.1-rc.1`).

---

## 2. Current Version
- **Canonical Version**: `0.2.1-rc.1` (Release Candidate)
- **Proposed Target**: `1.0.0` (Rejected at this gate)

---

## 3. Commit
- **Evaluated Commit**: `00ed676c8be23cda60d41494ad478d53b39e42b4`
- **Certified Branch**: `main`

---

## 4. Core Software
- **Test Suite**: `npm test` executed across all packages and apps.
- **Pass Rate**: **179 / 179 tests passing** across 44 suites (0 failures, 0 skipped, 0 cancelled).
- **Build Status**: `npm run build` passes cleanly.
- **Runtime**: Node.js v25.2.1 with `--experimental-strip-types`.

---

## 5. Security
- **Command**: `openfaceid security check`
- **Audit Results**: Passed 6 / 6 security gates:
  1. IPC loopback binding (`127.0.0.1:41793`).
  2. Zero external telemetry trackers or cloud endpoints.
  3. Master key stored in OS Keychain with 256-bit entropy.
  4. AES-256-GCM biometric encryption with tamper rejection.
  5. Cryptographic SHA-256 model integrity verification.
  6. Constant-time `crypto.timingSafeEqual` IPC token comparison.

---

## 6. Privacy
- **Command**: `openfaceid privacy check`
- **Audit Results**: Passed 4 / 4 privacy gates:
  1. Outbound network sockets blocked; zero remote DNS lookups.
  2. Volatile RAM zeroization flushes frame buffers to `0x00` upon completion.
  3. Zero raw camera frames or biometric images persisted to disk.
  4. Hardware Privacy Pause immediately halts camera ingestion.

---

## 7. Recognition
- **Evaluation Dataset**: `data/evaluation/realworld-evaluation.json` (1,950 total probe comparisons across 12 enrolled subjects).
- **Default Balanced Threshold ($\tau = 0.70$)**:
  - **Genuine Cooperative Frontal TAR**: **100.0%** (240 / 240 accepts) with mean similarity of `0.8024`.
  - **Disjoint Impostor FAR**: **0.000%** (0 false accepts across 500 tested impostor comparisons).
  - **Near-Neighbor Impostor FAR**: **8.000%** (20 false accepts across 250 tested near-neighbor comparisons).
- **Strict Threshold ($\tau = 0.80$)**:
  - **Genuine Cooperative Frontal TAR**: **58.75%** (141 / 240 accepts).
  - **Overall Impostor FAR**: **0.000%** (0 false accepts across 750 tested impostor comparisons).
- **Limitation**: Unconstrained yaw ($>20^\circ$) or dim lighting ($<35\text{ lux}$) triggers fail-closed rejection.

---

## 8. Liveness
- **Methodology**: Evaluated against presentation attack instruments (PAIs):
  - **2D Printed Photos**: **0.0% APCER** (50 / 50 rejected via EAR blink tracking + Laplacian variance).
  - **Smartphone Screen Replays**: **0.0% APCER** (50 / 50 rejected via moiré spatial frequency detection).
  - **Prerecorded Video Replays**: **8.0% APCER** in passive mode (4 / 50 accepted); **0.0% APCER in Active Challenge mode** (nod/turn prompts).
- **Sensor Limit**: Standard 2D RGB optical sensing cannot defend against 3D physical silicone masks or OS virtual camera driver injection.

---

## 9. Fail-Closed
- **Rule**: Authorization requires `1 Known Face + Liveness Passed + Single Subject + Active Session`.
- **Verified Failure Handlers**:
  - No Face $\to$ `UNAUTHORIZED` (`SEARCHING`)
  - Unknown Face $\to$ `UNAUTHORIZED` (`DENIED`)
  - Multiple Faces $\to$ `UNAUTHORIZED` (`PRESENCE_AMBIGUOUS`)
  - Liveness Failure $\to$ `UNAUTHORIZED` (`LIVENESS_FAILED`)
  - Camera Disconnect $\to$ `UNAUTHORIZED` (`CAMERA_DISCONNECTED`)
  - Privacy Paused $\to$ `UNAUTHORIZED` (`PAUSED`)
  - Session Expired $\to$ `UNAUTHORIZED` (`USER_LEFT`)
  - Process Restart $\to$ Session tokens purged; fresh verification required.

---

## 10. Reliability
- **Actual Tested Durations**:
  - **1-Hour Physical Session**: 54,000 frames evaluated continuously on physical macOS FaceTime HD camera in Phase 8 (`docs/performance/soak.md`). Zero crashes, zero unhandled rejections.
  - **Automated Soak Runner**: Multi-interval soak with deliberate fault injection executed in `scripts/validation/long-run-soak.js`. All 4 fault injection scenarios cleanly recovered.
- **Duration Notice**: The soak script accepts `--duration=<seconds>`. The recent run tested 22.8 seconds (445 frames) with full fault injection. Continuous unattended 4–8 hour bench soak requires dedicated lab hardware.
- **Evidence-Bounded Conclusion**: No sustained memory growth was observed under the tested continuous workload.

---

## 11. macOS Hardware
- **Status**: **`HARDWARE VERIFIED`**
- **Test Machine**: Apple M4 MacBook Air (Darwin 25.6.0 arm64, 16 GB unified RAM).
- **Verified Subsystems**: FaceTime HD 1080p camera discovery, TCC permission grants/revocation, live video streaming, macOS Notification Center delivery, system sleep/wake session resets.

---

## 12. Windows Hardware
- **Status**: **`HARDWARE UNVERIFIED`**
- **Reason**: Physical Windows 10/11 machine test bench unavailable on current workstation.
- **Code Status**: DirectShow/MediaFoundation native bindings and NSIS installer packaged; Windows CI runs tests.
- **Release Impact**: **RELEASE BLOCKING FOR v1.0.0** (`GAP-01` / `RB-02`). Retained as `DEFERRED`.

---

## 13. Linux Hardware
- **Status**: **`HARDWARE UNVERIFIED`**
- **Reason**: Physical Linux workstation test bench unavailable on current workstation.
- **Code Status**: V4L2 ioctl wrappers and PipeWire camera discovery implemented; Debian `.deb` package builder present; Linux CI runs tests.
- **Release Impact**: **RELEASE BLOCKING FOR v1.0.0** (`GAP-02` / `RB-02`). Retained as `DEFERRED`.

---

## 14. Camera Compatibility
- **Status**: **`PARTIALLY VERIFIED`**
- **FaceTime HD 1080p**: Verified on Apple Silicon.
- **Generic UVC USB Webcams**: Verified via standard class driver.
- **DirectShow / V4L2 Webcams**: Code implemented; physical hardware unverified.
- **Virtual Cameras**: Userspace loopback driver vulnerability documented in `presentation-attack-limitations.md`.

---

## 15. Performance
- **Status**: **`PASS`**
- **Inference Latency**: Median 0.628ms (Apple M4); p95: 0.760ms; p99: 0.827ms.
- **Throughput**: Sustains 30 FPS processing with <2.5% single-core equivalent CPU.
- **Cold Boot**: 312ms to full HTTP/IPC listener readiness.

---

## 16. Memory
- **Status**: **`PASS`**
- **Baseline RSS**: 78–95 MB idle.
- **Active Inference RSS**: 105–138 MB.
- **Leak Detection**: Linear regression slope across multi-interval soak is flat ($\le 0.05\text{ MB/hour}$ post-V8 heap allocation).

---

## 17. Battery
- **Status**: **`PASS`**
- **Desktop Impact**: Draws <2.5% single-core equivalent during active 30 FPS inference.
- **Dynamic Throttle**: Drops to 1.5 FPS when presence is stable, reducing CPU utilization to <0.4%.

---

## 18. Thermal
- **Status**: **`PASS`**
- **Host Observation**: Surface temperature on fanless Apple M4 MacBook Air remained $\le 34^\circ\text{C}$ throughout continuous monitoring. Zero thermal throttling events observed.

---

## 19. Packaging
- **Status**: **`PASS`**
- **Artifacts Built**: macOS `.tar.gz`, Linux `.tar.gz`, Debian `.deb`, Windows `.zip` + NSIS script.
- **Integrity**: Verified in `SHA256SUMS`. All artifacts match manifest hashes.

---

## 20. Apple Signing
- **Status**: **`DEFERRED`** (`GAP-03` / `RB-01`)
- **Limitation**: Apple Developer ID Application certificate is legitimately unavailable. Binaries are ad-hoc signed; Gatekeeper notarization cannot be performed.
- **Release Impact**: Precompiled binary distribution requires manual Gatekeeper override; source-only release is unhindered.

---

## 21. CI
- **Status**: **`PASS`**
- **Configuration**: GitHub Actions workflows configured across macOS, Ubuntu, and Windows runners. Builds, lint, typecheck, unit tests, and doc link checks execute cleanly.

---

## 22. Documentation
- **Status**: **`PASS`**
- **Link Audit**: `npm run docs:check-links` verified 146 markdown documents and 61 relative links with **0 broken links**.
- **Content**: Accurate description of what OpenFaceID is, what it does, what it does not do, platforms, privacy, security, and limitations.

---

## 23. Supply Chain
- **Status**: **`PASS`**
- **Runtime Dependencies**: **0 production packages** in `package.json`.
- **Vulnerabilities**: `npm audit` reports **0 vulnerabilities**.
- **Model Security**: In-tree mathematical formulations validated with SHA-256 cryptographic digests.

---

## 24. Model Positioning
- **Status**: **`ACCURATE`**
- **Classification**: Explicitly classified as an **analytical vision model**.
- **Suitability**:
  - Presence Awareness: **SUITABLE**
  - Workflow Automation: **SUITABLE**
  - General Recognition: **PARTIALLY SUITABLE** (Cooperative frontal desktop only)
  - Security-Sensitive Authentication: **NOT SUITABLE / NOT INTENDED**

---

## 25. Public Claims
- **Status**: **`PASS`**
- **Traceability**: All 15 externally visible technical claims (C-01 through C-15) mapped to empirical tests in `claim-evidence-matrix.md`.
- **Audit**: Zero marketing exaggerations ("Face ID equivalent", "100% accuracy", "0% FAR", "spoof-proof") remain.

---

## 26. Release Blockers
| Blocker | Description | Status | Release Impact |
| :--- | :--- | :---: | :--- |
| **RB-01 (GAP-03)** | Apple Developer ID Binary Signing & Gatekeeper Notarization | **`DEFERRED`** | Blocks distributed macOS precompiled binary release. |
| **RB-02 (GAP-01, GAP-02)** | Physical Windows & Linux Hardware Validation | **`DEFERRED`** | Blocks cross-platform hardware certification claim. |

---

## 27. Final Gate Results
- **Core Software**: PASS
- **Security**: PASS
- **Privacy**: PASS
- **Recognition**: PASS (Scoped)
- **Liveness**: PASS (Scoped)
- **Fail-Closed**: PASS
- **Reliability**: PARTIAL (1-Hour verified; 4-Hour pending lab bench)
- **macOS Hardware**: VERIFIED
- **Windows Hardware**: UNVERIFIED
- **Linux Hardware**: UNVERIFIED
- **Packaging**: PASS
- **Apple Signing**: DEFERRED
- **CI**: PASS
- **Documentation**: PASS
- **Supply Chain**: PASS
- **Public Claims**: PASS
- **Model Positioning**: ACCURATE

---

## 28. Stable Release Decision

In accordance with Section 23 ("V1 Eligibility Rule"), Section 24 ("Important Decision Rule"), and Section 26 ("Tagging Rule"):

> A full cross-platform `v1.0.0` stable release requires physical hardware validation across macOS, Windows, and Linux, plus Apple Developer ID binary signing. Because physical Windows and Linux hardware benches (`RB-02`) and Apple Developer ID signing credentials (`RB-01`) are legitimately deferred:

- **Stable Release Eligible**: **`NO`**
- **v1.0.0 Tagged**: **`NO`**
- **Current Version Retained**: **`0.2.1-rc.1`**
- **Final Classification**: **`PUBLIC RC WITH SIGNING & HARDWARE LIMITATIONS`** / **`SOURCE-ONLY RELEASE READY`**
- **Recommended Action**: Maintain release candidate posture at `v0.2.1-rc.1`. Provide open-source test scripts for community contributors with physical Windows and Linux machines to validate hardware drivers.
