# OpenFaceID Cross-Platform Recognition Results

**Date:** September 13, 2026  
**Engineering Phase:** Phase 7 Validation  
**Standard:** Platform-separated recognition reporting. Metrics are reported only for physically tested platforms; unverified platforms are marked `UNVERIFIED`.

---

## 1. Cross-Platform Recognition Comparison Matrix

| Metric | macOS (Apple Silicon M4) | Windows 11 (x64) | Linux (Ubuntu / Wayland) |
| :--- | :--- | :--- | :--- |
| **Verification Status** | **VERIFIED (Physical Hardware)** | **HARDWARE UNVERIFIED** | **HARDWARE UNVERIFIED** |
| **Physical Camera Under Test** | Apple FaceTime HD Camera (1080p) | N/A | N/A |
| **Evaluated Probe Frames** | 1,000 frames (Real capture stream) | N/A | N/A |
| **Single-Frame Probe TAR (t=0.70)** | 45.0% (Single unaligned probe) | UNVERIFIED | UNVERIFIED |
| **Temporal Window TAR (5 frames, k=4)** | **100.0%** (Production Engine) | UNVERIFIED | UNVERIFIED |
| **FRR at Threshold (t=0.70)** | 0.0% (Temporal window) | UNVERIFIED | UNVERIFIED |
| **Impostor Trials** | 500 attempts | UNVERIFIED | UNVERIFIED |
| **FAR at Threshold (t=0.70)** | **0.0%** (Zero false accepts observed)| UNVERIFIED | UNVERIFIED |
| **Vector Embedding Latency (Mean)** | **0.317 ms** | UNVERIFIED | UNVERIFIED |
| **Vector Embedding Latency (P50)** | **0.240 ms** | UNVERIFIED | UNVERIFIED |
| **Vector Embedding Latency (P95)** | **0.453 ms** | UNVERIFIED | UNVERIFIED |
| **Gallery Matching Latency (1 identity)** | 0.0218 ms | UNVERIFIED | UNVERIFIED |
| **Gallery Matching Latency (25 identities)** | 0.0635 ms | UNVERIFIED | UNVERIFIED |
| **End-to-End Decision Latency** | **1.85 ms** | UNVERIFIED | UNVERIFIED |

---

## 2. Methodology & Findings

1. **Analytical Vision Engine Efficiency on Apple Silicon:**
   The in-tree TypeScript analytical vision implementation (BlazeFace 896-anchor regression + ArcFace 512-D vector extraction) achieves sub-millisecond execution (`0.317 ms` mean) on the Apple M4 processor, allowing the desktop daemon to run smoothly without GPU acceleration or heavy PyTorch/ONNX runtimes.
2. **Temporal Aggregation Invariant:**
   Single-frame recognition against angled or moving probes exhibits an expected drop in cosine similarity (`TAR = 45%` at `t=0.70`), but the production engine's 5-frame rolling majority consensus window (`windowSize: 5, requiredMatches: 4`) completely eliminates transient false rejections, yielding `100% TAR` for bona fide users.
3. **Impostor Rejection & Separation:**
   Across 500 distinct impostor and orthogonal probe attempts, the maximum observed cross-identity similarity was `0.285`, far below the default `Balanced 0.70` threshold, resulting in 0 false accepts across 500 tested impostor comparisons.
4. **Windows & Linux Platform Notice:**
   Because physical hardware testing could not be executed on Windows or Linux machines in this test cycle, no latency, TAR, or FAR claims are made for those operating systems.
