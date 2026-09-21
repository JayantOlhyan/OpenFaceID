# Third-Party Attribution: Glance (jonnyoo/glance)

## Overview

OpenFaceID references design patterns, geometric principles, and interaction concepts from **Glance**, an open-source macOS facial recognition and presence utility created by Jonathan Zhou.

* **Repository:** [https://github.com/jonnyoo/glance](https://github.com/jonnyoo/glance)
* **Author / Copyright:** (c) 2024–2025 Jonathan Zhou and Glance contributors
* **License:** MIT License

---

## Studied and Adapted Concepts

OpenFaceID's macOS user experience studied the following components of Glance:

1. **Notch & Dynamic Island UI Interaction (`glance/NotchOverlay/`)**:
   - Studied Glance's notch attachment geometry and compact status indicator concept.
   - Reimplemented an independent OpenFaceID-native HUD with a dual-mode layout:
     - **Notched Macs:** Top-center anchor hugging the camera notch geometry.
     - **Notchless Macs:** Centered compact dynamic pill indicator.
2. **Camera Preview & Bounding Feedback (`glance/CameraPreviewView.swift`)**:
   - Studied real-time visual feedback patterns for face detection and quality status.
   - Reimplemented in OpenFaceID using AVFoundation helper + WebKit canvas rendering.
3. **Status Transitions & Feedback**:
   - Studied minimal status badges (Scanning, Recognized, Away) rather than complex engineering dashboards.
   - Reimplemented OpenFaceID presence state machine transitions with Apple-standard spring animations and reduced-motion accessibility support.

---

## OpenFaceID's Independent Architecture & Components

OpenFaceID retains its own distinct, standalone architecture. The following core components are 100% independently authored:

1. **Desktop Daemon & Cross-Platform Runtime**:
   - Node.js local daemon (`apps/desktop/serve.js`, `daemon.ts`) with typed IPC.
   - Cross-platform architecture supporting macOS, Linux, and Windows.
2. **Native Cocoa + WebKit Launcher**:
   - `apps/desktop/launcher/OpenFaceIDLauncher.swift`: native Swift launcher embedding WKWebView and managing child daemon lifecycles with zero terminal window.
3. **Native AVFoundation Camera Helper**:
   - `packages/camera/native/openfaceid-camera-avf.m`: standalone Objective-C / AVFoundation helper streaming raw camera frames with zero external dependencies.
4. **Computer Vision & Liveness Pipeline**:
   - `packages/vision/`: face detector, facial landmarks, 512D analytical hypersphere feature projection, presentation attack detection (PAD), eye-aspect ratio (EAR) blink detection, and multi-pose temporal liveness.
5. **Presence State Machine**:
   - `packages/presence/`: fail-closed, multi-face conflict detection (`PRESENCE_AMBIGUOUS`), hysteresis timers, and auto-lock security automation.
6. **Security & Privacy Boundaries**:
   - Local-only processing with zero cloud transmission.
   - Zero password interception or OS credential storage.

---

## Architectural Comparison & Differentiation

The primary product differentiation is architectural:

* **OpenFaceID**:
  - Open source (Apache-2.0).
  - Intended cross-platform architecture (macOS, Windows, and Linux).
  - Platform-specific native authentication adapters (macOS PAM + keystroke dispatch, Windows LogonUI Credential Provider, Linux PAM module).
  - Local biometric processing and multi-cue presentation attack detection.
  - Common biometric and authentication engine across platforms.

* **Glance**:
  - macOS-focused face-unlock utility.
  - Native Swift implementation tailored specifically for Apple Silicon macOS user experience.

---

## MIT License Notice

The following MIT License governs any components or patterns adapted from Glance:

```text
MIT License

Copyright (c) 2024 Jonathan Zhou

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
