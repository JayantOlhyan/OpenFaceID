# OpenFaceID (SightLock)

> **Open-source facial presence detection for desktop systems.**  
> *Local webcam recognition, liveness verification, and privacy-first presence awareness for macOS, Windows, and Linux.*

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20(Verified)%20%7C%20Windows%20(Code)%20%7C%20Linux%20(Code)-brightgreen.svg)](docs/architecture.md#current-platform-hardware-validation-status)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20Local%20%7C%20Zero%20Cloud-success.svg)](PRIVACY.md)
[![Security](https://img.shields.io/badge/security-AES--256--GCM%20%7C%20OS%20Keystore-blueviolet.svg)](SECURITY.md)
[![Node](https://img.shields.io/badge/node-%3E%3D22-informational.svg)](.nvmrc)

---

## 1. What OpenFaceID Is

OpenFaceID (SightLock) is a lightweight, local-first background desktop system that uses an ordinary 2D webcam to detect user presence, verify facial identity against locally enrolled templates, and trigger desktop automations (such as locking the workstation or pausing apps) when the user leaves.

All inference executes **100% locally in volatile RAM**. Raw video frames are analyzed and immediately wiped; only encrypted mathematical feature vectors are persisted at rest.

---

## 2. What OpenFaceID Is NOT

> [!CAUTION]
> **Important Security Boundaries**
> * **NOT an Apple Face ID or Windows Hello Replacement**: OpenFaceID relies on standard 2D optical webcams. It does NOT possess structured-light infrared dot projectors or time-of-flight depth hardware.
> * **NOT an OS Login Mechanism**: OpenFaceID does NOT replace macOS Loginwindow, Windows GINA/Credential Provider, or Linux PAM. It does not solicit, store, or inject operating system passwords.
> * **NOT Hardware-Certified Biometric Security**: It operates at the user desktop session layer for presence awareness, not kernel-level cryptographic authentication.
> * **NOT 100% Spoof-Proof**: While it implements Presentation Attack Detection (PAD), 2D optical recognition cannot guarantee resistance against sophisticated physical masks or advanced replay attacks.

---

## 3. Features

* **Continuous Presence Tracking**: Monitors user presence at power-efficient frame rates (1.5 FPS) with configurable absence timeouts (default: 20s) and grace periods.
* **Fail-Closed State Machine**: Authoritative core state machine instantly drops presence to `UNAUTHORIZED` if multiple faces are visible, liveness checks fail, or the camera disconnects.
* **In-Tree Computer Vision**: Pure TypeScript analytical formulations for face detection (BlazeFace heuristic) and 512D feature embeddings (ArcFace formulation) with zero external binary runtime dependencies.
* **Presentation Attack Detection (PAD)**: Multi-mode anti-spoofing incorporating optical flow micro-motion variance, eye aspect ratio (EAR) blink detection, and active challenge-response.
* **Encrypted Storage**: Identity vectors are stored locally using AES-256-GCM with PBKDF2 key derivation and OS keystore protection.
* **QuickGlance HUD & System Tray**: Compact, non-focus-stealing desktop overlay and menu bar indicator.
* **Developer CLI**: Full command-line interface supporting pure machine-readable `--json` output for automated tooling.

---

## 4. Current Platform Status

| Platform | Code Implementation | Physical Hardware Validation | Packaging Status | Platform Status |
| :--- | :--- | :--- | :--- | :--- |
| **macOS** | Implemented (`MacOSAdapter`) | **Hardware Verified** (Apple Silicon M1 / FaceTime HD) | Generated (Ad-hoc Signed DMG / App Bundle) | **Hardware Verified (Signing Deferred - RB-01)** |
| **Windows** | Implemented (`WindowsAdapter`) | **Hardware Unverified** (Pending Hardware Lab - RB-02) | Scripted (NSIS installer script) | **Hardware Unverified** |
| **Linux** | Implemented (`LinuxAdapter`) | **Hardware Unverified** (Pending Hardware Lab - RB-02) | Generated (.tar.gz / .deb packages) | **Hardware Unverified** |

> [!NOTE]
> OpenFaceID does not claim hardware verification for Windows or Linux until physical lab testing on real camera devices is performed (Blocker `RB-02`). macOS binaries are currently ad-hoc signed pending Apple Developer ID enrollment (Blocker `RB-01`).

---

## 5. Quick Start

### Prerequisites

* **Node.js >= 22.0.0** (native `--experimental-strip-types` support)
* Standard webcam (built-in or USB)

### Installation & Run

```bash
# 1. Clone repository
git clone https://github.com/JayantOlhyan/OpenFaceID.git
cd OpenFaceID

# 2. Install dependencies (dev/build dependencies only)
npm install

# 3. Run doctor to verify environment and camera access
node --experimental-strip-types apps/cli/bin/openfaceid.ts doctor

# 4. Check camera video capture
node --experimental-strip-types apps/cli/bin/openfaceid.ts camera test

# 5. Enroll your face (5-pose guided capture)
node --experimental-strip-types apps/cli/bin/openfaceid.ts identity enroll "MyName"

# 6. Check presence status
node --experimental-strip-types apps/cli/bin/openfaceid.ts status
```

---

## 6. Development

OpenFaceID requires zero runtime npm dependencies. All core and package modules execute on native Node.js APIs.

```bash
# Run unit, integration, and contract tests
npm test

# Run microbenchmarks
npm run test:perf

# Build desktop application bundle
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/development-architecture.md](docs/development-architecture.md) for architectural guidelines and package boundaries.

---

## 7. Architecture

OpenFaceID enforces strict separation between the **Authoritative Core** and **Untrusted Consumers**:

```text
Camera Sensor ──> Vision Pipeline ──> Liveness Check ──> Identity Match
                                                               │
Display Lock <── Automation Engine <── Authoritative Core <────┘
                                              │
                       ┌──────────────────────┴──────────────────────┐
                       ▼                                             ▼
             QuickGlance HUD / Tray                        CLI / External Apps
```

Read the full [docs/architecture.md](docs/architecture.md) for detailed Mermaid diagrams and data flows.

---

## 8. Security

* **Local-Only Keystore**: Encryption master keys are stored in native OS keychains (macOS Keychain, Windows DPAPI, Linux Secret Service).
* **AES-256-GCM Encryption**: Stored identity files are protected with authenticated encryption and written with strict `0600` POSIX permissions.
* **Authenticated IPC**: Local daemon communication binds strictly to `127.0.0.1:41793` and requires a 256-bit Bearer token validated in constant time.
* **Child Process Hardening**: Automation hooks execute with `shell: false` and strict parameterization; remote webhook URLs are blocked.

Read the full [SECURITY.md](SECURITY.md) and [docs/security-architecture.md](docs/security-architecture.md).

---

## 9. Privacy

* **Zero Cloud Egress**: OpenFaceID makes zero external network calls.
* **Zero Telemetry**: No usage metrics or facial embeddings are transmitted externally.
* **Volatile-Only Frames**: Raw camera frames exist only in volatile RAM for the duration of inference (<15ms) and are immediately zeroized.
* **Privacy Pause**: Global hardware camera cut that stops capture and wipes active identity RAM.

Read the full [PRIVACY.md](PRIVACY.md) and [docs/privacy-architecture.md](docs/privacy-architecture.md).

---

## 10. CLI

OpenFaceID includes a developer-friendly CLI with structured exit codes and clean machine-readable JSON output:

```bash
# Machine-readable system health check
openfaceid doctor --json

# Verify zero-telemetry and RAM sanitization
openfaceid privacy check --json

# List enrolled biometric profiles
openfaceid identity list --json
```

Read the full command reference in [docs/cli.md](docs/cli.md).

---

## 11. API

The monorepo exposes modular TypeScript packages:

* `packages/core`: Canonical state machines, presence logic, error models, and configuration.
* `packages/vision`: Plug-in interfaces (`IFaceDetector`, `IFaceEmbedder`) and analytical formulations.
* `packages/camera`: Cross-platform webcam enumeration and frame capture.
* `packages/security`: AES-256-GCM encryption, memory zeroization, and OS keystore bridges.
* `packages/storage`: Encrypted identity profile storage and audit logging.

See [docs/api-stability.md](docs/api-stability.md) for stability tiers and [examples/](examples/) for runnable code samples.

---

## 12. Testing

OpenFaceID maintains a comprehensive automated testing suite:

```bash
# Run all automated tests (unit, integration, contracts, boundaries, examples)
npm test

# Run headless vision benchmark
npm run eval:headless

# Run performance soak test
npm run test:perf
```

See [docs/testing.md](docs/testing.md) and [docs/testing/commands.md](docs/testing/commands.md).

---

## 13. Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

> [!WARNING]
> **Strict Biometric Test Data Rule**: Contributors are strictly prohibited from committing real photographic images, face crops, or personal biometric embeddings to git. Use the synthetic fixtures provided in `examples/demo/fixtures.ts`. See [docs/testing/biometric-data-policy.md](docs/testing/biometric-data-policy.md).

---

## 14. Roadmap

* **Current**: macOS physical hardware validation, developer experience, public API contracts, and contributor readiness.
* **Next**: Windows physical hardware lab validation, Linux V4L2 physical hardware validation, and standardized dataset evaluation.
* **Future**: Pluggable ONNX Runtime neural network backends, platform-native vision framework bridges, and advanced multi-spectral PAD research.

Read the detailed [ROADMAP.md](ROADMAP.md).

---

## 15. Known Limitations

1. **2D Optical Webcam Sensitivity**: Recognition accuracy is subject to lighting conditions (optimal: 150–500 lux; degraded below 35 lux).
2. **Analytical Formulations**: Current BlazeFace and ArcFace modules are in-tree analytical algorithms rather than billion-parameter deep learning models.
3. **Unsigned Desktop Packages**: macOS builds are currently unsigned and require manual Gatekeeper permission bypass.
4. **Secondary Platforms**: Windows and Linux implementations are code-complete but lack physical hardware certification.

---

## 16. License

OpenFaceID is licensed under the [Apache License, Version 2.0](LICENSE).
