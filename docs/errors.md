# OpenFaceID Canonical Error Reference

## 1. Overview

OpenFaceID standardizes errors across the Core daemon, Camera capture, Vision pipeline, Storage, Security, API, and Desktop UI using the `OpenFaceIDError` class (`packages/core/src/errors.ts`).

Every error provides:
* A canonical `ErrorCode` string.
* An actionable user recovery suggestion (`recovery.action`).
* An optional CLI remediation command (`recovery.command`).
* A `retryable` boolean flag indicating whether the operation can be retried immediately.
* An optional documentation link (`recovery.docsUrl`).

---

## 2. Error Categories & Codes

### 2.1 Camera & Hardware Errors

| Code | Retryable | Cause | Recovery Action | Remediation Command |
| :--- | :--- | :--- | :--- | :--- |
| `CAMERA_PERMISSION_DENIED` | Yes | OS camera permissions not granted to OpenFaceID. | Grant camera access in OS Settings / Privacy preferences. | `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera"` (macOS) |
| `CAMERA_UNAVAILABLE` | Yes | Another app (FaceTime, Zoom, Teams) holds exclusive webcam lock. | Close other apps using the webcam. | `openfaceid doctor` |
| `CAMERA_DISCONNECTED` | Yes | USB webcam unplugged or hardware video device severed. | Reconnect video capture device. | `openfaceid camera status` |
| `CAMERA_INITIALIZATION_FAILED` | Yes | Video capture stream failed to start. | Verify camera drivers and permissions. | `openfaceid doctor` |

### 2.2 Model & Integrity Errors

| Code | Retryable | Cause | Recovery Action | Remediation Command |
| :--- | :--- | :--- | :--- | :--- |
| `MODEL_INTEGRITY_FAILURE` | No | Vision algorithm file hash mismatch or corrupted in-tree module. | Verify repository signatures or reinstall files. | `openfaceid security check` |

### 2.3 Identity & Storage Errors

| Code | Retryable | Cause | Recovery Action | Remediation Command |
| :--- | :--- | :--- | :--- | :--- |
| `IDENTITY_STORE_CORRUPT` | No | Stored identity profile JSON could not be decrypted or parsed. | Profile corrupted; re-enroll face profile. | `openfaceid identity list` |
| `IDENTITY_NOT_FOUND` | No | Specified identity ID does not exist in `~/.openfaceid/identities/`. | Verify ID with `openfaceid identity list`. | `openfaceid identity list` |
| `IDENTITY_ENROLLMENT_FAILED` | Yes | Enrollment could not capture 5 required poses with acceptable quality. | Retry enrollment in well-lit environment. | `openfaceid identity enroll <name>` |
| `IDENTITY_DELETE_FAILED` | Yes | File permission or lock prevented profile deletion. | Check file permissions on `~/.openfaceid/identities/`. | `openfaceid doctor` |
| `STORAGE_TRAVERSAL_DENIED` | No | Identity ID contained illegal characters (`/`, `\`, `..`). | Supply alphanumeric ID conforming to `^[a-zA-Z0-9_-]+$`. | N/A |
| `ENROLLMENT_INCOMPLETE` | Yes | User canceled enrollment before completing 5 poses. | Restart guided enrollment flow. | `openfaceid identity enroll <name>` |

### 2.4 Liveness & Anti-Spoofing Errors

| Code | Retryable | Cause | Recovery Action | Remediation Command |
| :--- | :--- | :--- | :--- | :--- |
| `LIVENESS_FAILED` | Yes | Micro-motion variance below threshold; suspected 2D photo attack. | Ensure face is live and in natural ambient light. | `openfaceid liveness test` |
| `LIVENESS_TIMEOUT` | Yes | Active challenge response (blink, turn) not completed in time. | Follow on-screen visual prompts promptly. | `openfaceid liveness test` |

### 2.5 Detection & Recognition Errors

| Code | Retryable | Cause | Recovery Action | Remediation Command |
| :--- | :--- | :--- | :--- | :--- |
| `FACE_NOT_DETECTED` | Yes | No face detected within webcam view. | Center face in camera field of view. | `openfaceid camera test` |
| `MULTIPLE_FACES_DETECTED` | Yes | Two or more faces detected simultaneously. | Ensure only one person is visible in front of camera. | `openfaceid status` |
| `UNKNOWN_FACE` | Yes | Detected face does not match any enrolled profile. | Enroll identity or adjust recognition threshold. | `openfaceid identity enroll <name>` |

### 2.6 IPC & Local Daemon Errors

| Code | Retryable | Cause | Recovery Action | Remediation Command |
| :--- | :--- | :--- | :--- | :--- |
| `IPC_UNAVAILABLE` | Yes | Daemon process not running on localhost port 41793. | Start OpenFaceID desktop application or background service. | `openfaceid doctor` |
| `IPC_UNAUTHORIZED` | Yes | Missing or invalid Bearer token in request header. | Token rotated or unreadable; verify `~/.openfaceid/openfaceid.token`. | `openfaceid doctor` |
| `IPC_TIMEOUT` | Yes | Local daemon took longer than 5,000 ms to respond. | Check system load or restart daemon. | `openfaceid doctor` |
| `IPC_INVALID_REQUEST` | No | Request JSON payload failed schema validation. | Inspect request body against documentation. | N/A |
| `RATE_LIMIT_EXCEEDED` | Yes | Too many requests dispatched to daemon in short window. | Back off request rate. | N/A |

### 2.7 Privacy, Security & Cryptographic Errors

| Code | Retryable | Cause | Recovery Action | Remediation Command |
| :--- | :--- | :--- | :--- | :--- |
| `PRIVACY_PAUSED` | Yes | Privacy Pause active; camera capture suspended. | Resume protection from tray, HUD, or CLI. | `openfaceid desktop resume` |
| `CRYPTO_AUTHENTICATION_FAILURE` | No | AES-256-GCM authentication tag mismatch (tampering). | Ciphertext corrupted or master key rotated; re-enroll profile. | `openfaceid security check` |
| `KEYRING_ACCESS_DENIED` | Yes | Operating system secure keystore access blocked. | Grant keychain access or check permissions on `~/.openfaceid/.master_key`. | `openfaceid doctor` |
| `PLATFORM_UNSUPPORTED` | No | Host OS kernel or architecture is unsupported. | Refer to platform compatibility matrix in README. | N/A |
| `SYSTEM_ERROR` | Yes | Unhandled internal exception. | Inspect logs for stack trace. | `openfaceid doctor --verbose` |
