export type EventType =
  | 'FACE_DETECTED'
  | 'FACE_LOST'
  | 'IDENTITY_MATCHED'
  | 'IDENTITY_UNKNOWN'
  | 'LIVENESS_PASSED'
  | 'LIVENESS_FAILED'
  | 'USER_PRESENT'
  | 'USER_LEFT'
  | 'CAMERA_CONNECTED'
  | 'CAMERA_DISCONNECTED'
  | 'LOCK_REQUESTED'
  | 'UNLOCK_REQUESTED'
  | 'BATTERY_PROFILE_CHANGED'
  | 'SECURITY_ALERT';

export interface SystemEvent<T = any> {
  type: EventType;
  payload: T;
  timestamp: number;
}

export type EventCallback<T = any> = (event: SystemEvent<T>) => void;

export class EventBus {
  private static instance: EventBus;
  private subscribers: Map<EventType, Set<EventCallback>> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe<T = any>(type: EventType, callback: EventCallback<T>): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    const set = this.subscribers.get(type)!;
    set.add(callback as EventCallback);

    return () => {
      set.delete(callback as EventCallback);
    };
  }

  public emit<T = any>(type: EventType, payload: T): void {
    const event: SystemEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
    };

    const listeners = this.subscribers.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          console.error(`[EventBus] Error dispatching event ${type}:`, err);
        }
      }
    }
  }

  public clearAll(): void {
    this.subscribers.clear();
  }
}
