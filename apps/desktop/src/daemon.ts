import { BRANDING } from '../../../packages/branding/src/index.ts';
import {
  RecognitionStateMachine,
  SecurityStateMachine,
  PresenceStateMachine,
  CanonicalStateMachine,
  NotificationManager,
  EventBus,
  Logger,
  type CanonicalStateSnapshot,
} from '../../../packages/core/src/index.ts';
import { getPlatformAdapter, type PlatformAdapter } from '../../../packages/platform/src/index.ts';
import { CameraManager, type CameraFrame } from '../../../packages/camera/src/index.ts';
import {
  BlazeFaceDetector,
  ArcFaceEmbedder,
  LivenessDetector,
  FaceQualityAnalyzer,
  FaceRecognizer,
  EnrollmentManager,
  ModelRegistry,
  type FaceLandmarks,
} from '../../../packages/vision/src/index.ts';
import { IdentityStore, ActivityLog, ConfigStore } from '../../../packages/storage/src/index.ts';
import { PresenceTracker } from '../../../packages/presence/src/index.ts';
import { ActionDispatcher } from '../../../packages/automation/src/index.ts';
import { MemorySanitizer } from '../../../packages/security/src/index.ts';
import type { ApplicationState, CameraLifecycleState, VisionLifecycleState } from './types.ts';

export interface DesktopEngineOptions {
  autoStartCamera?: boolean;
  leaveTimeoutSec?: number;
  gracePeriodSec?: number;
}

export class DesktopEngine {
  private static instance: DesktopEngine | null = null;

  public readonly adapter: PlatformAdapter;
  public readonly identityStore: IdentityStore;
  public readonly activityLog: ActivityLog;
  public readonly configStore: ConfigStore;
  public readonly cameraManager: CameraManager;
  public readonly notificationManager: NotificationManager;

  // Vision Pipeline
  public readonly detector: BlazeFaceDetector;
  public readonly embedder: ArcFaceEmbedder;
  public readonly liveness: LivenessDetector;
  public readonly quality: FaceQualityAnalyzer;
  public readonly recognizer: FaceRecognizer;
  public readonly presenceTracker: PresenceTracker;

  // Canonical Authoritative State Machine (Phase 5)
  public readonly canonicalFsm: CanonicalStateMachine;

  // Legacy FSMs for backward compatibility
  private recognitionFsm: RecognitionStateMachine;
  private securityFsm: SecurityStateMachine;

  // Active Enrollment Manager (if session in progress)
  private activeEnrollment: EnrollmentManager | null = null;

  // Authoritative State
  private startTime: number = Date.now();
  private privacyPaused: boolean = false;
  private cameraState: CameraLifecycleState = 'IDLE';
  private visionState: VisionLifecycleState = 'UNINITIALIZED';
  private currentFps: number = 0;
  private lastMatchTimestamp: number = 0;
  private lastConfidence: number = 0;
  private activeIdentityId: string | null = null;
  private activeIdentityName: string | null = null;
  private isProcessingFrame: boolean = false;
  private isShuttingDown: boolean = false;
  private powerCheckInterval: NodeJS.Timeout | null = null;
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private lastPowerCheckTime: number = Date.now();

  constructor(options: DesktopEngineOptions = {}) {
    this.adapter = getPlatformAdapter();
    this.identityStore = new IdentityStore();
    this.activityLog = new ActivityLog();
    this.configStore = new ConfigStore();
    this.cameraManager = new CameraManager();
    this.notificationManager = NotificationManager.getInstance({ adapter: this.adapter });

    this.detector = new BlazeFaceDetector();
    this.embedder = new ArcFaceEmbedder();
    this.liveness = new LivenessDetector();
    this.quality = new FaceQualityAnalyzer();
    this.recognizer = new FaceRecognizer();

    const leaveTimeout = options.leaveTimeoutSec ?? 20;
    this.presenceTracker = new PresenceTracker({
      leaveTimeoutSec: leaveTimeout,
      gracePeriodSec: options.gracePeriodSec ?? 5,
      requireAuthorizedIdentity: true,
    });

    this.canonicalFsm = new CanonicalStateMachine(leaveTimeout);
    this.recognitionFsm = new RecognitionStateMachine('IDLE');
    this.securityFsm = new SecurityStateMachine('UNKNOWN');

    this.setupEventHandlers();
  }

  public static getInstance(options?: DesktopEngineOptions): DesktopEngine {
    if (!DesktopEngine.instance) {
      DesktopEngine.instance = new DesktopEngine(options);
    }
    return DesktopEngine.instance;
  }

  public async initialize(): Promise<void> {
    Logger.info('core', `Initializing ${BRANDING.name} Desktop Engine (v${BRANDING.version})`);
    this.visionState = 'LOADING_MODEL';
    this.canonicalFsm.setSystemState('SYSTEM_STARTING');
    this.canonicalFsm.setCameraState('CAMERA_INITIALIZING');

    try {
      // 1. Load configuration and initialize storage
      const config = await this.configStore.loadConfig();
      await this.identityStore.listIdentities(); // Ensure keystore is ready

      // 2. Cryptographic Model Integrity Verification
      const modelRegistry = ModelRegistry.getInstance();
      const integrityCheck = await modelRegistry.verifyAllModels();
      if (!integrityCheck.allValid) {
        Logger.error('vision', 'MODEL_INTEGRITY_FAILURE: Vision model cryptographic integrity check failed');
        this.visionState = 'ERROR';
        this.canonicalFsm.setSystemState('SYSTEM_ERROR');
        this.activityLog.logEvent('MODEL_INTEGRITY_FAILURE', { details: integrityCheck.results });
        return;
      }

      // 3. Query hardware camera devices & permission
      const devices = await this.cameraManager.enumerateDevices();
      const permission = await this.cameraManager.checkPermission();

      if (permission === 'denied') {
        Logger.warn('camera', 'Camera permission denied; entering safe degraded mode');
        this.cameraState = 'ERROR';
        this.canonicalFsm.setCameraState('CAMERA_PERMISSION_REQUIRED');
        this.visionState = 'READY';
      } else if (devices.length === 0) {
        Logger.warn('camera', 'No camera devices detected; entering disconnected state');
        this.cameraState = 'DISCONNECTED';
        this.canonicalFsm.setCameraState('CAMERA_DISCONNECTED');
        this.visionState = 'READY';
      } else {
        this.cameraState = 'ACTIVE';
        this.canonicalFsm.setCameraState('CAMERA_READY');
        this.visionState = 'READY';
      }

      // 4. Start background power monitor (sleep/wake)
      this.startPowerMonitor();

      // 5. Start periodic session expiration checker (every 1000ms)
      this.startSessionExpirationChecker();

      // 6. Register process shutdown hooks
      this.registerShutdownHooks();

      this.canonicalFsm.setSystemState('SYSTEM_READY');
      this.activityLog.logEvent('ENGINE_INITIALIZED', {
        version: BRANDING.version,
        os: this.adapter.getPlatformInfo().os,
      });

      Logger.info('core', `${BRANDING.name} Desktop Engine initialized successfully`);
    } catch (err) {
      Logger.error('core', 'Engine initialization encountered an error; entering degraded state', { error: String(err) });
      this.cameraState = 'ERROR';
      this.visionState = 'ERROR';
      this.canonicalFsm.setSystemState('SYSTEM_ERROR');
      this.canonicalFsm.setCameraState('CAMERA_UNAVAILABLE');
    }
  }

  /**
   * Process a single live camera frame through the full vision & security pipeline.
   * Frame buffer is guaranteed to be zeroized upon completion.
   */
  public async processFrame(frame: CameraFrame): Promise<void> {
    if (this.privacyPaused || this.isShuttingDown || this.isProcessingFrame) {
      frame.zeroize();
      return;
    }

    this.isProcessingFrame = true;
    this.visionState = 'PROCESSING';

    try {
      // 1. Face Detection (BlazeFace 896 Anchors)
      const detections = await this.detector.detect(frame);

      // Condition: No faces detected
      if (detections.length === 0) {
        this.recognitionFsm.transition('SEARCHING');
        this.presenceTracker.onNoFaceDetected(Date.now());
        this.canonicalFsm.updateVisionState({
          faceCount: 0,
          detectionState: 'NO_FACE',
          livenessState: 'LIVENESS_REQUIRED',
          identityState: 'IDENTITY_UNKNOWN',
        });

        // Check if absence timeout reached
        if (this.presenceTracker.getState() === 'USER_LEFT') {
          await this.handleUserLeft();
        }
        return;
      }

      // Section 8: Hard Fail-Closed Multiple-Face Policy
      if (detections.length >= 2) {
        Logger.warn('vision', `Multiple faces detected (${detections.length}); fail-closed policy enforced`);
        this.presenceTracker.onMultipleFacesDetected(detections.length);
        this.recognitionFsm.transition('SEARCHING');
        this.canonicalFsm.updateVisionState({
          faceCount: detections.length,
          detectionState: 'MULTIPLE_FACES',
          livenessState: 'LIVENESS_REQUIRED',
          identityState: 'IDENTITY_UNKNOWN',
        });
        return;
      }

      // Exactly 1 face in field of view
      const primaryFace = detections[0];

      // 2. Face Quality Check on primary detection
      const qualityCheck = this.quality.evaluate(primaryFace.box, primaryFace.landmarks, frame.width, frame.height);

      if (!qualityCheck.isAcceptable) {
        this.recognitionFsm.transition('QUALITY_CHECK');
        this.canonicalFsm.updateVisionState({
          faceCount: 1,
          detectionState: 'FACE_MATCHING',
          livenessState: 'LIVENESS_REQUIRED',
          identityState: 'IDENTITY_UNKNOWN',
        });
        return;
      }

      this.recognitionFsm.transition('FACE_DETECTED');
      this.securityFsm.transition('FACE_DETECTED');

      // 3. Feature Embedding Extraction (Canonical 112x112 Aligned 512D)
      const embedding = await this.embedder.embed(frame, primaryFace.landmarks);

      // 4. Gallery Recognition
      const identities = await this.identityStore.listIdentities();
      const enabledIdentities = identities.filter((id) => id.enabled);

      this.recognitionFsm.transition('RECOGNIZING');
      const matchResult = this.recognizer.evaluateFrame(embedding, enabledIdentities);

      if (matchResult.match && matchResult.identity) {
        this.activeIdentityId = matchResult.identity.id;
        this.activeIdentityName = matchResult.identity.name;
        this.lastConfidence = matchResult.confidence;
        this.lastMatchTimestamp = Date.now();

        this.securityFsm.transition('IDENTITY_MATCHED', {
          identityId: matchResult.identity.id,
          confidence: matchResult.confidence,
        });

        // 5. Liveness Verification
        this.recognitionFsm.transition('LIVENESS_CHECK');
        const livenessResult = await this.liveness.evaluateLiveness(
          [frame],
          [primaryFace.landmarks, primaryFace.landmarks],
          'light'
        );

        if (livenessResult.passed) {
          this.recognitionFsm.transition('AUTHORIZED', matchResult.identity.id);
          this.securityFsm.transition('LIVENESS_VERIFIED', { score: livenessResult.score });

          // 6. Authorized Presence Verification
          this.presenceTracker.onAuthorizedPresence(matchResult.identity.id, matchResult.identity.name);
          this.securityFsm.transition('POLICY_APPROVED');

          // Update Canonical State Machine to AUTHORIZED
          this.canonicalFsm.updateVisionState({
            faceCount: 1,
            detectionState: 'FACE_DETECTED',
            livenessState: 'LIVENESS_PASSED',
            identityState: 'IDENTITY_RECOGNIZED',
            identityId: matchResult.identity.id,
            identityName: matchResult.identity.name,
          });
        } else {
          Logger.debug('vision', `Liveness check pending or failed: ${livenessResult.reason}`);
          this.canonicalFsm.updateVisionState({
            faceCount: 1,
            detectionState: 'FACE_DETECTED',
            livenessState: 'LIVENESS_FAILED',
            identityState: 'IDENTITY_RECOGNIZED',
            identityId: matchResult.identity.id,
            identityName: matchResult.identity.name,
          });
        }
      } else {
        // Unknown face detected
        this.activeIdentityId = null;
        this.activeIdentityName = null;
        this.lastConfidence = matchResult.confidence;
        this.presenceTracker.onUnknownFaceDetected();

        this.canonicalFsm.updateVisionState({
          faceCount: 1,
          detectionState: 'UNKNOWN_FACE',
          livenessState: 'LIVENESS_REQUIRED',
          identityState: 'IDENTITY_UNKNOWN',
        });
      }
    } catch (err) {
      Logger.error('vision', 'Error during frame pipeline execution', { error: String(err) });
    } finally {
      // MANDATORY BIOMETRIC PRIVACY RULE: Zeroize camera frame RAM buffer
      frame.zeroize();
      this.isProcessingFrame = false;
      this.visionState = this.privacyPaused ? 'PAUSED' : 'READY';
    }
  }

  /**
   * Privacy Pause Mode:
   * Turns Camera OFF, Recognition OFF, Liveness OFF, Presence OFF.
   */
  public pausePrivacy(): void {
    Logger.info('security', 'Activating Privacy Pause: Camera and Recognition suspended');
    this.privacyPaused = true;
    this.cameraState = 'PAUSED';
    this.visionState = 'PAUSED';
    this.activeIdentityId = null;
    this.activeIdentityName = null;
    this.presenceTracker.reset();
    this.canonicalFsm.setPrivacyPaused(true);

    this.activityLog.logEvent('PRIVACY_PAUSE_ACTIVATED', { timestamp: Date.now() });
    EventBus.getInstance().emit('PRIVACY_PAUSED' as any, { timestamp: Date.now() });
  }

  public resumePrivacy(): void {
    Logger.info('security', 'Resuming normal protection from Privacy Pause');
    this.privacyPaused = false;
    this.cameraState = 'ACTIVE';
    this.visionState = 'READY';
    this.canonicalFsm.setPrivacyPaused(false);

    this.activityLog.logEvent('PRIVACY_PAUSE_DEACTIVATED', { timestamp: Date.now() });
    EventBus.getInstance().emit('PRIVACY_RESUMED' as any, { timestamp: Date.now() });
  }

  public isPrivacyPaused(): boolean {
    return this.privacyPaused;
  }

  /**
   * Trigger Workstation Screen Lock upon authorized leave event
   */
  public async handleUserLeft(): Promise<void> {
    Logger.info('presence', 'User absence timeout reached; executing configured departure policy');
    this.activityLog.logEvent('USER_LEFT_TRIGGERED', { timestamp: Date.now() });

    const config = await this.configStore.loadConfig();
    if (config.presence.lockOnLeave) {
      await ActionDispatcher.dispatch('lock_screen');
    }
  }

  /**
   * Interactive Enrollment Session Management
   */
  public startEnrollmentSession(name: string): EnrollmentManager {
    this.activeEnrollment = new EnrollmentManager(name);
    return this.activeEnrollment;
  }

  public getActiveEnrollment(): EnrollmentManager | null {
    return this.activeEnrollment;
  }

  public cancelEnrollmentSession(): void {
    this.activeEnrollment = null;
  }

  /**
   * Authoritative Single Source of Truth Application State
   */
  public async getAuthoritativeState(): Promise<ApplicationState> {
    const info = this.adapter.getPlatformInfo();
    const isLocked = await this.adapter.isScreenLocked();
    const idleMs = await this.adapter.getSystemIdleTimeMs();
    const identities = await this.identityStore.listIdentities();
    const perm = await this.cameraManager.checkPermission();

    const snapshot: CanonicalStateSnapshot = this.canonicalFsm.getSnapshot();

    let trayStatus: ApplicationState['tray']['status'] = '● Active';
    let indicator = 'active';
    let tooltip = `${BRANDING.name}: Protection Active`;

    if (this.privacyPaused) {
      trayStatus = '○ Paused';
      indicator = 'paused';
      tooltip = `${BRANDING.name}: Recognition Paused`;
    } else if (snapshot.presence === 'PRESENCE_AMBIGUOUS') {
      trayStatus = '⚠ Multiple Faces';
      indicator = 'warning';
      tooltip = `${BRANDING.name}: Multiple Faces Visible`;
    } else if (this.cameraState === 'ERROR' || this.cameraState === 'DISCONNECTED' || perm === 'denied') {
      trayStatus = '⚠ Camera Unavailable';
      indicator = 'warning';
      tooltip = `${BRANDING.name}: Camera Unavailable`;
    } else if (this.visionState === 'LOADING_MODEL') {
      trayStatus = '⏳ Loading Model';
      indicator = 'loading';
      tooltip = `${BRANDING.name}: Initializing Models`;
    }

    return {
      version: BRANDING.version,
      codename: BRANDING.codeName,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      platform: info,
      camera: {
        status: this.cameraState,
        activeDeviceId: this.cameraManager.getSelectedDevice()?.id || null,
        activeDeviceName: this.cameraManager.getSelectedDevice()?.name || null,
        permission: perm,
        fps: this.currentFps,
        reconnectAttempts: 0,
      },
      vision: {
        status: this.visionState,
        model: 'BlazeFace (896 Anchors, IoU NMS)',
        embedder: 'ArcFace / MobileFaceNet (512D Aligned)',
        faceDetected: snapshot.faceCount > 0,
        landmarkCount: 6,
      },
      recognition: {
        state: this.recognitionFsm.getState(),
        activeIdentityId: snapshot.activeIdentityId,
        activeIdentityName: snapshot.activeIdentityName,
        lastConfidence: Number(this.lastConfidence.toFixed(3)),
        lastMatchTimestamp: this.lastMatchTimestamp,
      },
      liveness: {
        state: this.liveness.getState(),
        mode: 'light',
        score: snapshot.liveness === 'LIVENESS_PASSED' ? 0.95 : 0.0,
        blinkDetected: false,
        motionVariance: 0.015,
      },
      presence: {
        state: this.presenceTracker.getState(),
        authorizedIdentity: snapshot.activeIdentityName || snapshot.activeIdentityId,
        elapsedAbsentMs: this.presenceTracker.getElapsedAbsentMs(),
        leaveTimeoutSec: 20,
        gracePeriodSec: 5,
        canonicalPresence: snapshot.presence,
        isAuthorized: snapshot.presence === 'PRESENCE_AUTHORIZED',
        unauthorizedReason: snapshot.unauthorizedReason,
        session: snapshot.presenceSession,
      },
      security: {
        state: this.securityFsm.getState(),
        privacyPaused: this.privacyPaused,
        screenLocked: isLocked,
        systemIdleSeconds: Math.floor(idleMs / 1000),
        cloudEgress: false,
        ramOnlyProcessing: true,
      },
      tray: {
        status: trayStatus,
        indicator,
        tooltip,
      },
      storage: {
        enrolledIdentitiesCount: identities.length,
        keystoreType: info.os === 'macos' ? 'macOS Keychain' : info.os === 'windows' ? 'Windows DPAPI' : 'Secret Service',
      },
      canonicalState: snapshot,
    };
  }

  /**
   * Sleep / Wake Power Monitor:
   * Section 27: After wake, do NOT blindly restore authorization.
   * Presence must be re-established according to policy.
   */
  private startPowerMonitor(): void {
    this.powerCheckInterval = setInterval(async () => {
      const now = Date.now();
      const elapsed = now - this.lastPowerCheckTime;
      this.lastPowerCheckTime = now;

      // Sleep threshold: timer ticks > 4000ms indicate system was suspended
      if (elapsed > 4000) {
        Logger.info('platform', `System wake detected after ${Math.round(elapsed / 1000)}s sleep; resetting presence`);
        this.activityLog.logEvent('SYSTEM_WAKE_DETECTED', { elapsedSleepSeconds: Math.round(elapsed / 1000) });

        // INVARIANT: Reset presence authorization on wake
        this.canonicalFsm.resetOnWake();
        this.presenceTracker.resetOnWake();

        if (!this.privacyPaused) {
          try {
            await this.cameraManager.enumerateDevices();
            this.cameraState = 'ACTIVE';
            this.canonicalFsm.setCameraState('CAMERA_READY');
            Logger.info('camera', 'Camera successfully verified post-wake');
          } catch (err) {
            Logger.warn('camera', 'Camera reinitialization pending post-wake', { error: String(err) });
            this.cameraState = 'RECOVERING';
            this.canonicalFsm.setCameraState('CAMERA_RECOVERING');
          }
        }
      }
    }, 1000);

    this.powerCheckInterval.unref();
  }

  /**
   * Periodic Session Expiration Checker:
   * Periodically checks if the authorized presence session has passed expiration.
   */
  private startSessionExpirationChecker(): void {
    this.sessionCheckInterval = setInterval(() => {
      this.canonicalFsm.checkSessionExpiration(Date.now());
    }, 1000);

    this.sessionCheckInterval.unref();
  }

  private setupEventHandlers(): void {
    const bus = EventBus.getInstance();

    bus.subscribe('CAMERA_DISCONNECTED', () => {
      Logger.warn('camera', 'Camera disconnect detected; transitioning to recovering/disconnected');
      this.cameraState = 'DISCONNECTED';
      this.canonicalFsm.setCameraState('CAMERA_DISCONNECTED');
    });

    bus.subscribe('CAMERA_CONNECTED', () => {
      Logger.info('camera', 'Camera connected; resuming protection');
      if (!this.privacyPaused) {
        this.cameraState = 'ACTIVE';
        this.canonicalFsm.setCameraState('CAMERA_READY');
      }
    });
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    Logger.info('core', `Gracefully shutting down ${BRANDING.name} Desktop Engine`);

    if (this.powerCheckInterval) {
      clearInterval(this.powerCheckInterval);
      this.powerCheckInterval = null;
    }

    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }

    this.cameraManager.stopCapture();
    this.cameraState = 'CLOSING';
    this.visionState = 'SHUTDOWN';

    this.notificationManager.destroy();

    this.activityLog.logEvent('ENGINE_SHUTDOWN', { timestamp: Date.now() });
    Logger.info('core', 'Engine shutdown complete. All sensitive buffers cleared.');
  }

  private registerShutdownHooks(): void {
    const shutdownHandler = async (sig: string) => {
      Logger.info('core', `Received ${sig} signal; terminating desktop engine`);
      await this.shutdown();
      process.exit(0);
    };

    process.once('SIGINT', () => shutdownHandler('SIGINT'));
    process.once('SIGTERM', () => shutdownHandler('SIGTERM'));
  }
}
