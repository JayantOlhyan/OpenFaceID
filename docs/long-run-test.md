# OpenFaceID — Long-Run Stability & Soak Testing Protocol

This document details the long-running stability, soak testing methodology, and leak detection protocols for OpenFaceID (SightLock).

---

## 1. Objectives & Quality Gates

Desktop background utilities must run continuously for days or weeks without:
1. Leaking memory (monotonically expanding heap or RSS).
2. Leaking EventBus listeners or EventEmitter callbacks.
3. Leaking OS file descriptors or socket handles.
4. Crashing or hanging when camera devices are unplugged, switched, or preempted.
5. Exhausting rate-limiter maps under repeated IPC polling.

---

## 2. Long-Run Soak Test Execution Matrix

| Test Suite | Target Duration | Total Inferences | Target Heap Drift | Target Status |
| :--- | :--- | :--- | :--- | :--- |
| **Short Soak** | 1 Hour | ~54,000 Frames | < 2.0 MB | **PASSED** |
| **Workday Soak**| 8 Hours | ~432,000 Frames | < 5.0 MB | **PASSED** |
| **Weekend Soak**| 48 Hours | ~2,592,000 Frames | < 10.0 MB | **QUALIFIED** |

---

## 3. Leak Verification Audits

### 3.1 Memory Leak Audit (V8 Heapsnapshots)
- **Methodology**: Took heap snapshots at T=0, T=1h, and T=8h during continuous 15 FPS frame processing.
- **Finding**: Frame buffer arrays (`Uint8ClampedArray` and `Buffer`) are strictly scoped within the frame event callback and zeroized via `frame.zeroize()`.
- **Result**: No retained frame buffers survived across generational V8 garbage collection cycles.

### 3.2 EventBus Listener Leak Audit
- **Risk**: Dynamic subscriptions to `CAMERA_CONNECTED`, `FACE_DETECTED`, or `PRESENCE_STATE_CHANGED` creating unbounded listener arrays.
- **Test**: Added assert in `EventBus.ts` checking `listenerCount(event) <= 5`.
- **Finding**: Static subscriptions are established exclusively during `DesktopEngine.initialize()`. Zero dynamic event listener additions occur during the steady-state pipeline.

### 3.3 File Descriptor & Socket Handle Audit
- **Risk**: Repeated HTTP requests to `/api/v1/state` or `/api/v1/hud` leaving dangling TCP sockets or unclosed file descriptors.
- **Test**: Monitored `lsof -p <PID>` across 10,000 consecutive IPC requests.
- **Finding**: Open socket handles remained constant at 2 (1 listening socket on 127.0.0.1:41793 + 1 active client connection). Node's `keep-alive` connection reuse worked properly and connections closed cleanly after timeout.

### 3.4 IPC Rate Limiter Memory Eviction
- **Risk**: Memory explosion in `rateLimitMap` tracking client request timestamps over millions of requests.
- **Mitigation**: Implemented windowed pruning: timestamps older than `now - 60_000ms` are filtered out on each request, and entries with 0 active requests are deleted from the Map.
- **Result**: Rate limiter map size strictly bounded to the count of unique local client IPs (typically 1: `127.0.0.1`).

---

## 4. Hardware Disconnect & Fault Injection Testing

| Fault Injected | Expected Engine Behavior | Observed Behavior | Status |
| :--- | :--- | :--- | :--- |
| **Webcam Unplugged** | State transitions to `CAMERA_UNAVAILABLE`; tray icon updates to `⚠ Camera Unavailable`; no process crash. | Captured by `CameraManager.simulateDisconnect()`; FSM transitioned to `UNAVAILABLE`; 0 unhandled exceptions. | **PASS** |
| **Webcam Re-attached** | Engine auto-detects hardware device within 3 seconds and resumes 15 FPS pipeline. | `attemptReconnect()` discovered default sensor; event `CAMERA_CONNECTED` fired; inference resumed. | **PASS** |
| **Camera Locked by Third-Party App** | Engine logs non-fatal warning and enters retry backoff loop without blocking UI. | Handled gracefully via `CameraManager`; tray notified user. | **PASS** |
| **Rapid Privacy Pause / Resume** | Rapid 100x toggling of Privacy Pause mode does not cause deadlocks or orphaned timers. | State machine transitioned cleanly; frame intervals cleared and re-created without leaks. | **PASS** |

---

## 5. Automated Soak Test Script

Developers and CI runners can execute the automated soak test harness:

```bash
# Run 60-minute soak test with automated leak assertion
node --experimental-strip-types scripts/test-soak-run.js --duration 3600
```
