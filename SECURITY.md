# Security Policy — OpenFaceID (SightLock)

## 1. Supported Versions

| Version | Status | Notes |
| :--- | :--- | :--- |
| **v0.2.x** | :white_check_mark: Supported | Active Release Line (`0.2.1-rc.1`) |
| **v0.1.x** | :warning: Maintenance | Critical security fixes only |

---

## 2. Security Boundaries & Explicit Non-Claims

> [!CAUTION]
> **Explicit Security Non-Claims**
> * **Standard 2D Webcams**: OpenFaceID operates with standard 2D RGB optical webcams. It does NOT have hardware depth sensing, structured-light infrared projectors, or hardware attestation.
> * **Recognition != Authentication**: OpenFaceID performs visual recognition and continuous presence monitoring at the desktop user session layer. It does **NOT** replace OS kernel authentication, passwords, or hardware security keys.
> * **No Password Handling**: OpenFaceID never prompts for, stores, or automates user OS login passwords.
> * **Anti-Spoofing Disclaimer**: Presentation Attack Detection (PAD) raises the barrier against casual photo/video attacks, but software-based 2D anti-spoofing is not certified against determined physical adversaries using high-resolution replays or silicone prosthetics.

---

## 3. Threat Mitigations in OpenFaceID

* **Fail-Closed Multiple-Face Rule**: If 2 or more faces are visible simultaneously, presence drops immediately to `PRESENCE_UNAUTHORIZED`.
* **Encrypted Identity Storage**: Facial vectors on disk are encrypted using **AES-256-GCM** (PBKDF2-HMAC-SHA256, 100,000 iterations). Files are restricted to mode `0600`.
* **OS Keystore Integration**: Master keys are stored in native operating system keychains (macOS Keychain, Windows DPAPI, Linux Secret Service).
* **Volatile-Only Camera Buffers**: Camera frames exist solely in volatile RAM during inference (<15ms) and are immediately wiped with `MemorySanitizer.zeroizeBuffer()`.
* **Authenticated Loopback IPC**: The local REST/SSE server binds strictly to `127.0.0.1:41793`. Mutating and data-access endpoints require an ephemeral 256-bit Bearer token validated in constant time via `crypto.timingSafeEqual`.
* **Child Process Hardening**: Automation commands execute with `shell: false` and strict array parameters. External webhook URLs are blocked (loopback only).

---

## 4. Reporting a Security Vulnerability

If you discover a security vulnerability, side-channel leak, or liveness bypass in OpenFaceID:

> [!IMPORTANT]
> **DO NOT OPEN A PUBLIC GITHUB ISSUE TO REPORT SECURITY VULNERABILITIES.**

### How to Report Privately

1. **GitHub Security Advisory (Preferred)**:
   Navigate to [JayantOlhyan/OpenFaceID Security Advisories](https://github.com/JayantOlhyan/OpenFaceID/security/advisories) and click **"Report a vulnerability"**.
2. **Email Disclosure**:
   Email the project maintainer directly at: `jayantolhyan@gmail.com` with subject line `[SECURITY] OpenFaceID Vulnerability Report`.

### What to Include in Your Report

* Description of the vulnerability and its potential impact.
* Component(s) affected (e.g., `packages/security`, `packages/api`, `packages/vision`).
* Proof of concept or step-by-step reproduction instructions.
* Hardware, operating system, and camera model used during discovery.
* Any proposed mitigations or patches.

### What NOT to Publicly Disclose

* Do not publish full exploit scripts, zero-day bypasses, or proof-of-concept videos before a coordinated disclosure fix is released.
* Do not commit real photographic face datasets or raw biometric vectors to public issues or PRs.

### Response Timeline

* **Initial Response**: Within 48 hours of receipt.
* **Triage & Reproduction**: Within 7 calendar days.
* **Fix & Coordinated Release**: Fix deployed in the next patch or minor release candidate, with public credit attributed to the reporter (unless anonymity is requested).
