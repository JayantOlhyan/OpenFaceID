import type { AppConfig } from './types.ts';

export const DEFAULT_CONFIG: AppConfig = {
  recognition: {
    threshold: 0.70,
    temporalWindowSize: 5,
    requiredMatchesInWindow: 4,
    maxFaceAngleDeviationDeg: 25,
  },
  liveness: {
    mode: 'light',
    blinkThresholdEar: 0.20,
    motionVarianceThreshold: 0.015,
    challengeTimeoutMs: 4000,
  },
  camera: {
    deviceId: 'default',
    preferredResolution: {
      width: 1280,
      height: 720,
    },
    recognitionFps: 15,
    presenceFps: 1.5,
  },
  presence: {
    enabled: true,
    leaveTimeoutSec: 20,
    gracePeriodSec: 5,
  },
  automation: {
    lockOnLeave: true,
    pauseAppOnLeave: false,
    notifyOnMatch: true,
  },
  privacy: {
    activityHistoryEnabled: true,
    autoDeleteHistoryDays: 7,
    telemetryEnabled: false,
    saveDebugFrames: false,
  },
  ui: {
    reduceMotion: false,
    compactOverlayShortcut: 'CommandOrControl+Shift+L',
    theme: 'dark',
  },
  system: {
    batteryProfile: 'balanced',
    launchAtStartup: true,
  },
};
