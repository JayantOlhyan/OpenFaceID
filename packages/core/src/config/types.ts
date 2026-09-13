export type LivenessMode = 'off' | 'light' | 'strong';
export type BatteryProfile = 'performance' | 'balanced' | 'battery_saver';

export interface RecognitionConfig {
  threshold: number; // 0.50 to 0.98 (default: 0.70 Balanced, Strict: 0.80, Very Strict: 0.88)
  temporalWindowSize: number; // e.g. 5 frames
  requiredMatchesInWindow: number; // e.g. 4 frames
  maxFaceAngleDeviationDeg: number; // e.g. 25 deg
}

export interface LivenessConfig {
  mode: LivenessMode;
  blinkThresholdEar: number; // Eye aspect ratio drop threshold (default: 0.20)
  motionVarianceThreshold: number; // micro-motion variance (default: 0.015)
  challengeTimeoutMs: number; // timeout for active challenge (default: 4000)
}

export interface CameraConfig {
  deviceId: string | 'default';
  preferredResolution: {
    width: number;
    height: number;
  };
  recognitionFps: number; // 5 to 30 (default: 15)
  presenceFps: number; // 1 to 5 (default: 1.5)
}

export interface PresenceConfig {
  enabled: boolean;
  leaveTimeoutSec: number; // seconds of no face before USER_LEFT (default: 20)
  gracePeriodSec: number; // grace period before triggering lock action (default: 10)
}

export interface AutomationConfig {
  lockOnLeave: boolean;
  pauseAppOnLeave: boolean;
  notifyOnMatch: boolean;
  customWebhookUrl?: string;
  customShellScript?: string;
}

export interface PrivacyConfig {
  activityHistoryEnabled: boolean;
  autoDeleteHistoryDays: number; // e.g. 7 days
  telemetryEnabled: false; // strictly locked to false
  saveDebugFrames: boolean; // default: false
}

export interface UIConfig {
  reduceMotion: boolean;
  compactOverlayShortcut: string; // default: "CommandOrControl+Shift+L"
  theme: 'dark' | 'light' | 'system';
}

export interface SystemConfig {
  batteryProfile: BatteryProfile;
  launchAtStartup: boolean;
}

export interface AppConfig {
  recognition: RecognitionConfig;
  liveness: LivenessConfig;
  camera: CameraConfig;
  presence: PresenceConfig;
  automation: AutomationConfig;
  privacy: PrivacyConfig;
  ui: UIConfig;
  system: SystemConfig;
}
