# OpenFaceID (SightLock) — Troubleshooting & FAQ

This guide provides actionable solutions to common operational, diagnostic, and error states in OpenFaceID Phase 5.

---

## 1. Canonical Error Codes & Recovery Guidance

Every major OpenFaceID error includes a machine-readable technical code and an automated or user-actionable recovery pathway:

| Error Code | Meaning | Recovery Action | Retryable |
| :--- | :--- | :--- | :---: |
| `CAMERA_PERMISSION_DENIED` | OS camera permission was denied by the user. | Open OS Privacy Settings and grant camera permission to OpenFaceID. | Yes |
| `CAMERA_UNAVAILABLE` | Camera sensor is in use by another application or not detected. | Close competing apps (Zoom, Teams, FaceTime) and verify hardware connection. | Yes |
| `CAMERA_DISCONNECTED` | Camera was unplugged or lost connection. | Reconnect the camera device; OpenFaceID will automatically attempt recovery. | Yes |
| `CAMERA_INITIALIZATION_FAILED`| Failed to initialize native video capture pipeline. | Restart the application or select a different camera device in Settings. | Yes |
| `MODEL_INTEGRITY_FAILURE` | ML model file hash does not match authoritative checksum. | Reinstall OpenFaceID; model file tampering or corruption detected. | No |
| `IDENTITY_STORE_CORRUPT` | Identity file failed AES-GCM decryption or authentication tag. | Re-enroll identity; previous data corrupted or encrypted with different key. | No |
| `IDENTITY_NOT_FOUND` | No identity profile currently enrolled. | Complete initial face enrollment in the Onboarding Wizard or Settings. | Yes |
| `IDENTITY_ENROLLMENT_FAILED` | Multi-pose sample collection failed consistency or quality checks. | Repeat enrollment ensuring steady lighting and single-face alignment. | Yes |
| `IDENTITY_DELETE_FAILED` | Failed to securely wipe or shred identity file. | Check file permissions on `~/.openfaceid/identities/`. | Yes |
| `LIVENESS_FAILED` | Subject failed eye-blink or micro-movement presentation check. | Look at the camera naturally and blink; avoid static photos or screens. | Yes |
| `LIVENESS_TIMEOUT` | Liveness verification timed out without detecting motion. | Ensure adequate lighting and face the camera directly. | Yes |
| `FACE_NOT_DETECTED` | No face visible in the camera frame. | Sit directly in front of the camera and remove obstructions. | Yes |
| `MULTIPLE_FACES_DETECTED` | Multiple faces detected in frame (`PRESENCE_AMBIGUOUS`). | Ensure only one person is visible to the camera for security and privacy. | Yes |
| `UNKNOWN_FACE` | Face detected does not match enrolled identity representation. | Ensure you are enrolled or adjust recognition preset if legitimate user. | Yes |
| `IPC_UNAUTHORIZED` | IPC request lacked valid Bearer token or token expired. | Restart the desktop app to obtain a fresh session token from the daemon. | Yes |
| `IPC_UNAVAILABLE` | Local daemon is not running or listening on port 4173. | Launch the OpenFaceID daemon (`npm run desktop` or `openfaceid daemon`). | Yes |
| `IPC_TIMEOUT` | Local API request exceeded timeout threshold. | Verify system load and restart daemon if unresponsive. | Yes |
| `PRIVACY_PAUSED` | Camera capture paused by user. | Click "Resume Camera" in the UI, tray, or run `openfaceid privacy resume`. | Yes |
| `SYSTEM_ERROR` | Unhandled runtime exception in core engine. | Inspect logs via `openfaceid doctor` or export diagnostics. | Yes |

---

## 2. Camera Hot-Plug & Sleep/Wake Recovery

### Camera Disconnected and Reconnected
When an external webcam is disconnected:
1. OpenFaceID transitions immediately to `CAMERA_DISCONNECTED` and sets presence to `PRESENCE_UNAUTHORIZED`.
2. The daemon enters a non-blocking recovery loop (`CAMERA_RECOVERING`).
3. Once the camera is plugged back in, OpenFaceID automatically re-establishes the video stream and transitions to `CAMERA_READY` without requiring an application restart.

### System Sleep & Wake Cycle
When your computer goes to sleep:
1. The camera pipeline is suspended by the operating system.
2. Upon wake, OpenFaceID's `PresenceTracker` **explicitly invalidates the active session** via `resetOnWake()`.
3. Presence state transitions to `PRESENCE_UNAUTHORIZED` / `NO_FACE`.
4. OpenFaceID requires a fresh, positive face recognition and liveness verification before re-authorizing presence.

---

## 3. Multiple-Face Detection (`PRESENCE_AMBIGUOUS`)

### Why was presence revoked when someone walked behind me?
OpenFaceID enforces a **strict fail-closed policy**. If two or more faces are detected in view:
- Presence is immediately set to `PRESENCE_AMBIGUOUS` (NOT AUTHORIZED).
- This prevents shoulder surfing and ensures an attacker cannot gain authorization by standing next to an enrolled user.
- To re-authorize, ensure only the enrolled user remains in the camera's field of view.

---

## 4. Diagnostics & Reporting Issues

Run the automated doctor tool to check system health:
```bash
openfaceid doctor
```

To generate a sanitized diagnostics report for bug reporting:
```bash
openfaceid export-diagnostics
```
This generates a privacy-scrubbed JSON file with zero biometric vectors, keys, or image frames.
