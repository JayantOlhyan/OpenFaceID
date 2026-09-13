# Presentation Attack Detection (PAD) & Liveness Results

**Evaluation Date**: 2026-09-13T14:49:30.548Z  
**Standard**: ISO/IEC 30107-3 Presentation Attack Detection  
**Modes**: Passive Micro-Motion (`light`) & Active Challenge-Response (`strong`)  

---

## Benchmark Results

| Scenario | Classification Type | Trials | Passed | Blocked | Security Status |
|---|---|---|---|---|---|
| **Bona Fide Live Presentation** | `Bona Fide` | 30 | 30 | 0 | `RESISTANT` |
| **2D Static Photo Presentation Attack** | `Attack` | 30 | 0 | 30 | `RESISTANT (Zero Bypass)` |
| **Digital Screen Replay / Freeze Frame** | `Attack` | 30 | 0 | 30 | `RESISTANT (Zero Bypass)` |
| **Active Challenge Non-Compliance (Timeout)** | `Attack` | 20 | 0 | 20 | `RESISTANT (Timed Out)` |
| **Active Challenge Compliance (Head Turn)** | `Bona Fide` | 20 | 20 | 0 | `ROBUST COMPLIANCE` |

---

## Formal PAD Metrics (ISO/IEC 30107-3)

- **APCER (Attack Presentation Classification Error Rate)**: `0.00%`  
  *(Target: $< 1.0\%$. Measures rate of spoofs mistakenly accepted as live).*
- **BPCER (Bona Fide Presentation Classification Error Rate)**: `0.00%`  
  *(Target: $< 5.0\%$. Measures rate of real users mistakenly rejected).*

---

## Vulnerability & Limitations Disclosure
1. **Printed Photo Resistance**: 100% blocked under passive mode because motion variance across temporal frames is exactly zero ($< 0.008$).
2. **Video Replay Resistance**: 100% blocked on static loops; subtle video loops with simulated blinks may require active challenge-response (`strong` mode) for absolute security.
3. **Hardware Limitation**: In the absence of specialized 3D structured light or active IR hardware, RGB webcam liveness relies on temporal optical flow, Eye Aspect Ratio (EAR) blink transitions, and user compliance with random spatial challenges.
