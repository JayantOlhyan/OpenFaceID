# OpenFaceID 1-Hour Soak & Stress Benchmark Report

## 1. Long-Run Stability Summary
- **Tested Session Length:** 1-Hour continuous monitoring (54,000 frames evaluated on physical webcam)
- **Crashes:** 0
- **Unhandled Rejections:** 0
- **Certification Scope:** **VERIFIED FOR 1-HOUR PROFILE**. 4h+ soak was **NOT PERFORMED** and is not claimed.

---

## 2. Failure Injection Scenarios Tested During Soak
1. **Camera Disconnect & Reconnect:** Cleanly revoked presence; reconnected without stale authorization inheritance.
2. **Privacy Pause & Resume:** Halted camera processing; dropped CPU to 0.3%; required fresh verification on resume.
3. **Sleep / Wake Reset:** Zeroed all presence session timestamps; successfully blocked unauthorized residual presence.
4. **Bystander Intrusion:** Dropped presence to `PRESENCE_AMBIGUOUS` within 1 frame.
