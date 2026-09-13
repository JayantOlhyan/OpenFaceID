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
| **Frame Ingest & Buffer Normalization** | 0.148 | 0.154 | 0.159 | 0.146 | 0.188 | **PASS** |
| **BlazeFace Detection (896 Anchors)** | 0.164 | 0.198 | 0.211 | 0.162 | 0.216 | **PASS** |
| **Face Quality Analysis** | 0.050 | 0.052 | 0.058 | 0.049 | 0.063 | **PASS** |
| **ArcFace 512D Embedding** | 0.212 | 0.231 | 0.266 | 0.204 | 0.275 | **PASS** |
| **Liveness Anti-Spoofing** | 0.002 | 0.002 | 0.007 | 0.001 | 0.010 | **PASS** |
| **Identity Cosine Matching (1 ID)** | 0.000 | 0.002 | 0.003 | 0.000 | 0.015 | **PASS** |
| **Presence State FSM Update** | 0.001 | 0.002 | 0.004 | 0.000 | 0.070 | **PASS** |
| **Analytical Pipeline Total** | **0.579** | **0.624** | **0.693** | **0.569** | **0.703** | **PASS** |

---

## 2. Hardware Runtime Baseline (MAC-01)
- **Cold Boot Daemon Ready:** 264.45 ms (Median) / 377.93 ms (P95)
- **Camera Initialization (AVFoundation):** ~268 ms
- **Idle Process CPU:** 0.6%
- **Active Presence Monitoring CPU:** 0.9%
- **Steady Active RSS:** ~104 MB
- **1080p RAM Buffer Zeroization:** 0.076 ms
- **Controlled Overload Frame Dropping:** Single-slot buffer capacity = 1, Queued backlog = 0, Stale frames dropped.
