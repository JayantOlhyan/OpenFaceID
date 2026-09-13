# OpenFaceID Benchmark Provenance & Measurement Catalog

This document establishes the authoritative provenance of every performance, resource, and reliability benchmark executed during Phase 8 in accordance with Section 5 of the Phase 8 Measurement Integrity Specification.

---

## Benchmark Registry

### `PERF-STARTUP-001`: Cold Daemon Boot Latency
- **Script:** `scripts/performance/run-pipeline-benchmark.js`
- **Command:** `node scripts/performance/run-pipeline-benchmark.js`
- **Input:** Clean process initialization with uninitialized storage/FSM
- **Data Source:** Host OS environment and configuration files
- **Algorithm Path:** PlatformAdapter -> Storage check -> FSM initialization -> Camera enumeration
- **Warm-Up:** None (measures true cold launch)
- **Iterations:** 5 cold process executions
- **Timer:** Monotonic `perf_hooks.performance.now()`
- **Hardware / Host:** `MAC-01` (Apple MacBook Air M4, 16 GB RAM, macOS Darwin 25.6.0 arm64)
- **Node Version:** v25.2.1
- **Commit:** `3d665ef`
- **Measured Result:** Median 264.45 ms, P95 377.93 ms

---

### `PERF-CV-001`: In-Tree Analytical Pipeline Microbenchmark
- **Script:** `scripts/performance/run-pipeline-benchmark.js`
- **Command:** `node scripts/performance/run-pipeline-benchmark.js`
- **Input:** Synthetic 640x480 RGBA TypedArray buffer fixture
- **Data Source:** In-memory pre-rendered frame buffer
- **Algorithm Path:** BlazeFaceDetector (896 anchors) -> FaceQualityAnalyzer -> ArcFaceEmbedder (512D) -> LivenessDetector -> Cosine Matching -> CanonicalStateMachine
- **Warm-Up:** 50 untimed iterations
- **Iterations:** 250 timed iterations
- **Timer:** Monotonic `perf_hooks.performance.now()`
- **Hardware / Host:** `MAC-01` (Apple MacBook Air M4, 16 GB RAM, macOS Darwin 25.6.0 arm64)
- **Node Version:** v25.2.1
- **Commit:** `3d665ef`
- **Measured Result:** Median 0.579 ms, P95 0.624 ms

---

### `PERF-BACKPRESSURE-001`: Controlled Consumer Overload & Frame Dropping
- **Script:** `scripts/performance/run-pipeline-benchmark.js`
- **Command:** `node scripts/performance/run-pipeline-benchmark.js`
- **Input:** 640x480 frames pushed at 30, 60, 120 FPS burst into consumer with simulated 35ms processing delay (~28.5 FPS capacity)
- **Data Source:** Synthetic frame generator
- **Algorithm Path:** CameraManager latest-frame single-slot buffer & backpressure drop guard
- **Warm-Up:** 10 cycles
- **Iterations:** 500 ms sustained burst per frequency
- **Timer:** Monotonic `perf_hooks.performance.now()`
- **Hardware / Host:** `MAC-01` (Apple MacBook Air M4, 16 GB RAM, macOS Darwin 25.6.0 arm64)
- **Node Version:** v25.2.1
- **Commit:** `3d665ef`
- **Measured Result:** Drop rate 46.7% at 30 FPS, 66.7% at 60 FPS, 75.0% at 120 FPS. Buffer capacity = 1, Queued backlog = 0, Average frame age = ~35 ms.

---

### `PERF-RES-001`: 8-State Runtime Resource Profiling
- **Script:** `scripts/performance/run-resource-benchmark.js`
- **Command:** `node scripts/performance/run-resource-benchmark.js`
- **Input:** Canonical state transitions across 8 operational states
- **Data Source:** Live desktop engine daemon instance
- **Algorithm Path:** Engine state machine and camera manager lifecycle
- **Sampling Window:** 100 ms per state
- **Timer:** Monotonic `perf_hooks.performance.now()`, `process.cpuUsage()`, `process.memoryUsage()`
- **Hardware / Host:** `MAC-01` (Apple MacBook Air M4, 16 GB RAM, macOS Darwin 25.6.0 arm64)
- **Node Version:** v25.2.1
- **Commit:** `3d665ef`
- **Measured Result:** Idle CPU 0.6%, Active CPU 0.9%, Idle RSS ~94 MB, Active RSS ~104 MB

---

### `PERF-LEAK-001`: Repeated Lifecycle Cycle Stress & Memory Stability
- **Script:** `scripts/performance/run-resource-benchmark.js`
- **Command:** `node scripts/performance/run-resource-benchmark.js`
- **Input:** 50 complete lifecycle iterations (camera stop -> start -> recognition -> liveness -> privacy pause -> resume)
- **Data Source:** Live engine process
- **Algorithm Path:** Complete daemon lifecycle loop
- **Iterations:** 50 cycles with checkpoints at 0, 10, 25, 50
- **Timer:** `process.memoryUsage()`
- **Hardware / Host:** `MAC-01` (Apple MacBook Air M4, 16 GB RAM, macOS Darwin 25.6.0 arm64)
- **Node Version:** v25.2.1
- **Commit:** `3d665ef`
- **Measured Result:** ΔRSS after 50 cycles: -3.62 MB (Classification: STABLE)

---

### `PERF-SOAK-001`: 1,500-Cycle Checkpointed Stability & Memory Plateau Audit
- **Script:** `scripts/performance/run-stress-soak.js`
- **Command:** `node scripts/performance/run-stress-soak.js`
- **Input:** 1,500 full pipeline frame ingestions with failure injections
- **Data Source:** Live engine daemon with event bus
- **Algorithm Path:** Full processFrame pipeline with periodic state changes
- **Checkpoints:** 0, 100, 250, 500, 750, 1000, 1250, 1500
- **Timer:** Monotonic `perf_hooks.performance.now()`, `process.memoryUsage()`
- **Hardware / Host:** `MAC-01` (Apple MacBook Air M4, 16 GB RAM, macOS Darwin 25.6.0 arm64)
- **Node Version:** v25.2.1
- **Commit:** `3d665ef`
- **Measured Result:** RSS plateaus around ~280 MB after cycle 250 with flat memory curve from 250 to 1250 cycles. 0 crashes, 0 errors.
