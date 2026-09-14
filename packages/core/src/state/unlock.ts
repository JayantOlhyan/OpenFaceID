/**
 * OpenFaceID Unlock State Machine
 *
 * Implements the event-driven, low-power Face Unlock lifecycle:
 * STANDBY (Camera OFF, 0% CPU) -> WAKE_TRIGGERED -> CAPTURING_BURST -> ANALYZING -> VERIFIED / FAILED -> STANDBY
 */

export type UnlockState =
  | 'STANDBY'
  | 'WAKE_TRIGGERED'
  | 'CAPTURING_BURST'
  | 'ANALYZING'
  | 'VERIFIED'
  | 'FAILED'
  | 'COMPLETED';

export type UnlockTriggerSource =
  | 'wake'
  | 'lock_screen'
  | 'spacebar'
  | 'manual'
  | 'ipc'
  | 'unknown';

export interface UnlockMetrics {
  wakeTimestamp: number | null;
  firstFrameTimestamp: number | null;
  wakeToFirstFrameMs: number | null;
  verificationLatencyMs: number | null;
  totalDurationMs: number;
  framesCaptured: number;
}

export interface UnlockResult {
  success: boolean;
  state: UnlockState;
  triggerSource: string;
  identityId: string | null;
  identityName: string | null;
  confidence: number;
  livenessPassed: boolean;
  metrics: UnlockMetrics;
  error?: string;
}

export interface UnlockStateMachineOptions {
  maxBurstFrames?: number;
  burstTimeoutMs?: number;
}

export type UnlockStateListener = (state: UnlockState, metrics: UnlockMetrics) => void;

export class UnlockStateMachine {
  private state: UnlockState = 'STANDBY';
  private triggerSource: string = 'unknown';
  private maxBurstFrames: number = 15;
  private burstTimeoutMs: number = 2000;

  private wakeTimestamp: number | null = null;
  private firstFrameTimestamp: number | null = null;
  private wakeToFirstFrameMs: number | null = null;
  private verificationLatencyMs: number | null = null;
  private framesCaptured: number = 0;

  private lastResult: UnlockResult | null = null;
  private listeners: UnlockStateListener[] = [];

  constructor(options: UnlockStateMachineOptions = {}) {
    if (options.maxBurstFrames) this.maxBurstFrames = options.maxBurstFrames;
    if (options.burstTimeoutMs) this.burstTimeoutMs = options.burstTimeoutMs;
  }

  public getState(): UnlockState {
    return this.state;
  }

  public getTriggerSource(): string {
    return this.triggerSource;
  }

  public getLastResult(): UnlockResult | null {
    return this.lastResult;
  }

  public getMetrics(): UnlockMetrics {
    const now = Date.now();
    const totalDurationMs = this.wakeTimestamp ? now - this.wakeTimestamp : 0;
    return {
      wakeTimestamp: this.wakeTimestamp,
      firstFrameTimestamp: this.firstFrameTimestamp,
      wakeToFirstFrameMs: this.wakeToFirstFrameMs,
      verificationLatencyMs: this.verificationLatencyMs,
      totalDurationMs,
      framesCaptured: this.framesCaptured,
    };
  }

  public subscribe(listener: UnlockStateListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private notify(): void {
    const metrics = this.getMetrics();
    for (const fn of this.listeners) {
      try {
        fn(this.state, metrics);
      } catch {
        // Safe execution
      }
    }
  }

  /**
   * Transition from STANDBY to WAKE_TRIGGERED when an OS wake, lock, or manual trigger occurs.
   */
  public triggerWake(source: string = 'wake', now: number = Date.now()): void {
    this.state = 'WAKE_TRIGGERED';
    this.triggerSource = source;
    this.wakeTimestamp = now;
    this.firstFrameTimestamp = null;
    this.wakeToFirstFrameMs = null;
    this.verificationLatencyMs = null;
    this.framesCaptured = 0;
    this.notify();
  }

  /**
   * Called upon arrival of the very first hardware camera frame.
   * Records wake-to-first-frame latency and moves to CAPTURING_BURST.
   */
  public onFirstFrameReceived(now: number = Date.now()): number {
    this.firstFrameTimestamp = now;
    if (this.wakeTimestamp) {
      this.wakeToFirstFrameMs = Math.max(0, now - this.wakeTimestamp);
    } else {
      this.wakeToFirstFrameMs = 0;
    }
    this.state = 'CAPTURING_BURST';
    this.notify();
    return this.wakeToFirstFrameMs;
  }

  /**
   * Records a captured burst frame. Returns true if burst limit is reached.
   */
  public onFrameCaptured(): boolean {
    this.framesCaptured++;
    if (this.framesCaptured >= this.maxBurstFrames) {
      return true;
    }
    return false;
  }

  public isBurstTimeout(now: number = Date.now()): boolean {
    if (!this.wakeTimestamp) return false;
    return now - this.wakeTimestamp >= this.burstTimeoutMs;
  }

  public setAnalyzing(): void {
    if (this.state === 'CAPTURING_BURST' || this.state === 'WAKE_TRIGGERED') {
      this.state = 'ANALYZING';
      this.notify();
    }
  }

  /**
   * Record a verified identity match with liveness check passed.
   */
  public recordVerified(
    identityId: string,
    identityName: string,
    confidence: number,
    now: number = Date.now()
  ): UnlockResult {
    this.state = 'VERIFIED';
    if (this.wakeTimestamp) {
      this.verificationLatencyMs = Math.max(0, now - this.wakeTimestamp);
    }

    const result: UnlockResult = {
      success: true,
      state: 'VERIFIED',
      triggerSource: this.triggerSource,
      identityId,
      identityName,
      confidence,
      livenessPassed: true,
      metrics: this.getMetrics(),
    };

    this.lastResult = result;
    this.notify();
    return result;
  }

  /**
   * Record a failed unlock attempt (timeout, unknown face, or liveness failure).
   */
  public recordFailed(reason: string, now: number = Date.now()): UnlockResult {
    this.state = 'FAILED';
    if (this.wakeTimestamp) {
      this.verificationLatencyMs = Math.max(0, now - this.wakeTimestamp);
    }

    const result: UnlockResult = {
      success: false,
      state: 'FAILED',
      triggerSource: this.triggerSource,
      identityId: null,
      identityName: null,
      confidence: 0,
      livenessPassed: false,
      metrics: this.getMetrics(),
      error: reason,
    };

    this.lastResult = result;
    this.notify();
    return result;
  }

  /**
   * Complete the session and return to zero-power STANDBY mode.
   */
  public resetToStandby(): void {
    this.state = 'STANDBY';
    this.notify();
  }
}
