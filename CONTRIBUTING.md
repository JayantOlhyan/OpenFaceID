# Contributing to OpenFaceID (SightLock)

Thank you for your interest in contributing to **OpenFaceID**! We welcome contributions from developers, computer vision researchers, and security auditors across all platforms.

---

## 1. Core Engineering Principles

Before opening a pull request or submitting code, please understand the non-negotiable architectural principles that govern this project:

1. **Zero External Runtime Dependencies**:
   - The runtime engine must rely **strictly** on Node.js built-in standard libraries (`node:crypto`, `node:fs`, `node:path`, `node:os`, `node:http`, `node:child_process`).
   - Do **NOT** add npm dependencies for HTTP routing, cryptography, utility functions, or math.
   - External dependencies introduce supply-chain vulnerabilities, bloat, and cross-platform installation fragility.
2. **Privacy First & Local-Only**:
   - Zero telemetry. Zero analytics. Zero remote pings.
   - Raw webcam frames must reside solely in volatile RAM buffers and be immediately zeroized after processing.
   - All biometric identity vectors stored on disk must be encrypted with AES-256-GCM.
3. **Brutal Honesty**:
   - Never claim a platform, camera, or feature works unless it has been physically verified.
   - If code is written but unverified on a physical OS kernel, mark it as `CODE_IMPLEMENTED` or `PARTIALLY VERIFIED`.
4. **Non-Destructive Security Boundary**:
   - Never store or inject user passwords in plaintext.
   - If OpenFaceID fails, system native authentication must remain intact.

---

## 2. Monorepo Structure

```
openfaceid/
├── apps/
│   ├── desktop/          # Desktop runtime daemon, native tray, HUD, and local UI
│   └── cli/              # Command-line interface tool (`openfaceid`)
├── packages/
│   ├── branding/         # Centralized product metadata, identifiers, and version
│   ├── core/             # State machines, EventBus, Logger, Config, Errors
│   ├── camera/           # CameraManager, FrameSampler, cross-platform hardware probes
│   ├── vision/           # BlazeFace detector, ArcFace embedder, Liveness PAD, ModelRegistry
│   ├── security/         # AES-256-GCM crypto, KeyringManager, MemorySanitizer
│   ├── storage/          # Encrypted biometric IdentityStore, ActivityLog, ConfigStore
│   ├── platform/         # MacOSAdapter, WindowsAdapter, LinuxAdapter
│   ├── presence/         # PresenceTracker, Leave/Grace period timing
│   ├── automation/       # ActionDispatcher, lockscreen triggers
│   └── api/              # Local loopback HTTP API & IPC server
├── tests/
│   └── unit/             # Automated test suites executed via node:test
├── scripts/              # Packaging, installer scripts, release manifest generator
└── docs/                 # Architectural specifications, threat model, verification reports
```

---

## 3. Development Environment & Testing

### Prerequisites
- **Node.js**: v22.0.0 or newer (uses `--experimental-strip-types` and `node:test`).
- **npm**: v10.0.0 or newer.

### Getting Started
```bash
# Clone repository
git clone https://github.com/JayantOlhyan/OpenFaceID.git
cd OpenFaceID

# Install dev dependencies (only typescript is installed as devDependency)
npm install

# Run automated test suite
npm test

# Run CLI locally
npm run cli doctor
npm run cli security check
npm run cli privacy check

# Run desktop daemon locally
npm run dev:desktop
```

### Adding Tests
- Every bugfix and feature must include automated unit tests under `tests/unit/`.
- Tests use Node's native test runner (`node:test`, `node:assert/strict`).
- Run `npm test` to verify all tests pass before submitting your PR.

---

## 4. Pull Request Checklist

When submitting a pull request, ensure:
- [ ] `npm test` passes with 0 failures and 0 skipped tests.
- [ ] `npm run cli doctor` passes all health checks.
- [ ] `npm run cli security check` passes all 6 security gates.
- [ ] No external npm packages were added to `dependencies`.
- [ ] No raw file paths or hardcoded developer directories exist in the diff.
- [ ] File permissions on sensitive paths follow `0600` (files) and `0700` (directories).
- [ ] Any child process executions use `execFile` or `execFileSync` with argument arrays.

---

## 5. Security Vulnerability Reporting

If you discover a security vulnerability or bypass in OpenFaceID:
- **Do NOT** open a public GitHub issue.
- Email the maintainers directly at `security@openfaceid.org` or report via [GitHub Security Advisories](https://github.com/JayantOlhyan/OpenFaceID/security/advisories).
- We follow responsible disclosure practices and respond within 48 hours.
