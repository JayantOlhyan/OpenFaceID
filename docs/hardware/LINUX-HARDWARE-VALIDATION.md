# Linux Hardware Validation Procedure & Checklist

**Document Version**: 1.0.0 (v0.2.1-rc.1)  
**Status**: `PHYSICALLY UNVERIFIED` (Requires physical Linux test bench)  
**Target Environments**: Ubuntu 22.04/24.04 LTS, Debian 12, Fedora 39+, Arch Linux  

---

## 1. Objective & Physical Verification Scope

The Linux integration is implemented through a native PAM module (`pam_openfaceid.so`), Unix domain socket communication (`/run/openfaceid/auth.sock`), and desktop session lock tracking (`LinuxAdapter`).

Because the primary development runner operates on macOS Apple Silicon, **actual desktop unlock and display manager integration on physical Linux machines must be formally executed and recorded before marking the platform as PHYSICALLY VERIFIED**.

---

## 2. Prerequisites & Build Test

Execute on a machine running native Linux (x86_64 or aarch64):

1. **Install Build Prerequisites**:
   - Ubuntu / Debian:
     ```bash
     sudo apt-get update
     sudo apt-get install -y build-essential libpam0g-dev nodejs npm
     ```
   - Fedora / RHEL:
     ```bash
     sudo dnf install -y gcc pam-devel nodejs npm
     ```

2. **Clone and Checkout Release Commit**:
   ```bash
   git clone https://github.com/JayantOlhyan/OpenFaceID.git
   cd OpenFaceID
   git checkout <RELEASE_COMMIT_SHA>
   npm install
   ```

3. **Compile Native Linux PAM Module**:
   ```bash
   make -C packages/platform/native/linux clean
   make -C packages/platform/native/linux
   ```
   - Verify `pam_openfaceid.so` is compiled cleanly without warnings.
   - Verify ELF shared object attributes:
     ```bash
     file packages/platform/native/linux/pam_openfaceid.so
     ```

---

## 3. Physical Hardware Execution Checklist

| Step # | Verification Item | Action / Command | Expected Pass Criteria | Result |
|:---|:---|:---|:---|:---|
| **L-01** | **PAM Module Installation** | `sudo make -C packages/platform/native/linux install` | Installs `pam_openfaceid.so` into `/lib/security/` with `0644` permissions | [ ] |
| **L-02** | **Socket Directory Creation** | `sudo mkdir -p /run/openfaceid && sudo chmod 0755 /run/openfaceid` | Runtime directory exists with correct ownership | [ ] |
| **L-03** | **Daemon Initialization** | `npm run desktop` or `systemctl --user start openfaceid` | Daemon starts, binds `/run/openfaceid/auth.sock` with `0600` permissions | [ ] |
| **L-04** | **Camera Enumeration** | `node apps/cli/bin/openfaceid.ts camera list` | Enumerates `/dev/video0` (V4L2 device stream) | [ ] |
| **L-05** | **Biometric Enrollment** | Complete 5-pose face enrollment via CLI or Web UI | Encrypted template stored in `~/.openfaceid/identities/` with `0600` permissions | [ ] |
| **L-06** | **Sudo PAM Verification** | Configure `/etc/pam.d/sudo`: add `auth sufficient pam_openfaceid.so` | Running `sudo -v` activates camera and authenticates without password prompt | [ ] |
| **L-07** | **Display Manager Integration** | Configure `/etc/pam.d/gdm-password` or `/etc/pam.d/sddm` | Display manager queries `pam_openfaceid.so` on session unlock screen | [ ] |
| **L-08** | **Session Lock Trigger** | Lock session via `loginctl lock-session` | Screen locks; daemon enters wake monitoring | [ ] |
| **L-09** | **Liveness Rejection** | Present printed photograph or mobile screen | Liveness rejects; PAM logs `AUTH_LIVENESS_FAILED`; screen remains locked | [ ] |
| **L-10** | **ACTUAL DESKTOP UNLOCK** | Enrolled user looks into webcam at lock screen | Face verified; PAM returns `PAM_SUCCESS`; desktop session unlocks | [ ] |
| **L-11** | **Daemon Inactive Fallback** | Stop daemon process (`pkill -f openfaceid`) | Running `sudo` or unlocking screen returns `PAM_AUTHINFO_UNAVAIL`, immediately falling back to standard password prompt | [ ] |
| **L-12** | **Uninstallation / Rollback** | `sudo ./scripts/install-linux-pam.sh --uninstall` | Removes `pam_openfaceid.so` and runtime socket directory cleanly | [ ] |

---

## 4. Certification Criteria

The platform may only be upgraded from `IMPLEMENTED / UNVERIFIED` to `SUPPORTED / PHYSICALLY VERIFIED` once all 12 checklist gates (`L-01` through `L-12`) are checked and validated with physical video/log evidence on real hardware.
