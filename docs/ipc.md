# OpenFaceID Local Daemon IPC & Automation API Reference

## 1. Overview

OpenFaceID's Authoritative Daemon provides a secure local Inter-Process Communication (IPC) interface over HTTP and Server-Sent Events (SSE) bound strictly to `127.0.0.1:41793`.

The interface allows the Desktop UI, System Tray, QuickGlance HUD, and CLI to observe presence states, receive real-time events, and trigger authorized actions.

---

## 2. IPC Security Model

* **Loopback-Only Binding**: The daemon binds strictly to `127.0.0.1`. Requests originating from non-loopback IP addresses are dropped at the socket level.
* **Bearer Token Authentication**:
  * On startup, the daemon generates a 256-bit cryptographically random token (`ofid_<hex>`).
  * The token is written to `~/.openfaceid/openfaceid.token` with mode `0600`.
  * All mutating and data-access endpoints require an `Authorization: Bearer <token>` header.
  * Validation is evaluated in constant time using `crypto.timingSafeEqual` to prevent side-channel timing analysis.
* **Payload Size Limits**: Request bodies are capped at 1 MB; larger requests are rejected with `413 Payload Too Large`.
* **Zero Biometric Exposure**: Biometric vectors (512D embeddings) and raw camera pixels are **NEVER** returned over IPC endpoints. Identity listings return only metadata (`id`, `name`, `posesCount`, `createdAt`).

---

## 3. Endpoints Reference

### 3.1 Public Endpoints

#### `GET /api/v1/status`
Returns high-level daemon and platform status. Does not require authentication.

**Response (`200 OK`):**
```json
{
  "app": "OpenFaceID",
  "codeName": "SightLock",
  "status": "active",
  "screenLocked": false,
  "idleSeconds": 4,
  "livenessMode": "light",
  "matchThreshold": 0.72,
  "platform": "macos",
  "localProcessingOnly": true,
  "cloudEgress": false
}
```

#### `GET /api/v1/events`
Server-Sent Events (SSE) real-time stream. Subscribes client to system and presence events. Does not require authentication.

**Event Format:**
```text
data: {"type":"CONNECTED","timestamp":1726245000000}

data: {"type":"USER_PRESENT","payload":{"identityId":"usr_01","identityName":"Alice","similarity":0.84,"timestamp":1726245005000}}

data: {"type":"USER_LEFT","payload":{"elapsedNoFaceMs":20100,"timestamp":1726245025000}}
```

**Streamed Event Types:**
* `CONNECTED`: Initial stream connection acknowledgment.
* `USER_PRESENT`: Authorized face verified and liveness confirmed.
* `USER_LEFT`: User absent continuously beyond configured timeout.
* `IDENTITY_MATCHED`: Biometric similarity matched enrolled vector.
* `CAMERA_CONNECTED`: Video capture device recognized.
* `CAMERA_DISCONNECTED`: Video capture device detached.

---

### 3.2 Authenticated Endpoints (`Authorization: Bearer <token>`)

#### `GET /api/v1/identities`
Lists enrolled biometric identities from encrypted storage.

**Headers:**
```text
Authorization: Bearer ofid_7a8f9b...
```

**Response (`200 OK`):**
```json
{
  "identities": [
    {
      "id": "usr_01",
      "name": "Alice",
      "enabled": true,
      "posesCount": 5,
      "createdAt": 1726240000000,
      "updatedAt": 1726240000000
    }
  ]
}
```

#### `POST /api/v1/lock`
Triggers an immediate operating system screen lock via `PlatformAdapter`.

**Headers:**
```text
Authorization: Bearer ofid_7a8f9b...
```

**Response (`200 OK`):**
```json
{
  "success": true
}
```

#### `POST /api/v1/identities`
Creates a new enrolled identity name container before guided pose capture.

**Request Body:**
```json
{
  "name": "Bob"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "name": "Bob"
}
```

#### `DELETE /api/v1/identities/:id`
Cryptographically shreds and unlinks an enrolled identity.

**Headers:**
```text
Authorization: Bearer ofid_7a8f9b...
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "id": "usr_01"
}
```

---

## 4. Automation Policy & Webhook Security

OpenFaceID's `ActionDispatcher` (`packages/automation/src/ActionDispatcher.ts`) executes local automations upon presence state transitions:

1. **`lock_screen`**: Triggers `PlatformAdapter.lockScreen()` to lock the workstation display.
2. **`notify`**: Dispatches a sanitized notification via `NotificationManager`.
3. **`custom_script`**: Runs a user-defined executable:
   * **Security Rule**: `shell: false` is enforced. Parameters are passed directly without shell expansion.
   * **Path Rule**: Must be an absolute path; directory traversal attempts are rejected.
   * **Timeout**: Maximum execution timeout is 5,000 ms.
4. **`webhook`**: Dispatches a local HTTP POST with presence event data:
   * **Strict Loopback Guard**: Webhook URLs **MUST** point to `http://127.0.0.1`, `http://localhost`, or `http://[::1]`.
   * Requests to remote hosts (e.g. `https://api.external.com`) are **strictly rejected** to maintain the zero-egress privacy guarantee.
