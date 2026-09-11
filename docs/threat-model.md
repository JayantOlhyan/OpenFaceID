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
### 1.2 Architectural Trust Boundaries & Authority

OpenFaceID establishes three explicit security trust tiers:

| Tier | Components | Authority & Permissions | Constraints |
| :--- | :--- | :--- | :--- |
| **Trusted** | Core Background Daemon (`DesktopEngine`), Security Engine (`CryptoManager`, `KeyringManager`), OS Keyring | **Sole Security Authority**. Controls locks, encryption keys, identity DB, and state transitions. | Runs as logged-in user; zero root/admin privileges requested. |
| **Partially Trusted** | Desktop UI Dashboard, Quick Glance HUD | Presentation & user interaction layer. Submits commands via authenticated IPC. | **Never an authority**. Cannot bypass daemon policies or declare presence independently. |
| **Untrusted** | Other local processes, web browsers, network interfaces, raw camera optical field, untrusted filesystem inputs | No authority. Regarded as potentially adversarial. | Blocked by loopback binding, CORS rejection, bearer tokens, and input validation schemas. |

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

## 2.1 Threat Actor Matrix (T1 – T10)

| Actor | Threat Category | Asset Targeted | Attack Vector | Existing Mitigation | Residual Risk | Recommended Hardening |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **T1: Malicious Local Process** | Unauthorized IPC Execution | Daemon policies, enrollment | Submits local HTTP requests to `127.0.0.1:41793` | Ephemeral 192-bit Bearer token required | Process running as same OS user might read token file | Restrict file to `0600`; enforce constant-time check |
| **T2: Malicious Browser Page** | Drive-by Cross-Origin Requests | Sensitive mutation endpoints | JavaScript `fetch()` from malicious tab | CORS restricted to local origin; Bearer token header | Simple requests may evade preflight | Never expose token in public DOM; reject non-local Origin |
| **T3: Malicious Local User** | Identity tampering / profile deletion | Enrolled user profiles | Direct filesystem modification in `~/.openfaceid/` | AES-256-GCM authenticated encryption | Corrupted profile deletes user profile | Restrict directory permissions to `0700` (`rwx------`) |
| **T4: Attacker with Filesystem Access** | Path Traversal / Arbitrary File Overwrite | System files outside app dir | Traversal sequences (`../`, `\0`, symlinks) | Canonical `path.resolve` checks in stores | Symlink dereference | Check `lstat` and reject symlinks targeting external paths |
| **T5: Attacker with Stolen Ciphertext** | Biometric Feature Vector Theft | Stolen `.enc` biometric files | Offline brute-force attack on ciphertext | AES-256-GCM with keys sealed in OS Keychain / DPAPI | If OS keystore itself is compromised | Keys never leave OS keyring; nonces never reused |
| **T6: Presentation Attacker** | Face Spoofing | Workstation lock screen presence | High-res photo, video loop, 3D mask | Light (EAR blink, motion) & Strong (challenge-response) | High-res 4K video loop with dynamic eye cuts | Require Strong active challenge for high-security actions |
| **T7: Compromised Dependency** | Supply-Chain Code Execution | Core runtime process memory | Malicious code in npm package update | **Zero production runtime dependencies** | Build-time devDependency compromise | Pinned `package-lock.json`, 0 vulnerabilities in audit |
| **T8: Compromised Update** | Binary Replacement | OpenFaceID executable | Forged update downloaded over HTTP | **Zero unauthenticated auto-updates**; manual updates only | Unsigned development builds | Provide SHA256SUMS and release manifests |
| **T9: Malicious Administrator** | Memory Dump / Kernel Snooping | RAM camera frames, keys | Attaches debugger (`lldb`, `gdb`) or root dumper | `frame.zeroize()`, immediate buffer clearing | Root/SYSTEM can bypass userland memory sanitization | Documented fundamental boundary: root owns userland |
| **T10: Physical Attacker** | Hardware Cam Sniffing / USB Tampering | Video stream | Physical hardware tap between lens and USB bus | Hardware Privacy Pause releases device handle | Physical bus tampering cannot be prevented by software | Document hardware limitation in SECURITY.md |

---

## 2.2 Localhost IPC & Desktop Route Protection

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

