# OpenFaceID (SightLock) — Architecture Decision Record (ADR)

## ADR 001: Technology Stack & Core Framework Selection

### Status: Accepted
### Date: 2026-09-11
### Deciders: Lead Software Architect & Systems Engineering Team

---

## 1. Context and Problem Statement
OpenFaceID requires a cross-platform (macOS, Windows, Linux) desktop architecture that is:
- **Local-first & Privacy-focused**: All biometric inference occurs strictly on-device in RAM.
- **Performant & Responsive**: Low latency (<15ms per frame inference), low idle CPU usage, and low battery consumption.
- **Highly Modular**: Vision models, camera providers, liveness algorithms, and platform integrations must be interchangeable without application rewrites.
- **Maintainable & Accessible**: Permissive open-source licensing, minimal build-toolchain friction for contributors, and robust automated testability.

---

## 2. Considered Alternatives

### Option A: Rust Core + Tauri (Wry/Tao) Desktop Shell
- **Pros**:
  - Memory-safe, compiled binary.
  - Very small executable footprint (~15–20 MB).
  - High performance via native SIMD (`tract` / `ort`).
- **Cons**:
  - Requires heavy local compilation toolchains (Rust compiler, Cargo, LLVM, C build tools).
  - Slower iteration cycle for open-source UI contributors.
  - Packaging across varying Linux distributions (glibc vs musl, WebKitGTK versions) has known distribution pain points.

### Option B: Rust Core + 3 Distinct Native Platform UIs (SwiftUI, WinUI 3, GTK4)
- **Pros**:
  - 100% native look-and-feel on each OS.
- **Cons**:
  - Requires maintaining three separate UI codebases.
  - Massive maintenance overhead; features inevitably diverge across platforms.
  - High barrier to entry for open-source contributors.

### Option C: C++ / OpenCV Core + Qt6
- **Pros**:
  - Direct native OpenCV and hardware camera drivers.
  - Mature desktop widgets.
- **Cons**:
  - Qt6 licensing complexities (LGPLv3 requirements vs proprietary or dual licensing).
  - Cross-compilation and distribution across macOS (universal binaries), Windows (MSVC runtime), and Linux (distro dependencies) is notoriously difficult.
  - Memory safety vulnerabilities (buffer overflows, use-after-free).

### Option D: Python Core + Electron/Qt
- **Pros**:
  - Rapid prototyping with PyTorch / OpenCV / InsightFace.
- **Cons**:
  - Packaging Python runtime + PyTorch / NumPy binaries leads to huge bundle sizes (>350 MB to 1 GB).
  - Python Global Interpreter Lock (GIL) bottlenecks real-time camera capture and UI responsiveness.
  - High memory usage (>300 MB idle).

### Option E (Chosen Architecture): TypeScript / Node.js Core + Modular Native Adapters + Vite & React 19 Shell
- **Pros**:
  - **Single Shared Language**: TypeScript across core business logic, computer vision interfaces, state machines, platform adapters, CLI, and desktop UI.
  - **Universal Toolchain**: Node.js and npm are universally installed on developer machines; zero compilation barrier to clone and run.
  - **Inference Efficiency**: Fast ONNX Runtime / WebAssembly SIMD execution achieves <10ms CPU inference time.
  - **Decoupled Architecture**: The core engine runs equally well in an interactive desktop window, as a background headless daemon, or via terminal CLI.
  - **Modern UI & Design System**: Rapid implementation of responsive, Linear/Raycast-grade dark UI with keyboard navigation, floating Quick Glance HUD, and fine-grained state management.
- **Cons**:
  - Requires isolated process execution or Web Workers to prevent heavy frame processing from blocking UI rendering (mitigated via asynchronous workers and dynamic frame rate throttling).

---

## 3. Decision Rationale

We select **Option E: TypeScript / Node.js Monorepo with Native Adapters & Vite/React UI**:
1. **Developer Experience & Contribution**: Open-source contributors can immediately `git clone`, `npm install`, and `npm test` without installing multi-gigabyte native SDKs.
2. **True Platform Parity**: The core state machines, policies, and vision algorithms are identical across macOS, Windows, and Linux. Platform divergence is strictly quarantined inside `packages/platform`.
3. **Execution Versatility**: Can be bundled as a standalone single-executable application (SEA), packaged via Electron/Tauri, or run as a lightweight system service.

---

## 4. Key Architectural Pillars

### 4.1 In-Memory Biometric Processing Pipeline
```
[Webcam Stream] ──(RAM)──> [Frame Sampler (1-15 FPS)]
                                │
                                ▼
                       [Face Detector (BlazeFace)]
                                │
                        (Bounding Box & 5 Landmarks)
                                │
                                ▼
                    [Face Quality & Pose Analyzer]
                                │ (Pass / Actionable Guidance)
                                ▼
                       [Affine Face Normalization]
                                │
                                ▼
                     [Embedding Extractor (ArcFace)]
                                │ (512D Float32Array)
                                ▼
                    [Cosine Similarity & Temporal Aggregator]
                                │
                                ▼
                     [Modular Liveness Verification]
                                │
                                ▼
                   [Policy Engine & Action Dispatcher]
                                │
                    [RAM Buffer Zeroed & Discarded]
```

### 4.2 Security & Storage Boundaries
- **No Plaintext Passwords**: OpenFaceID will **never** request, store, or inject OS user passwords.
- **Authenticated Encryption**: Biometric profiles are encrypted on disk using AES-256-GCM.
- **OS Keystore Derivation**: Master keys reside in macOS Keychain, Windows Credential Manager, or Linux Secret Service.
- **Zero Cloud**: Network egress is completely disabled by default. No analytics, no telemetry, no remote recognition.
