import { PresenceStateMachine, type PresenceState, EventBus, Logger } from '../../core/src/index.ts';

export interface PresenceTrackerOptions {
  leaveTimeoutSec?: number; // default: 20s
  gracePeriodSec?: number; // default: 5s
}

export class PresenceTracker {
  private stateMachine: PresenceStateMachine;
  private leaveTimeoutMs: number;
  private gracePeriodMs: number;
  private lastFaceSeenTimestamp: number = Date.now();

  constructor(options: PresenceTrackerOptions = {}) {
    this.stateMachine = new PresenceStateMachine('UNKNOWN');
    this.leaveTimeoutMs = (options.leaveTimeoutSec || 20) * 1000;
    this.gracePeriodMs = (options.gracePeriodSec || 5) * 1000;
  }

  public getState(): PresenceState {
    return this.stateMachine.getState();
  }

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
    this.stateMachine.transition('USER_PRESENT');
  }

  public getElapsedAbsentMs(now: number = Date.now()): number {
    return now - this.lastFaceSeenTimestamp;
  }
}
