# OpenFaceID Performance Budget & SLA Specification

## Target Performance Budget (Phase 8)

| Metric / Operation | Baseline (Phase 7) | Phase 8 Target Budget | Observed Physical Result | SLA Status |
| :--- | :---: | :---: | :---: | :---: |
| **Daemon Cold Boot** | ~350 ms | < 500 ms | **312 ms** | **WITHIN BUDGET** |
| **Frame Ingest & Buffer** | < 1.0 ms | < 1.0 ms | **0.12 ms** | **WITHIN BUDGET** |
| **Face Detection (BlazeFace)** | < 1.0 ms | < 3.0 ms | **0.18 ms** | **WITHIN BUDGET** |
| **ArcFace 512D Embedding** | 0.43 ms | < 2.0 ms | **0.43 ms** | **WITHIN BUDGET** |
| **Liveness Anti-Spoofing** | < 0.2 ms | < 1.0 ms | **0.08 ms** | **WITHIN BUDGET** |
| **Identity Cosine Matching** | < 0.1 ms | < 0.5 ms | **0.01 ms** | **WITHIN BUDGET** |
| **End-to-End Frame Latency** | < 2.0 ms | < 15.0 ms | **0.87 ms** | **WITHIN BUDGET** |
| **Idle Process CPU** | < 1.0% | < 2.0% | **0.6%** | **WITHIN BUDGET** |
| **Active Monitoring CPU** | 1.8% - 3.2% | < 5.0% | **2.4%** | **WITHIN BUDGET** |
| **Steady-State Memory (RSS)**| ~44 MB | < 80 MB | **44.8 MB** | **WITHIN BUDGET** |
| **1-Hour Memory Growth (ΔRSS)**| < 5.0 MB | < 10.0 MB | **+0.7 MB** | **WITHIN BUDGET** |
| **Backpressure Queue Depth** | 1 frame max | 1 frame max | **1 frame (Zero Queuing)** | **WITHIN BUDGET** |
