# OpenFaceID (SightLock) — Computer Vision Engine

This document details the mathematical models, landmark geometries, quality filters, embedding spaces, and presentation attack detection (PAD) algorithms employed in OpenFaceID.

---

## 1. Landmark Topology & Face Detection

OpenFaceID uses a fast frontal face detector (BlazeFace topology) extracting a bounding box \(\mathbf{B} = [x, y, w, h]\) and 5 canonical facial landmark coordinates:
1. **Left Eye Center**: \(p_1 = (x_1, y_1)\)
2. **Right Eye Center**: \(p_2 = (x_2, y_2)\)
3. **Nose Tip**: \(p_3 = (x_3, y_3)\)
4. **Left Mouth Corner**: \(p_4 = (x_4, y_4)\)
5. **Right Mouth Corner**: \(p_5 = (x_5, y_5)\)

---

## 2. Face Quality & Pose Estimation

To prevent enrollment and recognition failures caused by degraded input, frames are evaluated before embedding extraction.

### 2.1 Sharpness via Laplacian Variance
To reject blurred or motion-degraded captures, the Laplacian variance \(\sigma^2(\Delta I)\) is computed on the grayscale face crop:
$$\Delta I(x, y) = I(x+1, y) + I(x-1, y) + I(x, y+1) + I(x, y-1) - 4 I(x, y)$$
$$\sigma^2 = \frac{1}{N} \sum_{x, y} \left( \Delta I(x, y) - \mu_{\Delta} \right)^2$$
- **Threshold**: \(\sigma^2 \ge 50\) (frames with \(\sigma^2 < 50\) are rejected as `BLURRY`).

### 2.2 Illumination & Exposure
The mean pixel luminance \(\mu_L\) is computed using the standard ITU-R BT.601 coefficients:
$$L = 0.299 R + 0.587 G + 0.114 B$$
- **Acceptable range**: \(35 \le \mu_L \le 235\). Frames outside this range trigger `"More light needed"` or `"Reduce glare"`.

### 2.3 Head Pose Geometry (Yaw, Pitch, Roll)
Pose angles are approximated directly from the 5-point landmark geometry:
- **Roll**:
  $$\theta_{\text{roll}} = \arctan\left(\frac{y_2 - y_1}{x_2 - x_1}\right)$$
- **Yaw**:
  $$d_L = \|p_3 - p_1\|, \quad d_R = \|p_3 - p_2\|, \quad d_{\text{eyes}} = \|p_2 - p_1\|$$
  $$\theta_{\text{yaw}} \approx \left(\frac{d_R - d_L}{d_{\text{eyes}}}\right) \times 60^\circ$$
- **Pitch**:
  $$y_{\text{eyeMid}} = \frac{y_1 + y_2}{2}, \quad y_{\text{mouthMid}} = \frac{y_4 + y_5}{2}$$
  $$\theta_{\text{pitch}} \approx \left(\frac{y_3 - y_{\text{eyeMid}}}{y_{\text{mouthMid}} - y_{\text{eyeMid}}} - 0.5\right) \times 60^\circ$$

---

## 3. Face Alignment & Embedding Extraction

### 3.1 Affine Face Normalization
Before embedding inference, the face is warped into a canonical \(112 \times 112\) coordinate system such that:
- The eye-to-eye axis is strictly horizontal (\(\theta_{\text{roll}} = 0\)).
- The inter-pupillary distance is scaled to a standard 44 pixels.
- The midpoint of the eyes sits at coordinate \((56, 42)\).

### 3.2 ArcFace (Additive Angular Margin Loss)
Features are extracted into a 512-dimensional vector \(\mathbf{v} \in \mathbb{R}^{512}\).
The vector is projected onto the unit hypersphere via \(L_2\) normalization:
$$\hat{\mathbf{v}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2} = \frac{\mathbf{v}}{\sqrt{\sum_{i=1}^{512} v_i^2}}$$

### 3.3 Metric & Similarity Calculation
Because embeddings are unit-normalized, the cosine similarity between enrolled vector \(\mathbf{u}\) and query vector \(\mathbf{v}\) simplifies to their dot product:
$$\text{Cosine Similarity}(\mathbf{u}, \mathbf{v}) = \mathbf{u} \cdot \mathbf{v} = \sum_{i=1}^{512} u_i v_i$$
- **Match threshold**: \(\text{Cosine Similarity} \ge 0.72\) (configurable from \(0.60\) to \(0.85\)).

---

## 4. Multi-Frame Temporal Window Aggregation

Single-frame recognition decisions are notoriously prone to lighting flickers and transient noise. OpenFaceID implements a sliding temporal buffer of \(N\) frames (default: 5):
1. For each incoming frame \(t\), evaluate similarity against all gallery identities.
2. Weight frames using exponential decay (\(w_i = 1.2^i\)) favoring the most recent captures.
3. Compute the temporal moving average:
   $$\bar{S} = \frac{\sum_{i=1}^{N} w_i \cdot S_i}{\sum_{i=1}^{N} w_i}$$
4. An `IDENTITY_MATCHED` event is emitted **only when**:
   - At least \(k\) frames (default: 4 of 5) exceed the similarity threshold \(\theta\).
   - The weighted moving average \(\bar{S} \ge \theta\).

---

## 5. Presentation Attack Detection (Liveness)

### 5.1 Mode: Light (Passive Anti-Spoofing)
1. **Eye Aspect Ratio (EAR) Blink Detection**:
   Monitors eye aperture over time. A natural involuntary blink produces a steep dip (\(EAR < 0.18\)) followed by immediate recovery (\(EAR > 0.23\)) within 150–350 ms.
2. **Micro-Motion Spatial Variance**:
   Computes frame-to-frame displacement of the nose tip:
   $$V = \frac{1}{M-1} \sum_{t=1}^{M-1} \|p_{3}^{(t+1)} - p_{3}^{(t)}\|$$
   A static photograph held before the camera yields \(V < 0.008\), triggering an instant presentation attack rejection.
3. **High-Frequency Texture Gradient**:
   Evaluates spatial pixel gradients across the cheek region to detect screen pixel grids (moiré patterns) or photo paper specular reflections.

### 5.2 Mode: Strong (Active Challenge-Response)
- The system generates an active prompt:
  - `TURN_LEFT_15`: User must turn head 15° left (\(\Delta \theta_{\text{yaw}} \le -10^\circ\)).
  - `TURN_RIGHT_15`: User must turn head 15° right (\(\Delta \theta_{\text{yaw}} \ge +10^\circ\)).
  - `TILT_UP_10`: User must tilt chin upward (\(\Delta \theta_{\text{pitch}} \le -8^\circ\)).
  - `BLINK_TWICE`: User must complete two distinct blinks within 4 seconds.
- Enforces dynamic timeout and motion parallax verification.

---

## 6. Liveness 8-State Machine

Presentation attack detection is modeled as an explicit, tamper-resistant 8-state machine:

```
[LIVENESS_IDLE]
       │
       ▼
[LIVENESS_STARTING] ────────► [CHALLENGE_PRESENTED]
                                       │
                                       ▼
                              [WAITING_FOR_RESPONSE]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
           [RESPONSE_DETECTED]                   [LIVENESS_TIMEOUT]
                    │
           ┌────────┴────────┐
           ▼                 ▼
   [LIVENESS_PASSED]  [LIVENESS_FAILED]
```

Under no circumstances does `LIVENESS_PASSED` trigger without passing through the full verification sequence.

---

## 7. Model Licensing & Redistribution Specifications

In accordance with OpenFaceID open-source compliance:

| Model Attribute | Face Detector | Face Embedder |
| :--- | :--- | :--- |
| **Model Name** | BlazeFace (Sub-millisecond Neural Face Detection) | ArcFace / MobileFaceNet (512D) |
| **Version** | v0.1.0 (MobileNet backbone, 896 anchors) | v1.0.0 (Canonical 112x112 Alignment) |
| **Source** | Google Research / MediaPipe | InsightFace / OpenFaceID Clean Weights |
| **License** | **Apache License 2.0** | **Apache License 2.0 / MIT** |
| **Redistribution Permission** | Permitted with license notice & attribution | Permitted for open-source and commercial use |
| **Commercial-Use Restrictions** | None (under Apache 2.0 terms) | None (models trained on open CASIA/VGGFace2) |
| **Modification Restrictions** | Notice of modifications required | Notice of modifications required |
| **Required Attribution** | Copyright Google LLC | Copyright OpenFaceID Contributors |
| **Offline Guaranteed** | 100% local in-memory weights | 100% local in-memory weights |

