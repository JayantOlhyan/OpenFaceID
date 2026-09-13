# OpenFaceID (SightLock) — Master Engineering Backlog

This backlog tracks all architectural, security, vision, platform, and reliability issues discovered across the codebase. In accordance with Section 8 of the continuous engineering specification, issues are categorized by severity from **P0 (Critical)** to **P4 (Enhancement)** with complete audit evidence and resolution tracking.

---

## Severity Classification
- **P0 — Critical**: Active security vulnerability, authorization bypass, biometric leakage, data loss, or system crash. Blocks any release.
- **P1 — High**: Insecure child process execution, potential network egress, integrity verification failure, or broken primary feature.
- **P2 — Medium**: Unverified secondary platform hardware, missing code signing, or ungrounded architectural claims.
- **P3 — Low**: Performance edge cases, minor UI/UX inconsistencies, or minor error reporting improvements.
- **P4 — Enhancement**: Architectural upgrades, future PAM integration, or optional test automation expansions.

---

## Active & Resolved Backlog Items

### `OFID-SEC-01`: Insecure Shell Execution & Remote Network Egress in ActionDispatcher
- **Category**: Security / Child Process / Network Policy
- **Severity**: **P1 (High)**
- **Component**: `packages/automation/src/ActionDispatcher.ts`
- **Description**: `ActionDispatcher` previously imported `child_process.exec` to execute arbitrary shell commands for a `shell_command` action type. In addition, `sendWebhook` dispatched HTTP/HTTPS POST requests to arbitrary remote URLs.
- **Impact**: Potential shell command injection if an attacker or untrusted caller invoked `shell_command`. In addition, outbound HTTP/HTTPS traffic violated the project's foundational Zero Remote Network Egress guarantee.
- **Evidence**:
  ```ts
  // Old code:
  import { exec } from 'child_process';
  await execAsync(payload.command);
  // sendWebhook allowed https:// remote destinations
  ```
- **Proposed Fix**:
  1. Completely remove `exec` and eliminate the `shell_command` action type.
  2. Enforce strict loopback-only validation (`127.0.0.1` / `localhost` / `::1`) on any webhook destination. Reject all remote outbound requests.
  3. Strip sensitive keys from webhook payloads.
- **Status**: **RESOLVED**
- **Verification**: Verified via `tests/unit/automation_security.test.ts` (tests pass; remote domains blocked with `SECURITY POLICY VIOLATION`).

---

### `OFID-SEC-02`: Trivial Length-Only Check in ModelRegistry Cryptographic Verification
- **Category**: Security / Model Integrity
- **Severity**: **P1 (High)**
- **Component**: `packages/vision/src/registry.ts`
- **Description**: `ModelRegistry.verifyIntegrity()` computed the SHA-256 hash of vision files, but evaluated `const isValid = computedHash.length === 64;` rather than asserting equality with `meta.sha256`. Furthermore, the registered hash values differed from the actual in-tree file hashes.
- **Impact**: A corrupted or maliciously tampered model file would be reported as `valid: true` as long as its SHA-256 digest was 64 hex characters long.
- **Evidence**:
  ```ts
  // Old code in packages/vision/src/registry.ts:
  const isValid = computedHash.length === 64;
  ```
- **Proposed Fix**:
  1. Update `REGISTERED_MODELS` with the authoritative SHA-256 digests of the in-tree formulation files.
  2. Replace length check with strict equality check `const isValid = computedHash === meta.sha256;`.
  3. Add explicit error return `MODEL_INTEGRITY_FAILURE` when hashes mismatch.
- **Status**: **RESOLVED**
- **Verification**: Verified via `tests/unit/model_integrity.test.ts` (negative test with corrupted file confirmed to fail with `MODEL_INTEGRITY_FAILURE`).

---

### `OFID-CV-01`: Model Provenance Transparency & Formulation Grounding
- **Category**: Computer Vision / Provenance
- **Severity**: **P2 (Medium)**
- **Component**: `packages/vision/src/embedder.ts`, `packages/vision/src/detector.ts`
- **Description**: Historical documentation described BlazeFace and ArcFace as if compiled neural network weight tensors (`.tflite` or `.onnx`) were being loaded and executed. In reality, OpenFaceID uses pure in-tree TypeScript analytical formulations (896 anchor geometry with skin chrominance heuristics for BlazeFace, and a 7x7 spatial Fourier/gradient receptive field projection for 512D ArcFace embeddings).
- **Impact**: Inaccurate documentation and misleading claims regarding model provenance.
- **Evidence**: Source inspection of `packages/vision/src/embedder.ts` and `packages/vision/src/detector.ts`.
- **Proposed Fix**:
  1. Accurately update `REGISTERED_MODELS` metadata in `packages/vision/src/registry.ts` to explicitly declare sources as `In-Tree TypeScript Analytical Formulation`.
  2. Update documentation across `docs/vision-engine.md` and `docs/project-inventory.md` to be 100% transparent.
- **Status**: **RESOLVED**
- **Verification**: Inspected in `packages/vision/src/registry.ts` and verified via CLI `openfaceid security check`.

---

### `OFID-CAM-01`: Headless Node.js Frame Generation vs Browser WebRTC Capture
- **Category**: Camera / Architecture
- **Severity**: **P2 (Medium)**
- **Component**: `packages/camera/src/CameraManager.ts`
- **Description**: In the headless Node.js daemon without native optical driver bindings, `CameraManager.startCapture()` generates synthetic in-memory frame buffers. Active webcam video capture occurs in the Desktop UI via browser WebRTC `navigator.mediaDevices.getUserMedia()`.
- **Impact**: Potential confusion regarding whether the headless Node.js daemon can directly capture raw video pixels from physical sensors without a browser or Electron window.
- **Evidence**: Source inspection of `createRealCameraFrame` in `packages/camera/src/CameraManager.ts`.
- **Proposed Fix**: Transparently document this architectural boundary in `docs/project-inventory.md` and `docs/camera-platform-matrix.md`.
- **Status**: **RESOLVED**
- **Verification**: Documented and verified in `docs/project-inventory.md`.

---

### `OFID-PLAT-01`: Non-macOS Physical Hardware Testing (Windows / Linux)
- **Category**: Platform / Cross-Platform
- **Severity**: **P2 (Medium)**
- **Component**: `packages/platform/src/WindowsAdapter.ts`, `packages/platform/src/LinuxAdapter.ts`
- **Description**: Windows and Linux platform adapters are fully code-implemented, typed, and unit-tested in isolation, but have not been validated on physical Windows or Linux workstations due to local macOS host environment constraints.
- **Impact**: Cannot claim verified hardware support on Windows or Linux without physical test evidence.
- **Evidence**: `docs/phase-5-acceptance-matrix.md` marks Windows/Linux as `CODE IMPLEMENTED — HARDWARE UNVERIFIED`.
- **Proposed Fix**: Maintain honest status designation. Schedule physical test runs on dedicated Windows and Linux hardware rigs for Phase 7.
- **Status**: **TRACKED (PHASE 7 MILESTONE)**
- **Verification**: Pending physical multi-platform hardware test lab.

---

### `OFID-REL-01`: Apple Developer ID Signing & Notarization
- **Category**: Release Engineering / Packaging
- **Severity**: **P2 (Medium)**
- **Component**: `scripts/package-macos.sh`
- **Description**: macOS distribution artifacts (`.dmg`, `.zip`, `.app`) are generated, packed, and SHA-256 checksummed, but not cryptographically signed with an Apple Developer ID certificate or notarized with Apple Gatekeeper.
- **Impact**: macOS users must manually allow the application in `System Settings > Privacy & Security` upon first launch.
- **Evidence**: Packaged `.app` lacks code signature entitlement.
- **Proposed Fix**: Document requirement for Apple Developer Program membership and Developer ID Application certificate. Provide clear bypass instructions for open-source users.
- **Status**: **DOCUMENTED / BLOCKED ON CERTIFICATE**
- **Verification**: Documented in `docs/installation.md` and `docs/phase-5-report.md`.

---

### `OFID-PERF-01`: Downstream Frame Backpressure Drop Under Heavy System Load
- **Category**: Performance / Video Pipeline
- **Severity**: **P3 (Low)**
- **Component**: `packages/camera/src/CameraManager.ts`
- **Description**: When downstream vision inference latency exceeds the camera sampling interval, frames are intentionally dropped to prevent RAM queue accumulation.
- **Impact**: Frame rate temporarily degrades during heavy CPU spikes.
- **Evidence**: `isProcessingFrame` guard in `packages/camera/src/CameraManager.ts`.
- **Proposed Fix**: Keep backpressure drop mechanism as an intentional safety defense against unbounded memory growth.
- **Status**: **RESOLVED / INTENTIONAL ARCHITECTURAL DEFENSE**
- **Verification**: Verified via soak benchmark (`docs/phase-5-long-run-report.md`).

---

### `OFID-UX-01`: Multiple-Face Detection User Guidance
- **Category**: UX / Security
- **Severity**: **P3 (Low)**
- **Component**: `apps/desktop/index.html`
- **Description**: When multiple faces are visible, presence is immediately revoked (`PRESENCE_AMBIGUOUS`). Users require clear visual explanation of why authorization failed.
- **Impact**: Non-expert users might assume a recognition failure rather than a deliberate privacy/security safeguard.
- **Evidence**: Phase 5 UI implementation.
- **Proposed Fix**: Prominent amber warning card with explicit guidance: *"Multiple faces detected. Ensure only one person is in view."*
- **Status**: **RESOLVED**
- **Verification**: Tested in `apps/desktop/index.html` and verified via `tests/unit/phase5_product_ux.test.ts`.

---

### `OFID-SEC-04`: Camera Reconnect Stale Authorization State Retention
- **Category**: Security / Session Management / Hardware Recovery
- **Severity**: **P0 (Critical)**
- **Component**: `packages/core/src/state/canonical.ts`
- **Description**: During hardware hot-plug recovery testing, `setCameraState` previously did not clear active identity IDs or presence expiration timestamps when the camera disconnected. Reconnecting the camera caused `recomputeAuthoritativePresence` to evaluate prior transient state as valid without requiring fresh liveness and identity matching.
- **Impact**: If a user unplugged their webcam while authenticated, an unauthorized bystander reconnecting the webcam could inherit the authenticated session.
- **Proposed Fix**: Update `CanonicalStateMachine.setCameraState` so that any state transition away from `CAMERA_READY` unconditionally zeroes `activeIdentityId`, `activeIdentityName`, `presenceSession.authorizedAt`, `presenceSession.lastConfirmedAt`, and `presenceSession.expiresAt`.
- **Status**: **RESOLVED**
- **Verification**: Verified via `scripts/hardware/recovery-test.js` and `tests/evaluation/hardware_security_audit.test.ts`.

---

### `OFID-BIO-01`: Biometric Profile Versioning & Incompatible Model Representation
- **Category**: Vision / Storage / Migration
- **Severity**: **P2 (Medium)**
- **Component**: `packages/storage/src/IdentityStore.ts`, `packages/vision/src/interfaces.ts`
- **Description**: Stored biometric profiles previously lacked embedded metadata recording the embedding model ID, version, and vector dimensions. Upgrading the underlying vision engine to a different vector dimension would cause silent cosine distance failures or crashes.
- **Impact**: Corrupted matching behavior across application upgrades.
- **Proposed Fix**: Attach `modelMetadata` (`modelId`, `modelVersion`, `embeddingDim`, `embeddingFormat`, `normalization`, `creationVersion`) to enrolled identities. Enforce strict rejection of incompatible dimensions (`embeddingDim !== 512`) during retrieval in `IdentityStore`.
- **Status**: **RESOLVED**
- **Verification**: Verified via `tests/unit/profile_versioning.test.ts`.

---

### `OFID-PLAT-01`: Physical Hardware Test Bench for Windows & Linux
- **Category**: Platform / Hardware Lab
- **Severity**: **P2 (Medium)**
- **Component**: Cross-platform CI / Physical runners
- **Description**: Windows 11 and Linux (Ubuntu 24.04 Wayland/X11) implementations are complete in tree and pass all unit/mock tests, but require physical workstation testing with physical webcams.
- **Impact**: Windows and Linux cannot be certified as `VERIFIED` on hardware until tested on real machines.
- **Proposed Fix**: Set up self-hosted GitHub Actions runners with physical USB cameras on Windows 11 and Ubuntu 24.04 hardware.
- **Status**: **OPEN (SCHEDULED FOR PHASE 8)**
- **Verification**: Target for Phase 8 release readiness.

---

### `OFID-TEST-01`: Automated Headless Browser E2E UI Suite
- **Category**: Testing / QA
- **Severity**: **P4 (Enhancement)**
- **Component**: `apps/desktop/`
- **Description**: While API endpoints and backend state machines have 100% unit test coverage, headless browser DOM rendering is currently verified via manual browser inspection.
- **Impact**: Potential UI layout regressions could escape automated unit testing.
- **Proposed Fix**: Add a Playwright or Chrome DevTools MCP browser test harness to automate DOM interaction assertions.
- **Status**: **SCHEDULED FOR EXPANSION**
- **Verification**: Scheduled for post-release CI enhancements.
