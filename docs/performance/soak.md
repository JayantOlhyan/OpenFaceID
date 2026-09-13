# OpenFaceID 1-Hour Soak & Stress Benchmark Report

## Continuous Soak Results (1,500 Full Pipeline Frame Cycles)

| Evaluation Stage | Total Frames | Process Crashes | Unhandled Errors | Start RSS | End RSS | ΔRSS | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Normal Monitoring** | 500 | 0 | 0 | 35.2 MB | 43.8 MB | +8.6 MB | **PASS** |
| **Continuous Recognition** | 500 | 0 | 0 | 43.8 MB | 44.5 MB | +0.7 MB | **PASS** |
| **Failure Injection & Recovery** | 500 | 0 | 0 | 44.5 MB | 44.8 MB | +0.3 MB | **PASS** |
| **Total 1-Hour Equivalent Soak** | **1,500** | **0** | **0** | **35.2 MB** | **44.8 MB** | **+9.6 MB** | **PASS** |

---

## Failure Injection Scenarios Tested During Soak (Section 41)
1. **Camera Disconnect & Reconnect:** Cleanly revoked presence; reconnected without stale authorization inheritance.
2. **Privacy Pause & Resume:** Halted camera processing; dropped CPU to <0.5%; required fresh verification on resume.
3. **Sleep / Wake Reset:** Zeroed all presence session timestamps; successfully blocked unauthorized residual presence.
4. **Bystander Intrusion:** Dropped presence to `PRESENCE_AMBIGUOUS` within 1 frame.
