# OpenFaceID — Desktop Runtime Architecture Decision

**Document ID**: ADR-002  
**Status**: Accepted  
**Date**: 2026-09-11  
**Target Systems**: macOS (13+ Ventura / Sonoma / Sequoia), Windows 10/11, Linux (X11 / Wayland)

---

## 1. Problem Statement

Phase 2 established a functional browser-based prototype served via a local development HTTP server (`apps/desktop/serve.js` at `http://127.0.0.1:41793`). However, an operating-system utility cannot operate as a browser tab running from a dev server. OpenFaceID must:
1. Launch as a standalone desktop application.
2. Run persistently in the background when the dashboard window is closed.
3. Integrate with the system tray (Windows), menu bar (macOS), and status indicator (Linux).
4. Start automatically at system login when enabled by the user.
5. Reliably access the physical camera and recover from disconnects or sleep/wake events.
6. Enforce strict IPC and local API authorization with zero biometric leakage.

---

## 2. Comparative Evaluation of Candidate Architectures

| Evaluation Criterion | Option A: Tauri + Rust Core | Option B: Electron Shell | Option C: Qt6 + C++/Rust | Option D: Native UIs (Swift/WinUI/GTK) | Option E: Modular Native Desktop Runtime (Chosen) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Startup Latency** | Fast (~250ms) | Moderate (~800ms) | Fast (~300ms) | Instant (~150ms) | Fast (~350ms) |
| **Idle Memory Footprint** | ~45 MB | ~140 MB | ~60 MB | ~30 MB | ~55 MB |
| **Camera Access** | Webview getUserMedia or Rust AVF/V4L2 | Chromium WebRTC | Native OpenCV/DirectShow | Native AVFoundation/MF/V4L2 | Native WebRTC + OS Hardware Enumerator |
| **System Tray / Menu Bar** | Tao Tray API | Electron `Tray` | QSystemTrayIcon | Native NSStatusItem / NotifyIcon / AppIndicator | Native System Tray / Menu Bar Adapters |
| **Background Daemon** | Native Rust process | Node.js background process | Native daemon | Native daemon | Authoritative Node.js Background Daemon |
| **Start at Login** | Tauri autostart plugin | `app.setLoginItemSettings` | Registry / LaunchAgent | Native OS mechanisms | Native LaunchAgent (macOS), Registry Run (Win), XDG Autostart (Linux) |
| **Sleep / Wake Handling** | Custom OS hook | `powerMonitor` API | OS power events | Native OS power observers | Native Platform Watcher + Camera Reconnect FSM |
| **IPC Security** | Tauri commands (isolated) | `contextBridge` + IPC | Qt signals / slots | Native bindings | Cryptographic Bearer Token + Strict Local Socket IPC |
| **Compiler Dependencies** | Requires Rust toolchain, Cargo, LLVM | Requires Node.js only | Requires CMake, Qt SDK, C++ compiler | Requires Xcode, MSVC, GCC/Clang | Requires Node.js 20+ runtime only |
| **Cross-Platform Parity** | High | High | Moderate (UI differences) | Very Low (three separate UI codebases) | High (shared TypeScript core, native platform adapters) |
| **Open Source Maintenance** | High barrier (Rust + C) | Low barrier (JS/TS) | Very High barrier | Extreme (divergent codebases) | **Lowest barrier (Universal TypeScript + Shell scripts)** |

---

## 3. Decision & Architectural Specification

### Chosen Architecture: Option E — Modular Native Desktop Runtime

The project adopts a **Modular Native Desktop Runtime** designed around:
1. **Authoritative Desktop Daemon (`apps/desktop/src/daemon.ts`)**:
   - Runs as a persistent background process.
   - Holds the single source of truth (`ApplicationState`).
   - Manages camera lifecycle, vision engine, presence tracking, and policy enforcement.
   - Survives UI closure.
2. **Native Platform Integration Layer (`packages/platform`)**:
   - macOS: Native `.app` bundle, `NSStatusItem` menu bar controller, `~/Library/LaunchAgents` autostart, Keychain keystore.
   - Windows: PowerShell `NotifyIcon` system tray, `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` autostart, DPAPI keystore.
   - Linux: XDG autostart (`~/.config/autostart/openfaceid.desktop`), Secret Service keystore, D-Bus session lock integration.
3. **Strict Authenticated IPC / Local API (`packages/api`)**:
   - Strictly binds to `127.0.0.1`.
   - Generates high-entropy bearer token on daemon startup.
   - Separates public status endpoints from protected and highly sensitive operations.
   - Biometric vectors and raw image buffers are never exposed across IPC.
4. **Quick Glance HUD & Native Windowing (`apps/desktop/src/hud.ts`)**:
   - Accessible via global shortcut `Cmd/Ctrl+Shift+L`.
   - Clean floating status overlay reflecting real engine state.

---

## 4. Consequences & Tradeoffs

- **Positive**: Zero external binary compiler barriers for contributors; instant cloning and running on any macOS, Windows, or Linux system with Node.js.
- **Positive**: Complete architectural separation between UI, Vision Engine, Platform, and Storage.
- **Tradeoff**: Electron packaging can be optionally enabled for users desiring a single bundled executable, while the modular runtime remains operable as a standalone native background daemon with native OS integration.
