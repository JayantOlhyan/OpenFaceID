# OpenFaceID (SightLock) — Phase 5 Acceptance Matrix

This document provides the authoritative, subsystem-by-subsystem acceptance status for OpenFaceID Phase 5 productization. In accordance with Section 1.1 and Section 44 of the Phase 5 engineering specification, statuses are partitioned into Automated status, macOS physical hardware validation, and non-macOS hardware status.

### Status Definitions
- **VERIFIED**: Empirically tested and passing on target physical hardware or runtime environment.
- **PARTIALLY VERIFIED**: Core execution tested, but edge scenarios or secondary paths require additional physical test permutations.
- **CODE IMPLEMENTED**: Fully written, typed, structurally integrated, and verified by mock/unit tests, but unverified on physical hardware.
- **UNVERIFIED**: Capability exists in specification or roadmap, but lacks end-to-end hardware verification.
- **FAILED**: Subsystem failed verification or security requirements.
- **NOT APPLICABLE**: Feature not supported or relevant to the platform target.

---

## 1. Comprehensive Acceptance Matrix

| Subsystem / Feature | Automated Tests | macOS (Apple Silicon Darwin 25.6.0) | Windows (Win32 / Media Foundation) | Linux (X11/Wayland / V4L2) | Notes & Evidence Reference |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **First Launch & Onboarding** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | First-run wizard, privacy disclosures, onboarding stepper in `apps/desktop/index.html`. |
| **Camera Setup & Device Selection** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Enumerates devices, permissions check, platform settings recovery links, `/api/v1/camera/select`. |
| **Guided 5-Pose Enrollment** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Center, slight left, slight right, tilt up, tilt down; quality and EAR checks, encrypted storage. |
| **Liveness Verification (PAD)** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Temporal EAR eye-blink tracking, head movement variance, liveness challenge states. |
| **Face Recognition Engine** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | 512D hyperspherical embeddings, cosine distance matching, calibrated presets (Balanced, Strict, Very Strict). |
| **Multiple-Face Handling** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Fail-closed policy: `PRESENCE_AMBIGUOUS` if `face_count >= 2`. Zero authorization bypass. |
| **Presence State & Expiration** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Authoritative state machine (`canonical.ts`), active session timestamps (`authorized_at`, `expiration_at`). |
| **Privacy Pause** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Hard fail-closed presence denial, pipeline paused, memory zeroized, tray visual reflection. |
| **System Tray / Menu Bar** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Native tray menu with presence & camera statuses, pause/resume, shortcuts to settings/diagnostics. |
| **Quick Glance HUD** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Authoritative state HUD; no synthetic percentage numbers; accessible textual reasons. |
| **Settings Management** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Configuration persistence, recognition presets (Balanced/Strict/Very Strict), camera resolution, bounds. |
| **Security Center** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Audited checks for model integrity, AES-GCM encryption, IPC token auth, network egress, privacy state. |
| **Privacy Center** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Safe metadata overview, secure identity deletion with zeroization, camera pause, diagnostics export. |
| **Diagnostics & Export** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Doctor checks, security/privacy checks, automated sensitive data scanner scrubbing secrets & vectors. |
| **Camera Hot-Plug Recovery** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | Camera disconnect triggers `CAMERA_DISCONNECTED` -> `CAMERA_RECOVERING` -> `CAMERA_READY`. |
| **Sleep / Wake Cycle** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | System sleep revokes presence session (`resetOnWake()`), requiring fresh re-recognition upon wake. |
| **Daemon / UI Resilience** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `CODE IMPLEMENTED` | UI polling fails closed to `SYSTEM_ERROR` / `PRESENCE_UNAUTHORIZED` on daemon disconnect. |
| **Fresh Installation** | `VERIFIED` | `VERIFIED` | `UNVERIFIED` | `UNVERIFIED` | Clean directory execution without prior configuration runs onboarding cleanly on macOS. |
| **Packaging & Distribution** | `VERIFIED` | `VERIFIED` | `CODE IMPLEMENTED` | `PARTIALLY VERIFIED` | macOS `.app` bundle, `.dmg`, `.zip`, Linux `.tar.gz`, Debian `.deb` packaging scripts verified. |

---

## 2. Hardware Validation Profiles

### Host Test Rig (macOS)
- **Model**: Apple MacBook Pro (Apple Silicon arm64)
- **OS**: macOS Darwin 25.6.0
- **Node.js**: v25.2.1
- **Camera Device**: Built-in FaceTime HD Camera (AVFoundation native pipeline)
- **Status**: **VERIFIED** across all functional and security paths.

### Secondary Platform Status (Windows)
- **Camera Architecture**: `MediaFoundationCapture` with DirectShow fallback (`packages/camera/src/platform/windows.ts`).
- **Platform Adapter**: `WindowsAdapter` using DPAPI / PowerShell Keystore (`packages/platform/src/WindowsAdapter.ts`).
- **Physical Verification**: **UNVERIFIED (PHYSICAL HARDWARE)**. Code implementation complete and unit-tested in isolation, but no Windows physical hardware was accessible in this test environment.

### Secondary Platform Status (Linux)
- **Camera Architecture**: `V4L2Capture` via `/dev/video*` ioctls (`packages/camera/src/platform/linux.ts`).
- **Platform Adapter**: `LinuxAdapter` using Secret Service / libsecret (`packages/platform/src/LinuxAdapter.ts`).
- **Physical Verification**: **UNVERIFIED (PHYSICAL HARDWARE)**. Packaging validated (`package-deb.sh`, `package-linux.sh`), but no physical Linux hardware was accessible in this test environment.
