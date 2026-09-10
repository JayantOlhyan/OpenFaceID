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
| **Information Disclosure** | Biometric Data Theft | Local malicious process attempts to read facial images from disk | Critical | **Zero disk writes of raw images**. Frames exist only in RAM and are zeroized immediately. Embeddings are encrypted via OS Keychain/DPAPI/SecretService. | Attacker with root/SYSTEM privileges can inspect raw process memory (RAM). |
| **Information Disclosure** | Network Leakage / Telemetry Sniffing | Biometric data leaked over internet connection | Critical | **Zero network egress**. Zero cloud servers, zero analytics, zero telemetry. Daemon binds strictly to `127.0.0.1`. | None. |
| **Denial of Service** | Camera Lockout / Resource Exhaustion | Rapid frame hammering or camera detachment | Low | FrameSampler dynamically throttles capture (1–15 FPS). Reconnect recovery detects disconnection without crashing. | Physical lens occlusion cannot be resolved by software. |
| **Elevation of Privilege** | Lock Screen Bypass / Credential Injection | App simulates keystrokes to type user password | Critical | **STRICT RULE**: OpenFaceID **never** stores plaintext OS passwords and **never** injects keystrokes to unlock OS screens. | None; OpenFaceID does not claim to replace OS login authentication. |

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

## 4. Residual Risks & Brutal Honesty

1. **Webcams Lack Hardware Depth**: Without an infrared dot projector (Apple TrueDepth) or dual-sensor IR camera (Windows Hello), 2D optical face recognition **cannot guarantee absolute physical presence**. OpenFaceID must be used for convenience and presence-based locking, not for high-threat physical security scenarios.
2. **Root / Kernel Compromise**: An adversary possessing root/admin privileges on the host machine can inspect volatile memory, hook kernel display drivers, or manipulate the camera device stream.
3. **Twin / Close Relative Resemblance**: As with all 2D deep embedding models, identical twins or close biological relatives with high facial resemblance may produce similarity scores exceeding the standard 0.72 threshold.
