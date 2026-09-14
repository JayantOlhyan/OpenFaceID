import type { PlatformInfo } from '../../../packages/platform/src/index.ts';
import type {
  RecognitionState,
  SecurityState,
  PresenceState,
  CanonicalStateSnapshot,
  PresenceSession,
  PresenceCoreState,
} from '../../../packages/core/src/index.ts';
import type { LivenessState } from '../../../packages/vision/src/index.ts';

export type CameraLifecycleState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'OPENING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'DISCONNECTED'
  | 'RECOVERING'
  | 'ERROR'
  | 'CLOSING';

export type VisionLifecycleState =
  | 'UNINITIALIZED'
  | 'LOADING_MODEL'
  | 'READY'
  | 'PROCESSING'
  | 'PAUSED'
  | 'ERROR'
  | 'SHUTDOWN';

export interface ApplicationState {
  version: string;
  codename: string;
  uptimeSeconds: number;
  platform: PlatformInfo;
  camera: {
    status: CameraLifecycleState;
    activeDeviceId: string | null;
    activeDeviceName: string | null;
    permission: 'granted' | 'denied' | 'prompt' | 'unsupported';
    fps: number;
    reconnectAttempts: number;
  };
  vision: {
    status: VisionLifecycleState;
    model: string;
    embedder: string;
    embedderProvider: string;
    faceDetected: boolean;
    landmarkCount: number;
  };
  recognition: {
    state: RecognitionState;
    activeIdentityId: string | null;
    activeIdentityName: string | null;
    lastConfidence: number;
    lastMatchTimestamp: number;
  };
  liveness: {
    state: LivenessState;
    mode: 'off' | 'light' | 'strong';
    score: number;
    blinkDetected: boolean;
    motionVariance: number;
    glareScore?: number;
    depthScore?: number;
    cueBreakdown?: {
      glare?: number;
      depth: number;
      motion: number;
      texture: number;
      blink: number;
    };
  };
  presence: {
    state: PresenceState;
    authorizedIdentity: string | null;
    elapsedAbsentMs: number;
    leaveTimeoutSec: number;
    gracePeriodSec: number;
    // Canonical Phase 5 extensions
    canonicalPresence: PresenceCoreState;
    isAuthorized: boolean;
    unauthorizedReason: string | null;
    session: PresenceSession;
  };
  security: {
    state: SecurityState;
    privacyPaused: boolean;
    screenLocked: boolean;
    systemIdleSeconds: number;
    cloudEgress: false;
    ramOnlyProcessing: true;
  };
  tray: {
    status: '● Active' | '○ Paused' | '⚠ Camera Unavailable' | '⏳ Loading Model' | '✕ Engine Error' | '⚠ Multiple Faces' | '✖ Unauthorized';
    indicator: string;
    tooltip: string;
  };
  storage: {
    enrolledIdentitiesCount: number;
    keystoreType: string;
  };
  canonicalState: CanonicalStateSnapshot;
  unlock: {
    state: string;
    triggerSource: string;
    metrics: {
      wakeTimestamp: number | null;
      firstFrameTimestamp: number | null;
      wakeToFirstFrameMs: number | null;
      verificationLatencyMs: number | null;
      totalDurationMs: number;
      framesCaptured: number;
    };
    lastResult: any;
  };
}
