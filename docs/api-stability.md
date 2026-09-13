# OpenFaceID API Stability & Versioning Policy

## 1. Overview

OpenFaceID defines an explicit lifecycle and stability taxonomy for all exposed programming interfaces, schemas, and developer surfaces. This prevents breaking changes from destabilizing integrations while allowing internal biometric heuristics, performance formulations, and platform adapters to iterate rapidly.

In accordance with semantic versioning (`MAJOR.MINOR.PATCH-PRERELEASE`), stability levels define the contract guarantees provided by each tier.

---

## 2. API Stability Tiers

OpenFaceID categorizes every public and private interface into five tiers:

| Tier | Guarantee | Breaking Change Policy | Target Audience |
| :--- | :--- | :--- | :--- |
| **Stable** | Production-ready, long-term backwards compatibility | Only in major version bumps (`x.0.0`) with 1 minor release deprecation notice | Integrators, UI consumers, automation callers |
| **Experimental** | Under active design; public for developer feedback | May evolve across minor versions (`0.x.0`) with changelog notice | Early adopters, plugin developers, evaluators |
| **Internal** | Implementation details; zero backwards compatibility guarantee | Can change or be deleted at any commit without notice | Core maintainers only |
| **Deprecated** | Superseded; scheduled for removal | Retained for backward compatibility until target removal release | Existing callers migrating to replacements |
| **Removed** | Completely removed from codebase | Throws compile-time or runtime error | N/A |

---

## 3. Surface Classification Matrix

### 3.1 Stable Surfaces

These surfaces have stable schemas, predictable error states, and fail-closed security invariants:

* **Core State Types (`packages/core/src/state/`):**
  * `CanonicalPresenceState` (`UNKNOWN`, `ABSENT`, `SUSPICIOUS`, `USER_PRESENT`)
  * `CanonicalSecurityState` (`SECURE`, `UNLOCKED`, `LOCKED`, `ALARM`, `REVOKED`)
  * `CanonicalRecognitionState` (`IDLE`, `SCANNING`, `DETECTED`, `RECOGNIZED`, `MULTIPLE_FACES`, `TIMEOUT`)
  * `CanonicalStateMachine` (subscription API and transition events)
* **Configuration Schema (`packages/core/src/config/`):**
  * `AppConfig` type and schema validator (`validateConfig`)
  * Default configuration (`DEFAULT_CONFIG`)
  * Recognition thresholds: `Balanced = 0.70`, `Strict = 0.80`, `Very Strict = 0.88`
* **Cryptographic & Key Storage Interfaces (`packages/security/`):**
  * `CryptoManager` (`encrypt`, `decrypt` using authenticated AES-256-GCM)
  * `KeyringManager` (OS secure keystore integration and master key derivation)
  * `MemorySanitizer.zeroize` (cryptographic buffer wiping)
* **Biometric Identity Model (`packages/storage/`):**
  * `IdentityStore` (`listIdentities`, `getIdentity`, `saveIdentity`, `deleteIdentity`)
  * Secure shredding and file permissions (strict `0600` on disk)
* **Event Bus (`packages/core/src/events/bus.ts`):**
  * `EventBus.subscribe`, `EventBus.emit`, and canonical `SystemEvent` payloads
* **CLI Contract & Machine-Readable Output:**
  * Exit codes (`0` through `7`) documented in `docs/cli.md`
  * Pure JSON output schema for `--json` on `status`, `doctor`, `security check`, `privacy check`, `camera`, and `identity`

### 3.2 Experimental Surfaces

These surfaces are functionally operational but subject to interface refinement as external hardware and neural model backends are integrated:

* **Vision Backend Plug-In Interfaces (`packages/vision/src/interfaces.ts`):**
  * `IFaceDetector` (`detect(frame: CameraFrame): Promise<FaceDetectionResult[]>`)
  * `IFaceEmbedder` (`embed(frame: CameraFrame, landmarks: FaceLandmarks): Promise<Float32Array>`)
  * `IFaceQualityAnalyzer` (`analyzeQuality(frame, box, landmarks): FaceQualityScore`)
  * `IFaceRecognizer` (`evaluateFrame(embedding, gallery): MatchResult`)
  * `ILivenessDetector` (`evaluateLiveness(frames, landmarksHistory, mode): Promise<LivenessResult>`)
* **Local Daemon IPC Endpoints (`packages/api/src/server.ts`):**
  * REST API endpoints (`/status`, `/presence`, `/lock`, `/hud/stream`)
  * SSE event stream for QuickGlance HUD updates
* **Automation Policy Engine (`packages/automation/`):**
  * `ActionDispatcher` (`lock_screen`, `notify`, `custom_script`, `webhook`)
  * Loopback-only webhook security guards

### 3.3 Internal Surfaces

Do not depend on these modules directly; they are strictly internal to OpenFaceID:

* **Analytical Vision Formulations (`packages/vision/src/detector.ts`, `embedder.ts`):**
  * TypeScript heuristic math (Sobel edge gradients, facial contour centroid projections)
  * These will be augmented or superseded by ONNX / platform neural backends without changing the `IFaceDetector` / `IFaceEmbedder` interfaces.
* **Notification Burst Limiting & State Ring Buffers (`packages/core/src/notifications/`):**
  * In-memory cooldown maps and sliding window timestamps.
* **Camera Capture Process Spawning (`packages/camera/src/CameraManager.ts`):**
  * Child process `ffmpeg` / `imagesnap` arguments, pipe handles, and temporary stdout chunks.

---

## 4. Versioning Strategy

OpenFaceID follows **Semantic Versioning 2.0.0** (`MAJOR.MINOR.PATCH-PRERELEASE`):

```text
MAJOR (v1.0.0):
  Breaking changes to Stable APIs, removal of deprecated endpoints,
  incompatible identity profile storage migrations.

MINOR (v0.3.0):
  Backwards-compatible feature additions, new CLI subcommands,
  new vision backends implementing IFaceDetector/IFaceEmbedder,
  new configuration fields with safe defaults.

PATCH (v0.2.2):
  Backwards-compatible bug fixes, security hardening, performance optimizations,
  documentation updates.

PRE-RELEASE (v0.2.1-rc.1):
  Release candidates undergoing release validation, hardware tests, or CI soak.
```

### 4.1 Authoritative Version Source

The **single source of truth** for the project version is:
* `package.json` (`"version": "0.2.1-rc.1"`)

Runtime modules reference this through `packages/branding/src/index.ts` (`BRANDING.version`) or dynamically read `package.json`. No separate version constants are maintained.

---

## 5. Deprecation Process

When an API or configuration property must be phased out, OpenFaceID adheres to a 3-step deprecation cycle:

1. **Deprecation Announcement (Version N):**
   * The symbol is marked with `@deprecated` in TypeScript docstrings, detailing the rationale, replacement symbol, and targeted removal version.
   * Runtime callers receive a non-crashing warning via `Logger.warn`.
   * The deprecation is recorded under the `Deprecated` section in `CHANGELOG.md`.
2. **Migration Period (Minimum 1 Minor Cycle in 0.x, or until next Major in 1.x):**
   * Both the old and new mechanisms function simultaneously.
   * Automated tests verify backwards compatibility.
3. **Removal (Version N+1 or N+2):**
   * The deprecated symbol is deleted.
   * Callers attempting to use it encounter compile-time type errors.

---

## 6. Deprecation Register

| Feature / Interface | Status | Deprecated In | Removal Target | Replacement / Migration |
| :--- | :--- | :--- | :--- | :--- |
| Distance-metric configuration (`minDistance`) | **REMOVED** | v0.1.0 | v0.2.0 | Replaced by Cosine Similarity (`similarityThreshold >= 0.70`). Higher is closer match. |
| In-core direct platform adapter instantiation | **REMOVED** | v0.2.1-rc.1 | v0.2.1-rc.1 | Decoupled via `NotificationSink` interface; eliminates cyclic dependencies. |
| Unauthenticated Daemon HTTP IPC | **REMOVED** | v0.2.0 | v0.2.0 | Replaced by mandatory cryptographically random Bearer tokens via `openfaceid.token`. |
