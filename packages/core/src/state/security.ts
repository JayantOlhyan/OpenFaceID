export type SecurityState =
  | 'UNKNOWN'
  | 'FACE_DETECTED'
  | 'IDENTITY_MATCHED'
  | 'LIVENESS_VERIFIED'
  | 'POLICY_APPROVED'
  | 'ACTION_AUTHORIZED'
  | 'ACTION_COMPLETED';

export interface SecurityTransitionEvent {
  from: SecurityState;
  to: SecurityState;
  identityId?: string;
  policyAction?: string;
  timestamp: number;
}

export class SecurityStateMachine {
  private currentState: SecurityState = 'UNKNOWN';
  private listeners: Array<(event: SecurityTransitionEvent) => void> = [];

  constructor(initialState: SecurityState = 'UNKNOWN') {
    this.currentState = initialState;
  }

  public getState(): SecurityState {
    return this.currentState;
  }

  public canTransitionTo(next: SecurityState): boolean {
    const validTransitions: Record<SecurityState, SecurityState[]> = {
      UNKNOWN: ['FACE_DETECTED', 'UNKNOWN'],
      FACE_DETECTED: ['IDENTITY_MATCHED', 'UNKNOWN'],
      IDENTITY_MATCHED: ['LIVENESS_VERIFIED', 'UNKNOWN'],
      LIVENESS_VERIFIED: ['POLICY_APPROVED', 'UNKNOWN'],
      POLICY_APPROVED: ['ACTION_AUTHORIZED', 'UNKNOWN'],
      ACTION_AUTHORIZED: ['ACTION_COMPLETED', 'UNKNOWN'],
      ACTION_COMPLETED: ['UNKNOWN'],
    };

    return validTransitions[this.currentState].includes(next);
  }

  public transition(to: SecurityState, meta?: { identityId?: string; policyAction?: string }): boolean {
    if (!this.canTransitionTo(to)) {
      console.warn(`[SecurityStateMachine] Security violation: Attempted jump ${this.currentState} -> ${to}`);
      return false;
    }

    const event: SecurityTransitionEvent = {
      from: this.currentState,
      to,
      identityId: meta?.identityId,
      policyAction: meta?.policyAction,
      timestamp: Date.now(),
    };

    this.currentState = to;
    this.notify(event);
    return true;
  }

  public reset(): void {
    const event: SecurityTransitionEvent = {
      from: this.currentState,
      to: 'UNKNOWN',
      timestamp: Date.now(),
    };
    this.currentState = 'UNKNOWN';
    this.notify(event);
  }

  public onTransition(listener: (event: SecurityTransitionEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(event: SecurityTransitionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[SecurityStateMachine] Listener error:', err);
      }
    }
  }
}
