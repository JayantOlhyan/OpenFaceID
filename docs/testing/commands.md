# OpenFaceID Test & Verification Command Matrix

## 1. Automated Test Commands

All test commands run headlessly without requiring camera hardware or GUI displays:

| Command | Execution Target | Expected Duration | CI Runner |
| :--- | :--- | :--- | :--- |
| **`npm test`** | Full test suite (`tests/unit/`, `tests/evaluation/`, `tests/performance/`) | ~5–10s | macOS, Linux, Windows |
| **`npm run test:unit`** | Unit, contract, and architectural boundary tests | ~2–4s | macOS, Linux, Windows |
| **`npm run test:eval`** | Biometric evaluation and accuracy regression suites | ~2–3s | macOS, Linux, Windows |
| **`npm run test:perf`** | Microbenchmarks (latency, memory allocations, soak) | ~3–5s | macOS, Linux, Windows |

---

## 2. Evaluation & Benchmark Pipeline Commands

These scripts generate formatted empirical reports under `docs/`:

| Command | Description | Output Artifact |
| :--- | :--- | :--- |
| **`npm run eval`** | Executes recognition evaluation, threshold analysis, and liveness evaluation | `docs/biometric-evaluation-report.md` |
| **`npm run perf`** | Executes vision pipeline latency, memory profiling, and stress soak | `docs/performance-report.md` |

---

## 3. Developer & Environment Health Commands

| Command | Purpose | Expected Output |
| :--- | :--- | :--- |
| **`npm run cli doctor`** | Basic system, permission, and hardware health check | Human-readable diagnostics table |
| **`npm run cli -- doctor --dev`** | Developer diagnostic check (Node version, compiler, permissions) | Diagnostic summary |
| **`npm run cli -- doctor --json`** | Machine-readable health check | Parseable JSON object |
| **`npm run cli -- security check`** | Verifies encryption, loopback binding, and model integrity | 6/6 security gates pass |
| **`npm run cli -- privacy check`** | Verifies zero cloud egress and memory sanitization | 4/4 privacy gates pass |

---

## 4. Physical Hardware Testing Commands

> [!NOTE]
> These commands require a physical webcam sensor connected to the host machine. They cannot run inside headless CI virtual machines.

| Command | Purpose | Hardware Tested |
| :--- | :--- | :--- |
| **`npm run hardware:doctor`** | Hardware discovery & permission probe | AVFoundation / WMF / V4L2 |
| **`npm run hardware:camera`** | Live video frame capture and measured FPS | Camera sensor & USB bus |
| **`npm run hardware:recognition`** | Live webcam face detection and recognition | Camera + Vision pipeline |
| **`npm run hardware:liveness`** | Live presentation attack detection (PAD) | Webcam micro-motion |
| **`npm run hardware:presence`** | Real-time presence lifecycle and absence timeout | Desktop presence tracker |
| **`npm run hardware:recovery`** | Camera disconnect/reconnect and sleep/wake loop | Device driver recovery |
| **`npm run hardware:report`** | Generates physical hardware evidence summary | `docs/hardware-validation-report.md` |
