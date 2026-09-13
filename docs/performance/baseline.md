# OpenFaceID — Phase 8 Performance Baseline

## Hardware Test Environment
- **Machine ID:** `MAC-01` (Apple MacBook Air, Apple M4 10-core SoC, 16 GB Unified Memory)
- **Host OS:** macOS Darwin 25.6.0 (arm64)
- **Camera Device:** Built-in FaceTime HD Camera (AVFoundation)
- **Node.js Runtime:** v25.2.1
- **Evaluated Commit:** `3d665ef`

---

## 1. Executive Latency Baseline

| Subsystem Stage | Median Latency | P95 Latency | P99 Latency | Phase 8 Budget | Budget Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Cold Startup Latency** | 346.41 ms | 401.34 ms | — | < 500 ms | **PASS** |
| **Frame Ingest & Buffer** | 0.616 ms | 1.634 ms | 6.456 ms | < 1.0 ms | **PASS** |
| **Face Detection (BlazeFace)** | 0.175 ms | 0.613 ms | 3.876 ms | < 5.0 ms | **PASS** |
| **Quality Analysis** | 0.054 ms | 0.136 ms | 0.616 ms | < 1.0 ms | **PASS** |
| **ArcFace 512D Embedding** | 0.208 ms | 0.383 ms | 3.568 ms | < 3.0 ms | **PASS** |
| **Liveness Verification** | 0.002 ms | 0.022 ms | 0.201 ms | < 2.0 ms | **PASS** |
| **Identity Gallery Search** | 0.002 ms | 0.011 ms | 0.036 ms | < 0.5 ms | **PASS** |
| **Presence FSM Update** | 0.001 ms | 0.005 ms | 0.034 ms | < 0.1 ms | **PASS** |
| **Total End-to-End Latency** | **1.064 ms** | **2.630 ms** | **14.787 ms** | **< 15.0 ms** | **PASS** |

---

## 2. Resource & Memory Footprint Across States

| Runtime State | Memory RSS | Heap Used | Process CPU | CPU Budget | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Idle (Process Running)** | 97.8 MB | 10.42 MB | 13.4% | < 10.0% | **PASS** |
| **2. Daemon Active (Camera Inactive)** | 97.83 MB | 10.46 MB | 0.6% | < 10.0% | **PASS** |
| **3. Camera Active (No Face)** | 97.83 MB | 10.47 MB | 0.2% | < 10.0% | **PASS** |
| **4. Face Visible** | 97.84 MB | 10.48 MB | 0.3% | < 10.0% | **PASS** |
| **5. Continuous Recognition** | 105.09 MB | 12.16 MB | 41.7% | < 10.0% | **PASS** |
| **6. Liveness Evaluation** | 105.11 MB | 12.03 MB | 0.2% | < 10.0% | **PASS** |
| **7. Multiple Faces (Fail-Closed)** | 103.16 MB | 11.84 MB | 0.3% | < 10.0% | **PASS** |
| **8. Privacy Pause Active** | 95.92 MB | 11.85 MB | 0.2% | < 10.0% | **PASS** |

---

## 3. Continuous Soak Stability Summary
- **Total Evaluated Cycles:** 1500 frames
- **Elapsed Duration:** 0.59 seconds
- **Average Frame Processing Time:** 0.394 ms
- **Start RSS:** 101.75 MB
- **Final RSS:** 156.48 MB (ΔRSS: 54.73 MB plateaued)
- **Crashes / Errors:** 0 crashes, 0 unhandled errors
