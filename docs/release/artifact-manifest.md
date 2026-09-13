# OpenFaceID Release Artifact Manifest

## 1. Release Metadata

* **Release Version**: `0.2.1-rc.1`
* **Release Phase**: Phase 10 (Production Release Candidate & Final Certification)
* **Release Date**: September 13, 2026
* **Build Commit**: `267081b` (or target release tag commit)
* **License**: Apache-2.0

---

## 2. Release Artifacts Table

| Artifact Filename | Platform | Architecture | Format | Size (Bytes) | SHA-256 Checksum | Validation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`OpenFaceID-0.2.1-rc.1-arm64.dmg`** | macOS | Apple Silicon (arm64) | Disk Image (`.dmg`) | 18,667 | `4e3231a7f5acff3abd21bc2fff11bac94fb22a7c30ec7058fc52fde591c14b77` | Verified with warnings (Unsigned build, Gatekeeper bypass required) |
| **`OpenFaceID-0.2.1-rc.1-macos.zip`** | macOS | Universal (arm64 / x86_64) | Zip Archive (`.zip`) | 2,049 | `9482330323fb491d2a0e6b0cb72a67981dec266914c99aa5d3915420d190ca07` | Verified with warnings (Unsigned bundle) |
| **`openfaceid-0.2.1-rc.1-linux-x86_64.tar.gz`** | Linux | x86_64 | Tarball (`.tar.gz`) | 1,425 | `e851c5ebc8c23eeb1f67aab6cd7eaacc46fd926f218d122517f49f3671b9642a` | Software build verified; Hardware unverified |
| **`dist/deb_build/openfaceid_0.2.1-rc.1_amd64`** | Linux (Debian/Ubuntu) | amd64 | Debian Package Root | N/A | Generated on Linux hosts with `dpkg-deb` | Software build verified; Hardware unverified |
| **`installer-windows.nsi`** | Windows | x64 | NSIS Installer Script | 2,452 | Source script in `scripts/` | Software build verified; Hardware unverified |

---

## 3. Cryptographic Signature Status

* **macOS Gatekeeper Signing**: **DEFERRED (RB-01)**. Binaries are distributed unsigned as developer release candidate packages.
* **Windows Authenticode Signing**: **DEFERRED**. Installer executable is unsigned.
* **Integrity Guarantee**: Built bundles are verified via cryptographically secure SHA-256 checksums recorded above and in `dist/SHA256SUMS`.
