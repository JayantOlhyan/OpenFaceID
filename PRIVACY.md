# Privacy Policy — OpenFaceID (SightLock)

**Last Updated: September 11, 2026**

> **Core Philosophy: Your face data stays on your computer.**

---

## 1. Zero Cloud Egress
OpenFaceID is designed from the ground up as a **local-first, privacy-preserving desktop application**.
- **No Cloud Inference**: All face detection, landmark calculation, quality analysis, embedding extraction, and matching execute 100% locally on your machine's CPU/GPU.
- **No Telemetry**: OpenFaceID has **zero analytics, zero telemetry, and zero tracking** built into its codebase. Network egress is disabled by default.
- **No Remote Biometric Storage**: Your facial data is never sent to any server, third party, or cloud service.

---

## 2. In-Memory Processing & RAM-Only Lifecycle
Camera frames are captured directly into volatile system RAM buffers (`Uint8ClampedArray`):
1. Frame is grabbed from the camera stream.
2. The vision engine extracts bounding boxes, 5-point landmarks, and the 512D ArcFace embedding vector.
3. **The raw pixel buffer is immediately overwritten with zeros (`frame.zeroize()`) and discarded.**
4. Raw camera images or video recordings are **never written to disk or persistent storage**.

---

## 3. Encrypted Biometric Storage
Only mathematical feature vectors (512-dimensional floating-point arrays) are saved to disk. These vectors cannot be reverse-engineered to reconstruct an original photograph. Furthermore:
- Biometric vectors are encrypted using **AES-256-GCM** authenticated encryption.
- Master encryption keys are stored securely in your operating system's native secure keystore:
  - **macOS**: macOS Keychain Services.
  - **Windows**: Windows Credential Manager / Data Protection API (DPAPI).
  - **Linux**: FreeDesktop Secret Service (GNOME Keyring / KDE KWallet).

---

## 4. Secure Deletion & Shredding
When an identity is deleted in OpenFaceID:
- The encrypted profile on disk is overwritten with random bytes and zeros (multi-pass shredding) before being unlinked.
- All in-memory vector representations are zeroized.

---

## 5. Local Audit Trail (Activity History)
OpenFaceID maintains an optional local audit log of events (e.g. *"Jayant matched with 92% confidence"* or *"User left: screen locked"*).
- The activity log **never** stores photographic frames or biometric vectors.
- Old records automatically expire and are purged after 7 days (configurable).
- You can clear the activity log at any time with a single click.
