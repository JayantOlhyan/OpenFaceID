# OpenFaceID macOS Release Artifact Manifest

## 1. Release Identification
* **Application**: OpenFaceID (SightLock) Desktop
* **Version**: `0.2.1-rc.1`
* **Release Channel**: Public Release Candidate (macOS Native AVFoundation Pipeline)
* **Date**: September 13, 2026
* **Host Build Environment**: macOS 15.0 / Darwin 24.x (Apple Silicon arm64)
* **Designated Requirement**: `identifier "com.jayantolhyan.openfaceid"`

---

## 2. Release Artifacts

| Filename | Version | Architecture | Size | SHA-256 Checksum | Signed? | Notarized? | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`OpenFaceID-0.2.1-rc.1-arm64.dmg`** | `0.2.1-rc.1` | Apple Silicon (`arm64`) | 37 MB | `6f03dd042c9618e86b99ecd45b4a371df3663f2cf3197ca4f0fcd3affa5a11f9` | AD-HOC (`-`) | DEFERRED (RB-01) | **PRODUCTION CANDIDATE READY** |
| **`OpenFaceID-0.2.1-rc.1-macos.zip`** | `0.2.1-rc.1` | Apple Silicon (`arm64`) | 37 MB | `38bea587474fb3b004114d77f760011f0d3fa5fa7105de274268605644de58ee` | AD-HOC (`-`) | DEFERRED (RB-01) | **PRODUCTION CANDIDATE READY** |
| **`OpenFaceID.app`** (Bundle) | `0.2.1-rc.1` | Apple Silicon (`arm64`) | 120 MB | N/A (Directory Bundle) | AD-HOC (`-`) | DEFERRED (RB-01) | **STANDALONE VERIFIED** |

---

## 3. Cryptographic Signature & Notarization Disclosure

* **Code Signing Status**: **AD-HOC LOCAL SIGNATURE**.
  - Signature Command: `codesign --force --deep --sign - dist/macos/OpenFaceID.app`
  - Verification: `codesign --verify --deep --strict --verbose=2 dist/macos/OpenFaceID.app`
  - Result: `valid on disk; satisfies its Designated Requirement`
* **Apple Developer ID Certificate**: **DEFERRED (RB-01)**.
  - The project does not possess a paid Apple Developer ID certificate. No fraudulent signature claims are made.
* **Apple Notarization (`notarytool`)**: **NOT NOTARIZED / DEFERRED**.
  - Without a paid Apple Developer ID, Apple's notary service cannot issue a notarization ticket.
* **First Launch Gatekeeper Guidance**:
  - Double-clicking the unsigned application on macOS Sequoia may trigger a Gatekeeper notice ("OpenFaceID can't be opened because Apple cannot check it for malicious software").
  - Users must right-click (Control-click) `OpenFaceID.app` in `/Applications` and choose **Open**, or navigate to **System Settings &rarr; Privacy & Security** and click **Open Anyway**.

---

## 4. Checksum Verification

To verify the integrity of the downloaded DMG artifact on your Mac:
```bash
shasum -a 256 OpenFaceID-0.2.1-rc.1-arm64.dmg
```
Expected output:
```
6f03dd042c9618e86b99ecd45b4a371df3663f2cf3197ca4f0fcd3affa5a11f9  OpenFaceID-0.2.1-rc.1-arm64.dmg
```
