# OpenFaceID — Desktop Security & IPC Threat Analysis

This document details the security model, IPC authorization boundaries, local API controls, memory hygiene guarantees, and threat mitigations implemented in OpenFaceID (SightLock).

---

## 1. Local IPC & API Security Architecture

OpenFaceID exposes a local interface (`http://127.0.0.1:41793`) to facilitate communication between the desktop presentation layer (Dashboard UI, Quick Glance HUD, system tray) and the background `DesktopEngine`.

### 1.1 Strict Local Binding
- **Host**: Strictly bound to IPv4 loopback `127.0.0.1`.
- **Prohibited**: The server **never** binds to wildcard `0.0.0.0` or external network adapters.
- **CORS Policy**: Restricts `Access-Control-Allow-Origin` strictly to `http://127.0.0.1:41793`. Requests from unauthorized origins are rejected.
- **Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy: default-src 'self' 'unsafe-inline' data: blob:; media-src 'self' blob: mediastream:;`

### 1.2 Route Classification & Authorization Matrix

| Endpoint | Method | Classification | Authorization Required | Information Exposed |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/status` | GET | Public | None | Engine status, platform info, idle time, enrolled profile count |
| `/api/v1/capabilities` | GET | Public | None | Supported OS capabilities (screen lock, keystore, camera) |
| `/api/v1/hud` | GET | Public | None | HUD overlay summary (status, camera name, presence state) |
| `/api/v1/tray` | GET | Public | None | Tray status text and context menu action list |
| `/api/v1/camera/devices`| GET | Public | None | Hardware camera names and permission state |
| `/api/v1/identities` | GET | Protected | **Bearer Token** | Enrolled names, IDs, pose counts, creation timestamps |
| `/api/v1/identities` | POST | Protected | **Bearer Token** | Enrolls new identity profile with multi-pose vectors |
| `/api/v1/identities/:id`| DELETE | Highly Sensitive | **Bearer Token** | Shreds biometric vectors and deletes identity file |
| `/api/v1/privacy/pause`| POST | Protected | **Bearer Token** | Suspends camera grabber and recognition pipeline |
| `/api/v1/privacy/resume`| POST | Protected | **Bearer Token** | Resumes camera grabber and recognition pipeline |
| `/api/v1/lock` | POST | Highly Sensitive | **Bearer Token** | Triggers operating-system session lock |
| `/api/v1/activity` | GET | Protected | **Bearer Token** | Audit log entries (without secrets or embeddings) |
| `/api/v1/activity` | DELETE | Protected | **Bearer Token** | Clears audit history |

---

## 2. Bearer Token Lifecycle & Generation

1. **Generation**: On startup, `DesktopEngine` generates an ephemeral 192-bit cryptographic token:
   $$\text{Token} = \text{"ofid\_"} \,\|\, \text{crypto.randomBytes}(24).\text{toString}(\text{'hex'})$$
2. **Entropy**: $\ge 192$ bits of cryptographic entropy, preventing brute-force or guessing attacks by local unprivileged processes.
3. **Storage**: Stored exclusively in volatile daemon memory. It is **never** written to configuration files, disk logs, or public git repositories.
4. **Injection**: When serving `index.html` to the local browser window, the token is injected directly into the DOM window context (`window.__OFID_TOKEN__`), ensuring the legitimate UI can authorize its requests.
5. **Rejection**: Any request to a protected or highly sensitive endpoint missing the `Authorization: Bearer <token>` header is immediately aborted with HTTP 401 Unauthorized.

---

## 3. Biometric Data Isolation Boundaries

Biometric data (512-dimensional facial feature vectors and raw image frame buffers) is subject to strict isolation:

1. **No Vector Exposure Across IPC**: The Local API **never** serializes or returns raw 512D float arrays over HTTP responses. Endpoints return only high-level metadata (e.g. `{ id: "usr_01", name: "Alice", posesCount: 5 }`).
2. **No Image Frame Transmission**: Raw camera pixel buffers exist solely in volatile RAM buffers inside the vision pipeline. They are never returned across API endpoints.
3. **Master Key Isolation**: The 256-bit AES master encryption key remains inside `KeyringManager` and is never transmitted over IPC or logged.

---

## 4. Secure Memory & Zeroization Guarantees

In accordance with Section 72 of the Phase 3 specification, we state the precise guarantees and limitations of memory sanitization:

### 4.1 What `MemorySanitizer.zeroizeBuffer()` Guarantees
- The underlying bytes of the `Uint8Array`, `Buffer`, or `Float32Array` instance are overwritten with zeroes (`.fill(0)` / `.fill(0.0)`).
- When applied to camera frame buffers (`frame.zeroize()`), the raw frame data is wiped immediately before the next frame is sampled.
- When applied to decrypted biometric identity buffers during deletion (`IdentityStore.deleteIdentity()`), the file is overwritten with multi-pass random data before unlink.

### 4.2 Runtime & Compiler Limitations
- In modern V8 / JavaScript runtimes, memory management is governed by a garbage collector with generational copying and JIT register optimizations.
- Calling `.fill(0)` on an `ArrayBuffer` zeroes the memory backing that specific buffer. However, it does not guarantee physical DRAM hardware scrubbing, nor can it eliminate CPU register remnants or V8 internal temporary copies created during mathematical operations prior to zeroization.
- For maximum hardware-level memory scrubbing, native compiled C/Rust modules using `explicit_bzero(3)` or `SecureZeroMemory` are required. OpenFaceID documents this technical distinction honestly.

---

## 5. Localhost Attack Resistance & Threat Modeling

| Threat Vector | Attack Scenario | Mitigation |
| :--- | :--- | :--- |
| **Malicious Local Process** | Another non-root local user tries `curl http://127.0.0.1:41793/api/v1/identities` | Request rejected with 401 Unauthorized due to lack of bearer token. |
| **Unauthorized Workstation Lock** | Unprivileged script attempts `POST /api/v1/lock` | Rejected with 401 Unauthorized; token required. |
| **Biometric Theft via API** | Attacker sniffs localhost status endpoint | Status payload contains zero vectors, zero embeddings, zero images. |
| **Filesystem Key Extraction** | Attacker inspects `~/.openfaceid` directory | Permissions strictly enforced: directory `0o700`, keyfile `0o600`, identity files AES-256-GCM encrypted. |
| **DNS Rebinding Attack** | Malicious website in browser attempts cross-origin calls | Local server validates `Host` header and CORS `Access-Control-Allow-Origin: http://127.0.0.1:41793`. |
