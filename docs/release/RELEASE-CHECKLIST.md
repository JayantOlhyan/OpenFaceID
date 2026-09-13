# OpenFaceID — Production Release Candidate Checklist

**Canonical Release Candidate**: `v0.2.1-rc.1`  
**Target Architecture**: Cross-Platform Local Facial Presence & Recognition  
**Current Phase**: Phase 10 Final Certification  
**Release Readiness Classification**: **PUBLIC RC WITH SIGNING & HARDWARE LIMITATIONS**  

---

## 1. Release Verification Checklist

| Gate | Verification Command / Target | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Version Synchronized** | `scripts/sync-versions.js` | **DONE** | All 13 packages & scripts set to canonical `0.2.1-rc.1`. |
| **Full Test Regression** | `npm test` | **DONE** | 179/179 tests pass across 44 suites (0 skipped, 0 failed). |
| **Build Reproducibility** | `docs/release/reproducible-build.md` | **DONE** | Clean clone simulation in isolated directory passes 100%. |
| **Security Audit** | `openfaceid security check` | **DONE** | 6/6 security gates pass (loopback, key, encryption, model signatures). |
| **Privacy Audit** | `openfaceid privacy check` | **DONE** | 4/4 privacy gates pass (0 egress, RAM zeroization, 0 disk frames). |
| **Artifacts Generated** | `dist/` packages | **DONE** | macOS `.dmg`, `.zip`, Linux `.tar.gz`, `.deb` built. |
| **Checksums Generated** | `dist/SHA256SUMS`, `dist/release-manifest.json` | **DONE** | SHA-256 generated and verified for all release artifacts. |
| **Supply Chain Audit** | `npm audit` | **DONE** | 0 vulnerabilities, 0 third-party runtime dependencies. |
| **Documentation Link Audit** | `npm run docs:check-links` | **DONE** | 48 relative markdown links checked; 0 broken links. |
| **README Audited** | `README.md` | **DONE** | Honest platform matrix, hardware verification boundaries documented. |
| **Changelog Updated** | `CHANGELOG.md` | **DONE** | Phase 10 release candidate notes and history maintained. |
| **Known Limitations** | `docs/release/release-blockers.md` | **DONE** | RB-01 (Apple signing) & RB-02 (Win/Linux hardware) documented. |
| **Platform Status** | `docs/release/phase-10-baseline.md` | **DONE** | macOS (Hardware Verified); Windows/Linux (Hardware Unverified). |
| **Signing Status** | `docs/release/artifact-manifest.md` | **DONE** | Unsigned / Ad-hoc signed (`codesign -s -`); Apple signing DEFERRED. |
| **Git Hygiene** | `git status` | **DONE** | 0 image dumps, 0 secrets, 0 face crops, 0 private `.env` files. |
| **Release Commit Identified** | `git rev-parse HEAD` | **DONE** | Pinned to final certified Phase 10 commit. |

---

## 2. Platform Certification Status

```
┌──────────────────────────────┬────────────────────────────────────────────────────────┐
│ Platform                     │ Certification Status                                   │
├──────────────────────────────┼────────────────────────────────────────────────────────┤
│ macOS (Apple Silicon arm64)  │ HARDWARE VERIFIED (Camera, Face Detection, Liveness)    │
│ macOS (Intel x86_64)         │ AUTOMATED ONLY / EMULATION VERIFIED                    │
│ Windows 10/11 (x64)          │ CODE IMPLEMENTED / HARDWARE UNVERIFIED (Blocker RB-02)  │
│ Linux (Ubuntu/Debian x86_64) │ CODE IMPLEMENTED / HARDWARE UNVERIFIED (Blocker RB-02)  │
└──────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 3. Installation & Deployment Guidance

### 3.1 macOS Installation (Direct DMG)
1. Download `OpenFaceID-0.2.1-rc.1-arm64.dmg`.
2. Open the DMG and drag `OpenFaceID.app` to `/Applications`.
3. **Gatekeeper Note**: Because Apple Developer ID signing is **DEFERRED** (Blocker RB-01), macOS Gatekeeper will require right-clicking the app and selecting *Open*, or running:
   ```bash
   xattr -dr com.apple.quarantine /Applications/OpenFaceID.app
   ```
4. Launch OpenFaceID. Grant Camera permissions when prompted by macOS.

### 3.2 Linux Installation (.tar.gz / .deb)
1. Download `openfaceid-0.2.1-rc.1-linux-x86_64.tar.gz` or `.deb`.
2. Install via dpkg:
   ```bash
   sudo dpkg -i openfaceid_0.2.1-rc.1_amd64.deb
   ```
3. Or extract tarball:
   ```bash
   tar -xzf openfaceid-0.2.1-rc.1-linux-x86_64.tar.gz
   ./openfaceid/bin/openfaceid doctor
   ```

### 3.3 Source-Only Installation (Recommended for Developers)
```bash
git clone https://github.com/JayantOlhyan/OpenFaceID.git
cd OpenFaceID
npm ci
npm test
npm run cli -- doctor
```

---

## 4. Rollback & Uninstallation Protocol

### 4.1 Clean Uninstallation
- **macOS**:
  ```bash
  rm -rf /Applications/OpenFaceID.app
  rm -rf ~/.openfaceid
  ```
- **Linux**:
  ```bash
  sudo dpkg -r openfaceid
  rm -rf ~/.openfaceid
  ```

### 4.2 Biometric Identity Shredding (Prior to Uninstall)
To securely overwrite enrolled face templates with zeros prior to uninstallation:
```bash
openfaceid identity list
openfaceid identity delete <id>
```

---

## 5. Vulnerability Disclosure & Reporting

Security vulnerabilities must be reported directly to the maintainer via GitHub Security Advisories or by emailing `jayantolhyan@gmail.com`. Do NOT open public issues for suspected security vulnerabilities.
