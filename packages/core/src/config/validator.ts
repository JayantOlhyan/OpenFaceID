import type { AppConfig, LivenessMode, BatteryProfile } from './types.ts';
import { DEFAULT_CONFIG } from './defaults.ts';

export class ConfigValidator {
  public static validate(input: unknown): { valid: boolean; config: AppConfig; errors: string[] } {
    const errors: string[] = [];
    if (!input || typeof input !== 'object') {
      return { valid: false, config: DEFAULT_CONFIG, errors: ['Configuration must be a non-null object'] };
    }

    const raw = input as Record<string, any>;
    const merged: AppConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Recognition
    if (raw.recognition) {
      if (typeof raw.recognition.threshold === 'number') {
        if (raw.recognition.threshold < 0.5 || raw.recognition.threshold > 0.98) {
          errors.push('recognition.threshold must be between 0.50 and 0.98');
        } else {
          merged.recognition.threshold = raw.recognition.threshold;
        }
      }
      if (typeof raw.recognition.temporalWindowSize === 'number') {
        if (raw.recognition.temporalWindowSize < 1 || raw.recognition.temporalWindowSize > 20) {
          errors.push('recognition.temporalWindowSize must be between 1 and 20');
        } else {
          merged.recognition.temporalWindowSize = Math.floor(raw.recognition.temporalWindowSize);
        }
      }
      if (typeof raw.recognition.requiredMatchesInWindow === 'number') {
        if (raw.recognition.requiredMatchesInWindow < 1 || raw.recognition.requiredMatchesInWindow > merged.recognition.temporalWindowSize) {
          errors.push('recognition.requiredMatchesInWindow must be <= temporalWindowSize');
        } else {
          merged.recognition.requiredMatchesInWindow = Math.floor(raw.recognition.requiredMatchesInWindow);
        }
      }
    }

    // Liveness
    if (raw.liveness) {
      const validModes: LivenessMode[] = ['off', 'light', 'strong'];
      if (raw.liveness.mode && validModes.includes(raw.liveness.mode)) {
        merged.liveness.mode = raw.liveness.mode;
      } else if (raw.liveness.mode !== undefined) {
        errors.push(`liveness.mode must be one of: ${validModes.join(', ')}`);
      }
    }

    // Camera
    if (raw.camera) {
      if (typeof raw.camera.deviceId === 'string') {
        merged.camera.deviceId = raw.camera.deviceId;
      }
      if (typeof raw.camera.recognitionFps === 'number') {
        merged.camera.recognitionFps = Math.max(1, Math.min(30, raw.camera.recognitionFps));
      }
      if (typeof raw.camera.presenceFps === 'number') {
        merged.camera.presenceFps = Math.max(0.5, Math.min(10, raw.camera.presenceFps));
      }
    }

    // Presence
    if (raw.presence) {
      if (typeof raw.presence.enabled === 'boolean') {
        merged.presence.enabled = raw.presence.enabled;
      }
      if (typeof raw.presence.leaveTimeoutSec === 'number') {
        merged.presence.leaveTimeoutSec = Math.max(5, Math.min(600, raw.presence.leaveTimeoutSec));
      }
      if (typeof raw.presence.gracePeriodSec === 'number') {
        merged.presence.gracePeriodSec = Math.max(0, Math.min(60, raw.presence.gracePeriodSec));
      }
    }

    // Privacy (CRITICAL SECURITY RULE: telemetry is permanently false)
    merged.privacy.telemetryEnabled = false;
    if (raw.privacy) {
      if (typeof raw.privacy.activityHistoryEnabled === 'boolean') {
        merged.privacy.activityHistoryEnabled = raw.privacy.activityHistoryEnabled;
      }
      if (typeof raw.privacy.autoDeleteHistoryDays === 'number') {
        merged.privacy.autoDeleteHistoryDays = Math.max(1, Math.min(365, raw.privacy.autoDeleteHistoryDays));
      }
      if (typeof raw.privacy.saveDebugFrames === 'boolean') {
        merged.privacy.saveDebugFrames = raw.privacy.saveDebugFrames;
      }
    }

    // System
    if (raw.system) {
      const validProfiles: BatteryProfile[] = ['performance', 'balanced', 'battery_saver'];
      if (raw.system.batteryProfile && validProfiles.includes(raw.system.batteryProfile)) {
        merged.system.batteryProfile = raw.system.batteryProfile;
      }
      if (typeof raw.system.launchAtStartup === 'boolean') {
        merged.system.launchAtStartup = raw.system.launchAtStartup;
      }
    }

    return {
      valid: errors.length === 0,
      config: merged,
      errors,
    };
  }
}
