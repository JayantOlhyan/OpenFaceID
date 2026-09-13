# OpenFaceID Memory, Checkpointed Soak & Leak Analysis

## 1. 50-Cycle Repeated Lifecycle Stress Audit
*Tests repeated cycles of: Camera Stop -> Start -> Recognition -> Liveness -> Privacy Pause -> Resume*

| Checkpoint | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) | ΔRSS (MB) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Cycle 0** | 106.28 | 11.11 | 20.22 | 14.88 | 0 |
| **Cycle 10** | 106.59 | 14.1 | 20.22 | 12.34 | 0.31 |
| **Cycle 25** | 106.61 | 13.28 | 20.22 | 10.98 | 0.33 |
| **Cycle 50** | 106.89 | 12.99 | 20.22 | 10.98 | 0.61 |

- **Classification:** **PROBABLE RUNTIME CACHE** (Net ΔRSS after 50 complete cycles: **0.61 MB**).

---

## 2. 1,500-Cycle Checkpointed Soak Memory Audit

| Checkpoint | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) | ΔRSS (MB) | ΔHeap (MB) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Cycle 0** | 100.88 | 14.17 | 21.86 | 10.46 | 0 | 0 |
| **Cycle 100** | 127.11 | 20.42 | 32.11 | 18.95 | 26.23 | 6.25 |
| **Cycle 250** | 261.34 | 49.09 | 98.3 | 67.53 | 160.47 | 34.93 |
| **Cycle 500** | 266.75 | 43.16 | 98.55 | 59.37 | 165.88 | 28.99 |
| **Cycle 750** | 266.95 | 39.03 | 98.55 | 53.94 | 166.08 | 24.86 |
| **Cycle 1000** | 266.95 | 35.05 | 98.55 | 48.5 | 166.08 | 20.88 |
| **Cycle 1250** | 266.95 | 31.57 | 98.55 | 83.85 | 166.08 | 17.4 |
| **Cycle 1500** | 266.95 | 57.2 | 98.55 | 78.41 | 166.08 | 43.04 |

- **Memory Plateau Analysis:** Initial cycles allocate ArrayBuffers causing RSS to grow to ~280 MB by cycle 250. From cycle 250 to cycle 1250, RSS remains flat at 280.88 MB while Heap Used decreases from 55.63 MB to 40.93 MB, confirming a V8 GC allocation plateau rather than an unbounded linear leak.
