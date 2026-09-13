# OpenFaceID — Threshold Calibration & Biometric Matching Analysis

## 1. Mathematical Foundations of Cosine Similarity

OpenFaceID maps face crops to an L2-normalized 512-dimensional unit hypersphere $\mathbb{S}^{511} \subset \mathbb{R}^{512}$:

$$\|\mathbf{u}\|_2 = \sqrt{\sum_{i=1}^{512} u_i^2} = 1.0, \quad \|\mathbf{v}\|_2 = \sqrt{\sum_{i=1}^{512} v_i^2} = 1.0$$

The similarity metric between probe vector $\mathbf{u}$ and enrolled gallery vector $\mathbf{v}$ is the cosine of their angular separation $\theta$:

$$\text{Sim}(\mathbf{u}, \mathbf{v}) = \mathbf{u} \cdot \mathbf{v} = \sum_{i=1}^{512} u_i v_i = \cos(\theta)$$

Since $\mathbf{u}$ and $\mathbf{v}$ are unit vectors:
- **$\text{Sim} = 1.0$**: Identical facial representations ($\theta = 0^\circ$).
- **$\text{Sim} = 0.0$**: Orthogonal facial representations ($\theta = 90^\circ$).
- **$\text{Sim} < 0.0$**: Anti-correlated representations ($\theta > 90^\circ$).

---

## 2. Threshold Selection Tradeoffs: FAR vs. FRR

In biometric systems, selecting an operating threshold $\tau \in [0.0, 1.0]$ governs the trade-off between two opposing error rates:

1. **False Acceptance Rate (FAR)**: The probability that an unauthorized impostor's face is mistakenly authenticated:
   $$\text{FAR}(\tau) = P(\text{Sim}(\mathbf{u}_{\text{impostor}}, \mathbf{v}_{\text{enrolled}}) \ge \tau)$$
2. **False Rejection Rate (FRR)**: The probability that the genuine authorized user is rejected due to environmental variance:
   $$\text{FRR}(\tau) = P(\text{Sim}(\mathbf{u}_{\text{genuine}}, \mathbf{v}_{\text{enrolled}}) < \tau)$$

```
  Error Rate
     ▲
100% │ \                                       /
     │  \                                     /
     │   \  FRR (False Reject)               /  FAR (False Accept)
     │    \                                 /
     │     \                               /
     │      \             EER             /
     │       \             ▼             /
     │        \           ▲             /
     │         \         / \           /
     │          \       /   \         /
  0% └───────────▼─────────────────▲──────────────▼────────► Similarity Threshold (τ)
                0.50             0.70           0.80           0.88
```

### Certified Threshold Profiles (ArcFace 512D Cosine Similarity)

In accordance with Section 10 & 48, OpenFaceID standardizes on three certified operational operating points:

| Preset Profile | Threshold ($\tau$) | Genuine Cooperative TAR | Impostor FAR | Use Case & Security Profile |
| :--- | :---: | :---: | :---: | :--- |
| **Balanced (Default)** | **`0.70`** | **100.0%** (240 / 240) | **0.000%** (0 / 500 disjoint) | Everyday continuous presence monitoring and desktop automation under standard office lighting (150–500 lux). |
| **Strict** | **`0.80`** | **58.75%** (141 / 240) | **0.000%** (0 / 750 overall) | High-security desktop presence where zero false accepts from near-neighbors/look-alikes is strictly mandated. |
| **Very Strict** | **`0.88`** | **0.00%** (0 / 240) | **0.000%** (0 / 750 overall) | Maximum discrimination; requires rolling multi-frame temporal averaging in bright, uniform lighting. |

> [!IMPORTANT]
> The default threshold of `0.70` is a **calibrated operating point**, not an absolute security guarantee. Biometric matching thresholds are influenced by sensor noise, camera ISP sharpness, and ambient illumination. For detailed empirical evaluation data across 1,950 probe comparisons, see [Phase 11 Threshold Calibration](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/docs/validation/threshold-calibration.md).

---

## 3. Temporal Window Aggregation

Single-frame decisions are vulnerable to transient noise (sensor flicker, motion blur, eye blinks). OpenFaceID uses a rolling temporal window:

$$W = \{s_1, s_2, s_3, s_4, s_5\}$$

Decision rule:
$$\text{Authorized} \iff \sum_{i=1}^N \mathbb{I}(s_i \ge \tau) \ge k$$

Where:
- Window size $N = 5$ frames.
- Required matches $k = 4$ out of 5 frames.
- Exponential moving average weights newer frames: $w_i = 1.2^i$.

This temporal gate reduces single-frame False Accepts while tolerating natural brief blinks.

---

## 4. Calibration Influences & User Conditions

1. **Ambient Lighting Variance**:
   - Backlighting (e.g. sitting in front of a bright window) reduces facial contrast, lowering match scores by $0.08 - 0.15$.
   - Dim lighting increases sensor noise, elevating Laplacian blur rejections.
2. **Eyeglasses & Accessories**:
   - Enrolling an identity profile with and without glasses (using 5-pose guided capture) significantly lowers the FRR.
3. **Camera Resolution & Optics**:
   - A 1080p webcam yields higher Laplacian sharpness scores than a 480p sensor.

---

## 5. Summary Recommendation
- For standard personal laptop workstations: keep threshold at **`0.70`** (Balanced).
- For enterprise lock policies: increase threshold to **`0.80`** (Strict) and require active challenge liveness mode.
- Valid configurable range: `0.50` to `0.98`. Values outside this range are rejected by `ConfigValidator`.
