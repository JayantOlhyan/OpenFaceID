# OpenFaceID (SightLock) — Biometric Privacy & Data Protection Architecture

Privacy is the foundational design constraint of OpenFaceID. This document details the technical boundaries, data handling policies, and architectural guarantees enforced across all components.

---

## 1. Absolute Privacy Boundaries

OpenFaceID enforces the following non-negotiable rules:

1. **Zero Cloud Dependencies**: All biometric detection, alignment, embedding extraction, and matching execute locally on your physical machine.
2. **Zero Network Egress**: The daemon binds exclusively to the local loopback interface (`127.0.0.1`). It makes zero outbound HTTP, HTTPS, WebSocket, or WebRTC requests.
3. **Zero Telemetry or Analytics**: There are no analytics libraries, crash reporters, telemetry beacons, or usage tracking modules included in the codebase.
4. **Zero Persistent Raw Images**: Webcam video frames are decoded strictly into volatile RAM, processed for face landmarks and embeddings, and immediately zeroized. Raw camera frames, cropped face images, or video clips are **never written to disk or transmitted over IPC**.
5. **No OS Credential Ingestion**: OpenFaceID does not intercept OS passwords, does not store master keys, and does not hook the kernel or login manager.

---

## 2. Biometric Data Representation & Storage

When you enroll an identity in OpenFaceID:
- The vision pipeline extracts a **512-dimensional floating-point mathematical vector** (ArcFace embedding).
- This vector cannot be reverse-engineered into a photorealistic reconstruction of your face.
- The embedding vector is encrypted using **AES-256-GCM** with a hardware-backed key (via macOS Keychain, Windows DPAPI, or Linux Secret Service) or a machine-bound PBKDF2 key.
- The ciphertext is written to `~/.openfaceid/identities/` with strict POSIX permissions (`0600` for files, `0700` for directories).
- The identity file contains a 96-bit random IV, a 128-bit authentication tag, and the encrypted payload.

---

## 3. Real-Time Privacy Controls

### Camera Pause
Users can pause camera processing at any time from:
- Desktop UI: **Main Dashboard** -> *Pause Camera* or **Privacy Center** -> *Pause Camera*.
- System Tray / Menu Bar: *Pause Camera*.
- CLI: `openfaceid privacy pause`.

**When Paused**:
- The camera capture pipeline stops capturing frames immediately.
- The authoritative state machine transitions to `PRIVACY_PAUSED`.
- Presence authorization immediately fails closed (`PRESENCE_UNAUTHORIZED`).
- All active RAM buffers are scrubbed using `MemorySanitizer.zeroizeBuffer()`.

### Secure Identity Deletion (File Shredding)
When an identity is deleted:
1. The encrypted identity file is overwritten with cryptographically random bytes before unlinking (shredding).
2. All in-memory enrollment templates are zeroized.
3. Associated keystore entries are deleted.
4. The system transitions to `IDENTITY_UNKNOWN` / `UNENROLLED`.

---

## 4. Diagnostics & Export Privacy Protection

When exporting diagnostic archives (`/api/v1/diagnostics/export` or `openfaceid export-diagnostics`):
- An automated pattern scanner inspects every exported log and diagnostic field.
- The scanner detects and strips:
  - Embeddings and 512D float arrays
  - Raw base64 camera image buffers
  - Ephemeral bearer tokens
  - File system encryption keys and salts
  - User password strings or private environment variables
- The resulting export is guaranteed safe to share with developers when troubleshooting.
