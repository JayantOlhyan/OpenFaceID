# OpenFaceID Release Blocker Audit (Phase 10)

## 1. Overview & Classification Schema

This document records the final audit of all known release blockers, dependencies, and platform constraints prior to tagging the `0.2.1-rc.1` release candidate.

Blockers are classified under strict criteria:
* **P0 (Catastrophic / Security / Broken Source)**: Fatal issue halting all distribution (0 items).
* **P1 (Major Release Failure)**: Major core defect blocking release candidate tagging (0 items).
* **P2 / WARNING (Operational Limitation)**: Functional limitation clearly disclosed in documentation.
* **DEFERRED (External Hardware / Certificate Dependency)**: Cannot be resolved without third-party credentials or external hardware lab equipment.

---

## 2. Active Blocker Audit

### RB-01: Apple Developer ID Signing & Notarization

* **Identifier**: `RB-01`
* **Classification**: **DEFERRED / WARNING** (Severity: P2 for open-source source release; P1 for Mac App Store / Gatekeeper-seamless binary distribution).
* **Current Reality**:
  * macOS `.app` bundle and `.dmg` installer are created by `scripts/package-macos.sh`.
  * However, binaries are unsigned and not notarized by Apple because no active Apple Developer Program team certificate is provisioned in the build environment.
  * Users launching the application on macOS must right-click and select "Open" or execute `xattr -cr /Applications/OpenFaceID.app` to bypass Gatekeeper quarantine.
* **Impact Analysis**:
  * *Does it prevent source release?* **NO.** The source code compiles, tests, and runs cleanly via Node.js native execution.
  * *Does it prevent binary release?* **PARTIAL.** Unsigned binary artifacts can be distributed as developer release candidates, but NOT as signed consumer products.
  * *Does it prevent platform certification?* **YES (for production consumer packaging).** macOS packaging status is certified as **Verified with warnings (unsigned)**.
  * *Can it be resolved in Phase 10?* **NO.** Requires purchasing an Apple Developer Program subscription and provisioning signing identities.
* **Resolution Criteria**: Import an Apple Developer ID Application Certificate and integrate `codesign --sign "Developer ID Application: ..."` and `xcrun notarytool submit` into CI.

---

### RB-02: Windows & Linux Physical Hardware Lab Validation

* **Identifier**: `RB-02`
* **Classification**: **DEFERRED / WARNING** (Severity: P2 for source release; blocks cross-platform hardware claims).
* **Current Reality**:
  * Windows (`WindowsAdapter`, Media Foundation video capture, DPAPI keystore) and Linux (`LinuxAdapter`, Video4Linux2 video capture, Secret Service keyring) are **fully implemented in source code**.
  * Both platforms build and execute headless unit, contract, and mock tests cleanly in CI runners.
  * However, **no physical optical webcam hardware** has been tested on physical Windows or Linux motherboards by the core maintainer. All physical hardware captures were conducted on macOS (`MAC-01`).
* **Impact Analysis**:
  * *Does it prevent source release?* **NO.** Source code is complete, builds, and passes all automated software suites.
  * *Does it prevent binary release?* **PARTIAL.** Windows NSIS installers and Linux `.deb` / `.tar.gz` packages are built, but labeled `HARDWARE UNVERIFIED`.
  * *Does it prevent platform certification?* **YES.** Windows and Linux remain formally categorized as **HARDWARE UNVERIFIED**.
  * *Can it be resolved in Phase 10?* **NO.** Requires physical lab access to Windows 11 and Linux PC hardware with connected webcams.
* **Resolution Criteria**: Community contributors or physical test lab execution of the protocol in `docs/hardware-testing.md` submitting verified results for Windows and Linux machines.

---

## 3. Summary & Release Gate Decision

| Blocker ID | Description | Severity | Source Release | Binary Release | Production Claims |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-01** | Apple Developer ID Signing | DEFERRED | Allowed | Allowed with warning | Blocked (unsigned build) |
| **RB-02** | Windows/Linux Physical Hardware | DEFERRED | Allowed | Allowed with warning | Blocked (hardware unverified) |

### Formal Decision
Neither blocker halts open-source source release or developer release candidate distribution. Both blockers are transparently disclosed in `README.md`, `ROADMAP.md`, and all release notes.

The release readiness classification is formally set to:  
**PUBLIC RC WITH SIGNING & HARDWARE LIMITATIONS** (or **SOURCE-ONLY RELEASE READY**).
