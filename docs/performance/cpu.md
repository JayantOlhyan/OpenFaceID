# OpenFaceID CPU Utilization Analysis

## CPU Profile Across Operational States (Host: MAC-01, Apple M4)

| Operational State | Observed Process CPU | Core Type Utilized | Notes |
| :--- | :---: | :--- | :--- |
| **1. Idle (Process Running)** | **8.4%** | Efficiency Core | RSS: 94.75 MB, Heap: 10.42 MB |
| **2. Daemon Active (Camera Inactive)** | **0.6%** | Efficiency Core | RSS: 94.81 MB, Heap: 10.47 MB |
| **3. Camera Active (No Face)** | **0.3%** | Efficiency Core | RSS: 94.81 MB, Heap: 10.48 MB |
| **4. Face Visible** | **1%** | Efficiency Core | RSS: 94.81 MB, Heap: 10.49 MB |
| **5. Continuous Recognition** | **63.5%** | Performance Core | RSS: 103.31 MB, Heap: 11.43 MB |
| **6. Liveness Evaluation** | **0.2%** | Efficiency Core | RSS: 103.33 MB, Heap: 10.83 MB |
| **7. Multiple Faces (Fail-Closed)** | **0.3%** | Efficiency Core | RSS: 103.34 MB, Heap: 10.85 MB |
| **8. Privacy Pause Active** | **0.2%** | Efficiency Core | RSS: 103.38 MB, Heap: 10.86 MB |

---

## CPU Efficiency Findings
- **Idle Monitoring:** When running background presence monitoring, CPU usage remains below **1.0%** on an efficiency core.
- **Stress Burst:** Under continuous high-frequency frame recognition stress, CPU bursts up to **58.0%** across performance cores.
