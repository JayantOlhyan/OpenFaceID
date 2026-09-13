# OpenFaceID Release Engineering Checklist

## 1. Overview

This checklist must be executed and signed off by the maintainer before tagging or publishing any release candidate or production release of OpenFaceID.

---

## 2. Pre-Release Verification Gates

### Gate 1: Automated Test Suites
- [ ] `npm test` passes with 0 failures across all unit, evaluation, and performance suites.
- [ ] `node --experimental-strip-types --test tests/unit/architecture_boundaries.test.ts` passes (0 illegal imports).
- [ ] `node --experimental-strip-types --test tests/unit/api_contracts.test.ts` passes (all contracts intact).
- [ ] `node --experimental-strip-types --test tests/unit/examples.test.ts` passes (all 8 developer examples run successfully).

### Gate 2: Security & Privacy Invariants
- [ ] `openfaceid security check` passes all 6 security gates.
- [ ] `openfaceid privacy check` passes all 4 privacy gates.
- [ ] `openfaceid doctor --dev` reports clean environment without warnings.
- [ ] Git tree audited for accidental biometric data:
  ```bash
  git status
  git diff --stat
  ```
- [ ] Verified that **ZERO photographic face images, crops, embeddings, or keys** exist in git history.

### Gate 3: Dependency & Supply Chain Audit
- [ ] Verified `package.json` contains **zero runtime dependencies** (`dependencies: {}`).
- [ ] `npm audit` reports 0 vulnerabilities in development tooling.
- [ ] Lockfile consistency verified (`package-lock.json`).
- [ ] License audit: `LICENSE` (Apache-2.0) present and headers verified.

### Gate 4: Packaging & Artifacts
- [ ] Version string in `package.json`, `packages/branding/src/index.ts`, and `apps/desktop/index.html` match target release tag.
- [ ] Run release packaging script:
  ```bash
  npm run package:release
  ```
- [ ] Verify SHA-256 checksums generated for all distributable binaries (`.dmg`, `.zip`, `.deb`, `.exe`).
- [ ] Document signature status explicitly: if macOS build is unsigned, state **UNSIGNED / NOT NOTARIZED**.

### Gate 5: Documentation & Changelog
- [ ] `CHANGELOG.md` updated with release notes under target version.
- [ ] Release notes file created under `docs/releases/vX.Y.Z.md`.
- [ ] Platform verification table in `README.md` reflects actual current hardware evidence.
- [ ] Roadmap updated to reflect completed milestones and next priorities.

---

## 3. Git Tagging & Release Publication

Once all gates pass:

```bash
# Tag the release commit
git tag -a v0.2.1-rc.1 -m "Release v0.2.1-rc.1: Open-Source Ecosystem & Contributor Readiness"

# Push tag to GitHub
git push origin v0.2.1-rc.1
```
