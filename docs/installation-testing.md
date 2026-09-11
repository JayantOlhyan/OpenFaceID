# OpenFaceID — Installation, Launch & Lifecycle Verification Guide

This document outlines the step-by-step procedures for installing, launching, verifying, updating, and cleanly uninstalling OpenFaceID (SightLock) across macOS, Windows, and Linux.

---

## 1. Installation Procedures

### 1.1 macOS (Apple Silicon & Intel)
1. **Download**: Obtain `OpenFaceID-0.1.0-macos.zip` or `OpenFaceID.app` bundle.
2. **Installation**:
   - Extract the archive to `/Applications/OpenFaceID.app` or keep in `~/Applications/`.
   - Ensure execution permissions:
     ```bash
     chmod +x /Applications/OpenFaceID.app/Contents/MacOS/OpenFaceID
     ```
3. **First Launch**:
   - Double-click `OpenFaceID.app` in Finder or run:
     ```bash
     open /Applications/OpenFaceID.app
     ```
   - On first run, macOS Gatekeeper may prompt for approval. Under `System Settings > Privacy & Security`, allow OpenFaceID.
   - macOS TCC will request **Camera Access**. Grant permission.

### 1.2 Linux (Ubuntu / Debian / Arch / Fedora)
1. **Download**: Obtain `openfaceid-0.1.0-linux-x86_64.tar.gz`.
2. **Extraction**:
   ```bash
   tar -xzf openfaceid-0.1.0-linux-x86_64.tar.gz -C ~/.local/
   ```
3. **Desktop Integration**:
   ```bash
   cp ~/.local/linux/share/applications/openfaceid.desktop ~/.local/share/applications/
   chmod +x ~/.local/linux/bin/openfaceid
   ```
4. **Permissions**: Ensure user belongs to the `video` group:
   ```bash
   sudo usermod -a -G video $USER
   ```
5. **Launch**: Launch via application menu or run `~/.local/linux/bin/openfaceid`.

### 1.3 Windows (Windows 10 / 11)
1. **Extraction**: Extract `dist\windows` package to `C:\Program Files\OpenFaceID\`.
2. **Launch**: Run `C:\Program Files\OpenFaceID\OpenFaceID.cmd`.
3. **Camera Permission**: Allow camera access in Windows Settings (`Privacy & Security > Camera`).

---

## 2. Full Verification Lifecycle Test Flow

Execute the following standardized verification flow to confirm a valid installation:

```
Download / Clone
       │
       ▼
  Launch App ──────► [Verify UI opens at http://127.0.0.1:41793]
       │
       ▼
Camera Permission ──► [Verify camera preview is live, no mock canvas]
       │
       ▼
Guided Enrollment ──► [Complete 5 poses: Center, Left, Right, Up, Down]
       │
       ▼
Recognition Test ───► [Verify confidence meter reaches green match]
       │
       ▼
  Presence Test ────► [Step away from camera; verify absence timer]
       │
       ▼
  Quit & Relaunch ──► [Verify enrolled identities persist encrypted]
```

### Verification Checklist:
- [x] Application launches without external build toolchain.
- [x] Camera stream displays actual webcam feed.
- [x] 5-pose guided enrollment completes and saves encrypted record.
- [x] Face recognition correctly matches enrolled user.
- [x] Unrecognized faces trigger "Unknown face" without false authorization.
- [x] Privacy Pause suspends camera immediately.
- [x] Quick Glance HUD responds to `Cmd/Ctrl + Shift + L`.
- [x] Relaunch preserves encrypted identities and settings.

---

## 3. Uninstall Procedures

OpenFaceID respects user privacy and data sovereignty. Uninstalling removes all application files and provides options for purging biometric data.

### 3.1 Complete Uninstallation (macOS)
```bash
# 1. Stop background engine
killall OpenFaceID 2>/dev/null || true

# 2. Remove application bundle
rm -rf /Applications/OpenFaceID.app

# 3. Remove LaunchAgent autostart
rm -f ~/Library/LaunchAgents/org.openfaceid.desktop.plist

# 4. Remove encrypted biometric identity store and config
rm -rf ~/.openfaceid

# 5. Remove master key from Keychain
security delete-generic-password -s "org.openfaceid.desktop" -a "master_biometric_key" 2>/dev/null || true
```

### 3.2 Complete Uninstallation (Linux)
```bash
# 1. Stop process
pkill -f openfaceid || true

# 2. Remove binaries and desktop files
rm -rf ~/.local/linux
rm -f ~/.local/share/applications/openfaceid.desktop
rm -f ~/.config/autostart/openfaceid.desktop

# 3. Purge biometric storage
rm -rf ~/.openfaceid

# 4. Clear secret-tool keys
secret-tool clear service "openfaceid" key "master_biometric_key" 2>/dev/null || true
```

---

## 4. Storage Schema & Versioned Data Migration

All biometric identity records and configuration files follow explicit versioning:

```json
{
  "schemaVersion": 1,
  "id": "usr_01jk98",
  "name": "Jayant Olhyan",
  "createdAt": 1773273600000,
  "updatedAt": 1773273600000,
  "vectorDimension": 512,
  "embeddingAlgorithm": "ArcFace-512D-Canonical112",
  "encryptedData": "<base64_ciphertext>",
  "iv": "<hex_iv>",
  "authTag": "<hex_authtag>",
  "salt": "<hex_salt>"
}
```

- If `schemaVersion` is updated in future releases (e.g. from 1 to 2), an automatic migration runner unpacks the encrypted record, adjusts the data schema, re-encrypts with the master key, and writes the upgraded record atomically.
- Existing identity profiles are never invalidated or broken during standard application upgrades.
