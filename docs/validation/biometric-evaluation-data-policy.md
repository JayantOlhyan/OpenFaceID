# OpenFaceID — Biometric Evaluation Data & Privacy Policy

**Document ID**: OFID-POL-BIOMETRIC-011  
**Phase**: Phase 11 Real-World Validation  
**Canonical Version**: `0.2.1-rc.1`  
**Applicability**: All real-world biometric testing, hardware validation, and usability studies.  

---

## 1. Core Principles

To preserve OpenFaceID's foundational privacy guarantees, real-world evaluation must adhere to strict data-handling boundaries. Under no circumstances may evaluation protocols compromise participant privacy or violate the zero-cloud invariant.

### The Five Non-Negotiable Rules:
1. **Zero Git Persistence**: No raw facial images, video frames, crops, or personally identifiable biometric embeddings may be committed to git repositories or public issue trackers.
2. **Zero Cloud Egress**: Evaluation datasets, probes, or features must never be transmitted to external cloud servers, third-party analytics platforms, or remote APIs.
3. **Explicit Informed Consent**: Any individual participating in real-world testing must provide documented, affirmative opt-in consent prior to camera activation.
4. **Volatile In-Memory Processing**: Frame processing occurs in ephemeral host RAM; raw image buffers must be zeroized (`frame.zeroize()`) immediately after feature extraction.
5. **Immediate Data Quarantine & Shredding**: Any temporary enrolled profiles used for testing must be cryptographically shredded using multi-pass zero-filling (`Buffer.alloc(size, 0)`) immediately following test completion.

---

## 2. Participant Rights & Consent Protocol

### 2.1 Informed Consent Requirements
Participants in real-world validation studies must be informed of:
- **Purpose**: Evaluation of local presence detection, false accept rates, and false reject rates.
- **Sensor Used**: Ordinary standard desktop/laptop 2D webcam.
- **Data Extracted**: Mathematical 512-dimensional unit feature vectors and Eye Aspect Ratio (EAR) blink intervals.
- **Storage Location**: Local volatile RAM and encrypted local disk (`~/.openfaceid/identities/`).
- **Retention Period**: Ephemeral session only; maximum 24 hours during multi-session testing.

### 2.2 Right to Withdraw
- Participants may withdraw consent at any time without justification.
- Upon withdrawal, all enrolled biometric profiles and temporary feature vectors associated with the participant must be shredded immediately via `openfaceid identity delete <id>`.

---

## 3. Dataset Isolation & Storage Standards

| Category | Storage Medium | Encryption | Permitted Duration | Deletion Method |
| :--- | :--- | :--- | :--- | :--- |
| **Raw Camera Frames** | Volatile RAM only | N/A (RAM-only) | $< 15\text{ms}$ (Duration of single frame inference) | `MemorySanitizer.zeroize()` with `0x00` |
| **Feature Vectors (512D)** | Volatile RAM / Local File | AES-256-GCM | Duration of active benchmark run | Multi-pass zero-overwriting before unlink |
| **Evaluation Telemetry** | Local JSON (`data/evaluation/`) | Plaintext JSON | Permanent (Aggregated & Anonymized) | Sanitized of raw vectors / names |
| **Git Tracking** | `.gitignore` Quarantined | N/A | Strictly Prohibited (`data/evaluation/*` ignored) | Pre-commit hook inspection |

---

## 4. Anonymization & Aggregate Reporting

- All evaluation reports must reference participants by anonymous cohort identifiers (e.g., `SUBJECT_G01`, `SUBJECT_G02`, `IMPOSTOR_I01`).
- Reports must never publish personal names, high-resolution photographs, or reconstructible biometric representations.
- Metrics must be reported exclusively as aggregate rates with explicit denominators (e.g., "0 false accepts across 500 impostor comparisons").

---

## 5. Security Incident Handling

If any accidental biometric persistence is detected:
1. **Immediate Quarantine**: Disconnect any running processes.
2. **Cryptographic Shredding**: Execute file shredding on the contaminated path.
3. **Git History Scrubbing**: If any file was staged or committed, perform `git filter-repo` or `git reset` immediately before pushing.
4. **Incident Post-Mortem**: Document root cause in `docs/security/`.
