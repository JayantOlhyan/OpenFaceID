# OpenFaceID Notification Test Matrix (Phase 7)

## Canonical Event Mapping & Behavior Matrix

The table below outlines all system and vision events, their corresponding desktop notification mapping, severity classification, deduplication rules, and verification status in the automated test suite (`tests/unit/notifications.test.ts`).

| Event Key | User-Facing Notification | Expected Title | Expected Body | Severity | Dedupe / Cooldown | Action Available | Test Status |
|:---|:---:|:---|:---|:---:|:---:|:---:|:---:|
| `CAMERA_DISCONNECTED` | **Yes** | Camera disconnected | Protection is paused until your camera reconnects. | `warning` | Yes (60s) | Open Camera Settings | Passed (Unit) |
| `CAMERA_UNAVAILABLE` | **Yes** | Camera unavailable | Connect or enable a camera to resume presence protection. | `warning` | Yes (60s) | Open Diagnostics | Passed (Unit) |
| `CAMERA_CONNECTED` | **Yes** | Camera reconnected | OpenFaceID is ready to resume presence protection. | `info` | Yes (30s) | None | Passed (Unit) |
| `PRESENCE_AUTHORIZED` | **Yes** | Presence verified | You have been recognized and liveness verification passed. | `info` | Transition Only | None | Passed (Unit) |
| `PRESENCE_ENDED` | **Yes** | Presence ended | OpenFaceID is no longer detecting an authorized presence. | `info` | Transition Only | None | Passed (Unit) |
| `UNKNOWN_PERSON` | **Yes** | Unknown person detected | Presence verification failed because the detected person is not enrolled. | `warning` | Yes (30s) | None | Passed (Unit) |
| `MULTIPLE_FACES` | **Yes** | Multiple faces detected | Protection is paused because more than one person is visible. | `security` | Yes (30s) | None | Passed (Unit) |
| `LIVENESS_FAILED` | **Yes** | Liveness verification failed | We could not verify that the detected face is live. Try again. | `security` | Yes (15s) | Retry Verification | Passed (Unit) |
| `PRIVACY_PAUSED` | **Yes** | Protection paused | Camera monitoring is paused by Privacy Mode. | `info` | Transition Only | Resume Protection | Passed (Unit) |
| `PRIVACY_RESUMED` | **Yes** | Protection resumed | OpenFaceID is ready for fresh presence verification. | `info` | Transition Only | None | Passed (Unit) |
| `SECURITY_FAILURE` | **Yes** | OpenFaceID Security | Protection has been disabled due to a security violation. | `security` | Yes (30s) | Open Security Center | Passed (Unit) |
| `SYSTEM_ERROR` | **Yes** | Protection service unavailable | OpenFaceID could not communicate with its background service. | `error` | Yes (60s) | Open Diagnostics | Passed (Unit) |
| `FACE_DETECTED` | **No** | *(Silent Internal)* | *(None)* | — | — | — | Passed (Unit) |
| `FACE_LOST` | **No** | *(Silent Internal)* | *(None)* | — | — | — | Passed (Unit) |
| `CAMERA_FRAME_RECEIVED` | **No** | *(Silent Internal)* | *(None)* | — | — | — | Passed (Unit) |
| `MATCHING_STARTED` | **No** | *(Silent Internal)* | *(None)* | — | — | — | Passed (Unit) |
| `MATCHING_COMPLETED` | **No** | *(Silent Internal)* | *(None)* | — | — | — | Passed (Unit) |
| `LIVENESS_STARTED` | **No** | *(Silent Internal)* | *(None)* | — | — | — | Passed (Unit) |
| `LIVENESS_PROGRESS` | **No** | *(Silent Internal)* | *(None)* | — | — | — | Passed (Unit) |
| `PRESENCE_HEARTBEAT` | **No** | *(Silent Internal)* | *(None)* | — | — | — | Passed (Unit) |
| `FRAME_PROCESSED` | **No** | *(Silent Internal)* | *(None)* | — | — | — | Passed (Unit) |

---

## Rate-Limiting & Spam Simulation Results

| Scenario | Simulated Input | Expected Output | Actual Output | Result |
|:---|:---|:---|:---|:---:|
| **Unknown Person Flooding** | 100 consecutive `UNKNOWN_PERSON` events within 500ms | Max 3 notifications (Category burst cap) | Exactly 3 notifications; remaining 97 suppressed | **PASS** |
| **Camera Disconnect Oscillation** | 100 consecutive `CAMERA_DISCONNECTED` events within 500ms | 1 notification (60s cooldown) | Exactly 1 notification; 99 suppressed | **PASS** |
| **Multi-Face Threat Flood** | 100 consecutive `MULTIPLE_FACES` events within 500ms | Max 3 notifications (Category burst cap) | Exactly 3 notifications; remaining 97 suppressed | **PASS** |
| **Presence Continuous State** | 100 `PRESENCE_AUTHORIZED` frames without state transition | Exactly 1 notification at initial transition | Exactly 1 notification on initial transition; 99 suppressed | **PASS** |
| **State Oscillation Storm** | Rapidly cycling `AUTHORIZED` ↔ `UNAUTHORIZED` (10 cycles) | Rate-limited burst protection | Dampened to max 8 events / min | **PASS** |
| **Generic Alert Invariant** | Automation dispatch with empty payload `{}` | Sanitized fallback (Never `"Event triggered"`) | Title: `"OpenFaceID"`, Body: `"System state updated."` | **PASS** |
| **Observer Fault Tolerance** | OS Notification API throws fatal exception | Daemon and security state unaffected | Error safely logged; presence state intact | **PASS** |
| **Biometric Leakage Test** | Event containing embeddings, face crops, tokens | Stripped from history and notification body | Zero biometric attributes in history buffer | **PASS** |
