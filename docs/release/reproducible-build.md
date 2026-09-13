# OpenFaceID Reproducible Build Specification

## 1. Overview & Build Philosophy

OpenFaceID is engineered for **100% deterministic, reproducible builds** without requiring multi-gigabyte external build chains, heavy native compilation steps, or opaque third-party binary downloads.

The core desktop application and CLI run natively on Node.js standard libraries using TypeScript type stripping (`--experimental-strip-types`).

---

## 2. Deterministic Build Environment

* **Target Operating System**: macOS Darwin (arm64 / x86_64), Linux (x86_64), Windows (x64).
* **Node.js Runtime**: `>= 22.0.0` (validated on Node `v25.2.1` and `v22.12.0`).
* **Package Manager**: npm `>= 10.0.0` with strict lockfile enforcement (`package-lock.json`).
* **Native Tooling Requirements**:
  * macOS: `hdiutil` (Disk Image creation), `zip`.
  * Linux: `tar`, `gzip`, `dpkg-deb` (for `.deb` generation).
  * Windows: NSIS (`makensis.exe`, for installer generation).

---

## 3. Step-by-Step Clean Reproduction Protocol

To reproduce the release build from a clean machine:

```bash
# 1. Clone repository from canonical source
git clone https://github.com/JayantOlhyan/OpenFaceID.git
cd OpenFaceID

# 2. Check out target release candidate tag
git checkout v0.2.1-rc.1

# 3. Clean install strictly from lockfile
npm ci

# 4. Verify test suite passes completely (179 tests)
npm test

# 5. Execute build validation script
npm run build

# 6. Execute packaging scripts
./scripts/package-macos.sh
./scripts/package-linux.sh
./scripts/package-deb.sh

# 7. Generate release manifest & SHA-256 checksums
node --experimental-strip-types scripts/generate-release-manifest.js
```

---

## 4. Verification & Artifact Integrity

After execution, all distributable bundles are located in `dist/`. Their SHA-256 checksums are verified via:

```bash
cd dist
shasum -a 256 -c SHA256SUMS
```

All checksums should report `OK`.
