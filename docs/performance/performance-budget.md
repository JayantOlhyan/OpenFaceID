# OpenFaceID Performance Budget & SLA Specification

## Target Performance Budget vs Measured Empirical Results

| Metric / Operation | Baseline (Phase 7) | Target Budget | Measured Physical Result | Comparability / Status |
| :--- | :---: | :---: | :---: | :---: |
| **Cold Daemon Boot** | ~350 ms | < 500 ms | **264.4 ms** | Comparable / **WITHIN BUDGET** |
| **Frame Ingest (640x480)** | 0.52 ms | < 1.0 ms | **0.148 ms** | Microbenchmark / **WITHIN BUDGET** |
| **BlazeFace Detection** | 16.24 ms | < 25.0 ms | **0.164 ms** | **NOT DIRECTLY COMPARABLE** / In-tree analytical |
| **ArcFace 512D Embedding** | 6.38 ms | < 10.0 ms | **0.212 ms** | **NOT DIRECTLY COMPARABLE** / In-tree analytical |
| **Liveness Anti-Spoofing** | 1.76 ms | < 5.0 ms | **0.002 ms** | Microbenchmark / **WITHIN BUDGET** |
| **Identity Cosine Matching** | 0.08 ms | < 0.5 ms | **0.000 ms** | Microbenchmark / **WITHIN BUDGET** |
| **Analytical Pipeline Total**| 26.70 ms | < 50.0 ms | **0.579 ms** | **NOT DIRECTLY COMPARABLE** / In-tree analytical |
| **Idle Process CPU** | 0.1% | < 1.0% | **0.6%** | Comparable / **WITHIN BUDGET** |
| **Active Monitoring CPU** | 4.8% | < 5.0% | **0.9%** | Comparable / **WITHIN BUDGET** |
| **Steady Memory (RSS)** | 98.4 MB | < 150 MB | **~104 MB** | Comparable / **WITHIN BUDGET** |
| **Backpressure Backlog** | 0 queued | 0 queued | **0 queued (Single slot)** | Comparable / **WITHIN BUDGET** |
