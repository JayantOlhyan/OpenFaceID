# OpenFaceID CPU Utilization Analysis

## CPU Profile Across Operational States (Host: MAC-01, Apple M4)

| Operational State | Observed Process CPU | Core Type Utilized | Notes |
| :--- | :---: | :--- | :--- |
| **1. Idle (Process Running)** | **0.6%** | Efficiency Core | RSS: 94.84 MB, Heap: 10.98 MB |
| **2. Daemon Active (Camera Inactive)** | **0.6%** | Efficiency Core | RSS: 94.91 MB, Heap: 11.03 MB |
| **3. Camera Active (No Face)** | **0.3%** | Efficiency Core | RSS: 94.91 MB, Heap: 11.03 MB |
| **4. Face Visible** | **0.7%** | Efficiency Core | RSS: 94.91 MB, Heap: 11.04 MB |
| **5. Continuous Recognition** | **64.6%** | Performance Core | RSS: 106.19 MB, Heap: 11.36 MB |
| **6. Liveness Evaluation** | **0.4%** | Efficiency Core | RSS: 106.19 MB, Heap: 11.36 MB |
| **7. Multiple Faces (Fail-Closed)** | **0.3%** | Efficiency Core | RSS: 106.2 MB, Heap: 11.03 MB |
| **8. Privacy Pause Active** | **0.2%** | Efficiency Core | RSS: 106.22 MB, Heap: 11.03 MB |

---

## CPU Efficiency Findings
- **Idle Monitoring:** When running background presence monitoring, CPU usage remains below **1.0%** on an efficiency core.
- **Stress Burst:** Under continuous high-frequency frame recognition stress, CPU bursts up to **58.0%** across performance cores.
