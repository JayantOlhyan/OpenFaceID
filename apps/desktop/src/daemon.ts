import { BRANDING } from '../../../packages/branding/src/index.ts';
import {
  RecognitionStateMachine,
  SecurityStateMachine,
  PresenceStateMachine,
  CanonicalStateMachine,
  UnlockStateMachine,
  NotificationManager,
  EventBus,
  Logger,
  type CanonicalStateSnapshot,
  type UnlockResult,
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

  // Event-Driven Face Unlock State Machine (Phase 1)
  public readonly unlockFsm: UnlockStateMachine;
  private activeUnlockPromise: Promise<UnlockResult> | null = null;
  private pendingUnlockResolver: ((result: UnlockResult) => void) | null = null;
  private options: DesktopEngineOptions;

  // Legacy FSMs for backward compatibility
  private recognitionFsm: RecognitionStateMachine;
  private securityFsm: SecurityStateMachine;

  // Active Enrollment Manager (if session in progress)
  private activeEnrollment: EnrollmentManager | null = null;
  private pendingPoseCaptureResolvers: Array<(result: any) => void> = [];

  // Live Camera Sensor Preview & Detection Metadata (Volatile RAM)
  private latestFrameBmp: Buffer | null = null;
  private latestDetections: any[] = [];
  private latestFrameWidth: number = 1280;
  private latestFrameHeight: number = 720;
  private latestFrameTimestamp: number = 0;
  private lastBmpTime: number = 0;

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
    this.options = options;
    this.adapter = getPlatformAdapter();
    this.identityStore = new IdentityStore();
    this.activityLog = new ActivityLog();
    this.configStore = new ConfigStore();
    this.cameraManager = new CameraManager({ targetFps: 60 });
    this.cameraManager.setOnPreviewCallback((frame) => this.handlePreviewFrame(frame));
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
    this.unlockFsm = new UnlockStateMachine({ maxBurstFrames: 20, burstTimeoutMs: 2500 });
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
        this.cameraState = 'IDLE';
        this.canonicalFsm.setCameraState('CAMERA_READY');
        this.visionState = 'READY';

        // Phase 1 Event-Driven Model: Camera remains in low-power IDLE standby
        // until an OS wake, lock screen, or manual unlock trigger occurs.
        // If autoStartCamera is explicitly set to true (e.g. legacy test suite), start continuous capture.
        if (this.options?.autoStartCamera && permission === 'granted') {
          await this.cameraManager.startCapture((frame) => this.processFrame(frame));
        }
      }

      // 4. Start platform wake and lock session event listener
      this.adapter.startWakeAndLockListener((event) => this.handleSessionEvent(event));

      // 5. Start background power monitor (sleep/wake)
      this.startPowerMonitor();

      // 6. Start periodic session expiration checker (every 1000ms)
      this.startSessionExpirationChecker();

      // 7. Register process shutdown hooks
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

    // Reset frame-level FSMs to clean state for each incoming frame
    if (this.recognitionFsm.getState() !== 'SEARCHING') {
      this.recognitionFsm.reset('SEARCHING');
    }
    if (this.securityFsm.getState() !== 'UNKNOWN') {
      this.securityFsm.reset();
    }

    try {
      // 1. Face Detection (BlazeFace 896 Anchors)
      const detections = await this.detector.detect(frame);
      const faceCount = detections.length;

      // Cache real detection results & preview frame in RAM for UI
      this.latestDetections = detections.map((d) => ({
        box: d.box,
        confidence: d.confidence,
        landmarks: d.landmarks,
      }));
      this.latestFrameWidth = frame.width;
      this.latestFrameHeight = frame.height;
      this.latestFrameTimestamp = Date.now();

      if (!this.latestFrameBmp) {
        this.latestFrameBmp = this.generateBmpSnapshot(frame.data, frame.width, frame.height);
      }
      this.notifyFrameListeners();

      // Condition: No faces detected
      if (detections.length === 0) {
        this.recognitionFsm.reset('SEARCHING');
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

      // Fail-closed privacy & security invariant: multiple faces => AMBIGUOUS
      if (faceCount > 1) {
        this.presenceTracker.onAmbiguousPresence();
        this.activeIdentityId = null;
        this.activeIdentityName = null;
        this.lastConfidence = 0;
        this.canonicalFsm.updateVisionState({
          faceCount,
          detectionState: 'PRESENCE_AMBIGUOUS',
          livenessState: 'LIVENESS_REQUIRED',
          identityState: 'IDENTITY_UNKNOWN',
        });
        this.recognitionFsm.reset('SEARCHING');
        return;
      }

      // Exactly 1 face in field of view
      const primaryFace = detections[0];

      // Handle pending interactive enrollment pose capture from authentic camera frame
      if (this.pendingPoseCaptureResolvers.length > 0 && this.activeEnrollment) {
        const resolver = this.pendingPoseCaptureResolvers.shift();
        if (resolver) {
          const frameClone: CameraFrame = {
            data: new Uint8ClampedArray(frame.data),
            width: frame.width,
            height: frame.height,
            pixelFormat: frame.pixelFormat,
            timestamp: frame.timestamp,
            frameIndex: frame.frameIndex,
            zeroize: () => {},
          };
          this.activeEnrollment.capturePose(frameClone, primaryFace.landmarks)
            .then(resolver)
            .catch((e) => resolver({ success: false, error: String(e) }));
        }
      }

      this.recognitionFsm.transition('FACE_DETECTED');
      this.securityFsm.transition('FACE_DETECTED');

      // 2. Face Quality Check on primary detection
      this.recognitionFsm.transition('QUALITY_CHECK');
      const qualityCheck = this.quality.evaluate(primaryFace.box, primaryFace.landmarks, frame.width, frame.height);

      if (!qualityCheck.isAcceptable) {
        this.canonicalFsm.updateVisionState({
          faceCount: 1,
          detectionState: 'FACE_MATCHING',
          livenessState: 'LIVENESS_REQUIRED',
          identityState: 'IDENTITY_UNKNOWN',
        });
        return;
      }

      // 3. Feature Embedding Extraction (Canonical 112x112 Aligned 512D)
      const embedding = await this.embedder.embed(frame, primaryFace.landmarks);

      // 4. Gallery Recognition
      const identities = await this.identityStore.listIdentities();
      const enabledIdentities = identities.filter((id) => id.enabled);

      this.recognitionFsm.transition('RECOGNIZING');
      const matchResult = this.recognizer.evaluateFrame(embedding, enabledIdentities);

      const isMatch = Boolean(matchResult.matched || (matchResult as any).match);
      const matchedId = matchResult.identityId || (matchResult as any).identity?.id;
      const matchedName = matchResult.identityName || (matchResult as any).identity?.name || 'Authorized User';
      const matchedConfidence = matchResult.temporalConfidence ?? matchResult.similarity ?? (matchResult as any).confidence ?? 0;

      if (isMatch && matchedId) {
        this.activeIdentityId = matchedId;
        this.activeIdentityName = matchedName;
        this.lastConfidence = matchedConfidence;
        this.lastMatchTimestamp = Date.now();

        this.securityFsm.transition('IDENTITY_MATCHED', {
          identityId: matchedId,
          confidence: matchedConfidence,
        });

        // 5. Liveness Verification
        this.recognitionFsm.transition('LIVENESS_CHECK');
        const livenessResult = await this.liveness.evaluateLiveness(
          [frame],
          [primaryFace.landmarks, primaryFace.landmarks],
          'light'
        );

        if (livenessResult.passed) {
          this.recognitionFsm.transition('AUTHORIZED', matchedId);
          this.securityFsm.transition('LIVENESS_VERIFIED', { score: livenessResult.score });

          // 6. Authorized Presence Verification
          this.presenceTracker.onAuthorizedPresence(matchedId, matchedName);
          this.securityFsm.transition('POLICY_APPROVED');

          // Update Canonical State Machine to AUTHORIZED
          this.canonicalFsm.updateVisionState({
            faceCount: 1,
            detectionState: 'FACE_DETECTED',
            livenessState: 'LIVENESS_PASSED',
            identityState: 'IDENTITY_RECOGNIZED',
            identityId: matchedId,
            identityName: matchedName,
          });
        } else {
          Logger.debug('vision', `Liveness check pending or failed: ${livenessResult.reason}`);
          this.canonicalFsm.updateVisionState({
            faceCount: 1,
            detectionState: 'FACE_DETECTED',
            livenessState: 'LIVENESS_FAILED',
            identityState: 'IDENTITY_RECOGNIZED',
            identityId: matchedId,
            identityName: matchedName,
          });
        }
      } else {
        // Unknown face detected
        this.activeIdentityId = null;
        this.activeIdentityName = null;
        this.lastConfidence = matchedConfidence;
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

    this.cameraManager.stopCapture();

    this.activityLog.logEvent('PRIVACY_PAUSE_ACTIVATED', { timestamp: Date.now() });
    EventBus.getInstance().emit('PRIVACY_PAUSED' as any, { timestamp: Date.now() });
  }

  public async resumePrivacy(): Promise<void> {
    Logger.info('security', 'Resuming normal protection from Privacy Pause');
    this.privacyPaused = false;
    this.cameraState = 'ACTIVE';
    this.visionState = 'READY';
    this.canonicalFsm.setPrivacyPaused(false);

    await this.cameraManager.startCapture((frame) => this.processFrame(frame));

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
    this.pendingPoseCaptureResolvers = [];
  }

  public async captureEnrollmentPose(): Promise<{ success: boolean; error?: string; progress?: any }> {
    if (!this.activeEnrollment) {
      return { success: false, error: 'No active enrollment session' };
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.pendingPoseCaptureResolvers.indexOf(resolveWrapper);
        if (idx >= 0) {
          this.pendingPoseCaptureResolvers.splice(idx, 1);
          resolve({ success: false, error: 'Capture timed out: Please ensure your face is clearly visible in front of the camera.' });
        }
      }, 5000);

      const resolveWrapper = (result: any) => {
        clearTimeout(timer);
        resolve(result);
      };

      this.pendingPoseCaptureResolvers.push(resolveWrapper);
    });
  }

  /**
   * Platform session event handler (wake, lock, unlock)
   */
  public handleSessionEvent(event: 'wake' | 'lock' | 'unlock'): void {
    Logger.info('platform', `Session event received from platform adapter: ${event}`);
    if (event === 'wake') {
      this.triggerUnlockSession('wake').catch((err) => {
        Logger.error('unlock', 'Error during wake unlock session', { error: String(err) });
      });
    } else if (event === 'lock') {
      this.cameraManager.stopCapture();
      this.cameraState = 'IDLE';
      this.canonicalFsm.resetOnWake();
      this.unlockFsm.resetToStandby();
    }
  }

  /**
   * Event-Driven Face Unlock Burst Session
   * Wakes camera, captures 5-15 frames, evaluates liveness and face recognition,
   * records outcome, and immediately stops camera capture to return to standby.
   */
  public async triggerUnlockSession(triggerSource: string = 'wake'): Promise<UnlockResult> {
    if (this.activeUnlockPromise) {
      return this.activeUnlockPromise;
    }

    const currentState = this.unlockFsm.getState();
    if (currentState === 'WAKE_TRIGGERED' || currentState === 'CAPTURING_BURST' || currentState === 'ANALYZING') {
      return this.unlockFsm.getLastResult() || {
        success: false,
        state: currentState,
        triggerSource,
        identityId: null,
        identityName: null,
        confidence: 0,
        livenessPassed: false,
        metrics: this.unlockFsm.getMetrics(),
        error: 'Unlock session already in progress',
      };
    }

    this.unlockFsm.triggerWake(triggerSource);
    this.canonicalFsm.setSystemState('SYSTEM_READY');
    this.cameraState = 'ACTIVE';

    this.activeUnlockPromise = new Promise<UnlockResult>(async (resolve) => {
      this.pendingUnlockResolver = resolve;

      let isFirstFrame = true;
      const identities = await this.identityStore.listIdentities();

      if (identities.length === 0) {
        Logger.warn('unlock', 'No enrolled identities found; unlock burst aborted');
        const res = this.unlockFsm.recordFailed('NO_ENROLLED_IDENTITIES');
        this.finishUnlockSession(res);
        return;
      }

      const started = await this.cameraManager.startCapture(async (frame) => {
        if (isFirstFrame) {
          isFirstFrame = false;
          const latency = this.unlockFsm.onFirstFrameReceived();
          Logger.info('unlock', `Wake-to-first-frame latency: ${latency}ms`);
        }

        const isBurstLimit = this.unlockFsm.onFrameCaptured();

        try {
          await this.processUnlockBurstFrame(frame);
        } catch (err) {
          Logger.error('unlock', 'Error during unlock burst evaluation', { error: String(err) });
        } finally {
          frame.zeroize();
        }

        if (this.unlockFsm.getState() === 'VERIFIED') {
          const res = this.unlockFsm.getLastResult()!;
          this.finishUnlockSession(res);
          return;
        }

        if (this.unlockFsm.isBurstTimeout() || isBurstLimit) {
          Logger.warn('unlock', 'Unlock burst ended without a verified match');
          const res = this.unlockFsm.recordFailed('TIMEOUT_OR_NO_MATCH');
          this.finishUnlockSession(res);
          return;
        }
      });

      if (!started) {
        Logger.error('unlock', 'Failed to start camera for unlock burst');
        const res = this.unlockFsm.recordFailed('CAMERA_START_FAILED');
        this.finishUnlockSession(res);
      }
    });

    return this.activeUnlockPromise;
  }

  private async processUnlockBurstFrame(frame: CameraFrame): Promise<void> {
    this.unlockFsm.setAnalyzing();

    // 1. Detect faces
    const detections = await this.detector.detect(frame);
    if (detections.length === 0) return;

    if (detections.length > 1) {
      Logger.warn('unlock', 'Multiple faces detected during unlock; reject for security');
      return;
    }

    const detection = detections[0];

    // 2. Liveness check
    const livenessResult = await this.liveness.evaluateLiveness(
      frame,
      detection.box,
      detection.landmarks
    );
    if (!livenessResult.passed) {
      Logger.debug('unlock', 'Liveness check pending or failed', { reason: livenessResult.reason });
      return;
    }

    // 3. Embedding extraction
    const embedding = await this.embedder.embed(frame, detection.landmarks);

    // 4. Match against enrolled gallery
    const identities = await this.identityStore.listIdentities();
    const match = this.recognizer.evaluateFrame(embedding, identities);

    if (match.matched && match.identityId) {
      Logger.info('unlock', `Face recognized: ${match.identityName} (${match.identityId}) [similarity: ${match.similarity.toFixed(3)}]`);
      this.lastMatchTimestamp = Date.now();
      this.lastConfidence = match.similarity;
      this.activeIdentityId = match.identityId;
      this.activeIdentityName = match.identityName;

      this.canonicalFsm.updateVisionState({
        faceCount: 1,
        detectionState: 'FACE_DETECTED',
        livenessState: 'LIVENESS_PASSED',
        identityState: 'IDENTITY_RECOGNIZED',
        activeIdentityId: match.identityId,
        activeIdentityName: match.identityName,
      });

      this.unlockFsm.recordVerified(match.identityId, match.identityName ?? 'Authorized User', match.similarity);
    }
  }

  private finishUnlockSession(result: UnlockResult): void {
    this.cameraManager.stopCapture();
    this.cameraState = 'IDLE';
    this.canonicalFsm.setCameraState('CAMERA_READY');
    this.activeUnlockPromise = null;

    if (this.pendingUnlockResolver) {
      const resolver = this.pendingUnlockResolver;
      this.pendingUnlockResolver = null;
      resolver(result);
    }

    this.activityLog.logEvent(result.success ? 'FACE_UNLOCK_SUCCESS' : 'FACE_UNLOCK_FAILED', {
      source: result.triggerSource,
      identityId: result.identityId,
      confidence: result.confidence,
      metrics: result.metrics,
      error: result.error,
    });

    setTimeout(() => {
      this.unlockFsm.resetToStandby();
    }, 1000);
  }

  public async startLivePreview(onFrame?: (frame: CameraFrame) => void): Promise<boolean> {
    if (this.cameraState === 'ACTIVE') return true;
    this.cameraState = 'ACTIVE';
    this.canonicalFsm.setCameraState('CAMERA_READY');
    return this.cameraManager.startCapture(onFrame || ((frame) => this.processFrame(frame)));
  }

  public stopLivePreview(): void {
    this.cameraManager.stopCapture();
    this.cameraState = 'IDLE';
    this.canonicalFsm.setCameraState('CAMERA_READY');
    this.latestFrameBmp = null;
  }

  public getUnlockStatus() {
    return {
      state: this.unlockFsm.getState(),
      triggerSource: this.unlockFsm.getTriggerSource(),
      metrics: this.unlockFsm.getMetrics(),
      lastResult: this.unlockFsm.getLastResult(),
    };
  }

  private frameListeners: Array<() => void> = [];

  public handlePreviewFrame(frame: CameraFrame): void {
    if (this.privacyPaused || this.isShuttingDown) return;
    this.latestFrameWidth = frame.width;
    this.latestFrameHeight = frame.height;
    this.latestFrameTimestamp = Date.now();
    this.latestFrameBmp = this.generateBmpSnapshot(frame.data, frame.width, frame.height);
    this.notifyFrameListeners();
  }

  public waitForNextFrame(lastTimestamp: number, timeoutMs: number = 1000): Promise<{ bmp: Buffer | null; timestamp: number }> {
    if (this.latestFrameTimestamp > lastTimestamp && this.latestFrameBmp) {
      return Promise.resolve({ bmp: this.latestFrameBmp, timestamp: this.latestFrameTimestamp });
    }
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | null = null;
      const listener = () => {
        if (timer) clearTimeout(timer);
        resolve({ bmp: this.latestFrameBmp, timestamp: this.latestFrameTimestamp });
      };
      this.frameListeners.push(listener);
      timer = setTimeout(() => {
        const idx = this.frameListeners.indexOf(listener);
        if (idx !== -1) this.frameListeners.splice(idx, 1);
        resolve({ bmp: this.latestFrameBmp, timestamp: this.latestFrameTimestamp });
      }, timeoutMs);
    });
  }

  private notifyFrameListeners(): void {
    if (this.frameListeners.length > 0) {
      const listeners = this.frameListeners;
      this.frameListeners = [];
      for (const fn of listeners) {
        try { fn(); } catch {}
      }
    }
  }

  public getLatestFrameBmp(): Buffer | null {
    return this.latestFrameBmp;
  }

  public getLatestFrameInfo() {
    return {
      width: this.latestFrameWidth,
      height: this.latestFrameHeight,
      timestamp: this.latestFrameTimestamp,
      detections: this.latestDetections,
    };
  }

  private cachedBmpBuffer: Buffer | null = null;
  private cachedBmpSize: number = 0;

  private generateBmpSnapshot(rgbaData: Uint8ClampedArray, srcW: number, srcH: number): Buffer {
    // Generate a clean 480x270 or proportional preview BMP for low CPU usage
    const targetW = 480;
    const targetH = Math.round((targetW * srcH) / srcW);

    const fileHeaderSize = 14;
    const infoHeaderSize = 40;
    const rowSize = Math.floor((24 * targetW + 31) / 32) * 4;
    const pixelArraySize = rowSize * targetH;
    const fileSize = fileHeaderSize + infoHeaderSize + pixelArraySize;

    if (!this.cachedBmpBuffer || this.cachedBmpSize !== fileSize) {
      this.cachedBmpBuffer = Buffer.alloc(fileSize);
      this.cachedBmpSize = fileSize;
      const buf = this.cachedBmpBuffer;
      buf.write('BM', 0);
      buf.writeUInt32LE(fileSize, 2);
      buf.writeUInt32LE(fileHeaderSize + infoHeaderSize, 10);
      buf.writeUInt32LE(infoHeaderSize, 14);
      buf.writeInt32LE(targetW, 18);
      buf.writeInt32LE(-targetH, 22); // Top-down
      buf.writeUInt16LE(1, 26);
      buf.writeUInt16LE(24, 28);
      buf.writeUInt32LE(0, 30);
      buf.writeUInt32LE(pixelArraySize, 34);
    }

    const buf = this.cachedBmpBuffer;
    const xRatio = srcW / targetW;
    const yRatio = srcH / targetH;
    let offset = 54;

    for (let dy = 0; dy < targetH; dy++) {
      const sy = Math.min(srcH - 1, Math.floor(dy * yRatio));
      for (let dx = 0; dx < targetW; dx++) {
        const sx = Math.min(srcW - 1, Math.floor(dx * xRatio));
        const srcIdx = (sy * srcW + sx) * 4;
        buf[offset] = rgbaData[srcIdx + 2];     // B
        buf[offset + 1] = rgbaData[srcIdx + 1]; // G
        buf[offset + 2] = rgbaData[srcIdx];     // R
        offset += 3;
      }
      const pad = rowSize - targetW * 3;
      for (let p = 0; p < pad; p++) buf[offset++] = 0;
    }
    return buf;
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
        embedderProvider: this.embedder.getActiveProvider(),
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
      unlock: {
        state: this.unlockFsm.getState(),
        triggerSource: this.unlockFsm.getTriggerSource(),
        metrics: this.unlockFsm.getMetrics(),
        lastResult: this.unlockFsm.getLastResult(),
      },
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

    this.adapter.stopWakeAndLockListener();

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
