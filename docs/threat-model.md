# OpenFaceID (SightLock) — Threat Model & Security Analysis

This document provides a comprehensive security threat analysis based on the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) and ISO/IEC 30107-3 biometric presentation attack detection standards.

---

## 1. System Assets & Trust Boundaries

### 1.1 Assets to Protect
1. **Biometric Embeddings**: 512-dimensional mathematical feature vectors stored on disk.
2. **Master Encryption Key**: 256-bit symmetric key derived or sealed in operating system keystores.
3. **Volatile Camera Frames**: In-memory raw RGB pixel buffers.
4. **Local API Access**: REST and Server-Sent Events (SSE) daemon endpoints.
5. **Operating System Integrity**: Display sleep/lock states and user sessions.

### 1.2 Trust Boundaries
- **Untrusted Physical Environment**: The webcam field-of-view (adversary holding photographs, playing videos, or wearing masks).
- **Process Memory Boundary**: Userland application memory space vs untrusted third-party processes.
- **Localhost Network Boundary**: Loopback network interface (`127.0.0.1`) vs external network interfaces (`0.0.0.0`, LAN, WAN).
- **Storage Boundary**: Plaintext filesystem vs encrypted biometric store.
- **Kernel / OS Boundary**: Userland application vs operating system authentication subsystem (PAM, Winlogon, SecurityAgent).

---

## 2. STRIDE Threat Analysis & Mitigations

| Category | Threat Description | Attack Vector | Severity | OpenFaceID Mitigation | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Presentation Attack: Printed photograph | High-res color printout held in front of webcam | High | `Light` & `Strong` liveness detection: Eye Aspect Ratio (EAR) blink requirement, micro-motion variance analysis, texture gradient check. | Highly sophisticated high-res video loops or animated cutouts may challenge passive mode. Active mode (`Strong`) mitigates this. |
| **Spoofing** | Presentation Attack: Video replay | Tablet/phone screen playing video of enrolled user | High | Specular reflection gradient analysis, screen moiré frequency detection, active challenge-response (`Strong` mode). | 2D webcams cannot detect infrared depth. Documented explicit limitation. |
| **Tampering** | Biometric Vector Modification | Adversary alters stored `.enc` files on disk | Medium | **AES-256-GCM** authenticated encryption. Any bit flip in ciphertext or auth tag causes decryption failure. | None (tampered files are rejected and discarded). |
| **Tampering** | Local IPC & Route Tampering (Phase 3) | Drive-by web script or rogue local process calls `POST /api/identities/enroll` or pauses security | High | Ephemeral 192-bit Bearer token required for all mutating routes; constant-time comparison via `crypto.timingSafeEqual`; CORS origin verification. | Malicious processes with equal OS user privileges can read token from `~/.openfaceid/token` (file permissions `0600`). |
| **Information Disclosure** | Biometric Data Theft | Local malicious process attempts to read facial images from disk | Critical | **Zero disk writes of raw images**. Frames exist only in RAM and are zeroized immediately (`frame.zeroize()`). Embeddings are encrypted via OS Keychain/DPAPI/SecretService. | Attacker with root/SYSTEM privileges can inspect raw process memory (RAM). |
| **Information Disclosure** | Network Leakage / Telemetry Sniffing | Biometric data leaked over internet connection | Critical | **Zero network egress**. Zero cloud servers, zero analytics, zero telemetry. Daemon binds strictly to `127.0.0.1`. | None. |
| **Information Disclosure** | Optical Snooping / Camera Indicator Paranoia | Background daemon secretly streaming camera frames | Medium | Hardware **Privacy Pause** mode: completely detaches camera stream, turns off camera indicator LED, zeroizes active frame buffers. | Operating system-level rootkit could control camera independently. |
| **Denial of Service** | Camera Lockout / Resource Exhaustion | Rapid frame hammering or camera detachment | Low | FrameSampler dynamically throttles capture (1–15 FPS). Disconnect recovery manager detects USB hot-unplug and attempts exponential backoff recovery. | Physical lens occlusion cannot be resolved by software. |
| **Elevation of Privilege** | Lock Screen Bypass / Credential Injection | App simulates keystrokes to type user password | Critical | **STRICT RULE**: OpenFaceID **never** stores plaintext OS passwords and **never** injects keystrokes to unlock OS screens. | None; OpenFaceID does not claim to replace OS login authentication. |

---

## 2.1 Localhost IPC & Desktop Route Protection

The desktop background daemon (`DesktopEngine`) exposes a local HTTP/SSE interface on `127.0.0.1:41793`. Because web browsers running on the same host can attempt cross-origin requests (`fetch('http://127.0.0.1:41793/api/...')`), OpenFaceID implements defense-in-depth:
1. **Bearer Token Authentication**: Generated with `crypto.randomBytes(24).toString('hex')` (192 bits of entropy) at startup.
2. **Timing Attack Protection**: Evaluated using `crypto.timingSafeEqual` with length check pre-guards.
3. **Sensitive Route Quarantine**: Mutation endpoints (Enrollment, Deletion, Policy changes, Privacy Pause toggling) respond with `401 Unauthorized` without the bearer token.
4. **Public Safe Endpoints**: Only read-only `/api/status`, `/api/health`, and `/events` are accessible without tokens. Biometric vectors and raw landmarks are never exposed over any API route.

---

## 3. Presentation Attack Detection (PAD) Taxonomy (ISO/IEC 30107-3)

### 3.1 Attack Species Evaluated
1. **Species A (2D Static Print)**:
   - Matte paper printout: Blocked by micro-motion variance (\(V < 0.008\)).
   - Glossy photo printout: Blocked by specular reflection gradient analysis (\(G > 55\)).
2. **Species B (2D Video Replay)**:
   - Smartphone / iPad replay: Blocked by screen moiré texture filtering and `Strong` mode challenge-response.
3. **Species C (3D Physical Mask)**:
   - Rigid mask: Blocked by blink detection and temporal facial deformation analysis.

---

## 4. Residual Risks & Explicit Physical Limitations

1. **Webcams Lack Hardware Depth**: Without an infrared dot projector (Apple TrueDepth) or dual-sensor IR camera (Windows Hello), 2D optical face recognition **cannot guarantee absolute physical presence**. OpenFaceID must be used for convenience and presence-based locking, not for high-threat physical security scenarios.
2. **Root / Kernel Compromise**: An adversary possessing root/admin privileges on the host machine can inspect volatile memory, hook kernel display drivers, or manipulate the camera device stream.
3. **Twin / Close Relative Resemblance**: As with all 2D deep embedding models, identical twins or close biological relatives with high facial resemblance may produce similarity scores exceeding the standard 0.72 threshold.

---

## 5. Presentation Attack Testing Matrix

| Attack Scenario | Test Mechanism | Expected System Response | Detection Reliability |
| :--- | :--- | :--- | :--- |
| **Live Human Face** | Natural blinking + head micro-motion | `LIVENESS_PASSED`, Recognition allowed | High ($> 98\%$) |
| **Printed Photograph** (Paper print) | Zero landmark motion variance ($V < 0.008$) | `LIVENESS_FAILED`: "Presentation attack suspected: Static image" | High ($> 99\%$) |
| **Phone / Tablet Replay** | Screen moiré frequency check + challenge | Rejected in Light mode; fails active challenge in Strong mode | Medium-High ($> 90\%$) |
| **Multiple Faces in View** | Detector returns $> 1$ high-confidence candidates | Flagged as multi-face scene; authorization suppressed | High ($100\%$) |
| **Partial / Occluded Face** | Landmark parser fails eye-mouth proportions | Rejected at Quality Gate: `FACE_NOT_CENTERED` / `EXTREME_ANGLE` | High ($> 95\%$) |
| **Extreme Lighting** (Dark / Glare) | Luminance check ($\mu_L < 35$ or $\mu_L > 235$) | Rejected at Quality Gate: `TOO_DARK` / `TOO_BRIGHT` | High ($100\%$) |

