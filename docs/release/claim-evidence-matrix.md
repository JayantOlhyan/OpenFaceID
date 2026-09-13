# OpenFaceID — Final Claim & Evidence Traceability Matrix

**Document ID**: OFID-CLAIM-EVIDENCE-010  
**Phase**: Phase 10 Production Release Candidate + Final Certification  
**Canonical Version**: `0.2.1-rc.1`  
**Purpose**: Map every externally visible technical and biometric claim to empirical test evidence and define precise limitations.  

---

## Technical Claims Traceability

| # | Externally Visible Technical Claim | Evidence | Test Type | Platform | Dataset / Cohort | Trial Count | Status | Precise Limitation |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **C-01** | **Zero Telemetry / Cloud Egress** | `openfaceid privacy check` & AST search: 0 network trackers, `telemetryEnabled: false` locked. | Automated CLI + AST Static Audit | macOS / Darwin | Full repository tree | 1 | **VERIFIED** | Enforced at code level; does not monitor low-level OS kernel networking if root is compromised. |
| **C-02** | **Volatile RAM Sanitization** | `frame.zeroize()` flushes all buffer bytes to `0x00` in <15ms. | Automated Unit Test (`phase5_security_regression.test.ts`) | macOS Darwin | Ephemeral allocated video frame buffers | 50 | **VERIFIED** | Temporary in-memory buffers exist during the ~0.7ms inference window. |
| **C-03** | **Encrypted Biometric Storage** | Enrolled profiles encrypted via `AES-256-GCM` with random 96-bit IV and 128-bit tag. | Automated Security Test (`identity_security.test.ts`) | macOS / Linux / Windows | Synthetic 512D biometric identity profiles | 20 | **VERIFIED** | Protected by file permissions (`0600`) and OS Keyring; not a dedicated hardware Secure Enclave. |
| **C-04** | **Fail-Closed State Machine** | Unknown face, missing face, multi-face, or sensor loss immediately transitions to `UNAUTHORIZED`. | Automated Regression Test (`phase5_security_regression.test.ts`) | macOS Darwin | Synthetic test frames and state transitions | 100 | **VERIFIED** | Relies on software state machine running in the desktop daemon process. |
| **C-05** | **Sub-Millisecond Pipeline Latency** | Median inference latency: 0.628ms; P95: 0.760ms; P99: 0.827ms. | Microbenchmarks (`microbenchmarks.test.ts`) | macOS Apple Silicon M1 | Synthetic 128x128 face crops | 100 | **VERIFIED** | Measured on Apple Silicon M1; slower x86 or low-power processors will measure higher latencies. |
| **C-06** | **Zero Memory Leak / Soak Stability** | RSS memory remains stable at <267 MB across 1,500 continuous pipeline cycles. | Automated Soak Test (`tests/performance/soak.test.ts`) | macOS Apple Silicon M1 | Headless pipeline continuous frames | 1,500 | **VERIFIED** | Soak verified for 1,500 cycles; multi-week non-stop execution remains dependent on OS paging. |
| **C-07** | **Cooperative Facial Recognition TAR** | 100% True Accept Rate on cooperative synthetic evaluation cohort at $\tau = 0.70$. | Automated Eval Suite (`run-recognition-evaluation.js`) | macOS Darwin | Cooperative synthetic facial embedding cohort | 200 | **AUTOMATED ONLY** | Validated on cooperative synthetic test vectors; not tested on public wild benchmarks (LFW/IJB-C). |
| **C-08** | **Biometric FAR at High Threshold** | 0.0% False Accept Rate on distinct synthetic impostor cohort at $\tau = 0.80$ (Strict). | Automated Eval Suite (`run-threshold-analysis.js`) | macOS Darwin | Disjoint synthetic identity vectors | 500 | **AUTOMATED ONLY** | Evaluated on synthetic mathematical distributions; real-world twin or high-similarity impostors uncharacterized. |
| **C-09** | **Presentation Attack Rejection** | Rejection of static photos and screen replays via EAR eye-blinks and Laplacian variance. | Automated Eval Suite (`run-liveness-evaluation.js`) | macOS Darwin | Static / replay synthetic test image streams | 150 | **AUTOMATED ONLY** | 2D optical sensing; does not guarantee resistance against 3D silicone masks or deepfake injectors. |
| **C-10** | **Timing-Safe IPC Authentication** | Constant-time `crypto.timingSafeEqual` comparison on Bearer authorization tokens. | Automated Security Test (`phase5_security_regression.test.ts`) | macOS Darwin | Valid, invalid, and length-mismatched tokens | 50 | **VERIFIED** | Protects IPC socket; does not defend against malicious processes reading memory directly. |
| **C-11** | **Physical Camera Capture on macOS** | Successful device enumeration, permission verification, and real frame capture via FaceTime HD. | Hardware Script (`scripts/hardware/camera-test.js`) | macOS Apple Silicon M1 | Real physical webcam sensor | 30 | **HARDWARE VERIFIED** | Verified on Apple Silicon hardware; Windows and Linux hardware pending lab testing (RB-02). |
| **C-12** | **Zero External Runtime Dependencies** | 0 external packages in runtime dependencies; `npm audit` reports 0 vulnerabilities. | Lockfile & `npm audit` | Node.js v25.2.1 | Monorepo root and all 12 workspace packages | 1 | **VERIFIED** | Build requires `typescript: ^5.7.3` as devDependency. |
| **C-13** | **Deterministic Clean Build** | Fresh clone from scratch in isolated directory builds, passes tests, and runs CLI cleanly. | Reproducible Build Script (`docs/release/reproducible-build.md`) | macOS Darwin | Clean temporary isolated workspace | 1 | **VERIFIED** | Requires Node.js >= 22.0.0 with `--experimental-strip-types`. |

---

## Disclaimers & Non-Equivalence Notice

1. **Not Apple Face ID or Windows Hello**: OpenFaceID makes no claim of equivalence to dedicated infrared/depth biometric hardware.
2. **Not Operating System Login**: OpenFaceID operates purely at the user desktop session layer.
3. **Hardware Certification Scope**: macOS is the only physically verified platform in `v0.2.1-rc.1`. Windows and Linux hardware certifications are explicitly unverified (Blocker `RB-02`).
