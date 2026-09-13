# Security Policy — OpenFaceID (SightLock)

## 1. Supported Versions

| Version | Supported | Notes |
| :--- | :--- | :--- |
| **v0.2.x** | :white_check_mark: | Active Release (Phase 5 Productization) |
| **v0.1.x** | :white_check_mark: | Maintenance |

---

## 2. Security Boundaries & Explicit Non-Claims

> [!CAUTION]
> **OpenFaceID relies on standard 2D webcams.**
> 2D optical sensors cannot provide the same hardware security guarantees as Apple Face ID (TrueDepth structured-light infrared projector) or Windows Hello (active IR illumination with TPM attestation).

### Fundamental Rules of OpenFaceID:
1. **Recognition != Authentication**: OpenFaceID performs **visual recognition** and **presence detection**. It does **not** bypass operating system kernel cryptographic authentication.
2. **No Plaintext Passwords**: OpenFaceID **never** prompts for, stores, or automates typing of user login passwords.
3. **No Keystroke Injection**: OpenFaceID will never inject synthetic keystrokes to simulate lock screen unlocking.
4. **Anti-Spoofing Disclaimer**: OpenFaceID implements Presentation Attack Detection (PAD) including blink detection, micro-motion analysis, and active challenge-response. However, no software-based 2D anti-spoofing mechanism is 100% spoof-proof against determined physical adversaries with high-resolution video or silicone masks.
5. **Fail-Closed Multiple-Face Defense**: If 2 or more faces are detected in view (`face_count >= 2`), OpenFaceID immediately transitions to `PRESENCE_AMBIGUOUS` and revokes presence authorization. It never authorizes presence merely because one face in a group matched.

---

## 3. Threat Mitigations in OpenFaceID

- **Cryptographic Model Integrity**: All vision models (`blazeface-detector`, `arcface-embedder`, `liveness-pad-evaluator`) are verified using SHA-256 digests at boot. Corrupted or tampered weights trigger `MODEL_INTEGRITY_FAILURE` and halt execution.
- **Presentation Attacks**: Mitigated via modular liveness checks (`Light` passive blink/motion variance, `Strong` active head rotation challenges).
- **Credential & Database Theft**: Biometric embeddings on disk are encrypted using **AES-256-GCM** with keys sealed inside OS keystores (Keychain, DPAPI, Secret Service) or a machine-bound PBKDF2 key.
- **Memory Inspection**: In-memory camera frame buffers and cryptographic keys are zeroized immediately following inference using `MemorySanitizer.zeroizeBuffer()`.
- **Local API Abuse & Cross-Origin CSRF**: Local REST/SSE server binds strictly to `127.0.0.1:4173`. Mutating and sensitive routes require an ephemeral 256-bit Bearer token validated via constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
- **Biometric Vector Secrecy**: Vector representations are never exposed over public HTTP responses or log outputs; API responses return only Boolean status, confidence scores, and identity IDs.
- **Log & Diagnostic Leakage**: Automated scanning scrubs biometric vectors, raw image arrays, tokens, and secrets from all diagnostic exports.

---

## 4. Desktop IPC Route Security Classifications

| Tier | Endpoints | Authentication | Threat Mitigated |
| :--- | :--- | :--- | :--- |
| **Public** | `GET /api/v1/health`, `GET /api/v1/branding` | None (Localhost loopback only) | Basic health monitoring without state disclosure |
| **Protected** | `GET /api/v1/state`, `GET /api/v1/hud`, `POST /api/v1/privacy/*`, `POST /api/v1/camera/select` | Ephemeral Bearer Token | Unauthorized action triggering by untrusted local scripts |
| **Sensitive** | `POST /api/v1/enrollment/*`, `DELETE /api/v1/identities/*`, `GET /api/v1/diagnostics/*` | Ephemeral Bearer Token | Biometric gallery tampering, identity replacement, log exfiltration |

---

## 5. Reporting a Vulnerability

If you discover a security vulnerability in OpenFaceID, please do **NOT** open a public GitHub issue.

Please report vulnerabilities privately via:
- **GitHub Private Vulnerability Reporting**: [OpenFaceID Security Advisories](https://github.com/JayantOlhyan/OpenFaceID/security/advisories)
- **Email**: `security@openfaceid.org` (or directly to maintainer Jayant Olhyan)

Please include:
1. Type of issue (e.g., presentation attack bypass, cryptographic flaw, memory leakage).
2. Step-by-step instructions to reproduce the vulnerability.
3. Proof-of-concept code or test media (if safe to transmit).

We commit to acknowledging reports within 48 hours and providing regular updates on mitigation progress.
