# OpenFaceID (SightLock) — Security Center Architecture & Auditing

The **Security Center** is an authoritative diagnostic and auditing interface built directly into OpenFaceID Phase 5. It provides full transparency into the operational integrity of the system without producing ungrounded or synthetic security checkmarks.

---

## 1. Core Security Audits & Checks

Every indicator in the Security Center corresponds to an active, verifiable programmatic test:

### 1. Model Integrity Check
- **What is checked**: Validates that local machine learning model weights (`blazeface-detector`, `arcface-embedder`, `liveness-pad-evaluator`) have not been poisoned, corrupted, or tampered with on disk.
- **How it is checked**: The daemon computes the cryptographic SHA-256 digest of the model files and compares them against the immutable authoritative registry (`packages/vision/src/registry.ts`).
- **Pass Condition**: All model checksums match authoritative signatures.
- **Failure Mode**: If any hash fails to match, the system enters `MODEL_INTEGRITY_FAILURE`, halts camera capture, and blocks recognition.

### 2. Identity Encryption Check
- **What is checked**: Confirms that enrolled biometric representations are stored using authenticated symmetric encryption.
- **How it is checked**: Validates that identity payloads utilize **AES-256-GCM** with a 96-bit unique IV and 128-bit authentication tag, backed by the OS keystore or a PBKDF2 machine-bound key with 100,000 iterations.
- **Pass Condition**: AES-GCM cipher confirmed and test payload encrypt/decrypt verification succeeds.
- **Failure Mode**: Storage fails closed to `IDENTITY_STORE_CORRUPT`.

### 3. IPC Authentication & Loopback Binding
- **What is checked**: Confirms that the local IPC API server is protected against unauthorized local processes and remote network access.
- **How it is checked**: Verifies that the HTTP server is strictly bound to `127.0.0.1` and requires an ephemeral 256-bit Bearer token validated using constant-time timing-safe comparisons (`crypto.timingSafeEqual`).
- **Pass Condition**: Non-loopback requests are blocked; unauthenticated requests receive `401 Unauthorized`.

### 4. Network Policy Check
- **What is checked**: Validates that no outbound network connections are established by the OpenFaceID runtime.
- **How it is checked**: Verifies that no external sockets or network handlers are registered, confirming zero cloud telemetry or egress.
- **Pass Condition**: Offline local processing verified.

### 5. Camera Privacy Status
- **What is checked**: Verifies whether the camera pipeline is currently actively capturing frames or is suspended in privacy mode.
- **Pass Condition**: Correctly reflects `ACTIVE` or `PAUSED`.

---

## 2. Interactive Explanations & Transparency

In the Desktop UI (**Security Center** tab), clicking any check item opens a detailed modal explaining:
1. **What is checked**: The underlying security invariant being monitored.
2. **How it is checked**: The exact cryptographic or architectural mechanism employed.
3. **Current result**: Live status (`PASS`, `FAIL`, or `WARNING`).
4. **Limitations**: Real-world operational boundaries (e.g. OS-level kernel compromises or root-level memory dumpers are beyond user-space application isolation boundaries).

---

## 3. CLI Parity

The Security Center checks can be executed independently from the command line:
```bash
openfaceid security check
```
Output:
```text
=== OpenFaceID Security Audit ===
Model Integrity:     PASS (All models verified via SHA-256)
Identity Encryption: PASS (AES-256-GCM authenticated)
IPC Security:        PASS (Loopback 127.0.0.1 with ephemeral token)
Network Policy:      PASS (Zero remote egress verified)
Privacy State:       ACTIVE
=================================
```
