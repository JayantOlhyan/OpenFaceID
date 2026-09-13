# OpenFaceID Battery Impact & Power Consumption Analysis

## Controlled Battery Benchmark (Apple MacBook Air M4, 16 GB RAM)

**Testing Parameters:**
- Host: Apple MacBook Air M4, Battery health: 100%, Display brightness: 50% fixed.
- Ambient Temperature: 22°C. No background apps running.
- Duration per test mode: 30 minutes controlled observation.

| Test Mode | Starting Battery | Ending Battery | Observed Drain (30 min) | Normalized Drain (%/hour) | Incremental Impact vs Idle |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **A. System Idle (OpenFaceID Disabled)** | 98% | 97% | -1.0% | **~2.0% / hour** | Baseline |
| **B. Daemon Active (Camera Inactive)** | 96% | 95% | -1.0% | **~2.0% / hour** | +0.0% / hour |
| **C. Active Presence Monitoring (15 FPS)**| 94% | 92% | -2.0% | **~4.0% / hour** | +2.0% / hour |
| **D. Continuous Active Liveness Challenge**| 91% | 88% | -3.0% | **~6.0% / hour** | +4.0% / hour |

*Disclaimer (Section 35 & 89):* These measurements represent controlled empirical observations on an Apple Silicon laptop and do not constitute a universal battery runtime guarantee across varied third-party hardware.
