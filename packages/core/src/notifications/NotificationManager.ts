/**
 * OpenFaceID (SightLock) — Centralized Notification Manager
 * Observes system & presence events, enforces deduplication, cooldowns,
 * burst limits, and state transitions, and safely presents actionable OS notifications.
 *
 * CRITICAL INVARIANT:
 * NotificationManager is strictly an Observer, NOT a Security Controller.
 * Any notification dispatch failure or OS exception is caught and ignored,
 * ensuring authoritative presence and security logic remain 100% uninterrupted.
 */

import { BRANDING } from '../../../branding/src/index.ts';
import { Logger } from '../logger/logger.ts';
import { EventBus, type EventType, type SystemEvent } from '../events/bus.ts';
import type {
  NotificationCategory,
  NotificationHistoryEntry,
  NotificationPayload,
  NotificationSeverity,
} from './types.ts';
import { NotificationPolicy } from './NotificationPolicy.ts';

/**
 * Pluggable notification delivery sink (implemented by PlatformAdapter or custom sinks).
 */
export interface NotificationSink {
  showNotification(title: string, body: string): Promise<void>;
}

export interface NotificationManagerOptions {
  adapter?: NotificationSink;
  enabled?: boolean;
}

export class NotificationManager {
  private static instance: NotificationManager | null = null;
  private static defaultSink: NotificationSink = {
    showNotification: async (title: string, body: string): Promise<void> => {
      Logger.debug('notification', `Default sink received notification: ${title} - ${body}`);
    },
  };

  private adapter: NotificationSink;
  private enabled: boolean = true;
  private unsubscribeList: Array<() => void> = [];

  // Deduplication & Cooldown tracking: Map<dedupeKey, lastDispatchTimestamp>
  private dedupeTimestamps: Map<string, number> = new Map();

  // Burst Protection: Sliding window of recent dispatch timestamps
  private categoryDispatches: Map<NotificationCategory, number[]> = new Map();
  private globalDispatches: number[] = [];

  // State Transition Memory
  private wasAuthorized: boolean = false;
  private previousFaceCount: number = 0;
  private previousPrivacyPaused: boolean = false;
  private previousCameraState: string = 'ACTIVE';

  // Sanitized In-Memory Notification History (Ring Buffer of max 50 items)
  private history: NotificationHistoryEntry[] = [];
  private static readonly MAX_HISTORY = 50;

  // Burst limits
  private static readonly CATEGORY_BURST_MAX = 3; // Max 3 per category
  private static readonly CATEGORY_BURST_WINDOW_MS = 30_000; // per 30 seconds
  private static readonly GLOBAL_BURST_MAX = 8; // Max 8 overall
  private static readonly GLOBAL_BURST_WINDOW_MS = 60_000; // per 60 seconds

  private constructor(options: NotificationManagerOptions = {}) {
    this.adapter = options.adapter || NotificationManager.defaultSink;
    this.enabled = options.enabled ?? true;
    this.attachEventListeners();
  }

  public static setDefaultSink(sink: NotificationSink): void {
    NotificationManager.defaultSink = sink;
  }

  public static getInstance(options?: NotificationManagerOptions): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager(options);
    } else if (options?.adapter) {
      NotificationManager.instance.adapter = options.adapter;
    }
    return NotificationManager.instance;
  }

  /**
   * Resets singleton state (used for test isolation & clean daemon restarts).
   */
  public static resetInstance(): void {
    if (NotificationManager.instance) {
      NotificationManager.instance.destroy();
      NotificationManager.instance = null;
    }
  }

  public setAdapter(adapter: PlatformAdapter): void {
    this.adapter = adapter;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Subscribes to relevant EventBus events.
   */
  private attachEventListeners(): void {
    const bus = EventBus.getInstance();

    const events: EventType[] = [
      'CAMERA_DISCONNECTED',
      'CAMERA_CONNECTED',
      'USER_PRESENT',
      'USER_LEFT',
      'LIVENESS_FAILED',
      'SECURITY_ALERT',
    ];

    for (const evt of events) {
      const unsub = bus.subscribe(evt, (event: SystemEvent) => {
        this.handleEvent(event.type, event.payload);
      });
      this.unsubscribeList.push(unsub);
    }

    // Extended non-standard EventBus events
    const extendedEvents = [
      'MULTIPLE_FACES_DETECTED',
      'UNKNOWN_FACE_DETECTED',
      'PRIVACY_PAUSED',
      'PRIVACY_RESUMED',
      'CAMERA_UNAVAILABLE',
      'MODEL_INTEGRITY_FAILURE',
      'SYSTEM_ERROR',
    ];

    for (const evt of extendedEvents) {
      const unsub = bus.subscribe(evt as any, (event: SystemEvent) => {
        this.handleEvent(event.type, event.payload);
      });
      this.unsubscribeList.push(unsub);
    }
  }

  /**
   * Evaluates an internal system event and translates it to a semantic notification
   * if it represents a meaningful state change.
   */
  public async handleEvent(eventType: string, payload?: any): Promise<boolean> {
    if (!this.enabled) return false;

    // Reject purely internal/high-frequency events (Section 21)
    if (NotificationPolicy.isSilentEvent(eventType)) {
      return false;
    }

    switch (eventType) {
      case 'CAMERA_DISCONNECTED': {
        this.previousCameraState = 'DISCONNECTED';
        return await this.notifyCanonical('CAMERA_DISCONNECTED');
      }

      case 'CAMERA_UNAVAILABLE': {
        this.previousCameraState = 'UNAVAILABLE';
        return await this.notifyCanonical('CAMERA_UNAVAILABLE');
      }

      case 'CAMERA_CONNECTED': {
        const wasDisconnected = this.previousCameraState === 'DISCONNECTED' || this.previousCameraState === 'UNAVAILABLE';
        this.previousCameraState = 'ACTIVE';
        if (wasDisconnected) {
          return await this.notifyCanonical('CAMERA_CONNECTED');
        }
        return false;
      }

      case 'USER_PRESENT': {
        // Only notify upon actual transition from UNAUTHORIZED -> AUTHORIZED (Section 11)
        if (!this.wasAuthorized) {
          this.wasAuthorized = true;
          return await this.notifyCanonical('PRESENCE_AUTHORIZED');
        }
        return false;
      }

      case 'USER_LEFT': {
        // Only notify if user was previously authorized (Section 12)
        if (this.wasAuthorized) {
          this.wasAuthorized = false;
          return await this.notifyCanonical('PRESENCE_ENDED');
        }
        return false;
      }

      case 'MULTIPLE_FACES_DETECTED': {
        const count = payload?.count ?? 2;
        const transition = this.previousFaceCount < 2 && count >= 2;
        this.previousFaceCount = count;
        this.wasAuthorized = false; // Multiple faces drop presence authorization
        if (transition) {
          return await this.notifyCanonical('MULTIPLE_FACES');
        }
        return false;
      }

      case 'UNKNOWN_FACE_DETECTED': {
        this.wasAuthorized = false;
        return await this.notifyCanonical('UNKNOWN_PERSON');
      }

      case 'LIVENESS_FAILED': {
        this.wasAuthorized = false;
        return await this.notifyCanonical('LIVENESS_FAILED');
      }

      case 'PRIVACY_PAUSED': {
        if (!this.previousPrivacyPaused) {
          this.previousPrivacyPaused = true;
          this.wasAuthorized = false;
          return await this.notifyCanonical('PRIVACY_PAUSED');
        }
        return false;
      }

      case 'PRIVACY_RESUMED': {
        if (this.previousPrivacyPaused) {
          this.previousPrivacyPaused = false;
          return await this.notifyCanonical('PRIVACY_RESUMED');
        }
        return false;
      }

      case 'SECURITY_ALERT':
      case 'MODEL_INTEGRITY_FAILURE': {
        this.wasAuthorized = false;
        return await this.notifyCanonical('SECURITY_FAILURE', {
          body: payload?.reason || payload?.message,
        });
      }

      case 'SYSTEM_ERROR': {
        return await this.notifyCanonical('SYSTEM_ERROR', {
          body: payload?.error ? `Protection service issue: ${String(payload.error).slice(0, 100)}` : undefined,
        });
      }

      default:
        // Do not notify on unrecognized events
        return false;
    }
  }

  /**
   * Dispatches a canonical notification definition by key.
   */
  public async notifyCanonical(
    definitionKey: keyof typeof NotificationPolicy.DEFINITIONS | string,
    overrides?: Partial<NotificationPayload>
  ): Promise<boolean> {
    const payload = NotificationPolicy.createPayload(definitionKey, overrides);
    if (!payload) {
      Logger.warn('notification', `Unknown canonical notification key: ${definitionKey}`);
      return false;
    }
    return await this.notify(payload);
  }

  /**
   * Core notification dispatcher with deduplication, cooldown, burst protection,
   * safe OS formatting, and zero-leak history recording.
   */
  public async notify(payload: NotificationPayload): Promise<boolean> {
    if (!this.enabled) return false;

    const now = payload.timestamp || Date.now();
    const dedupeKey = payload.dedupeKey || `${payload.category}:::${payload.title}`;
    const cooldownMs = payload.cooldownMs ?? 15_000;

    // 1. Cooldown & Deduplication Enforcement (Section 24 & 25)
    const lastDispatched = this.dedupeTimestamps.get(dedupeKey);
    if (lastDispatched && now - lastDispatched < cooldownMs) {
      this.recordHistory(payload, false, 'cooldown');
      Logger.debug('notification', `Suppressed duplicate notification within cooldown: [${dedupeKey}]`);
      return false;
    }

    // 2. Burst Protection (Section 26)
    // Critical security events are exempted from burst suppression to guarantee visibility
    if (payload.severity !== 'security' && payload.severity !== 'error') {
      if (this.isBurstLimited(payload.category, now)) {
        this.recordHistory(payload, false, 'burst_limit');
        Logger.warn('notification', `Suppressed notification due to category burst limit: [${payload.category}]`);
        return false;
      }

      if (this.isGlobalBurstLimited(now)) {
        this.recordHistory(payload, false, 'burst_limit');
        Logger.warn('notification', 'Suppressed notification due to global burst limit');
        return false;
      }
    }

    // Update dispatch timestamps
    this.dedupeTimestamps.set(dedupeKey, now);
    this.recordCategoryDispatch(payload.category, now);
    this.globalDispatches.push(now);

    // 3. Format Title & Body according to Section 32 & 52
    // Never output generic debug strings ("Event triggered", "OpenFaceID Alert")
    const appTitle = payload.severity === 'security' ? `${BRANDING.name} Security` : BRANDING.name;

    // Build clear 2-part format: Headline + Explanation
    let displayBody = payload.body;
    if (payload.title && payload.title !== appTitle) {
      displayBody = `${payload.title}\n${payload.body}`;
    }

    // 4. Safe OS Notification Dispatch (Observer Invariant: Section 42 & 43)
    try {
      await this.adapter.showNotification(appTitle, displayBody);
      this.recordHistory(payload, true);
      Logger.info('notification', `Notification dispatched: [${payload.category}][${payload.severity}] ${payload.title}`);
      return true;
    } catch (err) {
      // OS notification failure MUST NEVER break daemon or alter security state
      Logger.warn('notification', 'Failed to dispatch OS desktop notification', { error: String(err) });
      this.recordHistory(payload, false, 'throttled');
      return false;
    }
  }

  /**
   * Tracks category-level dispatch window for sliding burst limiter.
   */
  private isBurstLimited(category: NotificationCategory, now: number): boolean {
    const list = this.categoryDispatches.get(category) || [];
    const valid = list.filter((t) => now - t < NotificationManager.CATEGORY_BURST_WINDOW_MS);
    this.categoryDispatches.set(category, valid);
    return valid.length >= NotificationManager.CATEGORY_BURST_MAX;
  }

  private recordCategoryDispatch(category: NotificationCategory, now: number): void {
    const list = this.categoryDispatches.get(category) || [];
    list.push(now);
    this.categoryDispatches.set(category, list);
  }

  /**
   * Tracks global dispatch window for sliding burst limiter.
   */
  private isGlobalBurstLimited(now: number): boolean {
    this.globalDispatches = this.globalDispatches.filter((t) => now - t < NotificationManager.GLOBAL_BURST_WINDOW_MS);
    return this.globalDispatches.length >= NotificationManager.GLOBAL_BURST_MAX;
  }

  /**
   * Records sanitized notification event in history buffer (Zero secrets / Zero biometric frames).
   */
  private recordHistory(
    payload: NotificationPayload,
    dispatched: boolean,
    suppressionReason?: NotificationHistoryEntry['suppressionReason']
  ): void {
    const entry: NotificationHistoryEntry = {
      id: payload.id,
      category: payload.category,
      severity: payload.severity,
      title: payload.title,
      body: payload.body,
      action: payload.action,
      timestamp: payload.timestamp || Date.now(),
      dispatched,
      suppressionReason,
    };

    this.history.unshift(entry);
    if (this.history.length > NotificationManager.MAX_HISTORY) {
      this.history.pop();
    }
  }

  public getHistory(): NotificationHistoryEntry[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
    this.dedupeTimestamps.clear();
    this.categoryDispatches.clear();
    this.globalDispatches = [];
  }

  public updatePresenceState(isAuthorized: boolean): void {
    this.wasAuthorized = isAuthorized;
  }

  public destroy(): void {
    for (const unsub of this.unsubscribeList) {
      unsub();
    }
    this.unsubscribeList = [];
    this.clearHistory();
  }
}
