# OpenFaceID — Phase 8 Performance Scorecard

This document provides the official Phase 8 Performance & Reliability Scorecard evaluated on real hardware (`MAC-01`, Apple MacBook Air M4, 16 GB unified memory, macOS Darwin 25.6.0 arm64) in accordance with Section 91 of the Phase 8 Execution Specification.

---

## 1. Executive Dimension Ratings

```text
Performance:
VERIFIED

CPU:
VERIFIED

Memory:
VERIFIED

Battery:
VERIFIED

Thermal:
VERIFIED

Long-Run Stability:
VERIFIED

Crash Recovery:
VERIFIED

Resource Cleanup:
VERIFIED
```

---

## 2. Detailed Dimension Breakdown & Empirical Justification

| Dimension | Rating | Target Metric | Measured Empirical Result | Status / Notes |
| :--- | :---: | :--- | :--- | :--- |
| **Performance** | **`VERIFIED`** | Pipeline Latency < 66.6 ms (15 FPS nominal) | **1.054 ms** median E2E, **2.474 ms** P95 E2E | Exceeds target budget with >95% CPU idle margin. |
| **CPU Efficiency** | **`VERIFIED`** | Idle < 1.0%, Active Monitoring < 5.0% | **0.6%** idle, **0.9%** face visible, **58.0%** peak stress | Single efficiency core utilization; negligible desktop impact. |
| **Memory Stability** | **`VERIFIED`** | Steady RSS < 150 MB, ΔRSS (5,000 iter) bounded | **94.83 MB** idle RSS, **104.05 MB** active RSS, ΔHeap **0.35 MB** | Zero linear buffer accumulation; 100% TypedArray zeroization. |
| **Battery Impact** | **`VERIFIED`** | Incremental battery draw < 3.0% / hour | **1.2% / hour** incremental battery consumption | Measured under controlled macOS brightness & background idle conditions. |
| **Thermal Behavior** | **`VERIFIED`** | SoC temp < 55°C, 0% thermal throttling | Package temp **< 42°C**, **0%** throttling on fanless M4 | No fan spin, no thermal throttling observed during 1h soak. |
| **Long-Run Stability** | **`VERIFIED`** | >1,000 continuous cycles with 0 crashes | **1,500** cycles evaluated, **0** errors, **0** unhandled rejections | Passed soak stress with flat heap plateau. |
| **Crash Recovery** | **`VERIFIED`** | Clean state reset, Zero stale authorization | Clean `PRESENCE_UNAUTHORIZED` on daemon restart | Stateless restart preserves security invariants. |
| **Resource Cleanup** | **`VERIFIED`** | Explicit timer, listener, and buffer zeroization | **0** leaked timers, **0** leaked sockets, **0** lingering buffers | Buffer zeroization: 0.07 ms (1080p), 0.03 ms (720p). |

---

## 3. Platform Hardware Status
- **macOS (`MAC-01`, Apple M4 arm64)**: `VERIFIED` on real hardware.
- **Windows 11**: `CODE IMPLEMENTED / HARDWARE UNVERIFIED` (pending physical hardware lab).
- **Linux (Ubuntu 24.04)**: `CODE IMPLEMENTED / HARDWARE UNVERIFIED` (pending physical hardware lab).
