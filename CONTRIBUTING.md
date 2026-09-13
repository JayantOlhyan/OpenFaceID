# Contributing to OpenFaceID (SightLock)

Thank you for contributing to **OpenFaceID**! We welcome contributions from developers, computer vision researchers, and security auditors across all platforms.

---

## 1. Core Engineering Invariants

Before writing code, please review the non-negotiable architectural principles that govern this repository:

1. **Zero External Runtime Dependencies**:
   * Production packages must rely **strictly** on Node.js standard libraries (`crypto`, `fs`, `path`, `os`, `http`, `child_process`).
   * Do **NOT** add npm runtime dependencies for routing, cryptography, utility functions, or math.
2. **Privacy First & Local-Only**:
   * Zero telemetry. Zero external cloud egress.
   * Raw webcam frames must reside solely in volatile RAM buffers and be immediately zeroized via `MemorySanitizer.zeroizeBuffer`.
   * All biometric identity vectors stored on disk must be encrypted with AES-256-GCM (mode `0600`).
3. **Technical Truth Over Marketing**:
   * Never claim a platform, camera, or feature works unless backed by physical hardware evidence.
   * Code implemented without physical verification must be labeled `HARDWARE UNVERIFIED` or `CODE ONLY`.
4. **Strict Biometric Data Rule (CRITICAL)**:
   * **NEVER commit real camera captures, face photographs, face crops, or personal biometric vectors to git.**
   * For tests and examples, use the synthetic, non-biometric fixtures provided in `examples/demo/fixtures.ts`. See [docs/testing/biometric-data-policy.md](docs/testing/biometric-data-policy.md).
5. **Architectural Boundaries**:
   * Packages must never import from `apps/` or UI layers.
   * `packages/core` must never import downstream packages (`vision`, `camera`, `presence`, `platform`, `api`).
   * These boundaries are verified automatically by `tests/unit/architecture_boundaries.test.ts`.

---

## 2. Contributor Quick Start

### Prerequisites

* **Node.js**: `>= 22.0.0` (native `--experimental-strip-types` and `node:test`).
* **npm**: `>= 10.0.0`.
* **Git**.

### Setup & Verification

```bash
# 1. Clone repository
git clone https://github.com/JayantOlhyan/OpenFaceID.git
cd OpenFaceID

# 2. Install development tooling
npm install

# 3. Run full automated test suite
npm test

# 4. Verify architectural boundary invariants
node --experimental-strip-types --test tests/unit/architecture_boundaries.test.ts

# 5. Run system diagnostics
node --experimental-strip-types apps/cli/bin/openfaceid.ts doctor --dev

# 6. Build desktop distribution bundle
npm run build
```

---

## 3. Monorepo Structure

```text
OpenFaceID/
├── apps/
│   ├── cli/                     # CLI binary (openfaceid status/doctor/camera)
│   └── desktop/                 # Desktop daemon, System Tray, QuickGlance HUD
├── packages/
│   ├── api/                     # Localhost REST & SSE daemon server (127.0.0.1:41793)
│   ├── automation/              # ActionDispatcher (screen lock, loopback webhooks)
│   ├── branding/                # Centralized product metadata and version
│   ├── camera/                  # CameraManager, FrameSampler, hardware capture
│   ├── core/                    # State machines, canonical FSM, config, logger, errors
│   ├── platform/                # MacOSAdapter, WindowsAdapter, LinuxAdapter
│   ├── presence/                # PresenceTracker, absence timers, grace period
│   ├── security/                # AES-256-GCM crypto, memory zeroizer, keyring bridge
│   ├── storage/                 # Encrypted IdentityStore, ActivityLog, ConfigStore
│   └── vision/                  # BlazeFace heuristic, ArcFace 512D formulation
├── examples/                    # Developer API examples (runnable via tests)
├── tests/                       # Unit, integration, security, evaluation, and contract tests
└── docs/                        # Specifications, API guides, and architecture documentation
```

---

## 4. Development Workflow & Standards

### Branching & Commits

* Work on descriptive feature branches: `git checkout -b feat/my-improvement` or `fix/issue-description`.
* Write conventional commits: `feat(camera): add frame rate throttle`, `fix(storage): enforce mode 0600 on new profiles`, `docs(api): clarify threshold semantics`.

### Adding Tests

* Every new feature or bugfix must include an automated test under `tests/unit/` or `tests/integration/`.
* Tests must run using Node.js native test runner:
  ```bash
  node --experimental-strip-types --test tests/unit/my_feature.test.ts
  ```
* Ensure no tests are left skipped (`t.skip`) or failing.

---

## 5. Pull Request Checklist

Before submitting a pull request, verify:

- [ ] `npm test` passes completely (all suites green).
- [ ] `node --experimental-strip-types --test tests/unit/architecture_boundaries.test.ts` passes with zero violations.
- [ ] `node --experimental-strip-types --test tests/unit/api_contracts.test.ts` passes with zero contract regressions.
- [ ] `npm run build` succeeds without compilation errors.
- [ ] No external npm packages were added to `dependencies` in `package.json`.
- [ ] **NO photographic face images, real face crops, or personal embeddings are included in the diff.**
- [ ] File permissions on sensitive files remain `0600` (files) and `0700` (directories).
- [ ] Any child process executions enforce `shell: false` and array parameters.
- [ ] Documentation has been updated to reflect any API, CLI, or configuration changes.

---

## 6. Security Vulnerability Reporting

If you identify a security vulnerability, side-channel leak, or liveness bypass:

* **DO NOT file a public GitHub issue.**
* Submit a report via [GitHub Private Security Advisories](https://github.com/JayantOlhyan/OpenFaceID/security/advisories) or review our [SECURITY.md](SECURITY.md) for reporting procedures.
