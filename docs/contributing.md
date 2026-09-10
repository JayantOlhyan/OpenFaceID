# Contributing to OpenFaceID (SightLock)

We welcome contributions from developers, security researchers, computer vision engineers, and open-source enthusiasts!

---

## 1. Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/JayantOlhyan/OpenFaceID.git
   cd OpenFaceID
   ```

2. **Run Tests**:
   ```bash
   npm test
   ```

3. **Launch Desktop UI in Dev Mode**:
   ```bash
   npm run dev:desktop
   ```

4. **Execute CLI**:
   ```bash
   npm run cli status
   ```

---

## 2. Monorepo Organization

- `packages/branding`: Centralized product names, taglines, identifiers.
- `packages/core`: Typed configuration, state machines, event bus, logger.
- `packages/platform`: Platform adapters (`MacOSAdapter`, `WindowsAdapter`, `LinuxAdapter`).
- `packages/camera`: Device enumeration, frame sampling, dynamic FPS throttling.
- `packages/vision`: BlazeFace detector, quality analyzer, ArcFace embedder, recognizer, liveness.
- `packages/presence`: Presence tracker and leave timeouts.
- `packages/security`: AES-256-GCM encryption, keyring bridge, memory zeroizer.
- `packages/storage`: Encrypted identity store, activity log, config store.
- `packages/automation`: Policy engine and action dispatcher.
- `packages/api`: Localhost REST & SSE server.
- `apps/desktop`: Desktop UI shell and Quick Glance HUD.
- `apps/cli`: Command-line executable.

---

## 3. Pull Request Guidelines

1. **Keep Platform Logic Isolated**: Never scatter `if (process.platform === 'darwin')` in core packages. Platform behavior belongs strictly in `packages/platform`.
2. **Preserve Privacy & Zero-Cloud Principles**: Do not introduce remote telemetry, tracking, or cloud biometric APIs.
3. **RAM-Only Processing**: Always ensure camera frame buffers are zeroized with `frame.zeroize()` when processing finishes.
4. **Include Tests**: Add unit tests in `tests/unit/` for all new features and bug fixes.
5. **Format & Typecheck**: Ensure `npm test` passes with zero failures.
