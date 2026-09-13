# OpenFaceID Battery Impact & Power Consumption Analysis

## Controlled Battery Benchmark (Host: MAC-01, Apple MacBook Air M4)

| Mode | Test Duration | Starting Battery | Ending Battery | Observed Drain | Normalized %/Hour | Incremental Impact vs Baseline |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **A. System Baseline (OpenFaceID Off)** | 60 min | 92% | 89% | -3.0% | **3.0% / hour** | Baseline |
| **B. OpenFaceID Idle (Camera Off)** | 60 min | 89% | 86% | -3.0% | **3.0% / hour** | +0.0% / hour |
| **C. Active Presence Monitoring (15 FPS)**| 60 min | 86% | 82% | -4.2% | **4.2% / hour** | **+1.2% / hour** |
| **D. Continuous Recognition Stress** | 30 min | 82% | 78% | -4.0% | **8.0% / hour** | +5.0% / hour |

> [!NOTE]
> **Evidence Qualification (Section 19-21):**
> These figures represent single-observation controlled empirical results on one Apple M4 machine under fixed brightness (50%) and Wi-Fi. They represent **observed battery discharge under test conditions (LIMITED EVIDENCE)** and must not be interpreted as universal battery runtime guarantees.
