/**
 * OpenFaceID (SightLock) — Canonical Notification Policy
 * Defines semantic notification mappings, severity classification, cooldowns,
 * deduplication keys, and event ignore rules.
 */

import type {
  NotificationCategory,
  NotificationSeverity,
  NotificationPayload,
  NotificationAction,
} from './types.ts';

export interface CanonicalNotificationDefinition {
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  action?: NotificationAction;
  dedupeKey: string;
  cooldownMs: number;
  transitionOnly?: boolean;
  priority: number; // Higher number = higher precedence during collisions
}

export class NotificationPolicy {
  /**
   * Events that are strictly internal and MUST NEVER produce an OS notification.
   */
  public static readonly SILENT_INTERNAL_EVENTS = new Set<string>([
    'FACE_DETECTED',
    'FACE_LOST',
    'CAMERA_FRAME_RECEIVED',
    'MATCHING_STARTED',
    'MATCHING_COMPLETED',
    'LIVENESS_STARTED',
    'LIVENESS_PROGRESS',
    'PRESENCE_HEARTBEAT',
    'FRAME_PROCESSED',
    'BATTERY_PROFILE_CHANGED',
    'LOCK_REQUESTED',
    'UNLOCK_REQUESTED',
  ]);

  /**
   * Canonical notification definitions conforming to Sections 8–20 & 25.
   */
  public static readonly DEFINITIONS: Record<string, CanonicalNotificationDefinition> = {
    CAMERA_DISCONNECTED: {
      category: 'camera',
      severity: 'warning',
      title: 'Camera disconnected',
      body: 'Protection is paused until your camera reconnects.',
      action: {
        label: 'Open Camera Settings',
        command: 'open_camera_settings',
      },
      dedupeKey: 'camera-disconnected',
      cooldownMs: 60_000,
      priority: 80,
    },

    CAMERA_UNAVAILABLE: {
      category: 'camera',
      severity: 'warning',
      title: 'Camera unavailable',
      body: 'Connect or enable a camera to resume presence protection.',
      action: {
        label: 'Open Camera Settings',
        command: 'open_camera_settings',
      },
      dedupeKey: 'camera-unavailable',
      cooldownMs: 60_000,
      priority: 80,
    },

    CAMERA_CONNECTED: {
      category: 'camera',
      severity: 'info',
      title: 'Camera reconnected',
      body: 'OpenFaceID is ready to resume presence protection.',
      dedupeKey: 'camera-reconnected',
      cooldownMs: 30_000,
      priority: 20,
    },

    PRESENCE_AUTHORIZED: {
      category: 'presence',
      severity: 'info',
      title: 'Presence verified',
      body: 'You have been recognized and liveness verification passed.',
      dedupeKey: 'presence-authorized',
      cooldownMs: 5_000,
      transitionOnly: true,
      priority: 40,
    },

    PRESENCE_ENDED: {
      category: 'presence',
      severity: 'info',
      title: 'Presence ended',
      body: 'OpenFaceID is no longer detecting an authorized presence.',
      dedupeKey: 'presence-ended',
      cooldownMs: 10_000,
      transitionOnly: true,
      priority: 40,
    },

    UNKNOWN_PERSON: {
      category: 'recognition',
      severity: 'warning',
      title: 'Unknown person detected',
      body: 'Presence verification failed because the detected person is not enrolled.',
      dedupeKey: 'unknown-person',
      cooldownMs: 45_000,
      transitionOnly: true,
      priority: 50,
    },

    MULTIPLE_FACES: {
      category: 'security',
      severity: 'security',
      title: 'Multiple faces detected',
      body: 'Protection is paused because more than one person is visible.',
      dedupeKey: 'multiple-faces',
      cooldownMs: 30_000,
      transitionOnly: true,
      priority: 70,
    },

    LIVENESS_FAILED: {
      category: 'liveness',
      severity: 'security',
      title: 'Liveness verification failed',
      body: 'We could not verify that the detected face is live. Try again.',
      action: {
        label: 'Retry Liveness',
        command: 'retry_liveness',
      },
      dedupeKey: 'liveness-failed',
      cooldownMs: 15_000,
      priority: 60,
    },

    PRIVACY_PAUSED: {
      category: 'privacy',
      severity: 'info',
      title: 'Protection paused',
      body: 'Camera monitoring is paused by Privacy Mode.',
      dedupeKey: 'privacy-paused',
      cooldownMs: 10_000,
      transitionOnly: true,
      priority: 30,
    },

    PRIVACY_RESUMED: {
      category: 'privacy',
      severity: 'info',
      title: 'Protection resumed',
      body: 'OpenFaceID is ready for fresh presence verification.',
      dedupeKey: 'privacy-resumed',
      cooldownMs: 10_000,
      transitionOnly: true,
      priority: 30,
    },

    SECURITY_FAILURE: {
      category: 'security',
      severity: 'security',
      title: 'OpenFaceID Security',
      body: 'Model integrity check failed. Protection has been disabled. Open Security Center for details.',
      action: {
        label: 'Open Security Center',
        command: 'open_security_center',
      },
      dedupeKey: 'security-failure',
      cooldownMs: 60_000,
      priority: 100,
    },

    SYSTEM_ERROR: {
      category: 'system',
      severity: 'error',
      title: 'Protection service unavailable',
      body: 'OpenFaceID could not communicate with its background service.',
      action: {
        label: 'Open Diagnostics',
        command: 'open_diagnostics',
      },
      dedupeKey: 'system-error',
      cooldownMs: 60_000,
      priority: 90,
    },
  };

  /**
   * Checks whether an event type is strictly silent.
   */
  public static isSilentEvent(eventType: string): boolean {
    return this.SILENT_INTERNAL_EVENTS.has(eventType);
  }

  /**
   * Builds a canonical NotificationPayload from definition key and optional custom overrides.
   */
  public static createPayload(
    definitionKey: keyof typeof NotificationPolicy.DEFINITIONS | string,
    overrides?: Partial<NotificationPayload>
  ): NotificationPayload | null {
    const def = this.DEFINITIONS[definitionKey];
    if (!def) {
      return null;
    }

    const timestamp = overrides?.timestamp ?? Date.now();
    const id = `notif_${def.dedupeKey}_${timestamp}`;

    return {
      id,
      category: def.category,
      severity: def.severity,
      title: overrides?.title ?? def.title,
      body: overrides?.body ?? def.body,
      action: overrides?.action ?? def.action,
      dedupeKey: def.dedupeKey,
      cooldownMs: def.cooldownMs,
      timestamp,
    };
  }
}
