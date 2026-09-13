# OpenFaceID (SightLock) — Installation & Setup Guide

This guide details the procedure for installing, configuring, and verifying OpenFaceID across supported desktop operating systems.

---

## 1. System Requirements

### Hardware
- **Processor**: 64-bit x86_64 or ARM64 (Apple Silicon M1/M2/M3/M4 or compatible).
- **RAM**: Minimum 512 MB available RAM (daemon typical RSS: ~120–250 MB).
- **Storage**: ~150 MB disk space.
- **Webcam**: Standard UVC-compliant USB or built-in webcam capable of 640x480 @ 15 FPS or higher.

### Supported Operating Systems
| Operating System | Version | Platform Architecture | Capture Backend | Status |
| :--- | :--- | :--- | :--- | :---: |
| **macOS** | 12.0+ (Monterey, Ventura, Sonoma, Sequoia) | Apple Silicon (arm64), Intel (x86_64) | AVFoundation via native CLI/daemon | **VERIFIED** |
| **Linux** | Ubuntu 22.04+, Debian 11+, Fedora 38+, Arch | x86_64, aarch64 | V4L2 (`/dev/video*`) | **CODE IMPLEMENTED** |
| **Windows** | Windows 10, Windows 11 | x86_64 | Media Foundation / DirectShow | **CODE IMPLEMENTED** |

---

## 2. Installing from Release Packages

### macOS Installation
1. Download the latest release `.dmg` from the GitHub Releases page:
   ```bash
   curl -LO https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.0-rc.1/OpenFaceID-0.2.0-rc.1-macOS.dmg
   ```
2. Open the DMG image and drag `OpenFaceID.app` to your `/Applications` directory.
3. On first launch, macOS Gatekeeper may prompt for permission:
   - Go to **System Settings > Privacy & Security > Camera** and ensure `OpenFaceID` is allowed access.

### Linux (Debian / Ubuntu) Installation
1. Download the `.deb` package:
   ```bash
   curl -LO https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.0-rc.1/openfaceid_0.2.0-rc.1_amd64.deb
   sudo dpkg -i openfaceid_0.2.0-rc.1_amd64.deb
   sudo apt-get install -f # resolve any system dependencies
   ```
2. Grant video access to your user account:
   ```bash
   sudo usermod -aG video $USER
   ```
3. Log out and back in for the group membership to take effect.

---

## 3. Running from Source (Developer & Power User)

### Prerequisites
- Node.js 20.0.0 or higher (v22+ or v25 recommended).
- npm 9.0.0 or higher.
- Native build tools (Xcode Command Line Tools on macOS, `build-essential` on Linux).

### Step-by-Step Setup
```bash
# 1. Clone the repository
git clone https://github.com/JayantOlhyan/OpenFaceID.git
cd OpenFaceID

# 2. Install workspace dependencies
npm install

# 3. Build all monorepo packages
npm run build

# 4. Verify test suite
npm test

# 5. Launch the Desktop Application
npm run desktop
```

The desktop dashboard will be accessible at `http://127.0.0.1:4173/`.

---

## 4. Fresh-Machine Verification Protocol

To verify that OpenFaceID operates correctly on a machine without prior state:
1. Ensure no existing configuration or identities exist:
   ```bash
   rm -rf ~/.openfaceid
   ```
2. Start the desktop application:
   ```bash
   npm run desktop
   ```
3. Verify that the **Onboarding Wizard** displays automatically on first launch.
4. Complete the 3-step onboarding:
   - Welcome Screen -> Privacy Disclosure -> Camera Setup & Permission Grant.
5. Complete the 5-pose guided enrollment.
6. Verify that presence authorization transitions cleanly to `AUTHORIZED`.

---

## 5. Uninstallation & Clean Removal

OpenFaceID respects user data ownership and leaves zero traces when uninstalled.

### Step 1: Securely Wipe Biometric Identities
From the Desktop UI, navigate to **Privacy Center** and click **Delete Identity Data**. This shreds the encrypted biometric files using random bytes before unlinking.

Alternatively, via the CLI:
```bash
openfaceid identity delete --all --shred
```

### Step 2: Remove Configuration & Cache
```bash
# Remove all OpenFaceID local storage
rm -rf ~/.openfaceid
```

### Step 3: Remove Application Binaries
- **macOS**: Delete `/Applications/OpenFaceID.app`.
- **Linux**: Run `sudo apt-get purge openfaceid` or remove the extracted binary.
