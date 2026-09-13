# OpenFaceID Latency Profile & Pipeline Breakdown

## 1. In-Tree Analytical Micro-Stage Breakdown

```text
[Synthetic Frame Ingest] ──(0.159 ms)──> [BlazeFace 896 Anchors] (0.174 ms)
                                                    │
                                                    ▼
                                          [Quality Check] (0.052 ms)
                                                    │
                                                    ▼
                                          [ArcFace 512D] (0.238 ms)
                                                    │
                                                    ▼
                                          [Liveness Anti-Spoof] (0.002 ms)
                                                    │
                                                    ▼
                                          [Linear Cosine Match] (0.001 ms)
                                                    │
                                                    ▼
                                          [Canonical FSM] (0.001 ms)
                                                    │
                                                    ▼
                             Total Analytical Microbenchmark: ~0.628 ms Median
```

## 2. Critical Comparability Clarification (Section 3 & 8)
- **Phase 7 Reported Baseline (16.24 ms detection, 6.38 ms embedding):** Came from historical runs under different hardware, lighting, or browser-based WebRTC capture pipelines.
- **Phase 8 In-Tree Analytical Latency (0.174 ms detection, 0.238 ms embedding):** Measures pure Node.js in-tree TypeScript analytical mathematical execution on synthetic memory buffers.
- **Conclusion:** These workloads are **NOT DIRECTLY COMPARABLE**. The numerical decrease reflects differing benchmark boundaries, not a 90x algorithmic optimization.
