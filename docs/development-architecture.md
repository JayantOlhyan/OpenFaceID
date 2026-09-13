# OpenFaceID Development Architecture & Package Dependency Guide

## 1. Overview

This document defines the structural organization of the OpenFaceID monorepo, where new code and tests should be placed, and the architectural invariants enforced by automated static analysis.

---

## 2. Directory Layout & Responsibilities

```text
OpenFaceID/
├── apps/
│   ├── cli/                     # CLI binary and subcommands (bin/openfaceid.ts)
│   └── desktop/                 # Electron/desktop wrapper, system tray, daemon process
├── packages/
│   ├── api/                     # Localhost REST & SSE daemon server (127.0.0.1:41793)
│   ├── automation/              # ActionDispatcher (screen lock, local webhook dispatch)
│   ├── branding/                # Centralized project branding, version, and metadata
│   ├── camera/                  # Physical camera enumeration, capture, and frame sampling
│   ├── core/                    # State machines, canonical FSM, config, logger, error types
│   ├── platform/                # OS-specific adapters (MacOSAdapter, WindowsAdapter, LinuxAdapter)
│   ├── presence/                # PresenceTracker, absence timers, and grace period logic
│   ├── security/                # AES-256-GCM crypto, memory zeroizer, keyring integration
│   ├── storage/                 # Encrypted IdentityStore, ActivityLog, ConfigStore
│   └── vision/                  # BlazeFace detector, ArcFace embedder, quality & liveness
├── examples/                    # Developer API examples (runnable via tests)
├── tests/
│   ├── unit/                    # Unit and component isolation tests
│   ├── integration/             # Multi-package workflow and IPC tests
│   ├── performance/             # Microbenchmarks, soak tests, and resource tests
│   ├── evaluation/              # Biometric accuracy, FAR/FRR, APCER/BPCER benchmarks
│   ├── security/                # Security regression, permissions, and fail-closed tests
│   └── hardware/                # Physical camera discovery and capture tests
├── docs/                        # Engineering, security, privacy, and API documentation
└── scripts/                     # Packaging, validation, and release automation scripts
```

---

## 3. Where to Add Code

| Type of Change | Target Location | Relevant Files |
| :--- | :--- | :--- |
| **New CLI command or flag** | `apps/cli/bin/openfaceid.ts` | Update CLI router, add command handler, add `--json` schema |
| **Core state or lifecycle logic** | `packages/core/src/` | `state/canonical.ts`, `state/presence.ts`, `errors.ts` |
| **New config parameter** | `packages/core/src/config/` | `types.ts`, `defaults.ts`, `validator.ts` |
| **Vision or model backend** | `packages/vision/src/` | Implement `IFaceDetector` or `IFaceEmbedder` in `interfaces.ts` |
| **Hardware camera access** | `packages/camera/src/` | `CameraManager.ts`, `FrameSampler.ts` |
| **OS-level automation or hook** | `packages/platform/src/` | `MacOSAdapter.ts`, `WindowsAdapter.ts`, `LinuxAdapter.ts` |
| **Encryption or key storage** | `packages/security/src/` | `crypto.ts`, `zeroize.ts`, `keyring.ts` |
| **Identity storage or file I/O** | `packages/storage/src/` | `IdentityStore.ts`, `ConfigStore.ts` |
| **Daemon HTTP/SSE endpoints** | `packages/api/src/` | `server.ts` |

---

## 4. Package Dependency Direction & Strict Invariants

OpenFaceID enforces strict layered dependency direction:

```text
[UI / Apps Layer] (apps/desktop, apps/cli)
       │
       ▼
[IPC & API] (packages/api)
       │
       ▼
[Daemon / Automation] (apps/desktop/src/daemon.ts, packages/automation)
       │
       ▼
[Core State & Domain] (packages/core, packages/presence)
       │
       ▼
[Vision & Camera] (packages/vision, packages/camera)
       │
       ▼
[Platform, Storage & Security] (packages/platform, packages/storage, packages/security)
       │
       ▼
[Branding] (packages/branding)
```

### 4.1 Prohibited Dependencies

The following dependency patterns are strictly prohibited and will fail automated CI tests:

1. **`packages/*` MUST NEVER import from `apps/*`**: Library packages cannot depend on application shells, UI markup, or CLI binaries.
2. **`packages/*` MUST NEVER import React or UI frameworks**: Biometric and security libraries must remain purely headless.
3. **`packages/core` MUST NEVER import downstream domain packages**: `packages/core` cannot import `vision`, `camera`, `presence`, `security`, `storage`, `automation`, `api`, or `platform`. It provides foundational types and contracts only.
4. **`packages/security` MUST NEVER import UI, vision, or presence**: Cryptographic and memory wiping primitives remain completely decoupled.
5. **`packages/vision` MUST NEVER import notifications or API**: Computer vision inference is an isolated mathematical pipeline.
6. **Zero runtime npm dependencies**: All production packages must execute using native Node.js APIs (`crypto`, `fs`, `path`, `os`, `http`, `child_process`).

---

## 5. Automated Architectural Enforcement

These rules are enforced automatically by `tests/unit/architecture_boundaries.test.ts`.

To verify compliance locally:

```bash
node --experimental-strip-types --test tests/unit/architecture_boundaries.test.ts
```

If an import violates boundaries, the test reports the offending source file, imported path, and the rule violated.
