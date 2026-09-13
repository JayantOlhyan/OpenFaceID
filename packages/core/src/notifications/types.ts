/**
 * OpenFaceID (SightLock) — Notification Subsystem Types
 * Semantic, severity-aware, deduplicated, and privacy-preserving desktop notification model.
 */

export type NotificationSeverity = 'info' | 'warning' | 'security' | 'error';

export type NotificationCategory =
  | 'camera'
  | 'presence'
  | 'recognition'
  | 'liveness'
  | 'privacy'
  | 'security'
  | 'system';

export interface NotificationAction {
  label: string;
  command: string;
}

export interface NotificationPayload {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  action?: NotificationAction;
  dedupeKey?: string;
  cooldownMs?: number;
  timestamp: number;
}

export interface NotificationHistoryEntry {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  action?: NotificationAction;
  timestamp: number;
  dispatched: boolean;
  suppressionReason?: 'cooldown' | 'burst_limit' | 'duplicate' | 'ci_environment' | 'throttled';
}
