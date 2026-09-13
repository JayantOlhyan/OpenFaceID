# OpenFaceID Performance Engineering Methodology

## Principles of Measurement
In strict compliance with Phase 8 engineering rules:
1. **No Artificial Downsampling:** All latency and throughput benchmarks preserve full analytical 512D ArcFace precision and 1080p/720p frame buffer integrity.
2. **Deterministic Distributions:** Every statistical metric reports Median, P95, P99, Min, and Max rather than misleading arithmetic means alone.
3. **Hardware Ground Truth:** Measurements distinguish between automated synthetic microbenchmarks and real physical hardware captures on host `MAC-01`.
4. **Zero-Trust Security Retention:** Security invariants (fail-closed multi-face, zero residual auth on wake, liveness gates, memory buffer zeroization) are kept active during all stress and soak runs.

## Tools & Sources
- **High-Resolution Clocks:** `perf_hooks.performance.now()` (microsecond precision monotonic clock).
- **Process Accounting:** `process.cpuUsage()` (user and system CPU microseconds) and `process.memoryUsage()` (Resident Set Size, Heap Total, Heap Used, External Buffers).
- **Network Audit:** `lsof -iTCP -sTCP:LISTEN -n -P` and socket byte inspection.
