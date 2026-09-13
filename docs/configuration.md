# OpenFaceID Configuration Reference & Schema

## 1. Overview

OpenFaceID stores user configuration in JSON format at `~/.openfaceid/config.json`. The configuration is loaded on daemon startup, validated by `ConfigValidator`, and managed via CLI commands (`openfaceid config get`, `openfaceid config set`).

---

## 2. Configuration Schema

```json
{
  "recognition": {
    "threshold": 0.70,
    "temporalWindowSize": 5,
    "requiredMatchesInWindow": 4,
    "maxFaceAngleDeviationDeg": 25
  },
  "liveness": {
    "mode": "light",
    "blinkThresholdEar": 0.20,
    "motionVarianceThreshold": 0.015,
    "challengeTimeoutMs": 4000
  },
  "camera": {
    "deviceId": "default",
    "preferredResolution": {
      "width": 1280,
      "height": 720
    },
    "recognitionFps": 15,
    "presenceFps": 1.5
  },
  "presence": {
    "enabled": true,
    "leaveTimeoutSec": 20,
    "gracePeriodSec": 5
  },
  "automation": {
    "lockOnLeave": true,
    "pauseAppOnLeave": false,
    "notifyOnMatch": true
  },
  "privacy": {
    "activityHistoryEnabled": true,
    "autoDeleteHistoryDays": 7,
    "telemetryEnabled": false,
    "saveDebugFrames": false
  },
  "ui": {
    "reduceMotion": false,
    "compactOverlayShortcut": "CommandOrControl+Shift+L",
    "theme": "dark"
  }
}
```

---

## 3. Detailed Parameter Reference

### 3.1 Recognition (`recognition`)

| Parameter | Type | Default | Valid Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| `threshold` | `number` | `0.70` | `0.50` – `0.98` | Minimum cosine similarity required to authorize an enrolled identity (Balanced: 0.70, Strict: 0.80, Very Strict: 0.88). |
| `temporalWindowSize` | `number` | `5` | `1` – `20` | Number of recent inference frames tracked in the sliding evaluation window. |
| `requiredMatchesInWindow` | `number` | `4` | `1` – `temporalWindowSize` | Minimum frames matching threshold within the window to declare authorization. |
| `maxFaceAngleDeviationDeg` | `number` | `25` | `10` – `45` | Maximum head yaw/pitch allowed before frame is rejected as severe angle. |

#### Similarity Threshold Profiles (Section 48)

| Profile | Threshold Value | Use Case | Security vs Usability |
| :--- | :--- | :--- | :--- |
| **Balanced** | **`0.70`** | Standard office / desk environment | Balanced convenience; resilient to slight lighting changes. |
| **Strict** | **`0.80`** | High-security or shared office spaces | Lower false acceptance rate (FAR); requires more direct gaze. |
| **Very Strict** | **`0.88`** | Maximum assurance presence verification | Extremely low FAR; requires high-fidelity frontal alignment. |

> [!NOTE]
> **Threshold Semantics**: OpenFaceID computes **Cosine Similarity** ($\cos(\theta) \in [-1.0, 1.0]$).
> **Higher values indicate a closer match.** Authorization succeeds when:
> $$\text{similarity} \ge \text{threshold}$$

### 3.2 Presentation Attack Detection / Liveness (`liveness`)

| Parameter | Type | Default | Allowed Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `mode` | `string` | `"light"` | `"off"`, `"light"`, `"strong"` | Anti-spoofing mode: `"off"` (bypass), `"light"` (passive micro-motion), `"strong"` (active challenge). |
| `blinkThresholdEar` | `number` | `0.20` | `0.10` – `0.35` | Eye Aspect Ratio (EAR) threshold for blink detection. |
| `motionVarianceThreshold` | `number` | `0.015` | `0.005` – `0.05` | Minimum optical flow variance to distinguish living human from a static 2D photo. |
| `challengeTimeoutMs` | `number` | `4000` | `2000` – `10000` | Maximum time allowed for active challenge completion. |

### 3.3 Camera & Video Capture (`camera`)

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `deviceId` | `string` | `"default"` | Device ID or `"default"` for system preferred video capture source. |
| `recognitionFps` | `number` | `15` | Capture framerate during active face recognition / search (1 – 30 FPS). |
| `presenceFps` | `number` | `1.5` | Power-saving sampling framerate once user presence is confirmed (0.5 – 10 FPS). |

### 3.4 Presence Lifecycle (`presence`)

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` | Enables continuous presence tracking and absence timeouts. |
| `leaveTimeoutSec` | `number` | `20` | Seconds of continuous absence before declaring `USER_LEFT` (clamped: 5 – 600s). |
| `gracePeriodSec` | `number` | `5` | Grace period buffer before triggering automated lock actions (clamped: 0 – 60s). |

### 3.5 Automation & Actions (`automation`)

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `lockOnLeave` | `boolean` | `true` | Automatically engages OS screen lock when user presence expires. |
| `pauseAppOnLeave` | `boolean` | `false` | Pauses media playback upon absence detection. |
| `notifyOnMatch` | `boolean` | `true` | Dispatches OS notification on initial identity authorization. |

### 3.6 Privacy & Telemetry (`privacy`)

| Parameter | Type | Default | Invariant |
| :--- | :--- | :--- | :--- |
| `telemetryEnabled` | `boolean` | `false` | **Permanently forced to `false` by ConfigValidator.** |
| `saveDebugFrames` | `boolean` | `false` | Prevents disk writes of frame crops. |
| `activityHistoryEnabled` | `boolean` | `true` | In-memory activity log tracking. |
| `autoDeleteHistoryDays` | `number` | `7` | Retention window for activity log entries (1 – 365 days). |

---

## 4. Configuration Validation & Insecure Setting Rejection

OpenFaceID's `ConfigValidator` strictly rejects insecure or invalid configurations:

* Setting `recognition.threshold < 0.50` produces a validation error (rejects insecure thresholds that would permit false matches).
* Setting `recognition.requiredMatchesInWindow > temporalWindowSize` produces a validation error.
* Setting `liveness.mode` to an unknown string produces a validation error.
* Setting `privacy.telemetryEnabled: true` is overridden and silenced to `false`.
