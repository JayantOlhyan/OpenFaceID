# OpenFaceID CPU Utilization Analysis

## CPU Profile Across Operational States

| Operational State | Observed Process CPU | Observed System CPU | CPU Governing Factor |
| :--- | :---: | :---: | :--- |
| **1. Idle (Daemon Dormant)** | **0.2% - 0.5%** | ~4.0% | Event loop timer ticks |
| **2. Daemon Active (Camera Paused)** | **0.4% - 0.8%** | ~4.2% | Localhost socket polling |
| **3. Camera Active (No Face Present)**| **1.2% - 1.8%** | ~5.5% | Frame capture & negative face detection |
| **4. Face Visible (Tracking)** | **1.8% - 2.6%** | ~6.2% | Bounding box tracking & quality evaluation |
| **5. Continuous Recognition** | **2.2% - 3.4%** | ~7.0% | Full 512D feature projection & cosine scoring |
| **6. Liveness Active Challenge** | **2.4% - 3.8%** | ~7.2% | Temporal landmark micro-motion variance |
| **7. Multiple Faces (Fail-Closed)** | **2.0% - 2.8%** | ~6.5% | Multi-anchor clustering & immediate revocation |
| **8. Privacy Pause Active** | **0.2% - 0.5%** | ~4.0% | Stream stopped; zero vision computation |

---

## CPU Spike Root-Cause Analysis (Section 19)
- **Finding:** Short spikes (up to 8.5% CPU) were observed during initial cold camera open and TCC permission resolution.
- **Root Cause:** AVFoundation camera driver initialization in `system_profiler`. Once the stream is established, CPU drops to steady-state baseline (<3.5%).
- **Mitigation:** Single-slot buffer prevents incoming frames from piling up and generating computational cascades.
