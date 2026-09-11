# OpenFaceID — Release Engineering Checklist

This checklist must be executed and approved by a maintainer before cutting any official release of OpenFaceID (SightLock).

---

## Phase 1: Pre-Release Quality & Security Gates

- [ ] **Clean Working Tree**: Ensure `git status` shows zero uncommitted modifications or untracked development artifacts.
- [ ] **Zero Vulnerability Dependency Audit**:
  ```bash
  npm audit --audit-level=low
  ```
  *Requirement: Exactly 0 vulnerabilities reported.*
- [ ] **Automated Test Suite**:
  ```bash
  npm test
  ```
  *Requirement: All 71 tests pass across 36 suites with 0 failures, 0 timeouts, 0 skips.*
- [ ] **CLI Security Gate Audit**:
  ```bash
  npm run cli security check
  ```
  *Requirement: All 6 security gates (Loopback, Telemetry, Keyring, AES-GCM Tamper, Model Integrity, Timing Defense) report PASS.*
- [ ] **CLI Privacy Architecture Audit**:
  ```bash
  npm run cli privacy check
  ```
  *Requirement: All 4 privacy gates (No egress, RAM zeroization, 0 disk frame persistence, Privacy Pause) report PASS.*
- [ ] **CLI Environment Doctor**:
  ```bash
  npm run cli doctor
  ```
  *Requirement: 7/7 system health checks report PASS.*
- [ ] **Model Integrity Signatures**:
  *Requirement: ModelRegistry signatures in `packages/vision/src/registry.ts` match actual SHA-256 hashes of model source code.*

---

## Phase 2: Version Standardization Check

Verify that the target release version (e.g. `0.2.0-rc.1`) is uniform across:
- [ ] Root `package.json` (`"version": "0.2.0-rc.1"`)
- [ ] `packages/branding/src/index.ts` (`BRANDING.version = '0.2.0-rc.1'`)
- [ ] Packaging scripts (`scripts/package-macos.sh`, `scripts/package-linux.sh`, `scripts/package-deb.sh`, `scripts/installer-windows.nsi`)
- [ ] `CHANGELOG.md` entry exists for the target version.

---

## Phase 3: Artifact Generation & Packaging

Run the multi-platform packaging pipeline:
```bash
# 1. Clean previous dist/ artifacts
rm -rf dist/*

# 2. Package macOS bundle & zip
./scripts/package-macos.sh

# 3. Package Linux desktop tarball & debian structure
./scripts/package-linux.sh
./scripts/package-deb.sh

# 4. Generate Windows scripts
./scripts/package-windows.bat # (or verify scripts/installer-windows.nsi)

# 5. Generate Release Manifest and Cryptographic Checksums
npm run package:release
```

---

## Phase 4: Artifact Integrity Verification

- [ ] Inspect `dist/release-manifest.json`:
  - Contains accurate `version`, `buildMetadata`, and `platforms`.
  - Artifact list includes size, format, and platform.
- [ ] Verify `dist/SHA256SUMS`:
  ```bash
  (cd dist && shasum -a 256 -c SHA256SUMS)
  ```
  *Requirement: Every packaged artifact verifies `OK`.*

---

## Phase 5: Tagging & Release Publication

- [ ] Create annotated Git tag:
  ```bash
  git tag -a v0.2.0-rc.1 -m "Release v0.2.0-rc.1: Production hardening, security audit, and release engineering"
  git push origin v0.2.0-rc.1
  ```
- [ ] Draft GitHub Release:
  - Title: `OpenFaceID v0.2.0-rc.1 — Production Hardening & Release Engineering`
  - Paste release notes from `CHANGELOG.md`.
  - Attach all files from `dist/` (`.zip`, `.tar.gz`, `.deb`, `release-manifest.json`, `SHA256SUMS`).
- [ ] Publish Release.
