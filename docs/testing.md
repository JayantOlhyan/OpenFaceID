# OpenFaceID Testing Guide

## 1. Testing Philosophy & Test Tiers

OpenFaceID enforces a multi-tiered testing discipline to ensure mathematical correctness, fail-closed security invariants, resource efficiency, and hardware compatibility.

The project strictly distinguishes between:
1. **Synthetic / Analytical Tests**: Headless tests running in CI on synthetic mathematical fixtures with 0 hardware dependencies.
2. **Software Integration Tests**: Multi-package lifecycle and IPC communication tests running in CI.
3. **Physical Hardware Tests**: Interactive or automated tests that interface with real physical optical webcam sensors and OS keystores (conducted on dedicated hardware test machines).
4. **Human Cohort Benchmarks**: Empirical recognition accuracy, FAR/FRR, and demographic equity evaluations.

---

## 2. Test Suites Overview

| Test Tier | Directory | Execution Environment | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | `tests/unit/` | CI & Local (Headless) | Component isolation, state transitions, mathematical formulas, boundary enforcement. |
| **Contract Tests** | `tests/unit/api_contracts.test.ts` | CI & Local (Headless) | Public API schemas, enum stability, error codes, backward compatibility. |
| **Boundary Tests** | `tests/unit/architecture_boundaries.test.ts` | CI & Local (Headless) | Monorepo import direction enforcement and 0 runtime dependency invariant. |
| **Example Tests** | `tests/unit/examples.test.ts` | CI & Local (Headless) | Ensures all code samples in `examples/` compile and execute without errors. |
| **Security Tests** | `tests/security/` | CI & Local (Headless) | Fail-closed invariants, multiple-face drop, timing-safe tokens, path traversal, file permissions. |
| **Performance Tests** | `tests/performance/` | CI & Local (Headless) | Microbenchmarks (latency, memory allocations) and long-running soak test (1500 cycles). |
| **Evaluation Tests** | `tests/evaluation/` | CI & Local (Headless) | Accuracy metrics, FAR/FRR, APCER/BPCER on synthetic biometric datasets. |
| **Hardware Tests** | `tests/hardware/` | Physical Hardware Lab | Real camera discovery, permission negotiation, measured capture FPS, RAM zeroization. |

---

## 3. Running Tests Locally

### 3.1 All Headless Tests (CI Standard)

```bash
# Run the complete test suite (unit + integration + examples + contracts + boundaries)
npm test
```

### 3.2 Individual Component Tests

```bash
# Architectural boundary verification
node --experimental-strip-types --test tests/unit/architecture_boundaries.test.ts

# Public API contract verification
node --experimental-strip-types --test tests/unit/api_contracts.test.ts

# Developer examples verification
node --experimental-strip-types --test tests/unit/examples.test.ts

# Security regression suite
node --experimental-strip-types --test tests/security/security_regression.test.ts
```

### 3.3 Performance & Microbenchmarks

```bash
# Run latency and memory microbenchmarks
npm run test:perf
```

### 3.4 Physical Hardware Tests (Requires Webcam)

```bash
# Discover real webcam hardware and test real-time capture
node --experimental-strip-types apps/cli/bin/openfaceid.ts camera test

# Run real-time interactive recognition in terminal
node --experimental-strip-types apps/cli/bin/openfaceid.ts recognition test
```

---

## 4. Writing New Tests

* Use Node's built-in `node:test` runner and `node:assert/strict`.
* Do not import Jest, Mocha, Chai, or other test runners.
* Use `createSyntheticFrame` and `createSyntheticLandmarks` from `examples/demo/fixtures.ts` for all visual inputs.
* Never hardcode machine-specific file paths (e.g. `/Users/jayantolhyan/`). Use `path.join(os.homedir(), '.openfaceid')` or temporary directories.
