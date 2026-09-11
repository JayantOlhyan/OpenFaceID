# OpenFaceID — Platform Authentication Research & OS Integration Limits

This document analyzes the engineering, security, and architectural considerations for integrating OpenFaceID with operating system login and session authentication on Linux, macOS, and Windows.

---

## 1. Executive Summary & Design Decision

OpenFaceID's primary production mode is **Active Presence Monitoring and Automatic Screen Locking** rather than direct OS login credential injection. 

### Core Invariants:
1. **Never store user plaintext passwords**: OpenFaceID will never solicit, store, or inject the user's OS login password in plaintext or reversible encryption.
2. **Never compromise OS login security**: A 2D RGB webcam without hardware-attested structured light (e.g., Apple Face ID or Windows Hello IR sensors) cannot meet FIDO Level 2 or Windows Hello hardware security guarantees.
3. **Fail-Safe Non-Interference**: If OpenFaceID fails, crashes, or is terminated, the OS native authentication (password, PIN, Touch ID) must remain 100% operational.

---

## 2. Linux: Pluggable Authentication Modules (PAM)

### 2.1 PAM Architecture Overview
Linux handles console, desktop display manager (GDM, LightDM, SDDM), and sudo authentication through the PAM subsystem (`/etc/pam.d/*`). A custom PAM module (`pam_openfaceid.so`) can participate in the `auth` stack.

```
+----------------------------------------------------------------+
|                PAM Stack (/etc/pam.d/gdm-password)              |
+----------------------------------------------------------------+
                               |
         +---------------------+---------------------+
         |                                           |
+------------------+                       +-------------------+
| pam_openfaceid.so| (sufficient / optional) |  pam_unix.so      | (required fallback)
+------------------+                       +-------------------+
         | (Unix Domain Socket / IPC)
         v
+-----------------------------+
| openfaceid-daemon (System)  |
|  - Root or dedicated group  |
|  - SO_PEERCRED auth check   |
|  - Accesses /dev/video*     |
+-----------------------------+
```

### 2.2 IPC & Privilege Separation
- PAM modules execute within the context of the calling process (e.g., `sudo` or `gdm-session-worker`).
- **Security Boundary**: The PAM module should **not** initialize camera drivers or load neural network models directly into the login process address space.
- Instead, `pam_openfaceid.so` connects to a local daemon socket at `/run/openfaceid/auth.sock`.
- The daemon validates caller credentials using `SO_PEERCRED` (gets calling UID/GID/PID) to ensure unauthorized local users cannot trigger false authentication signals.

### 2.3 Proposed PAM Configuration
```
# /etc/pam.d/sudo
auth [success=1 default=ignore] pam_openfaceid.so timeout=3 mode=light
auth required                   pam_unix.so try_first_pass
auth required                   pam_permit.so
```

### 2.4 Risks & Failure Modes
- **Camera Contention**: If another process is using `/dev/video0`, the PAM module must timeout immediately (< 3 seconds) and seamlessly fallback to password entry without blocking the user.
- **Headless & SSH Logins**: `pam_openfaceid.so` must detect non-graphical or remote SSH sessions (`PAM_TTY`, `PAM_RHOST`) and return `PAM_AUTH_ERR` immediately.

---

## 3. macOS: Authorization Plugins & TCC Privacy Restrictions

### 3.1 macOS Architecture (`AuthorizationPlugin`)
On macOS, system authentication at the `loginwindow` is controlled by the `Security.framework` Authorization Plugin API.

```
/System/Library/CoreServices/SecurityAgent.app
                   |
     AuthorizationEngine (macOS)
                   |
         OpenFaceID.bundle (AuthorizationPlugin)
```

### 3.2 The TCC (Transparency, Consent, and Control) Lockout
macOS enforces strict sandboxing and TCC privacy controls on camera and microphone devices:
1. **Screen Locked / Login Window Isolation**: When the macOS screen is locked or displaying the login window, the camera subsystem (`AVFoundation` and AppleCamera framework) **blocks all third-party video capture**.
2. **Camera Indicator Light Requirement**: Apple hardware enforces green indicator LED lighting, which is disabled at loginwindow for third-party processes.
3. **TCC Entitlements**: Third-party applications cannot receive `kTCCServiceCamera` permissions running as `root` or `_securityagent`.

### 3.3 Architectural Conclusion for macOS
Because macOS intentionally denies background camera access to third-party software while the display is locked, **OpenFaceID does not attempt to unlock the macOS login screen**. 
Instead, OpenFaceID on macOS operates as a high-privilege **User Agent Utility**:
- Continuously verifies user presence while the user is actively logged in.
- Automatically and instantly locks the display via `user32` equivalent (`CGSessionCopyCurrentDictionary` / `loginwindow` SACLockScreenImmediate) when the user leaves.
- Alerts user if unrecognized persons look over their shoulder.

---

## 4. Windows: Credential Providers & Windows Hello

### 4.1 Windows Credential Provider Architecture
Windows uses `ICredentialProvider` and `ICredentialProviderCredential2` COM interfaces hosted inside `LogonUI.exe` to render authentication tiles on the lockscreen.

```
+-------------------------------------------------------------+
|                          LogonUI.exe                         |
|  +-------------------------------------------------------+  |
|  |             OpenFaceIDCredentialProvider              |  |
|  |  (Implements ICredentialProviderCredential2)          |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
                               | (Local RPC / Named Pipe)
                               v
               +-------------------------------+
               | OpenFaceID Windows Service    |
               |  - Windows Media Foundation   |
               |  - DPAPI Master Secret Store  |
               +-------------------------------+
```

### 4.2 Security Risk: Reversible Password Injection
- Custom Credential Providers that unlock Windows via standard username/password must package credentials into a `KERB_INTERACTIVE_LOGON` structure and submit them to LSA (`LsaLogonUser`).
- To achieve this, the software would have to store the user's plaintext password (or an encrypted reversible password) on disk or in memory.
- **OpenFaceID Security Stance**: **REJECTED**. Storing or caching Windows user passwords creates an unacceptable local attack surface (Threat Actor T3 / T4).

### 4.3 Comparison with Windows Hello
| Feature | Windows Hello Face | OpenFaceID (SightLock) |
| :--- | :--- | :--- |
| **Camera Sensor** | 940nm Infrared (IR) + Structured Light | Standard 2D RGB Webcam |
| **Hardware Attestation** | TPM 2.0 Sealed Keys | Local AES-256-GCM (DPAPI / Keychain) |
| **Anti-Spoofing** | 3D Depth Map + IR Reflectivity | Optical Flow + Eye Aspect Ratio + Active Challenge |
| **Primary Purpose** | Windows Login Unlock | Cross-Platform Presence & Auto-Lock |
| **Target Platforms** | Windows 10/11 only | macOS, Windows, Linux |

---

## 5. Final Recommendations & Roadmap

| Platform | Current Status | Recommended Path |
| :--- | :--- | :--- |
| **macOS** | Full Presence & Auto-Lock | Stay strictly within user session; do not hack loginwindow. |
| **Linux** | Full Presence & Auto-Lock | Develop `pam_openfaceid.so` companion package for `sudo` and GDM optional unlock. |
| **Windows**| Full Presence & Auto-Lock | Use Windows Hello Companion Device Framework where supported; reject password caching. |
