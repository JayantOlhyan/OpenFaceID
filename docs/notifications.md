# OpenFaceID Desktop Notification Architecture

## Overview & Design Philosophy

OpenFaceID (SightLock) requires desktop notifications that are:
* **Semantic**: Convey clear meaning rather than generic event dispatch notices.
* **Severity-Aware**: Differentiate between informational updates, operational warnings, and security violations.
* **Actionable**: Direct the user to specific recovery commands or settings only where functional paths exist.
* **Deduplicated & Rate-Limited**: Guard against notification storms caused by continuous high-frequency frame processing.
* **Security-Aware**: Implement an **Observer-Only Boundary** where notification failures never compromise or mutate authoritative security/presence state.
* **Privacy-Preserving**: Enforce a **Zero Biometrics / Zero Secret** invariant in notification copy and history.

---

## The Notification Pipeline

```text
               System / Vision / Camera Event
                             │
                             ▼
                    Silent Event Filter
                (e.g., FACE_DETECTED, FRAME_PROCESSED)
                             │ [Pass]
                             ▼
                  NotificationPolicy.map()
                 (Semantic Event Mapping)
                             │
                             ▼
                    NotificationPayload
                (Title, Body, Severity, Action)
                             │
                             ▼
                NotificationManager (Observer)
     ┌───────────────────────┴───────────────────────┐
     ▼                                               ▼
State Transition & Cooldown Filters          Sliding Burst Limiter
(Deduplication & Minimization)            (Max 3/cat/30s, Max 8/total/60s)
     └───────────────────────┬───────────────────────┘
                             │
                             ▼
                 OS Platform Notification
            (macOS / Windows / Linux Native)
```

---

## Root Cause Analysis: Generic Fallbacks

### The Issue
Previous desktop builds occasionally surfaced generic alerts such as:
```text
OpenFaceID Alert
Event triggered
```

### Investigation & Root Cause
Inspection of the codebase revealed that in `packages/automation/src/ActionDispatcher.ts`, notification dispatching had fallback default strings:
```typescript
title: payload?.title || 'OpenFaceID Alert',
body: payload?.body || 'Event triggered',
```
When an automation action or state listener dispatched a notification without explicit text, or passed an unmapped internal event, these generic placeholder strings were forwarded directly to the operating system's notification center.

### The Architectural Fix
1. **Centralized Notification Policy (`NotificationPolicy.ts`)**: Every system event maps to a strictly defined, human-centric headline and body answering:
   * **WHAT HAPPENED?**
   * **WHAT DOES IT MEAN?**
   * **WHAT SHOULD I DO?**
2. **Silent Event Whitelist**: High-frequency internal pipeline events (`FACE_DETECTED`, `FACE_LOST`, `CAMERA_FRAME_RECEIVED`, `MATCHING_STARTED`, `MATCHING_COMPLETED`, `LIVENESS_PROGRESS`, `FRAME_PROCESSED`, etc.) return `null` and are discarded before reaching the OS.
3. **Safe Observer Dispatcher**: `NotificationManager` guards against missing payload attributes, replaces any legacy fallback attempt with canonical messages, and executes OS notifications within a `try/catch` wrapper that logs warnings without throwing.

---

## Canonical Notification Mappings

| Internal Event / State | Title | Body | Severity | Cooldown | Action |
|:---|:---|:---|:---|:---|:---|
| `CAMERA_DISCONNECTED` | Camera disconnected | Protection is paused until your camera reconnects. | `warning` | 60s | Open Camera Settings |
| `CAMERA_UNAVAILABLE` | Camera unavailable | Connect or enable a camera to resume presence protection. | `warning` | 60s | Open Diagnostics |
| `CAMERA_CONNECTED` | Camera reconnected | OpenFaceID is ready to resume presence protection. | `info` | 30s | None |
| `PRESENCE_AUTHORIZED` | Presence verified | You have been recognized and liveness verification passed. | `info` | Transition | None |
| `PRESENCE_ENDED` | Presence ended | OpenFaceID is no longer detecting an authorized presence. | `info` | Transition | None |
| `UNKNOWN_PERSON` | Unknown person detected | Presence verification failed because the detected person is not enrolled. | `warning` | 30s | None |
| `MULTIPLE_FACES` | Multiple faces detected | Protection is paused because more than one person is visible. | `security` | 30s | None |
| `LIVENESS_FAILED` | Liveness verification failed | We could not verify that the detected face is live. Try again. | `security` | 15s | Retry Verification |
| `PRIVACY_PAUSED` | Protection paused | Camera monitoring is paused by Privacy Mode. | `info` | Transition | Resume Protection |
| `PRIVACY_RESUMED` | Protection resumed | OpenFaceID is ready for fresh presence verification. | `info` | Transition | None |
| `SECURITY_FAILURE` | OpenFaceID Security | Protection has been disabled due to a security violation. | `security` | 30s | Open Security Center |
| `SYSTEM_ERROR` | Protection service unavailable | OpenFaceID could not communicate with its background service. | `error` | 60s | Open Diagnostics |

---

## Deduplication, Cooldowns & Burst Protection

Desktop biometric pipelines process frames continuously (e.g., 30 FPS). Without rate-limiting, an unrecognized face or disconnected camera could trigger dozens of alerts per second.

OpenFaceID enforces three levels of rate control:

### 1. Deduplication Cache
Each notification can declare a `dedupeKey` (e.g., `camera-disconnected`, `multiple-faces`). Subsequent notifications with the same key arriving within the active `cooldownMs` window are dropped immediately.

### 2. State-Transition Filtering
Presence transitions (`PRESENCE_AUTHORIZED`, `PRESENCE_ENDED`, `PRIVACY_PAUSED`, `PRIVACY_RESUMED`) only trigger when crossing state boundaries:
* `UNAUTHORIZED -> AUTHORIZED` triggers 1 notification.
* `AUTHORIZED -> AUTHORIZED` (subsequent frames) triggers 0 notifications.

### 3. Sliding-Window Burst Limiter
To prevent catastrophic notification flooding during state oscillation:
* **Per-Category Limit**: Maximum **3 notifications per category** within a 30-second window.
* **Global Engine Limit**: Maximum **8 notifications total** within a 60-second window.
Security-critical alerts (`MULTIPLE_FACES`, `LIVENESS_FAILED`) take precedence over informational messages.

---

## Architectural Boundaries

### 1. Observer-Only Pattern
```text
Camera -> Vision -> Liveness -> Identity -> Presence Policy -> Authoritative State
                                                                         │
                                                                         ▼
                                                                Notification Layer (Observer)
```
The notification layer is **purely an observer**. If the desktop notification daemon crashes or returns an error, OpenFaceID's authoritative presence state remains intact, locks remain engaged, and security guarantees remain fail-closed.

### 2. Privacy & Zero-Biometric Guarantee
* **No Biometric Data**: Embeddings, facial crop images, landmark vectors, or camera frames are **never** passed into notification payloads.
* **No Secret Exposure**: Cryptographic tokens, keys, hashes, and internal stack traces are stripped before reaching user-facing copy.
* **Sanitized Identity Representation**: Notifications do not leak personal names to lock screens by default (using `"Presence verified"` rather than `"Jane Doe recognized"`).
* **Notification History**: History stores a maximum of 50 sanitized metadata items in-memory.

---

## Cross-Platform Implementation

| Platform | Native Notification Mechanism | Action Support | Icon Handling |
|:---|:---|:---|:---|
| **macOS** | `NSUserNotification` / UNNotificationCenter via PlatformAdapter | Supported via notifications handler | Application icon bundle (`SightLock.icns`) |
| **Windows** | Windows Toast Notifications (WinRT / PowerShell) | Supported | Application resource icon (`icon.ico`) |
| **Linux** | `notify-send` / Freedesktop Desktop Notifications D-Bus specification | Standard actions where supported by daemon | `/usr/share/icons/hicolor/...` |
