# OpenFaceID CLI Reference & Architecture

**Tool**: `openfaceid` (`apps/cli/bin/openfaceid.ts`)  
**Version**: `0.2.1-rc.1`  
**Runtime**: Pure Node.js standard library (Zero external npm dependencies)  

---

## 1. Overview & Principles

The OpenFaceID Command-Line Interface (`openfaceid`) is a primary administrative and developer tool for:
1. System diagnostics and hardware environment validation (`doctor`).
2. Security and cryptographic posture verification (`security check`).
3. Local privacy and zero-egress validation (`privacy check`).
4. Camera discovery, stream profiling, and RAM sanitization testing (`camera`).
5. Biometric enrollment, status, and cryptographic shredding (`identity`).
6. Authoritative presence session monitoring (`presence`).
7. Headless computer vision benchmarking (`vision benchmark`).
8. Workstation locking and automation (`lock`).

### Non-Negotiable CLI Privacy Invariants
Under no circumstances does the CLI:
- Output raw biometric float vectors or embedding arrays.
- Output raw photographic camera frames or base64 crops.
- Expose master encryption keys, IPC tokens, or OS keyring secrets.
- Send telemetry, crash reports, or analytics across the network.

---

## 2. Global Flags & Options

| Flag | Type | Description |
| :--- | :---: | :--- |
| `--json` | Boolean | Emit clean, parseable, uncolored JSON to stdout. Internal logger output (`info`/`warn`) is silenced. |
| `--verbose` | Boolean | Include verbose execution details and exception stack traces on failure. |
| `--dev` | Boolean | Include local developer environment checks (TypeScript engine, git tracking) when running `doctor`. |
| `-v`, `--version` | Boolean | Display product name, codename, version, OS architecture, and git commit. |
| `-h`, `--help` | Boolean | Display usage instructions, command catalog, and security philosophy. |

---

## 3. Canonical CLI Exit Codes

OpenFaceID standardizes process exit codes across all commands to facilitate scripting, CI pipelines, and daemon monitoring:

| Code | Identifier | Description | Recovery / Remediation |
| :---: | :--- | :--- | :--- |
| **`0`** | `SUCCESS` | Command completed successfully with all checks passing. | None required. |
| **`1`** | `GENERAL_FAILURE` | Unexpected runtime error or diagnostic health check failure. | Inspect error message or rerun with `--verbose`. |
| **`2`** | `INVALID_ARGUMENTS` | Unknown command, missing mandatory argument, or invalid flag. | Run `openfaceid help` for syntax. |
| **`3`** | `CAMERA_UNAVAILABLE` | Camera permission denied, no devices detected, or capture failed. | Grant camera access or connect USB camera. |
| **`4`** | `AUTH_UNAVAILABLE` | Identity not found, enrollment rejected, or presence revoked. | Re-enroll profile or check lighting. |
| **`5`** | `SECURITY_FAILURE` | Security check failed, model hash tampered, or key access error. | Inspect `openfaceid security check` output. |
| **`6`** | `PRIVACY_RESTRICTION` | Privacy check failed, frame leak detected, or privacy paused. | Inspect `openfaceid privacy check` output. |
| **`7`** | `DAEMON_UNAVAILABLE` | Local daemon IPC socket unreachable or timed out. | Start daemon via `npm run dev:desktop`. |

---

## 4. Command Catalog

### 4.1 System Status & Diagnostics

#### `openfaceid status [--json]`
Displays overall platform health, screen lock state, system idle timer, keystore backend, camera permissions, and biometric profile counts.

**JSON Schema (`--json`)**:
```json
{
  "app": "OpenFaceID",
  "codeName": "SightLock",
  "version": "0.2.1-rc.1",
  "platform": {
    "os": "macos",
    "release": "25.6.0",
    "arch": "arm64",
    "screenLocked": false,
    "systemIdleSeconds": 14,
    "hasSecureKeystore": true
  },
  "hardware": {
    "cameraPermission": "granted"
  },
  "biometrics": {
    "enrolledProfiles": 1,
    "livenessMode": "light",
    "matchThreshold": 0.70
  },
  "security": {
    "cloudEgress": false,
    "ramOnlyProcessing": true
  },
  "timestamp": "2026-09-13T14:53:22.864Z"
}
```

---

#### `openfaceid doctor [--json] [--dev]`
Executes a 7-point (or 9-point with `--dev`) comprehensive hardware, runtime, and security diagnostic suite:
1. Operating System compatibility.
2. Node.js runtime version (`>= 22.0.0`).
3. Camera access permissions.
4. Video capture hardware enumeration.
5. Cryptographic master key accessibility and 256-bit entropy.
6. Configuration directory filesystem permissions (`0700`).
7. Vision model integrity (SHA-256 signatures).

**JSON Schema (`--json`)**:
```json
{
  "app": "OpenFaceID",
  "version": "0.2.1-rc.1",
  "healthy": true,
  "passCount": 7,
  "totalChecks": 7,
  "checks": [
    {
      "category": "Platform & OS",
      "name": "Operating System",
      "passed": true,
      "details": "macos (25.6.0) [arm64]",
      "remediation": "Run on macOS Darwin, Windows, or Linux"
    }
  ],
  "timestamp": "2026-09-13T14:53:16.330Z"
}
```

---

### 4.2 Security & Privacy Audits

#### `openfaceid security check [--json]`
Audits the 6 foundational security gates of OpenFaceID:
1. Strict `127.0.0.1:41793` loopback binding.
2. Zero external telemetry trackers or remote analytics endpoints.
3. Cryptographic master key storage in native OS secure keystore.
4. AES-256-GCM authenticated encryption and ciphertext tamper defense.
5. Neural network model integrity (SHA-256 verification of in-tree models).
6. Constant-time `crypto.timingSafeEqual` IPC token validation.

**Exit Code**: `0` if all gates pass; `5` (`SECURITY_FAILURE`) if any gate fails.

---

#### `openfaceid privacy check [--json]`
Audits the 4 non-negotiable privacy properties of OpenFaceID:
1. Network transmission policy (HTTP outbound blocked, zero domains).
2. Volatile memory sanitization (RAM buffers zeroized with `0x00`).
3. Disk persistence check (zero raw frames or image files in storage directory).
4. Hardware privacy pause state (hardware stream handles released).

**Exit Code**: `0` if all checks pass; `6` (`PRIVACY_RESTRICTION`) if any check fails.

---

### 4.3 Camera Subsystem

#### `openfaceid camera status [--json]`
Reports active camera device name, hardware ID, current resolution, capture frame rate, and permissions.

#### `openfaceid camera list [--json]`
Discovers and lists all physical video capture devices across AVFoundation, Media Foundation, or V4L2 backends.

#### `openfaceid camera test [--json]`
Initializes a real capture stream for 500 ms, measures real-time hardware FPS, verifies frame buffer zeroization in RAM, and confirms zero disk persistence.

---

### 4.4 Biometric Identity Management

#### `openfaceid identity list [--json]`
Lists enrolled biometric identities from encrypted storage with metadata (ID, name, pose count, creation date, enabled status). **Vectors are never emitted.**

#### `openfaceid identity status [--json]`
Reports identity store status, total profile count, and keystore backend encryption mode.

#### `openfaceid identity enroll <name>`
Launches a 5-pose guided biometric enrollment session:
1. Frontal neutral pose.
2. Slight turn left (~20° yaw).
3. Slight turn right (~20° yaw).
4. Slight tilt upward (~15° pitch).
5. Slight tilt downward (~15° pitch).

*Embeddings are averaged, L2-normalized, and encrypted with AES-256-GCM. Raw camera frames are immediately zeroized in RAM.*

#### `openfaceid identity delete <id>`
Cryptographically shreds the stored profile using multi-pass random data and zero overwrites before unlinking the file from disk.

---

### 4.5 Presence & Automation

#### `openfaceid presence status [--json]`
Connects to the local daemon (if running) and reports:
- Canonical presence state (`PRESENCE_AUTHORIZED`, `PRESENCE_AMBIGUOUS`, `PRESENCE_UNAUTHORIZED`).
- Active authorized identity.
- Detected face count.
- Camera and liveness pipeline statuses.
- Session time remaining before absence timeout.

#### `openfaceid lock`
Directly invokes native operating system screen locking via `PlatformAdapter`:
- macOS: `/System/Library/CoreServices/Menu Extras/User.menu/.../CGSession -suspend` or AppleScript.
- Windows: `rundll32.exe user32.dll,LockWorkStation`.
- Linux: `loginctl lock-session` or `xdg-screensaver lock`.

---

### 4.6 Vision Benchmarks & Diagnostics

#### `openfaceid vision benchmark [--json]`
Runs an in-process microbenchmark of the computer vision pipeline on a representative 1280x720 frame:
- Face detection latency (BlazeFace).
- Embedding extraction latency (ArcFace 512D).
- Liveness evaluation latency (Passive PAD).
- Process memory (Heap, RSS) and CPU consumption.

#### `openfaceid export-diagnostics [file]`
Exports a sanitized system diagnostic archive. All potential biometric vectors, tokens, passwords, and private keys are scanned and replaced with `[REDACTED]` tokens prior to writing to disk.

---

## 5. Machine-Readable JSON Integration Example

Bash / Python integration script example:

```bash
# Verify system is healthy before launching daemon
HEALTH=$(openfaceid doctor --json | jq -r '.healthy')
if [ "$HEALTH" != "true" ]; then
  echo "OpenFaceID doctor reported issues!"
  exit 1
fi

# Check presence status
PRESENCE=$(openfaceid presence status --json | jq -r '.presenceState // .presence')
echo "Current Presence: $PRESENCE"
```
