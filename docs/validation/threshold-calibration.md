# OpenFaceID — Phase 11 Threshold Calibration & Operating Points

**Document ID**: OFID-VAL-THRESH-011  
**Phase**: Phase 11 Real-World Validation  
**Canonical Version**: `0.2.1-rc.1`  
**Evaluation Date**: September 2026  
**Artifact Source**: `data/evaluation/realworld-evaluation.json`  

---

## 1. Operating Point Trade-Off Analysis

In biometric verification, similarity threshold $\tau \in [0.0, 1.0]$ defines the critical operating boundary between True Accept Rate (TAR) / False Reject Rate (FRR) and False Accept Rate (FAR).

The Phase 11 real-world evaluation tested 1,200 genuine probe comparisons and 750 impostor comparisons across 12 enrolled subjects under diverse environmental conditions:

```
Biometric Error Curve (Analytical 512D Unit Hypersphere)

Error Rate (%)
  100% ▲ \                                                    /
       │  \                                                  /  FRR (Low light / Extreme pose)
   80% │   \                                                /
       │    \                                              /
   60% │     \                                            /
       │      \                                          /
   40% │       \                                        /
       │        \                                      /
   20% │         \                                    /
    8% │          \         FAR (Near-Neighbors)     /
    0% └───────────▼─────────────────▲──────────────▼────────► Cosine Similarity (τ)
                  0.50             0.70           0.80
```

---

## 2. Empirical Recognition Metrics Table

All metrics are reported with exact mathematical numerators and denominators:

| Operating Preset | Threshold ($\tau$) | Genuine Cooperative TAR | Genuine Adverse TAR (Pose/Light) | Overall Genuine TAR | Overall FRR | Disjoint Impostor FAR | Near-Neighbor Impostor FAR | Overall FAR | Recommended Deployment Profile |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Balanced (Default)** | **0.70** | **100.0%** (240 / 240) | 0.0% (0 / 960) | **20.00%** (240 / 1200) | **80.00%** (960 / 1200) | **0.000%** (0 / 500) | **8.000%** (20 / 250) | **2.667%** (20 / 750) | **Continuous desktop presence monitoring** with rolling temporal consensus under normal room lighting. |
| **Strict** | **0.80** | **58.75%** (141 / 240) | 0.0% (0 / 960) | **11.75%** (141 / 1200) | **88.25%** (1059 / 1200) | **0.000%** (0 / 500) | **0.000%** (0 / 250) | **0.000%** (0 / 750) | **High-security desktop presence** where zero false accepts from look-alikes is strictly mandated. |
| **Very Strict** | **0.88** | **0.00%** (0 / 240) | 0.0% (0 / 960) | **0.00%** (0 / 1200) | **100.00%** (1200 / 1200) | **0.000%** (0 / 500) | **0.000%** (0 / 250) | **0.000%** (0 / 750) | Experimental maximum discrimination; requires multi-frame temporal averaging. |

---

## 3. Key Findings & Calibration Decisions

1. **Why $\tau = 0.70$ Remains the Recommended Balanced Default**:
   - For cooperative users seated in front of their desktop webcam under normal office/home lighting (150–500 lux), $\tau = 0.70$ achieves **100.0% TAR** (240 out of 240 accepts) with an average cosine similarity of **0.8024**.
   - For unrelated impostors, $\tau = 0.70$ achieves **0.00% FAR** (0 out of 500 false accepts; maximum observed similarity was only 0.173).
2. **Why Adverse Conditions Fail at $\tau = 0.70$**:
   - When head pose exceeds $\pm 20^\circ$ yaw or ambient light falls below $35\text{ lux}$, 2D analytical gradient projections lose alignment with the frontal gallery template, yielding similarities between 0.438 and 0.513.
   - OpenFaceID's fail-closed design deliberately treats these as non-matches rather than lowering $\tau$ below 0.65, which would cause impostor false accepts to surge.
3. **Temporal Rolling Consensus Mitigation**:
   - In production continuous presence mode, OpenFaceID uses a 5-frame rolling window (`windowSize = 5`, `requiredMatches = 4`). Transient pose dips during natural head movements are buffered by the temporal grace period (default: 20 seconds), maintaining stable presence without false screen locks.
