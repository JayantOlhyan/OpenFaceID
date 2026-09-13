# Recognition Threshold Sweep & Calibration Analysis

**Evaluation Date**: 2026-09-13T10:50:37.700Z  
**Calibration Standard**: ISO/IEC 19795-1 Biometric Performance Testing  
**Metric Type**: Cosine Similarity $s \in [-1.0, 1.0]$ evaluated as $s \ge t$  

---

## Critical Finding: Threshold Ordering Semantics

> [!IMPORTANT]
> In OpenFaceID's recognition pipeline, similarity is calculated as:
> $$s = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|}$$
> and evaluated via:
> `matchingFrames = scoreBuffer.filter(s => s.similarity >= threshold)`
> 
> Because higher similarity denotes a tighter mathematical match:
> - **Higher threshold = Stricter matching criteria**
> - **Lower threshold = Looser, more permissive criteria**
> 
> Historical documentation incorrectly cited `Balanced (0.72), Strict (0.65), Very Strict (0.58)`, which inverted the security hierarchy by conflating similarity with distance ($d = 1 - s$). The corrected and active preset hierarchy is:
> - **Balanced**: `0.70`
> - **Strict**: `0.80`
> - **Very Strict**: `0.88`

---

## Empirical Sweep Table ($t \in [0.50, 0.92]$)

| Threshold ($t$) | True Accept Rate (TAR) | False Reject Rate (FRR) | False Accept Rate (FAR) | Operating Characteristic |
|---|---|---|---|---|
| `0.50` | 100% | 0% | 0% | Usability-biased |
| `0.52` | 100% | 0% | 0% | Usability-biased |
| `0.54` | 100% | 0% | 0% | Usability-biased |
| `0.56` | 100% | 0% | 0% | Usability-biased |
| `0.58` | 100% | 0% | 0% | Usability-biased |
| `0.60` | 100% | 0% | 0% | Usability-biased |
| `0.62` | 100% | 0% | 0% | Usability-biased |
| `0.64` | 100% | 0% | 0% | Usability-biased |
| `0.66` | 100% | 0% | 0% | Usability-biased |
| `0.68` | 100% | 0% | 0% | Usability-biased |
| `0.70` | 100% | 0% | 0% | **Balanced Operating Point** |
| `0.72` | 100% | 0% | 0% | Permissive |
| `0.74` | 100% | 0% | 0% | Permissive |
| `0.76` | 99.33% | 0.67% | 0% | Permissive |
| `0.78` | 71.33% | 28.67% | 0% | Permissive |
| `0.80` | 8.67% | 91.33% | 0% | **Strict Security Point** |
| `0.82` | 0.67% | 99.33% | 0% | High False Rejection |
| `0.84` | 0% | 100% | 0% | High False Rejection |
| `0.86` | 0% | 100% | 0% | High False Rejection |
| `0.88` | 0% | 100% | 0% | **Very Strict / High Security** |
| `0.90` | 0% | 100% | 0% | High False Rejection |
| `0.92` | 0% | 100% | 0% | High False Rejection |

---

## Crossover Point Analysis
- **Empirical Equal Error Rate (EER)**: `0.00%` crossover at $t \approx 0.50 - 0.74$ on the evaluated synthetic cohort.
- **Recommended Desktop Default**: `0.70` (Balanced) provides optimal noise tolerance while completely excluding orthogonal impostor distributions.
