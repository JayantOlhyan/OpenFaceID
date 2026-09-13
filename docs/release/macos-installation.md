# OpenFaceID for macOS — Installation Guide

This guide describes how to install, verify, and run the standalone **OpenFaceID** application on macOS with zero dependencies.

---

## 1. System Requirements

* **Operating System**: macOS 14.0 Sonoma or macOS 15.0 Sequoia (or later)
* **Architecture**: Apple Silicon (`arm64`: M1, M2, M3, M4) or Intel Mac
* **Hardware**: Built-in FaceTime HD camera or external USB/Thunderbolt UVC camera
* **Prerequisites**: **None**. OpenFaceID bundles its own native camera engine, desktop UI, and standalone runtime. No Node.js, Xcode, or terminal is required.

---

## 2. Step-by-Step Installation

### Step 1: Download
Download the official release image:
* **[OpenFaceID-0.2.1-rc.1-arm64.dmg](https://github.com/JayantOlhyan/OpenFaceID/releases/download/v0.2.1-rc.1/OpenFaceID-0.2.1-rc.1-arm64.dmg)** (~37 MB)

### Step 2: Open the Disk Image
Double-click the downloaded `.dmg` file in your `Downloads` folder. macOS mounts the volume and displays the installation window:

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│       OpenFaceID.app    ──────────►    Applications    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Step 3: Drag to Applications
Drag the **OpenFaceID** icon into the **Applications** folder shortcut.

### Step 4: Launch
1. Open your `/Applications` folder in Finder.
2. Double-click **OpenFaceID.app**.
3. *Note on First Launch (Gatekeeper)*: Because OpenFaceID is an open-source community release compiled without a paid Apple Developer ID certificate, macOS may show a developer verification dialog. Right-click (Control-click) `OpenFaceID.app` and choose **Open**, or allow it under *System Settings → Privacy & Security*.

---

## 3. First Launch & Camera Access

1. When OpenFaceID opens, macOS displays a camera permission prompt:
   > *"OpenFaceID would like to access the camera."*
2. Click **OK** to allow camera access.
3. The live camera hardware initializes immediately via native AVFoundation capture.
4. Complete the guided 5-pose face enrollment in seconds. Your biometric data never leaves volatile RAM during processing and is encrypted locally with AES-256-GCM.

---

## 4. Verification & Integrity Check

To verify that your downloaded disk image matches the official build:
```bash
shasum -a 256 OpenFaceID-0.2.1-rc.1-arm64.dmg
```

**Expected SHA-256:**
```
6f03dd042c9618e86b99ecd45b4a371df3663f2cf3197ca4f0fcd3affa5a11f9
```

---

## 5. Uninstallation

1. Quit OpenFaceID from the menu bar or Dock.
2. Drag `/Applications/OpenFaceID.app` to the **Trash**.
3. (Optional) To remove local encrypted biometric templates and settings, remove the local configuration directory:
   ```bash
   rm -rf ~/.openfaceid
   ```
