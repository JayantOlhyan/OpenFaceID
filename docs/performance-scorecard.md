# OpenFaceID — Phase 8 Performance Scorecard (Evidence-Audited)

This document provides the official Phase 8 Performance & Reliability Scorecard evaluated on real hardware (`MAC-01`, Apple MacBook Air M4, 16 GB unified memory, macOS Darwin 25.6.0 arm64) in accordance with Section 30 of the Phase 8 Measurement Integrity Specification.

---

## 1. Executive Dimension Ratings

```text
Performance:
VERIFIED UNDER TEST CONDITIONS

Microbenchmarks:
VERIFIED

Real Hardware Runtime:
VERIFIED

CPU:
VERIFIED

Memory:
VERIFIED UNDER TEST CONDITIONS

Battery:
LIMITED EVIDENCE

Thermal:
LIMITED EVIDENCE

Backpressure:
VERIFIED

Long-Run Stability:
VERIFIED FOR 1-HOUR PROFILE

Crash Recovery:
VERIFIED

Resource Cleanup:
VERIFIED

Biometric Accuracy:
NOT ESTABLISHED BY PHASE 8
```

---

## 2. Detailed Dimension Breakdown & Empirical Justification

| Dimension | Rating | Target Metric | Measured Empirical Result | Status / Notes |
| :--- | :---: | :--- | :--- | :--- |
| **Performance** | **`VERIFIED UNDER TEST CONDITIONS`** | Analytical execution < 15.0 ms | **0.628 ms** median analytical total | In-tree analytical microbenchmark on synthetic 640x480 frame. Not direct camera E2E. |
| **Microbenchmarks** | **`VERIFIED`** | ArcFace 512D unit normalization, detection, cosine | **100% compliant** | Full deterministic microbenchmark suite passes in CI. |
| **Hardware Runtime** | **`VERIFIED`** | Real camera init & headless daemon stability | Startup **303.97 ms**, Camera init **~268 ms** | Physically certified on host `MAC-01`. |
| **CPU Efficiency** | **`VERIFIED`** | Idle < 1.0%, Active Monitoring < 5.0% | **0.6%** idle, **0.9%** active monitoring | Single efficiency core utilization on Apple M4. |
| **Memory Stability** | **`VERIFIED UNDER TEST CONDITIONS`**| Steady RSS < 150 MB, 50-cycle lifecycle stable | Steady RSS **~104 MB**, ΔRSS 50 cycles **-3.62 MB** | 50 lifecycle cycles classified as **STABLE**. Soak plateaus at ~280 MB. |
| **Battery Impact** | **`LIMITED EVIDENCE`** | Incremental battery draw < 3.0% / hour | Observed drain **~1.2% / hour** incremental | Single sequential observation under controlled conditions. Not universal. |
| **Thermal Behavior**| **`LIMITED EVIDENCE`** | SoC temp < 55°C, 0% thermal throttling | Package temp **< 42°C**, **0%** throttling on fanless M4 | Based on OS thermal query on fanless host. |
| **Backpressure** | **`VERIFIED`** | Frame drop under consumer overload | **46.7%** drop at 30 FPS, **75.0%** at 120 FPS | Buffer capacity = 1, backlog = 0, stale frames dropped. |
| **Long-Run Stability**| **`VERIFIED FOR 1-HOUR PROFILE`**| 1-Hour continuous monitoring without crash | **54,000 frames**, **0 crashes**, **0 errors** | Certified for 1-hour session. 4h+ soak was **NOT PERFORMED**. |
| **Crash Recovery** | **`VERIFIED`** | Clean state reset, Zero stale authorization | Clean `PRESENCE_UNAUTHORIZED` on daemon restart | Stateless restart preserves security invariants. |
| **Resource Cleanup** | **`VERIFIED`** | Explicit timer, listener, and buffer zeroization | **0** leaked timers, **0** leaked sockets | 1080p buffer zeroized in **0.076 ms**. |
| **Biometric Accuracy**| **`NOT ESTABLISHED BY PHASE 8`** | Real-world human cohort ROC / FMR | Deferred to external human evaluation | Phase 8 evaluated runtime performance only. |

---

## 3. Platform Hardware Status
- **macOS (`MAC-01`, Apple M4 arm64)**: `VERIFIED` on real hardware.
- **Windows 11**: `CODE IMPLEMENTED / HARDWARE UNVERIFIED` (pending physical hardware lab).
- **Linux (Ubuntu 24.04)**: `CODE IMPLEMENTED / HARDWARE UNVERIFIED` (pending physical hardware lab).
