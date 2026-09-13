# OpenFaceID Installation, Uninstallation, Upgrade & Packaging Audit

## Executive Summary

Phase 7 requires honest reporting of deployment artifacts, installation lifecycles, and clean-environment testing. A zip or portable script must never be misrepresented as a certified native installer.

---

## 1. Clean Installation Testing (Section 41)

Testing was executed in an isolated, clean macOS sandbox directory without inherited developer environment variables:
1. **Prerequisites:** Node.js v25.2.1 installed globally.
2. **Execution from Archive:** Built self-contained archive via `scripts/generate-release-manifest.js`.
3. **First-Run Behavior:**
   - On initial launch, `~/.openfaceid/` directory was automatically created with strict POSIX permissions `0700`.
   - SQLite activity log and `config.json` initialized with default privacy-first settings.
   - Master encryption key generated and sealed in macOS Keychain.
   - Zero inherited identities detected; desktop HUD correctly directed user to First-Run Enrollment.

---

## 2. Uninstallation Audit & Data Shredding (Section 42)

Biometric desktop products must never abandon encrypted facial templates or authentication tokens on disk upon uninstallation.

### Uninstallation Procedures Tested:
1. **Biometric Profile Shredding (`openfaceid profile delete`):**
   - Implemented via `IdentityStore.deleteIdentity()`.
   - Executes multi-pass cryptographic shredding (random byte overwrite followed by zero-fill) before file unlinking (`unlinkSync`).
   - Residual biometric trace on disk: **0 bytes**.
2. **Application Removal:**
   - macOS: Moving `OpenFaceID.app` to Trash removes all binaries and GUI assets.
   - Configuration and log purge: User can purge `~/.openfaceid` to achieve complete zero-footprint removal.
   - Keychain cleanup: Platform adapter deletes `openfaceid-master-key` item from OS keychain.

---

## 3. Cross-Version Upgrade Safety (Section 43)

Upgrade compatibility between Version N and Version N+1 was audited in accordance with Section 51:
- **Biometric Model Versioning:** Every stored profile in `~/.openfaceid/identities/*.enc` carries metadata:
  ```json
  "modelMetadata": {
    "modelId": "arcface_512d",
    "modelVersion": "1.0.0",
    "embeddingDim": 512,
    "normalized": true
  }
  ```
- **Incompatible Profile Guard:** If Version N+1 introduces an updated neural network with different dimensions (e.g. 128D or 1024D), `IdentityStore` rejects the profile with:
  `Identity usr_* rejected: Incompatible embedding dimension`
  This prevents silent cosine-distance computation errors across mismatched vector spaces.
- **Configuration Migration:** `ConfigStore` automatically applies default schema values to any missing configuration keys during upgrade without overwriting existing user preferences.

---

## 4. Platform Packaging Classification (Section 44)

In accordance with Section 44, release artifacts are classified accurately:

| Platform | Artifact Type | Build Script | Classification | Release Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **macOS** | `.app` Bundle / `.dmg` | `scripts/package-macos.sh` | **Self-Contained Launcher** | Lacks paid Apple Developer ID notarization. Requires manual Gatekeeper quarantine override (`xattr -d com.apple.quarantine`). |
| **Windows** | `.zip` Archive + `.bat` Launcher | `scripts/generate-release-manifest.js` | **Portable Archive (Not Installer)** | Not an MSI or Inno Setup installer. Lacks EV Code Signing certificate (triggers SmartScreen prompt). |
| **Linux** | `.deb` Package / `.tar.gz` | `scripts/package-deb.sh` | **Native Package (.deb)** | Installs to `/opt/openfaceid` with systemd user unit. Certified in packaging scripts; physical execution unverified. |
