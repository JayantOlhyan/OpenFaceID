# OpenFaceID Phase 10 Baseline Report

## 1. Baseline System & Environment Metadata

* **Date**: September 13, 2026
* **Repository**: `https://github.com/JayantOlhyan/OpenFaceID`
* **Baseline Commit**: `267081b`
* **Git Branch**: `main`
* **Release Version**: `0.2.1-rc.1`
* **Node.js Runtime**: `v25.2.1` (Architecture: `arm64`)
* **npm Version**: `11.3.0`
* **Host Operating System**: macOS Darwin `25.6.0` (Apple Silicon M1, Model: MAC-01)

---

## 2. Baseline Verification Status

| Category | Status | Evidence / Verification Method |
| :--- | :--- | :--- |
| **Automated Test Suite** | **AUTOMATED VERIFIED** | **179 / 179 PASS** across 44 suites (`node --experimental-strip-types --test`) |
| **Architectural Boundaries** | **AUTOMATED VERIFIED** | 5/5 pass; 0 illegal imports across layers; 0 runtime npm dependencies |
| **Public API Contracts** | **AUTOMATED VERIFIED** | 11/11 pass; stable enums, error structures, cryptographic guarantees |
| **Developer Examples** | **AUTOMATED VERIFIED** | 8/8 runnable examples execute with exit code 0 (`tests/unit/examples.test.ts`) |
| **CLI Functionality** | **LOCAL VERIFIED** | Exit codes 0–7 active; pure `--json` output; `--dev` flag verified |
| **Security Gates** | **LOCAL VERIFIED** | 6/6 security gates pass (`openfaceid security check`) |
| **Privacy Invariants** | **LOCAL VERIFIED** | 4/4 privacy checks pass (`openfaceid privacy check`); 0 telemetry |
| **Performance Soak** | **AUTOMATED VERIFIED** | 1500 continuous evaluation cycles confirmed stable RSS memory plateau (<267 MB) |
| **macOS Hardware** | **HARDWARE VERIFIED** | Physical FaceTime HD camera discovery, 1080p/720p capture, RAM zeroization on MAC-01 |
| **Windows Hardware** | **HARDWARE UNVERIFIED** | Code implemented (`WindowsAdapter`, Media Foundation, DPAPI); hardware unverified |
| **Linux Hardware** | **HARDWARE UNVERIFIED** | Code implemented (`LinuxAdapter`, V4L2, Secret Service); hardware unverified |
| **CI Matrix** | **AUTOMATED VERIFIED** | Multi-OS software CI workflow (`.github/workflows/ci.yml`) |
| **macOS Code Signing** | **DEFERRED** | Unsigned developer build; Gatekeeper bypass required (RB-01) |
| **Windows/Linux Lab** | **DEFERRED** | Physical Windows & Linux testing machines deferred (RB-02) |

---

## 3. Baseline Test Summary

```text
▶ Architectural Boundaries & Dependency Invariants: 5/5 pass
▶ Public API Contract & Stability Invariants: 11/11 pass
▶ Developer Runnable Examples: 8/8 pass
▶ Deterministic Performance Microbenchmarks: 8/8 pass
▶ Stress Soak Reliability (1500 cycles): 1/1 pass
▶ Canonical State Machine: 4/4 pass
▶ Security Regression: 7/7 pass
▶ Biometric Profile Versioning: 3/3 pass
▶ Crypto & Keyring: 3/3 pass
▶ Storage & Shredding: 4/4 pass
▶ Total Tests: 179 passing (0 failing, 0 skipped, 0 cancelled)
```
