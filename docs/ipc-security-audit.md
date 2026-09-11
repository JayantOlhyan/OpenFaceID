# OpenFaceID — Desktop IPC & Route Security Audit
**Auditor:** OpenFaceID Lead Security Engineer  
**Date:** September 11, 2026  
**Target:** Local HTTP/SSE Server (`apps/desktop/serve.js`) & Native IPC Layer  
**Host Binding:** Strict `127.0.0.1:41793` (Loopback only)  

---

## 1. Executive Summary

This audit catalogs and scrutinizes every inter-process communication (IPC) endpoint exposed by the OpenFaceID background daemon.
Endpoints are categorized into three authorization tiers:
- **Tier 1 (Public Read-Only)**: Endpoints that provide safe status telemetry to local desktop widgets and the CLI without state mutation.
- **Tier 2 (Protected Operations)**: Non-destructive control endpoints (lock, recognition trigger, privacy pause). Protected by an ephemeral 192-bit Bearer token.
- **Tier 3 (Sensitive Biometric Mutations)**: High-risk operations (enrollment, identity deletion, policy update). Protected by Bearer token, rate-limited, and schema-validated.

---

## 2. Route Security Matrix

| Endpoint | Method | Tier | Authentication | Input Validation | Rate Limit | Sensitive Data Exposed | Side Effects |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/status` | GET | Tier 1 | None (Localhost) | None | 120/min | None (Booleans, states) | None (Read-only) |
| `/api/v1/capabilities` | GET | Tier 1 | None (Localhost) | None | 60/min | None (OS architecture) | None (Read-only) |
| `/api/v1/hud` | GET | Tier 1 | None (Localhost) | None | 120/min | None (Atomic HUD payload) | None (Read-only) |
| `/api/v1/tray` | GET | Tier 1 | None (Localhost) | None | 120/min | None (Menu labels) | None (Read-only) |
| `/api/v1/camera/devices` | GET | Tier 1 | None (Localhost) | None | 30/min | Hardware device labels | Hardware enumeration |
| `/api/v1/events` | GET | Tier 1 | None (Localhost) | None | Max 10 clients | Event names, status flags | SSE keepalive |
| `/api/v1/privacy/pause` | POST | Tier 2 | Bearer (timing-safe) | Empty body | 30/min | None | Halts camera, zeros RAM |
| `/api/v1/privacy/resume` | POST | Tier 2 | Bearer (timing-safe) | Empty body | 30/min | None | Re-acquires camera, resumes |
| `/api/v1/lock` | POST | Tier 2 | Bearer (timing-safe) | Empty body | 10/min | None | Invokes OS lock API |
| `/api/v1/recognize` | POST | Tier 2 | Bearer (timing-safe) | Optional `{ immediate }` | 30/min | Matched identity name/ID | Runs recognition cycle |
| `/api/v1/identities` | GET | Tier 2 | Bearer (timing-safe) | None | 60/min | Identity names, IDs (Vectors scrubbed) | None (Read-only) |
| `/api/v1/identities/enroll` | POST | Tier 3 | Bearer (timing-safe) | Schema: name (1-64 chars), 5 512D arrays | 6/min | Vectors in memory; saved AES-256 encrypted | Adds encrypted identity |
| `/api/v1/identities/:id` | DELETE | Tier 3 | Bearer (timing-safe) | Schema: `^usr_[a-zA-Z0-9_-]{1,64}$` | 20/min | None | Shreds encrypted file, purges RAM |

---

## 3. Cryptographic Token Lifecycle & Security

### 3.1 Token Generation
- **Entropy**: 192 bits generated via `crypto.randomBytes(24).toString('hex')`. Prefix `ofid_` added for identifier hygiene.
- **Storage**: Written to `$HOME/.openfaceid/token` with explicit file mode `0600` (`-rw-------`), accessible strictly by the operating-system user running the daemon.
- **Lifetime**: Strictly ephemeral. Generated on daemon launch; invalidated and deleted on daemon shutdown (`SIGINT`/`SIGTERM`).
- **Rotation**: Automatically replaced on each daemon startup; old tokens become permanently invalid.

### 3.2 Timing Attack Defense
Authentication validation uses `crypto.timingSafeEqual` over fixed-length buffer conversions:
```typescript
function verifyBearerToken(provided: string, expected: string): boolean {
  if (typeof provided !== 'string' || !provided) return false;
  const provBuf = Buffer.from(provided);
  const expBuf = Buffer.from(expected);
  if (provBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(provBuf, expBuf);
}
```

### 3.3 Elimination of Public Token Endpoint
In earlier development prototypes, `GET /api/v1/auth/token` was temporarily exposed for local browser debugging. In Phase 4, **this endpoint has been completely removed**. The local browser dashboard obtains authentication via secure local handshake, and the token is never written into public DOM attributes, URLs, or query parameters.

---

## 4. Input Validation & Defense-in-Depth

1. **Max Body Size**: The HTTP request parser enforces a strict **1 MB payload ceiling**. Any request attempting to stream more than 1,048,576 bytes is terminated immediately with HTTP 413 (*Payload Too Large*).
2. **Strict Schema Checking**:
   - `identityId`: Validated against `^usr_[a-zA-Z0-9_-]{1,64}$`. Path traversal sequences (`../`, null bytes, slashes) are rejected with HTTP 400.
   - `name`: Must be 1 to 64 printable characters, trimmed, with HTML entities sanitized.
   - `poses`: Must be an array of length 5; each item must be a 512-element numeric array.
3. **JSON Parse Guard**: JSON parsing is wrapped in guarded try/catch blocks; malformed JSON returns HTTP 400 (*Bad Request*) without crashing the server or leaking stack traces.
4. **CORS Hardening**: Access-Control-Allow-Origin strictly matches `http://127.0.0.1:41793`. Wildcard `*` is prohibited across all endpoints.
