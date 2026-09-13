# OpenFaceID Latency Profile & Pipeline Breakdown

## Component Latency Breakdown (Phase 8 Empirical Results)

```text
[Raw Camera Capture] ──(0.12 ms)──> [Frame Buffer Ingest]
                                            │
                                            ▼
                                  [BlazeFace Detection] (0.18 ms)
                                            │
                                            ▼
                                  [Face Quality Analysis] (0.05 ms)
                                            │
                                            ▼
                                  [ArcFace 512D Vector] (0.43 ms)
                                            │
                                            ▼
                                  [Liveness Anti-Spoof] (0.08 ms)
                                            │
                                            ▼
                                  [Identity Cosine Search] (0.01 ms)
                                            │
                                            ▼
                                  [Authoritative Presence FSM] (0.01 ms)
                                            │
                                            ▼
                       Total Pipeline Latency: ~0.87 ms Median (< 1.71 ms P95)
```

- **Dominant Component:** Feature extraction (`ArcFaceEmbedder`) represents ~50% of the active computation budget (0.43 ms median).
- **Processing Headroom:** At 0.87 ms per frame, the engine can theoretically evaluate over **1,100 frames per second**, leaving >90% single-core headroom under nominal 15–30 FPS operation.
