# Biometric Dataset Protocol & Privacy Guardrails

## 1. Absolute Privacy & Git Hygiene Mandate

> [!CAUTION]
> **NO BIOMETRIC DATA IN GIT**: Under no circumstances shall real human biometric images, video clips, face crops, or persistent embedding dumps be committed to the OpenFaceID git repository.

In accordance with Section 7 of the project charter and biometric privacy standards (GDPR Article 9, Illinois Biometric Information Privacy Act (BIPA), California Consumer Privacy Act (CCPA)):
1. **Local Quarantine**: All evaluation datasets, test recordings, and benchmark outputs must reside exclusively in \`data/evaluation/\`.
2. **Git Exclusion**: \`data/evaluation/*\` is strictly ignored via \`.gitignore\` with the sole exception of the directory tracking placeholder \`data/evaluation/.gitkeep\`.
3. **Transient Memory Zeroization**: Any frame buffer held in RAM during testing must have its \`.zeroize()\` method invoked immediately upon test conclusion.

---

## 2. Dataset Partitioning: Development vs Evaluation

To avoid data leakage, circular calibration, and over-optimistic performance figures:

```text
┌──────────────────────────────────────────────────────────┐
│                   Development Cohort                     │
│  - Parameter discovery (minInterval, IOU, EAR thresholds)│
│  - Anchor tuning & heuristic calibration                 │
└────────────────────────────┬─────────────────────────────┘
                             │ (Strict Separation)
                             ▼
┌──────────────────────────────────────────────────────────┐
│                   Evaluation Cohort                      │
│  - Final unbiased TAR / FAR / FRR measurement            │
│  - Never used for threshold selection                    │
│  - Fixed random seeds and controlled variation sets      │
└──────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Small-Sample Disclaimer**:
> Current benchmarks utilize small-sample synthetic cohorts modeling real desktop conditions.
> **Results are indicative rather than statistically representative of global human populations.**

---

## 3. Metadata Schema (Safe & Non-PII)

All probe metadata collected during evaluation sessions must omit Personally Identifiable Information (PII). Only categorical testing attributes are permitted:

```json
{
  "sampleId": "probe_synth_0042",
  "subjectId": "usr_subject_2",
  "sessionIndex": 1,
  "cameraClass": "built_in_rgb_1080p",
  "lightingCategory": "nominal_office_fluorescent",
  "poseCategory": "yaw_15_left",
  "distanceCategory": "normal_desktop_60cm",
  "occlusionCategory": "none",
  "timestamp": 1726228800000,
  "expectedLabel": "usr_subject_2"
}
```

### Prohibited Fields:
- Real names, email addresses, employee IDs.
- Raw photographic file paths pointing to personal storage.
- IP addresses, geolocation, or hardware MAC addresses.

---

## 4. Cohort Variation Dimensions

Real-world desktop evaluation probes must capture variations across 7 operational dimensions:

| Dimension | Categories Tested | Controlled Variables |
|---|---|---|
| **1. Session Temporal Split** | Same-session vs Next-day session | Simulates hairstyle, ambient light, clothing changes. |
| **2. Head Pose** | Frontal ($0^\circ$), Left ($15^\circ$), Right ($15^\circ$), Up ($10^\circ$), Down ($10^\circ$) | Affine landmark realignment stress test. |
| **3. Distance / Scale** | Far (8% frame area), Nominal (20-40%), Close (70%) | Receptive field scaling and interpolation. |
| **4. Illumination** | Low light (40 luma), Office (130 luma), Glare/Backlit (230 luma) | Dynamic range & chrominance stability. |
| **5. Occlusion** | Eyeglasses, subtle hand chin-rest, shadow | Receptive field gradient occlusion tolerance. |
| **6. Impostors** | Zero-enrolled synthetic identities ($N=100$) | False accept rate (FAR) discrimination testing. |
| **7. Spoofs** | 2D printouts, digital replay, freeze-frame, timeout | Presentation attack detection (PAD). |

---

## 5. Data Retention & Deletion Policy
- Benchmark output dumps (\`data/evaluation/*.json\`) contain aggregate metrics and anonymous numerical vectors only.
- Developers testing on local hardware with real camera frames must ensure all temporary captures in \`data/evaluation/\` are wiped upon test completion:
  ```bash
  rm -f data/evaluation/*.raw data/evaluation/*.bin data/evaluation/*.eval.json
  ```
