# Changelog

All notable changes to OpenFaceID (SightLock) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-09-13

### Phase 5: Productization, UX, Enrollment, Presence Experience & Reliability

#### Authoritative Architecture & Canonical State
- **Canonical State Machine (`packages/core/src/state/canonical.ts`)**: Established single source of truth for presence, camera, recognition, liveness, and privacy states. UI, HUD, Tray, and CLI act strictly as state consumers.
- **Fail-Closed Multiple-Face Policy**: Enforced immediate transition to `PRESENCE_AMBIGUOUS` whenever `face_count >= 2`. Zero authorization bypass on ambiguous or secondary faces.
- **Session-Bound Presence Lifecycle**: Integrated active session tracking (`authorized_at`, `last_confirmed_at`, `expiration_at`) in `packages/presence/src/PresenceTracker.ts`. System sleep automatically revokes presence sessions via `resetOnWake()`.
- **Expanded Canonical Error System**: Standardized machine-readable error codes in `packages/core/src/errors.ts` with technical codes, human-readable descriptions, and retryability flags.

#### Desktop Product Experience & Accessible UI
- **First-Run Onboarding Wizard**: 3-step interactive onboarding (Welcome, Privacy Disclosure, Camera Setup & Permissions) for fresh installations.
- **Guided 5-Pose Enrollment**: Interactive multi-pose flow (Center, Slight Left, Slight Right, Tilt Up, Tilt Down) with real-time pose guidance, quality evaluation, and liveness verification.
- **Security Center**: Live audits for ML model integrity (SHA-256), AES-256-GCM identity encryption, IPC loopback token authentication, network egress, and camera privacy.
- **Privacy Center & Controls**: Immediate camera pause kill-switch, secure cryptographic identity deletion (file shredding and memory zeroization), and live biometric storage metadata.
- **Settings & Calibration Presets**: Calibration presets (`Balanced` @ 0.72, `Strict` @ 0.65, `Very Strict` @ 0.58) and camera resolution/FPS bounds.
- **Quick Glance HUD & Tray**: Authoritative quick-glance status HUD with explicit text reasons and production tray menu structure with pause/resume and diagnostics shortcuts.
- **Accessibility Compliance**: Full keyboard navigation, visible focus indicators, WCAG AA contrast ratios, semantic HTML, and multi-attribute status indicators (icons + text).

#### Reliability, Diagnostics & Security
- **Sanitized Diagnostic Export**: Integrated automated sensitive data scanner scrubbing 512D biometric vectors, base64 frame buffers, tokens, keys, and credentials before export.
- **Child Process Security Hardening**: Completely eliminated raw `exec` and `shell_command` execution in `ActionDispatcher.ts`.
- **Zero Remote Network Egress Guarantee**: Enforced strict loopback-only validation (`127.0.0.1`/`localhost`) for automation webhooks, rejecting remote outbound requests.
- **Cryptographic Model Verification**: Hardened `ModelRegistry.verifyIntegrity()` to strictly assert mathematical equality against authoritative SHA-256 file digests.
- **Master Project Governance**: Generated Master Project Inventory (`docs/project-inventory.md`), Master Engineering Backlog (`docs/engineering-backlog.md`), Master Status System (`docs/project-status.md`), Master Test Matrix (`docs/master-test-matrix.md`), Master Security Matrix (`docs/security-status.md`), and Master Project Scorecard (`docs/project-scorecard.md`).
- **Automated Testing & Soak Verification**: Test suite expanded to 86 passing tests across 39 suites. 1,000-cycle soak test verified 0 unhandled rejections, 0 memory leaks, and complete memory zeroization on shutdown.

---

## [0.2.0-rc.1] - 2026-09-11

### Phase 4: Production Hardening, Cross-Platform Validation & Release Engineering

#### Security Hardening & Threat Defense
- **STRIDE Threat Model Expansion**: Documented 10 threat actors (T1–T10) across 3 distinct trust boundaries (Trusted Kernel/OS, Partially Trusted User Space, Untrusted Network/Attackers).
- **Cryptographic Model Integrity**: Implemented `ModelRegistry` in `packages/vision/src/registry.ts` with strict SHA-256 integrity verification. Tampered or corrupted model weights now trigger `MODEL_INTEGRITY_FAILURE` at boot.
- **IPC Timing Attack Defense**: Added `CryptoManager.verifyTimingSafe()` using constant-time `crypto.timingSafeEqual` comparison, eliminating byte-by-byte timing leak vulnerabilities on bearer tokens.
- **Route Authorization Audit & Fuzzing**: Audited all HTTP IPC endpoints; enforced strict bearer authorization on sensitive paths. Created comprehensive fuzzing suite (`tests/unit/ipc_fuzzing.test.ts`) covering malformed JSON, prototype pollution, oversized payloads (1MB limit), and path traversal.
- **Filesystem Traversal & Symlink Guards**: Hardened `IdentityStore.getSafeFilePath()` to validate IDs against `^[a-zA-Z0-9_-]{1,64}$` and verify realpath resolution remains inside `~/.openfaceid`, preventing directory traversal and symlink attacks.
- **Child Process Security**: Completely eliminated shell command string execution (`exec`, `execSync`). Refactored all platform and camera operations (`MacOSAdapter`, `LinuxAdapter`, `WindowsAdapter`, `CameraManager`) to use injection-safe `execFile` and `execFileSync` with argument arrays.
- **Supply-Chain Zero-Vulnerability Win**: Standardized monorepo workspaces, pinned dependencies in `package-lock.json`, and confirmed `npm audit` reports **0 vulnerabilities** across 26 audited packages.

#### Diagnostics & Health Verification
- **`openfaceid security check`**: CLI command verifying 6 security gates: loopback binding, absence of telemetry, master key permissions, AES-256-GCM tamper rejection, model signatures, and timing attack resistance.
- **`openfaceid privacy check`**: CLI command verifying zero outbound sockets, volatile RAM buffer zeroization, zero disk frame persistence, and privacy pause operation.
- **`openfaceid doctor`**: Complete system health check verifying platform, Node.js version (>= 22 required), camera access permissions, hardware availability, keystore accessibility, and configuration directory permissions.
- **`openfaceid export-diagnostics`**: Redacted JSON diagnostics export removing all secret keys, passwords, and biometric vectors.

#### Release Engineering & Packaging
- **macOS**: Built `dist/OpenFaceID.app` application bundle with `Info.plist`, `dist/OpenFaceID-0.2.0-rc.1-macos.zip`, and DMG support.
- **Windows**: Created NSIS installer script `scripts/installer-windows.nsi` and `OpenFaceID.cmd` standalone launcher.
- **Linux**: Created Debian packaging script `scripts/package-deb.sh` producing `.deb` packages with systemd user service and `.desktop` entry.
- **Release Manifest**: Implemented `scripts/generate-release-manifest.js` creating `dist/release-manifest.json` and cryptographic `dist/SHA256SUMS`.

---

## [0.1.0] - 2026-09-10

### Phase 3: Native Desktop Runtime & Multi-Platform Integration
- Real camera hardware discovery and video frame capture via AVFoundation/Video4Linux.
- Desktop background daemon running authoritative state machine (`DesktopEngine`).
- System tray status indicator (`DesktopTrayManager`) and Quick Glance HUD (`QuickGlanceHud`).
- Autostart integration across macOS LaunchAgents, Linux XDG autostart, and Windows Registry.
- Screen locking via platform native adapters (`MacOSAdapter`, `LinuxAdapter`, `WindowsAdapter`).
- Presence tracking with leave timeout and absence grace periods.

---

## [0.0.2] - 2026-09-08

### Phase 2: Computer Vision Pipeline & Liveness Detection
- BlazeFace multi-scale single-shot detector with 896 anchor candidates and IoU Non-Maximum Suppression (NMS).
- ArcFace 512-dimensional hyperspherical feature embedding with strict L2-normalization.
- 8-state presentation attack detection (PAD) state machine defending against printed photos and replay attacks.
- 5-pose guided biometric enrollment (center, look left, look right, look up, smile).
- Face quality analyzer evaluating illumination, bounding box sizing, and pose centrality.

---

## [0.0.1] - 2026-09-01

### Phase 1: Architecture, Core State Machines & Encryption Foundation
- Monorepo structure with 11 packages.
- Core FSMs for recognition, security, and presence.
- AES-256-GCM authenticated encryption and PBKDF2 key derivation.
- File shredding with multi-pass zeroization on deletion.
- In-memory zeroization of sensitive arrays via `MemorySanitizer`.
- Activity log and configuration storage.
