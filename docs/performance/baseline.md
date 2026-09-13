# OpenFaceID — Phase 8 Performance Baseline & Evidence-Audited Metrics

## Hardware Test Environment
- **Machine ID:** `MAC-01` (Apple MacBook Air, Apple M4 10-core SoC, 16 GB Unified Memory)
- **Host OS:** macOS Darwin 25.6.0 (`arm64`)
- **Primary Camera:** Built-in FaceTime HD Camera (AVFoundation)
- **Node.js Runtime:** v25.2.1
- **Evaluated Commit:** `3d665ef`

---

## 1. Analytical In-Tree Microbenchmark Baseline (Synthetic 640x480 Frame)
*Note: Evaluated across 250 timed iterations after 50 untimed warm-up cycles. Measures pure in-tree JavaScript analytical algorithms, not deep neural networks.*

| In-Tree Stage (Microbenchmark) | Median (ms) | P95 (ms) | P99 (ms) | Min (ms) | Max (ms) | Budget Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Frame Ingest & Buffer Normalization** | 0.149 | 0.159 | 0.166 | 0.135 | 0.189 | **PASS** |
| **BlazeFace Detection (896 Anchors)** | 0.165 | 0.201 | 0.218 | 0.149 | 0.238 | **PASS** |
| **Face Quality Analysis** | 0.050 | 0.056 | 0.063 | 0.045 | 0.066 | **PASS** |
| **ArcFace 512D Embedding** | 0.205 | 0.244 | 0.291 | 0.181 | 0.295 | **PASS** |
| **Liveness Anti-Spoofing** | 0.002 | 0.003 | 0.004 | 0.001 | 0.010 | **PASS** |
| **Identity Cosine Matching (1 ID)** | 0.000 | 0.002 | 0.004 | 0.000 | 0.017 | **PASS** |
| **Presence State FSM Update** | 0.001 | 0.002 | 0.006 | 0.000 | 0.068 | **PASS** |
| **Analytical Pipeline Total** | **0.578** | **0.637** | **0.700** | **0.527** | **0.747** | **PASS** |

---

## 2. Hardware Runtime Baseline (MAC-01)
- **Cold Boot Daemon Ready:** 329.56 ms (Median) / 357.97 ms (P95)
- **Camera Initialization (AVFoundation):** ~268 ms
- **Idle Process CPU:** 0.6%
- **Active Presence Monitoring CPU:** 0.9%
- **Steady Active RSS:** ~104 MB
- **1080p RAM Buffer Zeroization:** 0.076 ms
- **Controlled Overload Frame Dropping:** Single-slot buffer capacity = 1, Queued backlog = 0, Stale frames dropped.
