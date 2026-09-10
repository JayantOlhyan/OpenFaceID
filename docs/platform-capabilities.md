# OpenFaceID (SightLock) — Platform Capabilities & Matrix

This document defines the platform capabilities, security boundaries, native integration APIs, and fallback behaviors across **macOS**, **Windows**, and **Linux**.

---

## 1. Cross-Platform Capability Matrix

| Feature | macOS | Windows 10/11 | Linux (X11) | Linux (Wayland) |
| :--- | :--- | :--- | :--- | :--- |
| **Face Detection & Recognition** | Full (Local) | Full (Local) | Full (Local) | Full (Local) |
| **Modular Liveness Detection** | Full (Off/Light/Strong) | Full (Off/Light/Strong) | Full (Off/Light/Strong) | Full (Off/Light/Strong) |
| **Presence Detection** | Full | Full | Full | Full |
| **Camera Enumeration & Access** | AVFoundation / WebRTC | Media Foundation / WebRTC | V4L2 / WebRTC | PipeWire / V4L2 / WebRTC |
| **Camera Permissions** | TCC (`kTCCServiceCamera`) | CapabilityAccessManager | `/dev/video*` permissions | PipeWire portal permissions |
| **Screen Lock Trigger** | `pmset displaysleepnow` / CoreGraphics | `user32.dll LockWorkStation` | `loginctl lock-session` / `xdg-screensaver` | `loginctl lock-session` |
| **Screen Lock Detection** | `ioreg CGSSessionScreenIsLocked` | `WTSRegisterSessionNotification` | D-Bus `ScreenSaver.ActiveChanged` | `loginctl LockedHint` |
| **System Idle Time** | `IOHIDSystem` `HIDIdleTime` | `GetLastInputInfo` | `xprintidle` | Mutter IdleMonitor / ext-idle |
| **Secure Key Storage** | macOS Keychain | Credential Manager / DPAPI | Secret Service (`libsecret`) | Secret Service (`libsecret`) |
| **System Tray / Menu Bar** | Native Menu Bar | System Tray (Notification Area) | AppIndicator / StatusNotifier | AppIndicator / StatusNotifier |
| **Launch at Login** | `LaunchAgents` / AppleScript | Registry `Run` / Startup Folder | XDG Autostart (`~/.config/autostart`) | XDG Autostart |
| **OS Biometric Auth API** | LocalAuthentication (TouchID) | Windows Hello Framework | PAM (Pluggable Auth) | PAM (Pluggable Auth) |

---

## 2. Platform-Specific Implementations & Boundaries

### 2.1 macOS
- **Camera Access**:
  - Permissions are managed by macOS Transparency, Consent, and Control (TCC).
  - OpenFaceID guides the user to `System Settings > Privacy & Security > Camera` if access is denied.
- **Secure Key Storage**:
  - Uses the macOS Keychain (`security` utility / native Keychain Services).
  - Stores a 256-bit AES master key in the user's login keychain under service name `org.openfaceid.desktop`.
- **Screen Lock**:
  - Non-destructive display sleep and session lock via `/usr/bin/pmset displaysleepnow`.
- **Display & Notch Integration**:
  - Floating Quick Glance overlay is calibrated to appear gracefully near the top-center of the primary display without requiring a physical camera notch.

### 2.2 Windows
- **Camera Access**:
  - Managed via Windows Media Foundation and Universal Windows Platform (UWP) device capability broker.
- **Secure Key Storage**:
  - Uses Windows Credential Manager and Data Protection API (DPAPI) via `CryptProtectData` to encrypt master keys with user credentials.
- **Screen Lock**:
  - Invokes `rundll32.exe user32.dll,LockWorkStation`.
- **Windows Hello Boundary**:
  - **LIMITATION**: Windows Hello requires IR camera sensors and cryptographic TPM attestation. Standard third-party desktop apps are not permitted to register 2D webcam biometric credentials into Windows Hello.
  - **Safe Implementation**: OpenFaceID provides application-level recognition, presence-based lock automation, and companion unlock prompts without compromising Windows security policies.

### 2.3 Linux
- **Camera Access**:
  - Queries Video4Linux2 (`/dev/video*`) nodes and PipeWire camera portal.
  - Checks if the user belongs to the `video` group.
- **Secure Key Storage**:
  - Interfaces with FreeDesktop Secret Service via D-Bus (`secret-tool`).
  - Supports GNOME Keyring and KDE KWallet.
  - Fallback: Encrypted keyfile protected with user-derived pass-phrase and machine-ID salt if no Secret Service daemon is present.
- **Desktop Environments Supported**:
  - GNOME, KDE Plasma, XFCE, Sway, Hyprland.
- **Tiered Linux Authentication Strategy**:
  - **Level 1 (Application-Level)**: In-app identity verification and dashboard protection.
  - **Level 2 (Presence Automation)**: Automatic workstation locking when user walks away.
  - **Level 3 (Desktop Lock Integration)**: D-Bus screensaver signals to monitor lock state and trigger wake/verification workflows.
  - **Level 4 (Experimental PAM Companion)**: Completely segregated optional module. Documented risks; never enabled by default to prevent login lockout.

---

## 3. Graceful Degradation & Fallback Strategy

When a native capability is unavailable on a target system, OpenFaceID degrades gracefully according to the following matrix:

| Requested Feature | Primary Mechanism | Fallback Mechanism | Final Safe State |
| :--- | :--- | :--- | :--- |
| **Secure Key Storage** | Native OS Keystore (Keychain / WinCred / SecretService) | Salted PBKDF2 Master Keyfile with OS-bound Machine ID | Encrypted in-memory storage (re-prompt on restart) |
| **Screen Lock** | OS API (`pmset` / `LockWorkStation` / `loginctl`) | Screensaver execution command (`xdg-screensaver`) | Notification prompt urging user to lock screen |
| **Idle Time Detection** | IOHID / GetLastInputInfo / xprintidle | Internal camera frame motion variance timer | Inactivity timer based on face absence only |
| **Liveness Verification** | Strong Mode (Interactive Challenge) | Light Mode (Blink & Micro-motion) | Inform user and require confirmation click |
