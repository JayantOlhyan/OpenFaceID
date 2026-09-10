export type PresenceState =
  | 'UNKNOWN'
  | 'USER_PRESENT'
  | 'GRACE_PERIOD'
  | 'USER_LEFT';

export interface PresenceTransitionEvent {
  from: PresenceState;
  to: PresenceState;
  elapsedNoFaceMs: number;
  timestamp: number;
}

export class PresenceStateMachine {
  private currentState: PresenceState = 'UNKNOWN';
  private listeners: Array<(event: PresenceTransitionEvent) => void> = [];

  constructor(initialState: PresenceState = 'UNKNOWN') {
    this.currentState = initialState;
  }

  public getState(): PresenceState {
    return this.currentState;
  }

  public canTransitionTo(next: PresenceState): boolean {
    const validTransitions: Record<PresenceState, PresenceState[]> = {
      UNKNOWN: ['USER_PRESENT', 'USER_LEFT'],
      USER_PRESENT: ['GRACE_PERIOD', 'USER_LEFT'],
      GRACE_PERIOD: ['USER_PRESENT', 'USER_LEFT'],
      USER_LEFT: ['USER_PRESENT', 'UNKNOWN'],
    };

    return validTransitions[this.currentState].includes(next);
  }

  public transition(to: PresenceState, elapsedNoFaceMs: number = 0): boolean {
    if (this.currentState === to) return true;

    if (!this.canTransitionTo(to)) {
      console.warn(`[PresenceStateMachine] Invalid transition: ${this.currentState} -> ${to}`);
      return false;
    }

    const event: PresenceTransitionEvent = {
      from: this.currentState,
      to,
      elapsedNoFaceMs,
      timestamp: Date.now(),
    };

    this.currentState = to;
    this.notify(event);
    return true;
  }

  public onTransition(listener: (event: PresenceTransitionEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(event: PresenceTransitionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[PresenceStateMachine] Listener error:', err);
      }
    }
  }
}
