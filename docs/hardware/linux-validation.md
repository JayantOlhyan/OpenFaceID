# OpenFaceID Linux Hardware Validation Report

## Evaluation Status: **CODE IMPLEMENTED — HARDWARE UNVERIFIED**

**Evaluation Target:** Ubuntu 24.04 LTS / Debian 12 / Fedora 40 (x86_64 & aarch64)  
**Date:** September 13, 2026  
**Git Baseline:** `0fba170`  
**Governing Rule:** No physical Linux machine was directly attached to the local test environment during Phase 7. In accordance with Section 2, 38, and 39 of the Phase 7 engineering specification, **NO physical test results are manufactured**.

---

## 1. Subsystem Implementation vs. Physical Validation Matrix

| Subsystem / Feature | Code Implementation Status | Physical Hardware Status | Implementation Details |
| :--- | :--- | :--- | :--- |
| **Pure TypeScript Runtime** | **IMPLEMENTED** | **VERIFIED IN CI** | Node.js 22.x/25.x execution verified without native binary compilation. |
| **Camera Enumeration** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | `LinuxAdapter.ts` enumerates `/sys/class/video4linux/` and queries `v4l2-ctl`. |
| **Camera Capture Pipeline** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | V4L2 `/dev/video*` stream capture with single-slot backpressure buffer. |
| **Camera Permissions** | **DOCUMENTED** | **HARDWARE UNVERIFIED** | Enforces standard group membership (`sudo usermod -aG video $USER`). Strictly rejects `chmod 777`. |
| **D-Bus Notifications** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | Implemented via `notify-send` / `org.freedesktop.Notifications`. |
| **System Tray Support** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | StatusNotifierItem / AppIndicator fallback; pure Wayland compositor behavior unverified. |
| **Screen Lock Trigger** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | Dispatches `loginctl lock-session` with fallback to `xdg-screensaver lock`. |
| **Systemd Service Unit** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | `openfaceid.service` user-level unit targeting `graphical-session.target`. |
| **Packaging (.deb / .tar.gz)** | **IMPLEMENTED** | **HARDWARE UNVERIFIED** | `./scripts/package-deb.sh` creates clean Debian packages with systemd hooks. |

---

## 2. Linux Hardware Testing Protocol (Pending Physical Lab Runner)

When a physical Linux workstation (`LINUX-01`) is provisioned, the following test protocol will be executed:
1. **Device Enumeration:** Test both legacy V4L2 device nodes (`/dev/video0`) and modern PipeWire camera portal streams.
2. **Permission Safety:** Confirm that non-root execution succeeds with the user in the `video` group, verifying no insecure permission elevation is required.
3. **Wayland Compatibility:** Evaluate system tray icon rendering and global HUD positioning under GNOME 46 (Wayland) versus KDE Plasma 6.
4. **Sleep/Wake (`systemd-suspend`):** Verify that systemd sleep hooks properly trigger `resetOnWake()` to clear authorization tokens.

---

## 3. Official Classification
- **Release Verdict:** **EXPERIMENTAL / PREVIEW ONLY**
- **Production Certification:** **NOT CERTIFIED** (Pending physical Linux validation).
