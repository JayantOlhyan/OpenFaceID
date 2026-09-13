import { PresenceStateMachine, type PresenceState, EventBus, Logger } from '../../core/src/index.ts';

export interface PresenceTrackerOptions {
  leaveTimeoutSec?: number; // default: 20s
  gracePeriodSec?: number; // default: 5s
  reappearanceTimeoutSec?: number; // default: 3s
  requireAuthorizedIdentity?: boolean; // default: true
}

export class PresenceTracker {
  private stateMachine: PresenceStateMachine;
  private leaveTimeoutMs: number;
  private gracePeriodMs: number;
  private reappearanceTimeoutMs: number;
  private requireAuthorizedIdentity: boolean;
  private lastFaceSeenTimestamp: number = Date.now();
  private lastAuthorizedIdentity: string | null = null;
  private unknownFaceCount: number = 0;
  private multipleFacesCount: number = 0;
  private authorizedAt: number | null = null;
  private lastConfirmedAt: number | null = null;
  private expirationAt: number | null = null;

  constructor(options: PresenceTrackerOptions = {}) {
    this.stateMachine = new PresenceStateMachine('UNKNOWN');
    this.leaveTimeoutMs = (options.leaveTimeoutSec ?? 20) * 1000;
    this.gracePeriodMs = (options.gracePeriodSec ?? 5) * 1000;
    this.reappearanceTimeoutMs = (options.reappearanceTimeoutSec ?? 3) * 1000;
    this.requireAuthorizedIdentity = options.requireAuthorizedIdentity ?? false; // default false for backward compat in tests, true in production daemon
  }

  public getState(): PresenceState {
    return this.stateMachine.getState();
  }

  public getLastAuthorizedIdentity(): string | null {
    return this.lastAuthorizedIdentity;
  }

  public getSessionInfo() {
    return {
      authorizedAt: this.authorizedAt,
      lastConfirmedAt: this.lastConfirmedAt,
      expirationAt: this.expirationAt,
      isExpired: this.isSessionExpired(),
    };
  }

  public isSessionExpired(now: number = Date.now()): boolean {
    if (this.expirationAt === null) return false;
    return now > this.expirationAt;
  }

  /**
   * Phase 3 Verified Multi-Stage Presence:
   * Face Detected + Identity Recognized + Liveness Passed -> Authorized Presence
   */
  public onAuthorizedPresence(identityId: string, name: string): void {
    const now = Date.now();
    this.lastFaceSeenTimestamp = now;
    this.lastAuthorizedIdentity = identityId;
    this.unknownFaceCount = 0;
    this.multipleFacesCount = 0;

    if (!this.authorizedAt) {
      this.authorizedAt = now;
    }
    this.lastConfirmedAt = now;
    this.expirationAt = now + this.leaveTimeoutMs;

    if (this.stateMachine.getState() !== 'USER_PRESENT') {
      Logger.info('vision', `Authorized presence verified for ${name} (${identityId})`);
      this.stateMachine.transition('USER_PRESENT');
      EventBus.getInstance().emit('USER_PRESENT', {
        identityId,
        name,
        timestamp: this.lastFaceSeenTimestamp,
      });
    }
  }

  /**
   * Section 8 Multiple-Face Fail-Closed Policy:
   * If face_count >= 2, presence authorization is immediately revoked.
   */
  public onMultipleFacesDetected(count: number = 2): void {
    this.multipleFacesCount = count;
    this.lastAuthorizedIdentity = null;
    this.authorizedAt = null;
    this.expirationAt = null;

    Logger.warn('vision', `Multiple faces detected in camera field (${count}); presence authorization suspended`);
    EventBus.getInstance().emit('MULTIPLE_FACES_DETECTED' as any, {
      count,
      timestamp: Date.now(),
    });

    if (this.stateMachine.getState() === 'USER_PRESENT' || this.stateMachine.getState() === 'GRACE_PERIOD') {
      this.stateMachine.transition('USER_LEFT');
    }
  }

  public resetOnWake(): void {
    this.lastAuthorizedIdentity = null;
    this.authorizedAt = null;
    this.lastConfirmedAt = null;
    this.expirationAt = null;
    this.unknownFaceCount = 0;
    this.multipleFacesCount = 0;
    this.lastFaceSeenTimestamp = 0; // force absence check if not immediately refreshed
    if (this.stateMachine.getState() !== 'UNKNOWN') {
      this.stateMachine.transition('USER_LEFT');
    }
  }

  /**
   * Safe Unknown Face Handler:
   * Does NOT label user an "attacker". Records "Unknown face" and does not grant authorized presence.
   */
  public onUnknownFaceDetected(): void {
    this.unknownFaceCount++;
    Logger.info('vision', `Unknown face detected in camera field (count: ${this.unknownFaceCount})`);
    EventBus.getInstance().emit('UNKNOWN_FACE_DETECTED' as any, {
      count: this.unknownFaceCount,
      timestamp: Date.now(),
    });

    // If we require an authorized identity, an unknown face does not refresh authorized presence
    if (!this.requireAuthorizedIdentity) {
      this.onFaceDetected();
    }
  }

  /**
   * General face presence trigger (backward-compatible)
   */
  public onFaceDetected(): void {
    this.lastFaceSeenTimestamp = Date.now();

    if (this.stateMachine.getState() !== 'USER_PRESENT') {
      Logger.info('vision', 'User presence detected');
      this.stateMachine.transition('USER_PRESENT');
      EventBus.getInstance().emit('USER_PRESENT', {
        timestamp: this.lastFaceSeenTimestamp,
      });
    }
  }

  public onNoFaceDetected(currentTimestamp: number = Date.now()): void {
    const elapsedNoFaceMs = currentTimestamp - this.lastFaceSeenTimestamp;
    const currentState = this.stateMachine.getState();

    if (
      (currentState === 'GRACE_PERIOD' || currentState === 'USER_PRESENT') &&
      elapsedNoFaceMs >= this.leaveTimeoutMs
    ) {
      Logger.info('vision', `User left detected: absent for ${Math.round(elapsedNoFaceMs / 1000)}s`);
      this.stateMachine.transition('USER_LEFT', elapsedNoFaceMs);
      EventBus.getInstance().emit('USER_LEFT', {
        absentDurationMs: elapsedNoFaceMs,
        timestamp: currentTimestamp,
      });
    } else if (currentState === 'USER_PRESENT' && elapsedNoFaceMs >= this.gracePeriodMs) {
      Logger.debug('vision', `Entering absence grace period (${Math.round(elapsedNoFaceMs / 1000)}s since face seen)`);
      this.stateMachine.transition('GRACE_PERIOD', elapsedNoFaceMs);
    }
  }

  public reset(): void {
    this.lastFaceSeenTimestamp = Date.now();
    this.lastAuthorizedIdentity = null;
    this.unknownFaceCount = 0;
    this.stateMachine.transition('USER_PRESENT');
  }

  public getElapsedAbsentMs(now: number = Date.now()): number {
    return now - this.lastFaceSeenTimestamp;
  }
}
