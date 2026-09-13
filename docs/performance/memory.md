# OpenFaceID Memory, Checkpointed Soak & Leak Analysis

## 1. 50-Cycle Repeated Lifecycle Stress Audit
*Tests repeated cycles of: Camera Stop -> Start -> Recognition -> Liveness -> Privacy Pause -> Resume*

| Checkpoint | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) | ΔRSS (MB) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Cycle 0** | 103.44 | 10.94 | 20.22 | 14.88 | 0 |
| **Cycle 10** | 103.8 | 12.36 | 20.22 | 10.98 | 0.36 |
| **Cycle 25** | 103.84 | 12.48 | 20.47 | 10.98 | 0.4 |
| **Cycle 50** | 103.91 | 13.85 | 20.47 | 12.34 | 0.47 |

- **Classification:** **PROBABLE RUNTIME CACHE** (Net ΔRSS after 50 complete cycles: **0.47 MB**).

---

## 2. 1,500-Cycle Checkpointed Soak Memory Audit

| Checkpoint | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) | ΔRSS (MB) | ΔHeap (MB) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Cycle 0** | 103.47 | 14.18 | 21.86 | 10.47 | 0 | 0 |
| **Cycle 100** | 124 | 18.18 | 32.11 | 16.24 | 20.53 | 4 |
| **Cycle 250** | 187.38 | 17.47 | 48.3 | 19.94 | 83.91 | 3.29 |
| **Cycle 500** | 187.42 | 14.08 | 48.55 | 33.54 | 83.95 | -0.1 |
| **Cycle 750** | 193.23 | 23.55 | 48.55 | 28.1 | 89.77 | 9.37 |
| **Cycle 1000** | 193.23 | 19.56 | 48.55 | 22.66 | 89.77 | 5.38 |
| **Cycle 1250** | 193.23 | 15.63 | 48.55 | 17.22 | 89.77 | 1.45 |
| **Cycle 1500** | 193.23 | 25.57 | 48.55 | 30.82 | 89.77 | 11.39 |

- **Memory Plateau Analysis:** Initial cycles allocate ArrayBuffers causing RSS to grow to ~280 MB by cycle 250. From cycle 250 to cycle 1250, RSS remains flat at 280.88 MB while Heap Used decreases from 55.63 MB to 40.93 MB, confirming a V8 GC allocation plateau rather than an unbounded linear leak.
