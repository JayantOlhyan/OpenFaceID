# OpenFaceID Test Matrix

## 1. Test Coverage Matrix

| Test Domain | Test File / Suite | Pass Criteria | Execution Target | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **Architectural Boundaries** | `tests/unit/architecture_boundaries.test.ts` | 5/5 pass (0 illegal imports, 0 runtime npm deps) | All CI runners | Node >= 22 |
| **API Contracts** | `tests/unit/api_contracts.test.ts` | 11/11 pass (stable enums, schemas, exit codes) | All CI runners | Node >= 22 |
| **Developer Examples** | `tests/unit/examples.test.ts` | 8/8 examples execute with exit code 0 | All CI runners | Node >= 22 |
| **Canonical State Machine** | `tests/unit/canonical_state.test.ts` | Complete lifecycle, session expiration, fail-closed | All CI runners | Node >= 22 |
| **Presence Tracker** | `tests/unit/presence.test.ts` | Absence timeouts, grace periods, multi-face drops | All CI runners | Node >= 22 |
| **Face Quality** | `tests/unit/quality.test.ts` | Rejection of blur, dark illumination, extreme pitch/yaw | All CI runners | Node >= 22 |
| **Face Detection** | `tests/unit/detector.test.ts` | 6 landmarks, bounding boxes, IoU non-max suppression | All CI runners | Node >= 22 |
| **Face Embedding** | `tests/unit/embedder.test.ts` | 512D float arrays, unit length L2-norm, cosine similarity | All CI runners | Node >= 22 |
| **Liveness (PAD)** | `tests/unit/liveness.test.ts` | Photo rejection, micro-motion acceptance, blink detection | All CI runners | Node >= 22 |
| **Crypto & Keyring** | `tests/unit/security.test.ts` | AES-256-GCM authenticated encryption, tag tamper detection | All CI runners | Node >= 22 |
| **Memory Sanitizer** | `tests/unit/zeroize.test.ts` | Zeroing of typed arrays and buffer wiping | All CI runners | Node >= 22 |
| **Storage & Shredding** | `tests/unit/storage.test.ts` | Mode 0600 file permissions, traversal block, shred on delete | All CI runners | Node >= 22 |
| **Notification Observer** | `tests/unit/notifications.test.ts` | Cooldowns, deduplication, burst limits, non-blocking | All CI runners | Node >= 22 |
| **Automation Dispatcher** | `tests/unit/automation.test.ts` | Loopback-only webhook guards, shell=false parameterization | All CI runners | Node >= 22 |
| **Daemon REST & SSE** | `tests/unit/api_server.test.ts` | Bearer token auth, constant-time validation, SSE streams | All CI runners | Node >= 22 |
| **CLI Functionality** | `tests/unit/diagnostics_cli.test.ts` | Exit codes 0–7, pure JSON parsing, secret redaction | All CI runners | Node >= 22 |
| **Security Regression** | `tests/security/security_regression.test.ts` | Multi-face drop, timing-safe checks, zero disk frames | All CI runners | Node >= 22 |
| **Microbenchmarks** | `tests/performance/microbenchmarks.test.ts` | Pipeline latency < 35ms, memory leak prevention | All CI runners | Node >= 22 |
| **Soak Reliability** | `tests/performance/stress_soak.test.ts` | 1500 continuous cycles, stable RSS plateau (< 300 MB) | All CI runners | Node >= 22 |
| **Physical Camera** | `scripts/hardware/camera-test.js` | Real optical sensor enumeration, capture, zeroize | Hardware Lab only | Physical Webcam |
