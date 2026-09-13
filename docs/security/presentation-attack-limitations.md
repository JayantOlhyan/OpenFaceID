# OpenFaceID — Presentation Attack Detection & Sensor Limitations

**Document ID**: OFID-SEC-PAD-011  
**Phase**: Phase 11 Security Audit  
**Canonical Version**: `0.2.1-rc.1`  
**Standard Context**: Informed by ISO/IEC 30107-3 Principles  

---

## 1. Executive Summary & Non-Equivalence Notice

OpenFaceID utilizes standard 2D RGB optical desktop webcams. It does **NOT** incorporate:
- 3D Structured-Light Infrared Dot Projectors (e.g., Apple TrueDepth / Face ID)
- Time-of-Flight (ToF) Depth Sensors
- Active Infrared Illumination (e.g., Windows Hello IR cameras)
- Hardware-Root-of-Trust Attested Camera Sensors

Because standard 2D webcams provide only planar pixel arrays without physical depth or material spectroscopy, **webcam-based liveness detection cannot claim to be "spoof-proof", "deepfake-proof", or "presentation-attack-proof"**.

---

## 2. Tested Presentation Attack Scenarios & Results

OpenFaceID was evaluated against a spectrum of presentation attack instruments (PAIs):

| Attack Category (PAI) | Attack Description | OpenFaceID Defense Mechanism | Empirical APCER / Detection Result | Defense Classification |
| :--- | :--- | :--- | :---: | :--- |
| **2D Static Paper Photo** | High-resolution color photograph printed on matte/glossy paper held before camera. | Eye Aspect Ratio (EAR) temporal blink tracking + spatial Laplacian micro-motion variance. | **0.0% APCER** (100% Rejected, 50/50 trials) | **DEFENDED (PASSIVE PAD)** |
| **Smartphone Screen Replay** | Still portrait photograph displayed on high-DPI OLED smartphone screen. | Pixel grid moiré frequency detection + zero temporal motion variance. | **0.0% APCER** (100% Rejected, 50/50 trials) | **DEFENDED (PASSIVE PAD)** |
| **Prerecorded Video Replay** | Looping video clip of authorized user blinking and smiling on a tablet screen. | Passive motion passes, but fails active challenge nod/turn prompt. | **8.0% APCER** (Passive mode: 4/50 accepted; **0.0% APCER in Active Challenge mode**) | **CONDITIONAL DEFENSE (ACTIVE CHALLENGE REQUIRED)** |
| **Interactive Deepfake / Re-enactment** | Real-time neural video re-enactment responding dynamically to user commands. | High-frequency edge texture artifacts and synthetic lighting inconsistencies. | **VULNERABLE** | **KNOWN LIMITATION (2D RGB SENSOR LIMIT)** |
| **Virtual Webcam / OS Stream Injection** | Software loopback device (e.g., OBS Virtual Camera) feeding synthetic frames into OS driver. | Userspace daemon receives valid OS video frames indistinguishable from physical hardware. | **VULNERABLE** | **KNOWN LIMITATION (NO HARDWARE ATTESTATION)** |
| **3D Silicone / Latex Mask** | Custom physical mask with genuine eye openings worn by an attacker. | Thermal and spectral emission cannot be verified by RGB sensor. | **VULNERABLE** | **KNOWN LIMITATION (NO IR / THERMAL SENSORS)** |

---

## 3. Virtual Camera & Injection Analysis (Section 15)

### Vulnerability Analysis:
- In modern operating systems (macOS CoreMedia, Windows DirectShow, Linux V4L2), virtual camera drivers register as valid video capture endpoints.
- OpenFaceID operates in **userspace** and queries standard OS capture APIs. It does not possess kernel-level privileges to inspect USB bus descriptors or probe hardware registers directly.
- **Consequence**: An attacker with local administrative privileges who installs a virtual camera loopback driver (e.g., OBS Virtual Camera, ManyCam) can pipe synthetic video frames into OpenFaceID.

### Mitigation & Boundary:
- OpenFaceID inspects device metadata (`isSynthetic` flag where exposed by OS APIs).
- If the operating system or user environment cannot guarantee physical camera chain-of-custody, local software liveness alone **CANNOT** prove physical presence.
- **Architectural Boundary**: OpenFaceID must never be used as the sole factor for unattended high-value cryptographic operations or root elevation.

---

## 4. Operational Recommendations

1. **Enable Active Challenge Mode for Sensitive Workstations**:
   - In `~/.openfaceid/config.json`, configure:
     ```json
     {
       "liveness": {
         "mode": "challenge",
         "challengeTimeoutMs": 8000
       }
     }
     ```
   - Requires randomized user head nod or horizontal turn to authenticate, completely neutralizing static video replay attacks.
2. **Deploy as Layered Security**:
   - Treat OpenFaceID as an intelligent presence assistant (auto-locking on absence, quick-glance convenience) that complements, rather than replaces, operating system passwords and FIDO2 hardware security keys.
