/**
 * OpenFaceID Canonical Authoritative State Machine
 *
 * Enforces the canonical hierarchy:
 * Camera -> Vision -> Liveness -> Identity -> Presence Policy -> Authoritative Core State -> IPC -> UI / CLI
 *
 * Absolute rule: The desktop UI and CLI are strictly consumers of state.
 * They are NEVER the security authority.
 */

export type SystemCoreState =
  | 'SYSTEM_STARTING'
  | 'SYSTEM_READY'
  | 'SYSTEM_ERROR';

export type CameraCoreState =
  | 'CAMERA_PERMISSION_REQUIRED'
  | 'CAMERA_INITIALIZING'
  | 'CAMERA_READY'
  | 'CAMERA_UNAVAILABLE'
  | 'CAMERA_DISCONNECTED'
  | 'CAMERA_RECOVERING';

export type DetectionCoreState =
  | 'NO_FACE'
  | 'FACE_DETECTED'
  | 'MULTIPLE_FACES'
  | 'UNKNOWN_FACE'
  | 'FACE_MATCHING';

export type LivenessCoreState =
  | 'LIVENESS_REQUIRED'
  | 'LIVENESS_RUNNING'
  | 'LIVENESS_PASSED'
  | 'LIVENESS_FAILED';

export type IdentityCoreState =
  | 'IDENTITY_RECOGNIZED'
  | 'IDENTITY_UNKNOWN';

export type PresenceCoreState =
  | 'PRESENCE_AUTHORIZED'
  | 'PRESENCE_EXPIRED'
  | 'PRESENCE_UNAUTHORIZED'
  | 'PRESENCE_AMBIGUOUS';

export interface PresenceSession {
  authorizedAt: number | null;
  lastConfirmedAt: number | null;
  expiresAt: number | null;
  timeoutSec: number;
}

export interface CanonicalStateSnapshot {
  system: SystemCoreState;
  camera: CameraCoreState;
  detection: DetectionCoreState;
  liveness: LivenessCoreState;
  identity: IdentityCoreState;
  presence: PresenceCoreState;
  privacyPaused: boolean;
  faceCount: number;
  activeIdentityId: string | null;
  activeIdentityName: string | null;
  presenceSession: PresenceSession;
  unauthorizedReason: string | null;
  timestamp: number;
}

export type StateChangeListener = (snapshot: CanonicalStateSnapshot) => void;

export class CanonicalStateMachine {
  private system: SystemCoreState = 'SYSTEM_STARTING';
  private camera: CameraCoreState = 'CAMERA_INITIALIZING';
  private detection: DetectionCoreState = 'NO_FACE';
  private liveness: LivenessCoreState = 'LIVENESS_REQUIRED';
  private identity: IdentityCoreState = 'IDENTITY_UNKNOWN';
  private presence: PresenceCoreState = 'PRESENCE_UNAUTHORIZED';
  private privacyPaused: boolean = false;
  private faceCount: number = 0;
  private activeIdentityId: string | null = null;
  private activeIdentityName: string | null = null;
  private unauthorizedReason: string | null = 'System starting';
  private listeners: StateChangeListener[] = [];

  private presenceSession: PresenceSession = {
    authorizedAt: null,
    lastConfirmedAt: null,
    expiresAt: null,
    timeoutSec: 20,
  };

  constructor(timeoutSec: number = 20) {
    this.presenceSession.timeoutSec = timeoutSec;
  }

  public setSystemState(state: SystemCoreState): void {
    this.system = state;
    this.recomputeAuthoritativePresence();
  }

  public setCameraState(state: CameraCoreState): void {
    this.camera = state;
    this.recomputeAuthoritativePresence();
  }

  public setPrivacyPaused(paused: boolean): void {
    this.privacyPaused = paused;
    if (paused) {
      this.activeIdentityId = null;
      this.activeIdentityName = null;
      this.presenceSession.authorizedAt = null;
      this.presenceSession.expiresAt = null;
    }
    this.recomputeAuthoritativePresence();
  }

  /**
   * Process vision pipeline evaluation results atomically
   */
  public updateVisionState(params: {
    faceCount: number;
    detectionState: DetectionCoreState;
    livenessState: LivenessCoreState;
    identityState: IdentityCoreState;
    identityId?: string | null;
    identityName?: string | null;
    now?: number;
  }): void {
    const now = params.now ?? Date.now();
    this.faceCount = params.faceCount;
    this.detection = params.detectionState;
    this.liveness = params.livenessState;
    this.identity = params.identityState;

    if (params.identityId !== undefined) {
      this.activeIdentityId = params.identityId;
    }
    if (params.identityName !== undefined) {
      this.activeIdentityName = params.identityName;
    }

    // Check if session can be authorized or extended
    if (
      !this.privacyPaused &&
      this.camera === 'CAMERA_READY' &&
      this.faceCount === 1 &&
      this.detection === 'FACE_DETECTED' &&
      this.liveness === 'LIVENESS_PASSED' &&
      this.identity === 'IDENTITY_RECOGNIZED' &&
      this.activeIdentityId
    ) {
      if (!this.presenceSession.authorizedAt) {
        this.presenceSession.authorizedAt = now;
      }
      this.presenceSession.lastConfirmedAt = now;
      this.presenceSession.expiresAt = now + this.presenceSession.timeoutSec * 1000;
    }

    this.recomputeAuthoritativePresence(now);
  }

  /**
   * Evaluates presence expiration and checks against policy
   */
  public checkSessionExpiration(now: number = Date.now()): void {
    if (
      this.presence === 'PRESENCE_AUTHORIZED' &&
      this.presenceSession.expiresAt !== null &&
      now > this.presenceSession.expiresAt
    ) {
      this.recomputeAuthoritativePresence(now);
    }
  }

  /**
   * Hard reset on system wake from sleep:
   * Presence is NEVER blindly restored.
   */
  public resetOnWake(): void {
    this.presenceSession.authorizedAt = null;
    this.presenceSession.lastConfirmedAt = null;
    this.presenceSession.expiresAt = null;
    this.activeIdentityId = null;
    this.activeIdentityName = null;
    this.detection = 'NO_FACE';
    this.faceCount = 0;
    this.liveness = 'LIVENESS_REQUIRED';
    this.identity = 'IDENTITY_UNKNOWN';
    this.recomputeAuthoritativePresence();
  }

  /**
   * Authoritative presence calculation according to Section 7 & 8:
   *
   * NO_FACE -> NOT AUTHORIZED
   * UNKNOWN_FACE -> NOT AUTHORIZED
   * MULTIPLE_FACES -> NOT AUTHORIZED (PRESENCE_AMBIGUOUS)
   * LIVENESS_FAILED -> NOT AUTHORIZED
   * CAMERA_FAILURE -> NOT AUTHORIZED
   * PRIVACY_PAUSED -> NOT AUTHORIZED
   * RECOGNIZED_FACE + FAILED/UNKNOWN LIVENESS -> NOT AUTHORIZED
   * RECOGNIZED_FACE + PASSED LIVENESS -> AUTHORIZED
   */
  private recomputeAuthoritativePresence(now: number = Date.now()): void {
    // 1. Privacy Pause Check
    if (this.privacyPaused) {
      this.presence = 'PRESENCE_UNAUTHORIZED';
      this.unauthorizedReason = 'Privacy paused: Camera processing is suspended';
      this.notify();
      return;
    }

    // 2. Camera Health Check
    if (this.camera !== 'CAMERA_READY') {
      this.presence = 'PRESENCE_UNAUTHORIZED';
      this.unauthorizedReason =
        this.camera === 'CAMERA_PERMISSION_REQUIRED'
          ? 'Camera permission required'
          : this.camera === 'CAMERA_DISCONNECTED'
          ? 'Camera disconnected'
          : this.camera === 'CAMERA_RECOVERING'
          ? 'Camera recovering'
          : 'Camera unavailable';
      this.notify();
      return;
    }

    // 3. System Health Check
    if (this.system === 'SYSTEM_ERROR') {
      this.presence = 'PRESENCE_UNAUTHORIZED';
      this.unauthorizedReason = 'System error: Core engine degraded';
      this.notify();
      return;
    }

    // 4. Multiple-Face Fail-Closed Check (Section 8)
    if (this.faceCount >= 2 || this.detection === 'MULTIPLE_FACES') {
      this.presence = 'PRESENCE_AMBIGUOUS';
      this.unauthorizedReason =
        'Multiple faces detected: For security and privacy, presence is not authorized while multiple faces are visible. Ensure only one person is in view.';
      this.notify();
      return;
    }

    // 5. Zero Face Check
    if (this.faceCount === 0 || this.detection === 'NO_FACE') {
      this.presence = 'PRESENCE_UNAUTHORIZED';
      this.unauthorizedReason = 'Looking for you...';
      this.notify();
      return;
    }

    // 6. Unknown Face Check
    if (this.identity === 'IDENTITY_UNKNOWN' || this.detection === 'UNKNOWN_FACE') {
      this.presence = 'PRESENCE_UNAUTHORIZED';
      this.unauthorizedReason = 'Unknown face';
      this.notify();
      return;
    }

    // 7. Liveness Check
    if (this.liveness === 'LIVENESS_FAILED') {
      this.presence = 'PRESENCE_UNAUTHORIZED';
      this.unauthorizedReason = 'Liveness check failed';
      this.notify();
      return;
    }

    if (this.liveness !== 'LIVENESS_PASSED') {
      this.presence = 'PRESENCE_UNAUTHORIZED';
      this.unauthorizedReason = 'Checking liveness...';
      this.notify();
      return;
    }

    // 8. Session Expiration Check (Section 17)
    if (
      this.presenceSession.expiresAt !== null &&
      now > this.presenceSession.expiresAt
    ) {
      this.presence = 'PRESENCE_EXPIRED';
      this.unauthorizedReason = 'Presence expired: Looking for you...';
      this.notify();
      return;
    }

    // 9. Fully Authorized
    if (
      this.faceCount === 1 &&
      this.identity === 'IDENTITY_RECOGNIZED' &&
      this.liveness === 'LIVENESS_PASSED' &&
      this.activeIdentityId
    ) {
      this.presence = 'PRESENCE_AUTHORIZED';
      this.unauthorizedReason = null;
      this.notify();
      return;
    }

    // Default fail-closed
    this.presence = 'PRESENCE_UNAUTHORIZED';
    this.unauthorizedReason = 'Presence unauthorized';
    this.notify();
  }

  public getSnapshot(): CanonicalStateSnapshot {
    return {
      system: this.system,
      camera: this.camera,
      detection: this.detection,
      liveness: this.liveness,
      identity: this.identity,
      presence: this.presence,
      privacyPaused: this.privacyPaused,
      faceCount: this.faceCount,
      activeIdentityId: this.activeIdentityId,
      activeIdentityName: this.activeIdentityName,
      presenceSession: { ...this.presenceSession },
      unauthorizedReason: this.unauthorizedReason,
      timestamp: Date.now(),
    };
  }

  public isAuthorized(): boolean {
    return this.presence === 'PRESENCE_AUTHORIZED';
  }

  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[CanonicalStateMachine] Listener error:', err);
      }
    }
  }
}
