# Security Policy — OpenFaceID (SightLock)

## 1. Supported Versions

| Version | Supported | Notes |
| :--- | :--- | :--- |
| **v0.1.x** | :white_check_mark: | Active Development |

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

---

## 3. Threat Mitigations in OpenFaceID

- **Presentation Attacks**: Mitigated via modular liveness checks (`Light` passive blink/motion variance, `Strong` active head rotation challenges).
- **Credential & Database Theft**: Biometric embeddings on disk are encrypted using **AES-256-GCM** with keys sealed inside OS keystores (Keychain, DPAPI, Secret Service).
- **Memory Inspection**: In-memory camera frame buffers and cryptographic keys are zeroized immediately following inference.
- **Local API Abuse**: Local REST/SSE server binds strictly to `127.0.0.1` and requires an ephemeral cryptographically random Bearer token for mutating operations.
- **Log Leakage**: The structured logger automatically scrubs biometric vectors, raw image arrays, and secrets.

---

## 4. Reporting a Vulnerability

If you discover a security vulnerability in OpenFaceID, please do **NOT** open a public GitHub issue.

Please report vulnerabilities privately via:
- **GitHub Private Vulnerability Reporting**: [OpenFaceID Security Advisories](https://github.com/JayantOlhyan/OpenFaceID/security/advisories)
- **Email**: `security@openfaceid.org` (or directly to maintainer Jayant Olhyan)

Please include:
1. Type of issue (e.g., presentation attack bypass, cryptographic flaw, memory leakage).
2. Step-by-step instructions to reproduce the vulnerability.
3. Proof-of-concept code or test media (if safe to transmit).

We commit to acknowledging reports within 48 hours and providing regular updates on mitigation progress.
