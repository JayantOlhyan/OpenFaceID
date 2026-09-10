# OpenFaceID (SightLock) — Architecture & System Design

## 1. Architectural Philosophy
OpenFaceID is architected around four non-negotiable principles:
1. **Local-First & Volatile-Only Processing**: Biometric pixel buffers exist only in volatile RAM for the duration of inference (<15ms) and are zeroized immediately.
2. **Strict Boundary Separation**:
   - **Recognition**: *"Does this visual input match an enrolled feature vector?"*
   - **Presence**: *"Is an enrolled individual sitting in front of the machine?"*
   - **Authentication**: *"Cryptographic authorization mediated by the operating system kernel."*
3. **Cross-Platform Decoupling**: All core state machines, computer vision algorithms, and automation policies are platform-agnostic. Platform divergence is quarantined behind the `PlatformAdapter` interface.
4. **No Plaintext Passwords**: OpenFaceID will never solicit, store, or inject operating system passwords.

---

## 2. Monorepo Component Diagram

```
                       ┌───────────────────────────────┐
                       │          Apps Layer           │
                       │ ┌──────────────┐ ┌──────────┐ │
                       │ │ apps/desktop │ │ apps/cli │ │
                       │ └──────┬───────┘ └────┬─────┘ │
                       └────────┼──────────────┼───────┘
                                │              │
                                ▼              ▼
                       ┌───────────────────────────────┐
                       │         packages/api          │
                       │   (Localhost REST + SSE)      │
                       └───────────────┬───────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
       ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
       │ packages/core   │    │ packages/vision │    │ packages/camera │
       │ • Config        │    │ • BlazeFace     │    │ • Enumeration   │
       │ • State Machines│    │ • ArcFace 512D  │    │ • FrameSampler  │
       │ • EventBus      │    │ • Quality Check │    │ • Throttle      │
       │ • Logger        │    │ • Liveness      │    │ • Reconnect     │
       └────────┬────────┘    └────────┬────────┘    └─────────────────┘
                │                      │
                ├──────────────────────┤
                │                      │
                ▼                      ▼
       ┌─────────────────┐    ┌─────────────────┐
       │packages/security│    │packages/storage │
       │ • AES-256-GCM   │    │ • IdentityStore │
       │ • KeyringBridge │    │ • ActivityLog   │
       │ • Zeroizer      │    │ • ConfigStore   │
       └────────┬────────┘    └─────────────────┘
                │
                ▼
       ┌────────────────────────────────────────────────────────┐
       │                   packages/platform                    │
       │  ┌────────────────┐ ┌────────────────┐ ┌─────────────┐ │
       │  │  MacOSAdapter  │ │ WindowsAdapter │ │LinuxAdapter │ │
       │  └────────────────┘ └────────────────┘ └─────────────┘ │
       └────────────────────────────────────────────────────────┘
```

---

## 3. State Machines

### 3.1 Recognition State Machine
```
   ┌────────┐
   │  IDLE  │
   └───┬────┘
       │ startCapture()
       ▼
 ┌───────────┐
 │ SEARCHING │◄────────────────────────┐
 └─────┬─────┘                         │
       │ face detected                 │
       ▼                               │
┌───────────────┐                      │
│ FACE_DETECTED │                      │
└──────┬────────┘                      │
       │ box & landmarks extracted     │
       ▼                               │
┌───────────────┐                      │
│ QUALITY_CHECK │───(unacceptable)─────┤
└──────┬────────┘                      │
       │ acceptable lighting, pose     │
       ▼                               │
 ┌────────────┐                        │
 │RECOGNIZING │───(match below θ)──────┤
 └─────┬──────┘                        │
       │ temporal matches accumulated  │
       ▼                               │
┌────────────────┐                     │
│ LIVENESS_CHECK │───(spoof detected)──┘
└──────┬─────────┘
       │ blink / motion / challenge passed
       ▼
 ┌────────────┐
 │ AUTHORIZED │
 └────────────┘
```

### 3.2 Security Authorization State Machine
To guarantee security integrity, the system enforces a strict non-bypassable sequence before any action can occur:
1. `UNKNOWN`: Initial unauthenticated state.
2. `FACE_DETECTED`: Frame captured, landmarks present.
3. `IDENTITY_MATCHED`: Mathematical similarity exceeded threshold \(\theta\).
4. `LIVENESS_VERIFIED`: Passive or active anti-spoofing criteria satisfied.
5. `POLICY_APPROVED`: User configuration confirms action is permitted.
6. `ACTION_AUTHORIZED`: One-time authorization grant emitted.
7. `ACTION_COMPLETED`: Workstation locked or notification sent; state resets to `UNKNOWN`.

---

## 4. In-Memory Privacy Pipeline
Every frame captured follows a strict volatile lifecycle:
```
[Camera Sensor] ──> [RAM Buffer] ──> [Landmark Extraction] ──> [ArcFace Embedding]
                                                                        │
[RAM Zeroized (0x00)] <── [Buffer Discarded] <── [Match Decision] <─────┘
```
No photographic pixel data is ever written to disk, caches, or swap partitions.
