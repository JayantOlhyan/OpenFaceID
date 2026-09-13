# Biometric Evaluation Methodology & Theoretical Foundations

## 1. Overview & Objective

Phase 6 of OpenFaceID (SightLock) establishes an evidence-backed evaluation framework to answer:
> **Does the actual OpenFaceID vision pipeline reliably recognize an enrolled person, reject other people, and maintain acceptable behavior under realistic desktop conditions?**

This document establishes the mathematical foundations, metric definitions, evaluation protocols, and transparent model reality disclosures governing all biometric benchmarks in this repository.

---

## 2. Model Reality Check & Provenance Transparency

In accordance with Phase 6 Section 3, OpenFaceID explicitly and transparently declares the true nature of its in-tree computer vision components.

| Component | In-Tree Implementation | Pretrained Weights Status | Provenance & License |
|---|---|---|---|
| **Face Detection** | \`BlazeFaceDetector\` | **NOT VERIFIED** (In-tree analytical TS formulation) | Analytical implementation of BlazeFace 896-anchor geometry with YCbCr chrominance skin locus heuristics. Apache-2.0. |
| **Face Embedding** | \`ArcFaceEmbedder\` | **NOT VERIFIED** (In-tree analytical TS formulation) | Analytical spatial receptive-field projection (7x7 spatial grid, Fourier frequency bases, facial landmark ratios, L2 normalization) producing 512D unit vectors. Apache-2.0. |
| **Liveness Detection** | \`LivenessDetector\` | N/A (Algorithmic formulation) | In-tree temporal Eye Aspect Ratio (EAR) blink tracking, micro-motion landmark variance, and active 8-state spatial challenges. Apache-2.0. |
| **Quality Analysis** | \`FaceQualityAnalyzer\` | N/A (Algorithmic formulation) | In-tree Laplacian variance sharpness, luminance distribution, affine landmark pose estimation (yaw, pitch, roll), and centering bounds. Apache-2.0. |

### Architectural Limitations
1. **No Compiled Binary Weights**: The current engine does not execute compiled `.onnx` or `.tflite` neural network weights.
2. **Deterministic Mathematical Projections**: Embeddings are computed purely in CPU memory via TypeScript linear algebra and trigonometric basis functions.
3. **Small-Sample / Synthetic Cohorts**: Due to biometric privacy laws (GDPR Art. 9, CCPA, BIPA) and repository hygiene rules, benchmarks are conducted on controlled synthetic and indicative desktop cohorts. Results are reported as **indicative rather than statistically universal across world populations**.

---

## 3. Mathematical Foundations & Metric Definitions

### 3.1 Cosine Similarity Space
Face embeddings $\mathbf{u}, \mathbf{v} \in \mathbb{R}^{512}$ reside on the 512-dimensional unit hypersphere $\mathbb{S}^{511}$ after L2 normalization:
$$\|\mathbf{u}\|_2 = \sqrt{\sum_{i=1}^{512} u_i^2} = 1.0$$

The similarity between two embeddings is their inner product:
$$s(\mathbf{u}, \mathbf{v}) = \langle \mathbf{u}, \mathbf{v} \rangle = \sum_{i=1}^{512} u_i v_i, \quad s \in [-1.0, 1.0]$$

Cosine distance is defined as:
$$d(\mathbf{u}, \mathbf{v}) = 1 - s(\mathbf{u}, \mathbf{v}), \quad d \in [0.0, 2.0]$$

### 3.2 Threshold Semantics & Monotonicity
The recognition engine evaluates matching candidates using similarity:
$$\text{Decision}(\mathbf{u}, \mathbf{v}) = \begin{cases} \text{MATCH} & \text{if } s(\mathbf{u}, \mathbf{v}) \ge \theta \\ \text{REJECT} & \text{if } s(\mathbf{u}, \mathbf{v}) < \theta \end{cases}$$

Because $s \ge \theta$:
- **Larger $\theta$** requires higher similarity (stricter security, lower FAR, higher FRR).
- **Smaller $\theta$** allows lower similarity (looser security, higher FAR, lower FRR).

**Active Preset Calibrations**:
- **Balanced**: $\theta = 0.70$
- **Strict**: $\theta = 0.80$
- **Very Strict**: $\theta = 0.88$

### 3.3 Recognition Metrics (ISO/IEC 19795-1)
Given a set of genuine comparison scores $\mathcal{S}_{\text{gen}}$ and impostor comparison scores $\mathcal{S}_{\text{imp}}$:

1. **True Accept Rate (TAR)**:
   $$\text{TAR}(\theta) = \frac{|\{s \in \mathcal{S}_{\text{gen}} : s \ge \theta\}|}{|\mathcal{S}_{\text{gen}}|}$$
2. **False Reject Rate (FRR)**:
   $$\text{FRR}(\theta) = 1 - \text{TAR}(\theta) = \frac{|\{s \in \mathcal{S}_{\text{gen}} : s < \theta\}|}{|\mathcal{S}_{\text{gen}}|}$$
3. **False Accept Rate (FAR)**:
   $$\text{FAR}(\theta) = \frac{|\{s \in \mathcal{S}_{\text{imp}} : s \ge \theta\}|}{|\mathcal{S}_{\text{imp}}|}$$
4. **Equal Error Rate (EER)**:
   The operating point $\theta^*$ where:
   $$\text{FAR}(\theta^*) = \text{FRR}(\theta^*)$$

### 3.4 Presentation Attack Detection Metrics (ISO/IEC 30107-3)
1. **Attack Presentation Classification Error Rate (APCER)**:
   $$\text{APCER} = \frac{|\text{Attack Presentations Classified as Bona Fide}|}{|\text{Total Attack Presentations}|}$$
2. **Bona Fide Presentation Classification Error Rate (BPCER)**:
   $$\text{BPCER} = \frac{|\text{Bona Fide Presentations Classified as Attack}|}{|\text{Total Bona Fide Presentations}|}$$

---

## 4. Operational Boundaries

| Environmental Dimension | Nominal Range | Rejection Threshold |
|---|---|---|
| **Ambient Illuminance** | 50 – 200 luma | $< 35$ (\`TOO_DARK\`), $> 235$ (\`TOO_BRIGHT\`) |
| **Image Sharpness (Laplacian)** | $> 70$ | $< 50$ (\`BLURRY\`) |
| **Face Centering Offset** | $< 0.25$ | $> 0.35$ (\`FACE_NOT_CENTERED\`) |
| **Face Frame Area Ratio** | 0.10 – 0.60 | $< 0.08$ (\`FACE_TOO_FAR\`), $> 0.75$ (\`FACE_TOO_CLOSE\`) |
| **Head Yaw Angle** | $\pm 15^\circ$ | $> 35^\circ$ (\`EXTREME_ANGLE\`) |
| **Head Pitch Angle** | $\pm 15^\circ$ | $> 30^\circ$ (\`EXTREME_ANGLE\`) |
| **Head Roll Angle** | $\pm 10^\circ$ | $> 25^\circ$ (\`EXTREME_ANGLE\`) |
| **Face Count** | Exactly 1 | $0$ (\`NO_FACE\`), $\ge 2$ (\`MULTIPLE_FACES\` $\rightarrow$ \`PRESENCE_AMBIGUOUS\`) |
