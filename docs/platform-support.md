# OpenFaceID (SightLock) — Platform Support & Compatibility

OpenFaceID is architected from day one for **macOS**, **Windows**, and **Linux**.

---

## 1. Operating System Compatibility

### 1.1 macOS
- **Architectures**: Apple Silicon (M1/M2/M3/M4) & Intel x86_64.
- **Minimum OS**: macOS 12 (Monterey) or newer.
- **Hardware**: FaceTime HD Camera, Studio Display, Continuity Camera, or standard USB-C/USB webcams.
- **Keystore**: macOS Keychain Services via `/usr/bin/security`.
- **Display Sleep / Lock**: Supported via `/usr/bin/pmset displaysleepnow`.
- **Camera Permissions**: Managed via macOS Transparency, Consent, and Control (TCC).

### 1.2 Windows
- **Architectures**: Windows 10 & Windows 11 (x64 and ARM64).
- **Hardware**: Integrated webcam or USB video class (UVC) device.
- **Keystore**: Windows Credential Manager and Data Protection API (DPAPI).
- **Display Lock**: Supported via `user32.dll!LockWorkStation`.
- **Permissions**: Managed via Windows Settings > Privacy & Security > Camera.

### 1.3 Linux
- **Distributions**: Ubuntu 22.04+, Fedora 38+, Debian 12+, Arch Linux.
- **Desktop Environments**: GNOME (Wayland/X11), KDE Plasma 5/6, XFCE, Sway, Hyprland.
- **Hardware**: Any Video4Linux2 (`/dev/video*`) compliant webcam or PipeWire camera stream.
- **Keystore**: FreeDesktop Secret Service specification (`org.freedesktop.secrets`) via `secret-tool` / `libsecret` (GNOME Keyring / KDE KWallet).
- **Display Lock**: Supported via `loginctl lock-session` or `xdg-screensaver`.

---

## 2. Linux Authentication Strategy & PAM Boundaries

OpenFaceID defines four clear tiers for Linux integration:

| Tier | Capability | Status | Configuration |
| :--- | :--- | :--- | :--- |
| **Tier 1** | Application-level facial recognition | Stable | Default |
| **Tier 2** | Continuous presence-based lock automation | Stable | Default |
| **Tier 3** | Desktop lock-state detection via D-Bus | Stable | Default |
| **Tier 4** | Pluggable Authentication Module (PAM) | **Experimental** | Manual opt-in only |

> [!WARNING]
> **Why OpenFaceID does not modify `/etc/pam.d` by default:**
> Tampering with system-level PAM modules on Linux can render a machine unbootable or lock users out permanently if the camera driver or display manager experiences a panic. Tier 4 PAM integration is kept strictly as an isolated optional companion utility.
