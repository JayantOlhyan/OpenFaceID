# OpenFaceID Phase 8 Evidence Matrix

This matrix classifies every empirical claim made in Phase 8 by evidence type, reproducibility, hardware validation status, and defensibility in accordance with Section 32 of the Evidence Audit Specification.

---

| Empirical Claim | Evidence Type | Reproducible? | Real Hardware? | Benchmark ID | Empirical Status & Defensibility Boundaries |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **Daemon Startup Latency** | Hardware Process Launch | Yes | Yes (`MAC-01`) | `PERF-STARTUP-001` | **VERIFIED:** Median ~304 ms across 5 cold boots on Apple M4. |
| **Camera Init (AVFoundation)** | Hardware Enumeration | Yes | Yes (`MAC-01`) | Hardware probe | **VERIFIED:** ~268 ms via AVFoundation probe on Built-in FaceTime HD camera. |
| **Face Detection Latency** | Microbenchmark | Yes | Analytical | `PERF-CV-001` | **VERIFIED UNDER TEST CONDITIONS:** Median 0.174 ms on synthetic 640x480 buffer. Analytical formulation only; does not represent neural model inference. |
| **ArcFace Embedding Latency** | Microbenchmark | Yes | Analytical | `PERF-CV-001` | **VERIFIED UNDER TEST CONDITIONS:** Median 0.238 ms on synthetic patch. Analytical 512D Fourier/gradient projection only. |
| **Liveness Anti-Spoof Latency**| Microbenchmark | Yes | Analytical | `PERF-CV-001` | **VERIFIED UNDER TEST CONDITIONS:** Median 0.002 ms on temporal motion variance. |
| **Identity Matching Latency** | Microbenchmark | Yes | Analytical | `PERF-CV-001` | **VERIFIED UNDER TEST CONDITIONS:** Median 0.001 ms for single identity linear cosine matching. |
| **Analytical Pipeline Total** | Microbenchmark | Yes | Analytical | `PERF-CV-001` | **VERIFIED UNDER TEST CONDITIONS:** Median 0.628 ms total analytical execution on synthetic buffer. |
| **Camera-to-Authorization** | End-to-End Hardware | Partial | Limited | Manual probe | **LIMITED EVIDENCE:** Subject presence & optical capture takes 150-250 ms. Synthetic microbenchmark (0.63 ms) is NOT full camera-to-auth. |
| **Idle Process CPU** | Hardware Process Metric | Yes | Yes (`MAC-01`) | `PERF-RES-001` | **VERIFIED:** 0.6% on efficiency core during background dormancy. |
| **Active Monitoring CPU** | Hardware Process Metric | Yes | Yes (`MAC-01`) | `PERF-RES-001` | **VERIFIED:** 0.9% on efficiency core during active face tracking. |
| **Stress Recognition CPU** | Hardware Process Metric | Yes | Yes (`MAC-01`) | `PERF-RES-001` | **VERIFIED:** 58.0% burst on performance cores during continuous recognition. |
| **Steady Memory (RSS)** | Hardware Process Metric | Yes | Yes (`MAC-01`) | `PERF-RES-001` | **VERIFIED:** 94.8 MB idle, 104.0 MB active monitoring. |
| **Lifecycle Memory Stability** | Repeated Cycle Stress | Yes | Yes (`MAC-01`) | `PERF-LEAK-001` | **VERIFIED:** ΔRSS after 50 complete stop/start/recognize cycles is -3.62 MB (STABLE). |
| **Soak Memory Behavior** | Checkpointed Soak Audit | Yes | Yes (`MAC-01`) | `PERF-SOAK-001` | **VERIFIED UNDER TEST CONDITIONS:** RSS plateaus at ~280 MB after cycle 250; flat curve from 250 to 1250 cycles. |
| **Backpressure Frame Dropping**| Controlled Overload | Yes | Yes (`MAC-01`) | `PERF-BACKPRESSURE-001`| **VERIFIED:** Drops stale frames under overload (46.7% drop at 30 FPS, 75.0% at 120 FPS). Queued backlog = 0. |
| **Memory Buffer Zeroization** | Deterministic Benchmark| Yes | Yes (`MAC-01`) | `PERF-RES-001` | **VERIFIED:** 1080p (7.91 MB) wipes in 0.076 ms; 720p in 0.027 ms. |
| **Incremental Battery Draw** | Controlled Observation | Partial | Yes (`MAC-01`) | Observation | **LIMITED EVIDENCE:** ~1.2% / hr observed difference under single sequential run. Not a universal battery certification. |
| **SoC Thermal Behavior** | Hardware Observation | Partial | Yes (`MAC-01`) | Observation | **LIMITED EVIDENCE:** Package temp < 42°C, 0% throttling observed on fanless M4 during 1h test. |
| **1-Hour Survival** | Soak Test | Yes | Yes (`MAC-01`) | 1h soak | **VERIFIED FOR 1-HOUR PROFILE:** 0 crashes, 0 errors during 1-hour session. Does not establish 24-hour stability. |
| **Biometric Accuracy** | Evaluation | Yes | Analytical | Phase 6 eval | **NOT ESTABLISHED BY PHASE 8:** Phase 8 evaluated runtime performance, not public human cohort accuracy. |
