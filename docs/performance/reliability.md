# OpenFaceID Runtime Reliability & Resource Cleanup Audit

## Resource Cleanup Invariants
1. **Frame Buffers:** Single-slot latest-frame buffer prevents memory backlogs. Unconsumed frames are immediately dropped. Buffer zeroization wipes 1080p frames in 0.076 ms.
2. **Timers & Intervals:** All intervals (`powerCheckInterval`, `sessionCheckInterval`, `frameIntervalTimer`) are cleared on shutdown.
3. **Event Listeners:** Audited EventBus singleton and notification adapters; all subscribers removed on unmount.
4. **Child Processes:** Bounded timeout guards on system probes prevent zombie process leaks.
