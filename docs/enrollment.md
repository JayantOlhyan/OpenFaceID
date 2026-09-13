# OpenFaceID (SightLock) — Enrollment Guide & Biometric Pipeline

This document explains the technical architecture, security guarantees, user experience, and validation criteria for enrolling facial identities in OpenFaceID Phase 5.

---

## 1. The 5-Pose Enrollment Workflow

OpenFaceID uses a guided multi-pose capture process to create a comprehensive biometric representation while preventing presentation attacks (spoofing).

```text
Start Enrollment (Explicit User Action)
       ↓
Camera Pre-flight & Permission Check
       ↓
Single Face Detection Guard (Reject 0 or 2+ Faces)
       ↓
Real-Time Guidance & Quality Verification
       ↓
Liveness Verification (Eye-Blink & Motion Check)
       ↓
5-Pose Sample Collection:
  1. Center (Frontal Gaze)
  2. Slight Left (~15° Yaw)
  3. Slight Right (~15° Yaw)
  4. Tilt Up (~10° Pitch)
  5. Tilt Down (~10° Pitch)
       ↓
Embedding Generation (ArcFace 512D)
       ↓
Hyperspherical Consistency Evaluation (Cosine Distance < 0.35 across samples)
       ↓
User Explicit Confirmation Dialog
       ↓
AES-256-GCM Encrypted Storage & Keystore Link
       ↓
Enrollment Complete & Authoritative State Transition
```

---

## 2. Enrollment Guidance & Quality Evaluation

During each pose capture, the system evaluates the following criteria using the `FaceQualityAnalyzer`:

| Parameter | Validation Metric | Target Range | User Guidance Feedback |
| :--- | :--- | :--- | :--- |
| **Face Centering** | Bounding box centroid distance from frame center | Within central 60% of frame | *"Center your face in the camera view"* |
| **Face Scale** | Face area relative to total frame resolution | Between 15% and 55% of frame | *"Move closer"* or *"Move farther away"* |
| **Lighting Contrast** | Grayscale pixel variance across face bounding box | >= 25.0 variance threshold | *"Improve lighting / Avoid strong backlighting"* |
| **Head Pose Orientation** | Geometric landmark alignment (yaw/pitch) | Matches required pose step | *"Turn slightly left"*, *"Tilt slightly up"*, etc. |
| **Eye Openness** | Eye Aspect Ratio (EAR) metric | EAR >= 0.20 | *"Keep your eyes open and look at the camera"* |

Normal users are provided with clear, non-technical indicators (e.g. *Good*, *Needs Adjustment*, *Passed*) rather than raw numerical figures.

---

## 3. Strict Rejection Criteria

Enrollment will be rejected or halted under any of the following conditions:
1. **Zero Faces Detected**: No face visible in frame.
2. **Multiple Faces Detected (`face_count >= 2`)**: Immediate transition to `PRESENCE_AMBIGUOUS`. Enrollment aborts to prevent sample poisoning.
3. **Failed Liveness Check**: If eye-blink or micro-motion threshold is not reached, liveness fails.
4. **Poor Lighting / Extreme Blur**: Fails `FaceQualityAnalyzer` threshold.
5. **Inconsistent Sample Embeddings**: If the cosine distance between the captured sample poses exceeds `0.35`, indicating an inconsistent subject or extreme distortion, the batch is rejected.
6. **Hardware Failure**: Camera disconnects or pipeline errors immediately abort enrollment.

---

## 4. Enrollment Security Guarantees

- **Explicit User Action Required**: Enrollment cannot be initiated silently in the background or triggered remotely over the network.
- **Local IPC Authorization**: All enrollment endpoints (`/api/v1/enrollment/start`, `/capture`, `/confirm`, `/cancel`) require an authenticated Bearer token from the local loopback daemon.
- **Identity Replacement Guard**: If an enrolled identity already exists, the UI and API require an explicit `confirmOverwrite: true` confirmation before replacing the existing identity.
- **Zero Raw Frame Retention**: Frame buffers used for feature extraction exist strictly in volatile RAM and are zeroized using `MemorySanitizer.zeroizeBuffer()` upon completion or cancellation.
- **AES-256-GCM Storage**: Enrolled embeddings are serialized, encrypted with a 96-bit random IV and 128-bit authentication tag, and written to disk with restrictive `0600` permissions.
