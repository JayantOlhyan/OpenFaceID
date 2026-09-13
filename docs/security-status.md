# OpenFaceID (SightLock) — Master Security Status Matrix

This matrix tracks every identified threat actor, attack vector, defense mechanism, implementation file, test evidence, residual risk, and current status, fulfilling Section 70 of the continuous engineering specification.

---

## 1. Threat Matrix (T1–T10) & Defense Implementation

| ID | Threat Actor & Attack Scenario | Defense & Architectural Mitigation | Implementation Reference | Automated Test Reference | Residual Risk & Operational Boundary | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **T1** | **Physical Passerby**<br>Attacker accesses workstation after user leaves. | PresenceTracker absence timeout (15s default) triggers automated screen lock via platform adapter. | `packages/presence/src/PresenceTracker.ts`<br>`packages/automation/src/PolicyEngine.ts` | `tests/unit/presence_authorized.test.ts`<br>`tests/unit/automation.test.ts` | Attack within the 15-second leave window before timeout expires. | **`VERIFIED`** |
| **T2** | **Shoulder Surfer / Multiple Faces**<br>Attacker stands next to user to piggyback on presence authorization. | Hard fail-closed multiple-face policy: presence transitions immediately to `PRESENCE_AMBIGUOUS` whenever `face_count >= 2`. | `packages/core/src/state/canonical.ts`<br>`packages/presence/src/PresenceTracker.ts` | `tests/unit/phase5_security_regression.test.ts` | Attacker completely occludes user's face (treated as unknown face -> unauthorized). | **`VERIFIED`** |
| **T3** | **Unprivileged Co-Habitant OS User**<br>Malicious local user attempts to read identity embeddings from filesystem. | Strict directory permissions (`0700`) and file permissions (`0600`) on `~/.openfaceid`. Master key sealed in OS Keystore. | `packages/storage/src/IdentityStore.ts`<br>`packages/security/src/keyring.ts` | `tests/unit/security_filesystem.test.ts` | Root / Admin superuser can read user directories if filesystem permissions are bypassed. | **`VERIFIED`** |
| **T4** | **Compromised Local Process / Script**<br>Malicious background process probes local IPC to forge authorization or trigger enrollment. | Server strictly bound to loopback `127.0.0.1`. Ephemeral 256-bit bearer token required on sensitive routes. Constant-time comparison prevents timing leaks. | `apps/desktop/serve.js`<br>`packages/security/src/crypto.ts` | `tests/unit/ipc_security.test.ts`<br>`tests/unit/ipc_fuzzing.test.ts` | Compromised process running as the same local user could read `~/.openfaceid/token`. | **`VERIFIED`** |
| **T5** | **Remote Network Attacker**<br>Remote adversary attempts to exploit listening ports or exfiltrate biometrics. | Zero network egress policy: daemon listens strictly on `127.0.0.1`. All outbound remote webhooks blocked. Zero telemetry. | `packages/automation/src/ActionDispatcher.ts`<br>`apps/desktop/serve.js` | `tests/unit/automation_security.test.ts`<br>`tests/unit/phase5_security_regression.test.ts` | Remote DNS rebinding attack mitigated by Host header validation and bearer token requirement. | **`VERIFIED`** |
| **T6** | **Presentation Attack (Spoofing)**<br>Attacker presents a printed photograph, tablet screen, or recorded video. | Modular 8-state PAD: Temporal Eye Aspect Ratio (EAR) blink detection, high-frequency spatial texture variance, and active pose challenges. | `packages/vision/src/liveness.ts` | `tests/unit/vision.test.ts`<br>`tests/unit/phase2_vision_camera_liveness.test.ts` | Sophisticated 3D physical silicone masks or high-resolution animated deepfakes with dynamic blink synthesis. Standard 2D webcams cannot offer 100% hardware anti-spoofing guarantees. | **`VERIFIED`** |
| **T7** | **Model Poisoning & Weight Tampering**<br>Attacker alters vision model code or weights to create backdoors. | Startup SHA-256 cryptographic verification: files are hashed and asserted against immutable authoritative digests. Mismatch halts execution with `MODEL_INTEGRITY_FAILURE`. | `packages/vision/src/registry.ts` | `tests/unit/model_integrity.test.ts` | Attacker modifies both source file and registered checksum if they possess write access to application bundle. | **`VERIFIED`** |
| **T8** | **Supply Chain Poisoning**<br>Malicious npm package injects backdoor into dependency graph. | Zero external runtime dependencies preserved. Pure Node.js standard libraries only. Zero npm vulnerabilities in `package-lock.json`. | `package.json`<br>`package-lock.json` | `npm audit`<br>`docs/dependency-audit.md` | Compromise of Node.js upstream runtime binary itself. | **`VERIFIED`** |
| **T9** | **Memory Extraction & Cold Boot Attack**<br>Attacker dumps system RAM to recover raw camera images or embeddings. | Strict volatile memory lifecycle: raw frame buffers and embeddings are zeroized in-place using `MemorySanitizer.zeroizeBuffer()`. | `packages/security/src/zeroize.ts`<br>`packages/camera/src/CameraManager.ts` | `tests/unit/security.test.ts`<br>`tests/unit/phase5_security_regression.test.ts` | V8 garbage collector non-deterministic string copies in heap prior to collection (mitigated by storing secrets strictly in TypedArray buffers). | **`VERIFIED`** |
| **T10** | **Timing Attack on IPC Tokens**<br>Attacker measures microsecond latency variations to guess bearer token byte-by-byte. | Replaced string equality (`===`) with constant-time comparison `crypto.timingSafeEqual` via `CryptoManager.verifyTimingSafe()`. | `packages/security/src/crypto.ts`<br>`apps/desktop/serve.js` | `tests/unit/security.test.ts`<br>`tests/unit/ipc_security.test.ts` | Extremely subtle CPU pipeline cache timing variations (negligible over loopback socket). | **`VERIFIED`** |

---

## 2. Cryptographic Security Standards

1. **Cipher Algorithm**: AES-256-GCM (Galois/Counter Mode) authenticated encryption.
2. **Key Derivation**: 256-bit cryptographically secure pseudorandom keys generated via `crypto.randomBytes(32)`. Sealed inside macOS Keychain, Windows DPAPI, or Linux Secret Service. Fallback key derived via PBKDF2 with SHA-512 and 100,000 iterations.
3. **Initialization Vector (IV)**: 96-bit unique cryptographically random nonce generated per encryption operation. Nonces are never reused.
4. **Authentication Tag**: 128-bit authentication tag appended to ciphertext. Any bit modification results in decryption failure and authentication error.
5. **Data at Rest Shredding**: Secure multi-pass erasure: identity files are overwritten with cryptographically secure random bytes, followed by zeros, before the file node is unlinked.

---

## 3. Security Status Summary

All 10 threat scenarios are mitigated by defense-in-depth architectural invariants, reinforced by automated regression tests, and verified in continuous integration.
