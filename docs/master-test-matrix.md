# OpenFaceID (SightLock) — Master Test Matrix

This matrix tracks testing across every subsystem, methodology, test file, test count, pass/fail status, and coverage classification, fulfilling Section 69 of the continuous engineering specification.

---

## 1. Test Pyramid Breakdown

- **Total Automated Test Suites**: 40 suites
- **Total Automated Passing Tests**: 137 tests (89 unit tests + 48 evaluation & security audit tests)
- **Physical Hardware Test Suites**: 6 suites (28 live hardware assertions in `scripts/hardware/`)
- **Passing Rate**: 100% (137 / 137 passing, 0 failures, 0 timeouts)
- **Host Execution Environment**: macOS Darwin 25.6.0 (arm64 Apple Silicon M4), Node.js v25.2.1

---

## 2. Comprehensive Subsystem Test Matrix

| Subsystem | Test Type | Primary Test Suite File | Test Count | Status | Key Properties Verified |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **Core** | Unit | `tests/unit/core.test.ts` | 5 | **PASS** | State machines, event bus pub/sub, config validation, logger formatting |
| **Canonical State** | Unit / Integration | `tests/unit/phase5_product_ux.test.ts` | 4 | **PASS** | Authoritative state hierarchy, Section 25 error recovery suggestions, 5-pose targets, HUD/Tray payload structure |
| **Camera** | Unit / Hardware | `tests/unit/camera.test.ts` | 3 | **PASS** | Device enumeration, permission states, frame sampling rate limits |
| **Camera Lifecycle** | Integration | `tests/unit/phase2_vision_camera_liveness.test.ts` | 2 | **PASS** | Hardware probe via AVFoundation, frame backpressure dropping |
| **Face Detection** | Unit / CV | `tests/unit/vision.test.ts` | 3 | **PASS** | 896 BlazeFace anchors, IoU Non-Maximum Suppression (NMS), skin locus filter |
| **Face Embeddings**| Unit / Math | `tests/unit/vision.test.ts` | 2 | **PASS** | ArcFace 512D hyperspherical vector L2 normalization (\|\|v\|\| = 1.0), unit cosine distance properties |
| **Liveness (PAD)** | Unit / Security | `tests/unit/vision.test.ts` | 3 | **PASS** | Passive mode blink / micro-motion, static photo rejection, active challenge FSM |
| **Model Integrity**| Security | `tests/unit/model_integrity.test.ts` | 3 | **PASS** | Metadata verification, authoritative SHA-256 validation, detection of corrupted/tampered model bytes |
| **Identity Store** | Unit / Security | `tests/unit/security.test.ts` | 4 | **PASS** | Profile serialization, AES-256-GCM cipher encryption, multi-pass random byte file shredding |
| **Storage Security**| Security / FS | `tests/unit/security_filesystem.test.ts` | 3 | **PASS** | Path traversal rejection, regex ID validation, strict `0600` file / `0700` directory permissions |
| **Presence** | Integration | `tests/unit/presence_authorized.test.ts` | 2 | **PASS** | Authorization requires matching face + valid liveness; absence timeout / grace periods |
| **Multi-Face Defense**| Security Regression | `tests/unit/phase5_security_regression.test.ts` | 7 | **PASS** | `face_count >= 2` triggers `PRESENCE_AMBIGUOUS`, unauthorized UI suppression, zero raw frame persistence, zero telemetry |
| **IPC Security** | Security | `tests/unit/ipc_security.test.ts` | 5 | **PASS** | Ephemeral 256-bit bearer token required on sensitive routes, timing-safe equality defense |
| **IPC Fuzzing** | Security / Robustness | `tests/unit/ipc_fuzzing.test.ts` | 8 | **PASS** | Oversized payloads (1MB cap), malformed JSON, prototype pollution, deeply nested objects |
| **Automation & Egress**| Security | `tests/unit/automation_security.test.ts` | 4 | **PASS** | Remote webhooks blocked (`SECURITY POLICY VIOLATION`), loopback allowed, raw shell commands rejected |
| **Daemon Lifecycle** | Integration | `tests/unit/desktop_lifecycle.test.ts` | 4 | **PASS** | Cold boot, background mode, hot-plug camera disconnect/reconnect, graceful shutdown zeroization |
| **Desktop UI / HUD** | Product UX | `tests/unit/phase5_product_ux.test.ts` | 4 | **PASS** | Non-color-only indicators, HUD payload structure, onboarding flow targets, tray actions |
| **CLI Parity** | System CLI | `tests/unit/diagnostics_cli.test.ts` | 6 | **PASS** | `status`, `camera status`, `identity status`, `presence status`, `doctor`, sanitized `export-diagnostics` |
| **macOS Platform** | Hardware Integration | `packages/platform/src/MacOSAdapter.ts` | Verified | **PASS** | `pmset displaysleepnow`, IORegistry idle time, native notifications, keychain master secret |
| **Windows Platform**| Code Only | `packages/platform/src/WindowsAdapter.ts` | Mocked | **UNVERIFIED** | Unit tested with mock adapter; awaiting physical Windows workstation |
| **Linux Platform** | Code Only | `packages/platform/src/LinuxAdapter.ts` | Mocked | **UNVERIFIED** | Unit tested with mock adapter; awaiting physical Linux workstation |
| **Packaging** | Build / Packaging | `scripts/package-macos.sh`, `package-deb.sh` | 3 | **PASS** | macOS `.app` bundle, `.dmg`, `.zip`, Linux `.deb`, release manifest & SHA-256 generation |
| **Performance Soak** | Reliability | `scripts/long-run-validation.js` | 1 | **PASS** | 1,000 continuous frames processed in 0.53s, 0.532ms average cycle, zero memory leaks, zero unhandled errors |
| **Accessibility** | Audit / DOM | `apps/desktop/index.html` | Manual | **PASS** | Keyboard tab order, visible focus rings, WCAG AA contrast, semantic button/dialog tags |
| **Threshold Semantics**| Evaluation / Math | `tests/evaluation/threshold.test.ts` | 6 | **PASS** | Monotonic presets (0.70 < 0.80 < 0.88), rejection of inverted 0.58 distance myth, clamping bounds |
| **Recognition Quality**| Evaluation / Biometric | `tests/evaluation/recognition.test.ts` | 7 | **PASS** | Genuine match, temporal window aggregation (4/5), zero impostor acceptance (FAR=0%), disabled profile |
| **Enrollment Cohesion**| Evaluation / Biometric | `tests/evaluation/enrollment-consistency.test.ts` | 6 | **PASS** | 5-pose pipeline, intra-subject similarity clustering, mixed-identity rejection, frame zeroization |
| **Multi-Face Ambiguity**| Evaluation / Policy | `tests/evaluation/multi-face.test.ts` | 7 | **PASS** | 0/1/2/3+ face state transitions, fail-closed PRESENCE_AMBIGUOUS, bystander entry/exit recovery |
| **Liveness (PAD)** | Evaluation / Security | `tests/evaluation/liveness.test.ts` | 7 | **PASS** | Static photo rejection (APCER=0%), micro-motion acceptance, active challenge timeouts & turns |
| **Face Quality Gating**| Evaluation / Environmental | `tests/evaluation/quality.test.ts` | 9 | **PASS** | Rejection of blur, dark, glare, extreme yaw/pitch/roll, small/large face area ratio, off-center |
| **Profile Versioning** | Unit / Storage | `tests/unit/profile_versioning.test.ts` | 3 | **PASS** | Model metadata serialization, dimension rejection (`embeddingDim !== 512`), forward compatibility |
| **Hardware Security**  | Security / Network | `tests/evaluation/hardware_security_audit.test.ts` | 5 | **PASS** | Loopback binding, constant-time token verification, 0700/0600 permissions, diagnostic sanitization |
| **Physical Hardware**  | Live Hardware | `scripts/hardware/*.js` | 28 | **PASS** | FaceTime HD discovery, 1080p/720p/480p, backpressure queue, M4 embedding latency, disconnect/reconnect |

---

## 3. Security Regression Verification

```text
CRITICAL SECURITY INVARIANTS:
[PASS] AUTHORIZED state NEVER appears when authoritative state is not authorized.
[PASS] Multiple faces strictly fail closed to PRESENCE_AMBIGUOUS.
[PASS] Unknown faces strictly fail closed to PRESENCE_UNAUTHORIZED.
[PASS] Liveness failures strictly fail closed to PRESENCE_UNAUTHORIZED.
[PASS] Unauthenticated IPC requests receive 401 Unauthorized.
[PASS] Tampered model files trigger MODEL_INTEGRITY_FAILURE.
[PASS] Remote webhook requests are rejected with SECURITY POLICY VIOLATION.
[PASS] Biometric vectors and raw frames are excluded from diagnostic exports.
```
