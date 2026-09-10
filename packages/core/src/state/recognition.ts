export type RecognitionState =
  | 'IDLE'
  | 'SEARCHING'
  | 'FACE_DETECTED'
  | 'QUALITY_CHECK'
  | 'RECOGNIZING'
  | 'LIVENESS_CHECK'
  | 'AUTHORIZED'
  | 'DENIED'
  | 'ERROR';

export interface RecognitionTransitionEvent {
  from: RecognitionState;
  to: RecognitionState;
  reason?: string;
  timestamp: number;
}

export class RecognitionStateMachine {
  private currentState: RecognitionState = 'IDLE';
  private listeners: Array<(event: RecognitionTransitionEvent) => void> = [];

  constructor(initialState: RecognitionState = 'IDLE') {
    this.currentState = initialState;
  }

  public getState(): RecognitionState {
    return this.currentState;
  }

  public canTransitionTo(next: RecognitionState): boolean {
    const validTransitions: Record<RecognitionState, RecognitionState[]> = {
      IDLE: ['SEARCHING', 'ERROR'],
      SEARCHING: ['FACE_DETECTED', 'IDLE', 'ERROR'],
      FACE_DETECTED: ['QUALITY_CHECK', 'SEARCHING', 'ERROR'],
      QUALITY_CHECK: ['RECOGNIZING', 'SEARCHING', 'ERROR'],
      RECOGNIZING: ['LIVENESS_CHECK', 'DENIED', 'SEARCHING', 'ERROR'],
      LIVENESS_CHECK: ['AUTHORIZED', 'DENIED', 'SEARCHING', 'ERROR'],
      AUTHORIZED: ['IDLE', 'SEARCHING', 'ERROR'],
      DENIED: ['IDLE', 'SEARCHING', 'ERROR'],
      ERROR: ['IDLE', 'SEARCHING'],
    };

    return validTransitions[this.currentState].includes(next);
  }

  public transition(to: RecognitionState, reason?: string): boolean {
    if (!this.canTransitionTo(to)) {
      console.warn(`[RecognitionStateMachine] Invalid transition: ${this.currentState} -> ${to}`);
      return false;
    }

    const event: RecognitionTransitionEvent = {
      from: this.currentState,
      to,
      reason,
      timestamp: Date.now(),
    };

    this.currentState = to;
    this.notify(event);
    return true;
  }

  public reset(to: RecognitionState = 'IDLE'): void {
    const event: RecognitionTransitionEvent = {
      from: this.currentState,
      to,
      reason: 'State machine reset',
      timestamp: Date.now(),
    };
    this.currentState = to;
    this.notify(event);
  }

  public onTransition(listener: (event: RecognitionTransitionEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(event: RecognitionTransitionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[RecognitionStateMachine] Listener error:', err);
      }
    }
  }
}
