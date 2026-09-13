# Biometric Recognition Evaluation Results

**Evaluation Date**: 2026-09-13T12:30:08.023Z  
**Architecture Reality**: In-tree pure TypeScript analytical formulation  
**Status**: `INDICATIVE / SMALL-SAMPLE EVALUATION`  

---

## Executive Summary

The OpenFaceID recognition engine (comprising `ArcFaceEmbedder` and `FaceRecognizer`) was evaluated across controlled genuine probe sets and zero-enrolled impostor probe cohorts.

- **Zero False Accept Rate (FAR)** was maintained across all standard presets (**0.00%** at Balanced 0.70, Strict 0.80, and Very Strict 0.88).
- **Latency**: Sub-millisecond hyperspherical cosine matching in RAM ($P95 < 0.06\text{ ms}$).
- **Discrimination**: High inter-subject angular separation ($0.084 \pm 0.028$ mean impostor similarity vs $0.700 \pm 0.127$ mean genuine similarity).

---

## Preset Benchmark Matrix

| Preset | Threshold | Genuine Count | Impostor Count | True Accepts | False Rejects | True Rejects | False Accepts | TAR (%) | FRR (%) | FAR (%) | Latency P95 (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Balanced** | `0.70` | 100 | 100 | 45 | 55 | 100 | 0 | **45%** | 55% | **0%** | `0.057 ms` |
| **Strict** | `0.80` | 100 | 100 | 24 | 76 | 100 | 0 | **24%** | 76% | **0%** | `0.013 ms` |
| **Very Strict** | `0.88` | 100 | 100 | 19 | 81 | 100 | 0 | **19%** | 81% | **0%** | `0.013 ms` |

---

## Score Distribution Analysis

| Metric | Genuine Pairs ($S_{\text{genuine}}$) | Impostor Pairs ($S_{\text{impostor}}$) |
|---|---|---|
| **Mean Similarity** | `0.7` | `0.084` |
| **Standard Deviation** | `± 0.127` | `± 0.028` |
| **Minimum Observed** | `0.487` | `0.012` |
| **Maximum Observed** | `0.896` | `0.155` |

### Observations:
1. **Clear Margin Separation**: The maximum observed impostor similarity (`0.155`) is substantially below the lowest preset threshold (0.70), guaranteeing zero false accepts on this cohort.
2. **Usability / Security Trade-off**: As threshold increases from 0.70 to 0.88, genuine acceptance drops as expected, requiring closer front-facing camera alignment or multi-frame temporal confirmation.
