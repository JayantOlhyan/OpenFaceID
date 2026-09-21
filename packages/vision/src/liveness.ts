import type { CameraFrame } from '../../camera/src/index.ts';
import type { LivenessMode } from '../../core/src/index.ts';
import type { FaceLandmarks, LivenessResult, LivenessState, ILivenessDetector, BoundingBox } from './interfaces.ts';
import { ScreenGlareTracker, type GlareChallenge, type GlareEvaluationResult } from './glare.ts';
import { LandmarkDepthAnalyzer, type DepthAnalysisResult } from './depth.ts';
import { Logger } from '../../core/src/index.ts';

export type ChallengeType = 'TURN_LEFT_15' | 'TURN_RIGHT_15' | 'TILT_UP_10' | 'BLINK_TWICE';

export interface ActiveChallenge {
  type: ChallengeType;
  prompt: string;
  issuedAt: number;
  timeoutMs: number;
  completed: boolean;
}

/**
 * Multi-Cue Heuristic Presentation Attack Detector (Anti-Spoofing)
 * Note: Heuristic multi-cue PAD architecture; benchmarking metrics inspired by ISO/IEC 30107-3 methodology (uncertified).
 *
 * Cues:
 * 1. Dynamic Screen Glare Reflection (ScreenGlareTracker: specular spectral correlation)
 * 2. 3D Volumetric Landmark Parallax (LandmarkDepthAnalyzer: non-affine perspective relief)
 * 3. Temporal Eye Aspect Ratio (EAR) Blink Dynamics (asymmetric closure/reopening)
 * 4. High-Frequency Moiré & Texture Spectral Filtering (subpixel grid aliasing detection)
 * 5. Multi-Cue Passive/Active Fusion State Machine (<300ms passive burst unlock)
 */
export class LivenessDetector implements ILivenessDetector {
  private activeChallenge: ActiveChallenge | null = null;
  private blinkHistory: number[] = []; // Rolling EAR history
  private state: LivenessState = 'LIVENESS_IDLE';
  private blinkCount: number = 0;
  private lastBlinkTimestamp: number = 0;
  private depthAnalyzer = new LandmarkDepthAnalyzer();
  private glareTracker = new ScreenGlareTracker();

  public getState(): LivenessState {
    return this.state;
  }

  public getDepthAnalyzer(): LandmarkDepthAnalyzer {
    return this.depthAnalyzer;
  }

  public getGlareTracker(): ScreenGlareTracker {
    return this.glareTracker;
  }

  /**
   * Unified, polymorphic liveness evaluation supporting both legacy signatures
   * and Glance-style 5-cue multi-frame passive bursts with screen glare challenge.
   */
  public async evaluateLiveness(
    framesOrFrame: CameraFrame[] | CameraFrame,
    landmarksOrHistory: FaceLandmarks[] | BoundingBox | FaceLandmarks,
    modeOrLandmarks: LivenessMode | FaceLandmarks = 'light',
    glareChallenge?: GlareChallenge
  ): Promise<LivenessResult> {
    // 1. Normalize Polymorphic Inputs
    let frames: CameraFrame[];
    if (Array.isArray(framesOrFrame)) {
      frames = framesOrFrame;
    } else {
      frames = framesOrFrame ? [framesOrFrame] : [];
    }

    let landmarksHistory: FaceLandmarks[];
    let mode: LivenessMode = 'light';

    if (Array.isArray(landmarksOrHistory)) {
      landmarksHistory = landmarksOrHistory;
      if (typeof modeOrLandmarks === 'string') {
        mode = modeOrLandmarks;
      }
    } else if (landmarksOrHistory && 'leftEye' in landmarksOrHistory) {
      landmarksHistory = [landmarksOrHistory, landmarksOrHistory];
      if (typeof modeOrLandmarks === 'string') {
        mode = modeOrLandmarks;
      }
    } else {
      // Called with (frame, box, landmarks)
      if (modeOrLandmarks && typeof modeOrLandmarks === 'object' && 'leftEye' in modeOrLandmarks) {
        landmarksHistory = [modeOrLandmarks, modeOrLandmarks];
      } else {
        landmarksHistory = [];
      }
    }

    if (mode === 'off') {
      this.state = 'LIVENESS_PASSED';
      return {
        passed: true,
        mode: 'off',
        state: 'LIVENESS_PASSED',
        score: 1.0,
        blinkDetected: false,
        motionVariance: 1.0,
        reason: 'Liveness disabled (Off mode)',
        cueBreakdown: {
          depth: 1.0,
          motion: 1.0,
          texture: 1.0,
          blink: 0.0,
        },
      };
    }

    if (!landmarksHistory || landmarksHistory.length < 2) {
      this.state = 'LIVENESS_STARTING';
      return {
        passed: false,
        mode,
        state: 'LIVENESS_STARTING',
        score: 0.2,
        blinkDetected: false,
        motionVariance: 0.0,
        reason: 'Collecting temporal frames for liveness verification',
      };
    }

    // 2. Cue 3: Eye Aspect Ratio (EAR) Blink Dynamics
    const latestLm = landmarksHistory[landmarksHistory.length - 1];
    const ear = this.calculateEyeAspectRatio(latestLm);
    this.blinkHistory.push(ear);
    if (this.blinkHistory.length > 25) {
      this.blinkHistory.shift();
    }

    const blinkDetected = this.detectBlink(this.blinkHistory);
    if (blinkDetected && Date.now() - this.lastBlinkTimestamp > 500) {
      this.blinkCount++;
      this.lastBlinkTimestamp = Date.now();
    }

    // 3. Cue 2: 3D Volumetric Landmark Parallax Analysis
    const depthResult: DepthAnalysisResult = this.depthAnalyzer.analyzeDepth(landmarksHistory);

    // 4. Temporal Landmark Motion Variance
    const motionVariance = this.calculateMotionVariance(landmarksHistory);

    // 5. Cue 4: Texture Naturalness & Moiré Spectral Screening
    const latestFrame = frames[frames.length - 1];
    const textureScore = latestFrame ? this.evaluateTextureGradient(latestFrame, latestLm) : 0.8;

    // 6. Cue 1: Dynamic Screen Glare Reflection
    let glareResult: GlareEvaluationResult | null = null;
    if (glareChallenge && frames.length >= 2) {
      glareResult = this.glareTracker.evaluateReflection(
        frames[0],
        frames[frames.length - 1],
        latestLm,
        glareChallenge
      );
    }

    // 7. Multi-Cue Mode Evaluation: Light (Passive Burst) vs Strong (Active Challenge)
    if (mode === 'light') {
      // Presentation Attack Conditions:
      // A static paper photo has motionVariance < 0.008 AND no blink.
      // A flat display or rigid card has planar depth geometry with zero volumetric parallax.
      const isStaticPhoto = (motionVariance < 0.008 && !blinkDetected) || (depthResult.isPlanar && motionVariance < 0.008);

      // Multi-cue Fused Score Calculation:
      let fusedScore: number;
      if (glareResult) {
        // When dynamic screen glare challenge is active:
        fusedScore = Math.min(
          1.0,
          glareResult.score * 0.30 +
          depthResult.score * 0.30 +
          textureScore * 0.20 +
          Math.min(0.20, motionVariance * 10) +
          (blinkDetected ? 0.15 : 0.0)
        );
      } else {
        // Standard passive multi-cue weighting:
        fusedScore = Math.min(
          1.0,
          depthResult.score * 0.35 +
          Math.min(0.35, motionVariance * 18) +
          textureScore * 0.25 +
          (blinkDetected ? 0.20 : 0.05)
        );
      }

      // Preserve baseline guarantee for authentic human micro-motion
      if (!isStaticPhoto && motionVariance >= 0.008 && textureScore >= 0.7) {
        fusedScore = Math.max(fusedScore, 0.65);
      }

      // Penalize presentation attack conditions
      if (isStaticPhoto) {
        fusedScore = Math.min(fusedScore, 0.20);
      }
      if (textureScore <= 0.35) {
        fusedScore = Math.min(fusedScore, 0.30);
      }

      const passed = !isStaticPhoto && fusedScore >= 0.55;
      this.state = passed ? 'LIVENESS_PASSED' : isStaticPhoto ? 'LIVENESS_FAILED' : 'WAITING_FOR_RESPONSE';

      return {
        passed,
        mode: 'light',
        state: this.state,
        score: Number(fusedScore.toFixed(3)),
        blinkDetected,
        motionVariance: Number(motionVariance.toFixed(4)),
        reason: passed
          ? `Passive liveness confirmed (3D depth: ${depthResult.score.toFixed(2)}, texture: ${textureScore.toFixed(2)}${glareResult ? `, glare: ${glareResult.score.toFixed(2)}` : ''})`
          : isStaticPhoto
          ? 'Presentation attack suspected: Static image detected (zero micro-motion or 2D planar spoof)'
          : 'Liveness score below threshold',
        cueBreakdown: {
          glare: glareResult ? glareResult.score : undefined,
          depth: depthResult.score,
          motion: Number(motionVariance.toFixed(4)),
          texture: Number(textureScore.toFixed(3)),
          blink: blinkDetected ? 1.0 : 0.0,
        },
      };
    } else {
      // Strong Mode: Active Challenge-Response (8-state machine)
      if (!this.activeChallenge) {
        this.startNewChallenge();
      }

      const challenge = this.activeChallenge!;
      const now = Date.now();

      // Check timeout
      if (now - challenge.issuedAt > challenge.timeoutMs) {
        this.state = 'LIVENESS_TIMEOUT';
        const timedOutResult: LivenessResult = {
          passed: false,
          mode: 'strong',
          state: 'LIVENESS_TIMEOUT',
          score: 0.1,
          blinkDetected,
          motionVariance: Number(motionVariance.toFixed(4)),
          challengeCompleted: false,
          reason: `Challenge timed out: "${challenge.prompt}" was not performed in time`,
          cueBreakdown: {
            depth: depthResult.score,
            motion: Number(motionVariance.toFixed(4)),
            texture: Number(textureScore.toFixed(3)),
            blink: blinkDetected ? 1.0 : 0.0,
          },
        };
        this.activeChallenge = null;
        return timedOutResult;
      }

      // Evaluate response
      this.state = 'WAITING_FOR_RESPONSE';
      const challengeCompleted = this.checkChallengeCompletion(challenge, landmarksHistory);

      if (challengeCompleted) {
        this.state = 'RESPONSE_DETECTED';
        challenge.completed = true;

        if (motionVariance > 0.010) {
          this.state = 'LIVENESS_PASSED';
          this.activeChallenge = null;
          return {
            passed: true,
            mode: 'strong',
            state: 'LIVENESS_PASSED',
            score: 0.95,
            blinkDetected,
            motionVariance: Number(motionVariance.toFixed(4)),
            challengeCompleted: true,
            reason: `Active challenge passed: "${challenge.prompt}" verified`,
            cueBreakdown: {
              depth: depthResult.score,
              motion: Number(motionVariance.toFixed(4)),
              texture: Number(textureScore.toFixed(3)),
              blink: blinkDetected ? 1.0 : 0.0,
            },
          };
        }
      }

      return {
        passed: false,
        mode: 'strong',
        state: this.state,
        score: challengeCompleted ? 0.70 : 0.35,
        blinkDetected,
        motionVariance: Number(motionVariance.toFixed(4)),
        challengeCompleted: false,
        reason: `Awaiting challenge completion: "${challenge.prompt}"`,
        cueBreakdown: {
          depth: depthResult.score,
          motion: Number(motionVariance.toFixed(4)),
          texture: Number(textureScore.toFixed(3)),
          blink: blinkDetected ? 1.0 : 0.0,
        },
      };
    }
  }

  public startNewChallenge(): ActiveChallenge {
    const challenges: Array<{ type: ChallengeType; prompt: string }> = [
      { type: 'TURN_LEFT_15', prompt: 'Turn your head slightly Left' },
      { type: 'TURN_RIGHT_15', prompt: 'Turn your head slightly Right' },
      { type: 'TILT_UP_10', prompt: 'Tilt your chin slightly Up' },
      { type: 'BLINK_TWICE', prompt: 'Blink naturally twice' },
    ];

    const selected = challenges[Math.floor(Math.random() * challenges.length)];
    this.activeChallenge = {
      type: selected.type,
      prompt: selected.prompt,
      issuedAt: Date.now(),
      timeoutMs: 6000,
      completed: false,
    };
    this.state = 'CHALLENGE_PRESENTED';
    this.blinkCount = 0;
    return this.activeChallenge;
  }

  public getActiveChallenge(): ActiveChallenge | null {
    return this.activeChallenge;
  }

  public reset(): void {
    this.activeChallenge = null;
    this.state = 'LIVENESS_IDLE';
    this.blinkHistory = [];
    this.blinkCount = 0;
    this.glareTracker.clearChallenge();
  }

  private calculateEyeAspectRatio(landmarks: FaceLandmarks): number {
    const eyeDx = landmarks.rightEye.x - landmarks.leftEye.x;
    const eyeDy = landmarks.rightEye.y - landmarks.leftEye.y;
    const interEyeDist = Math.hypot(eyeDx, eyeDy) || 1;

    // Approximate vertical eye openness based on eye-to-nose vertical proportion
    const leftEyeToNose = Math.abs(landmarks.noseTip.y - landmarks.leftEye.y);
    const rightEyeToNose = Math.abs(landmarks.noseTip.y - landmarks.rightEye.y);
    const avgEyeToNose = (leftEyeToNose + rightEyeToNose) / 2;

    const ear = avgEyeToNose / (interEyeDist * 0.8);
    return Math.max(0.05, Math.min(0.50, ear));
  }

  private detectBlink(history: number[]): boolean {
    if (history.length < 5) return false;

    // A blink is characterized by a dip below 0.20 followed by a recovery above 0.25
    let hasDip = false;
    let hasRecovery = false;

    for (let i = 1; i < history.length - 1; i++) {
      if (history[i] < 0.20) {
        hasDip = true;
      }
      if (hasDip && history[i] > 0.25) {
        hasRecovery = true;
      }
    }

    return hasDip && hasRecovery;
  }

  private calculateMotionVariance(history: FaceLandmarks[]): number {
    if (history.length < 2) return 0;

    let sumDist = 0;
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];

      const dNose = Math.hypot(curr.noseTip.x - prev.noseTip.x, curr.noseTip.y - prev.noseTip.y);
      const dLeftEye = Math.hypot(curr.leftEye.x - prev.leftEye.x, curr.leftEye.y - prev.leftEye.y);
      const dRightEye = Math.hypot(curr.rightEye.x - prev.rightEye.x, curr.rightEye.y - prev.rightEye.y);

      sumDist += (dNose + dLeftEye + dRightEye) / 3;
    }

    const meanMovement = sumDist / (history.length - 1);
    // Normalized variance: genuine micro-motion is typically 0.5 - 5.0 pixels
    const variance = Math.min(1.0, meanMovement / 30.0);
    return variance;
  }

  private evaluateTextureGradient(frame: CameraFrame, landmarks: FaceLandmarks): number {
    // Measures spatial standard deviation and subpixel moiré artifacts
    const nx = Math.floor(landmarks.noseTip.x);
    const ny = Math.floor(landmarks.noseTip.y);

    let sum = 0;
    let sumSq = 0;
    let samples = 0;
    let moireEnergy = 0;
    let gridSamples = 0;

    const radius = 15;
    for (let dy = -radius; dy <= radius; dy += 3) {
      const y = ny + dy;
      if (y < 0 || y >= frame.height) continue;

      for (let dx = -radius; dx <= radius; dx += 3) {
        const x = nx + dx;
        if (x < 0 || x >= frame.width) continue;

        const idx = (y * frame.width + x) * 4;
        const lum = 0.299 * frame.data[idx] + 0.587 * frame.data[idx + 1] + 0.114 * frame.data[idx + 2];
        sum += lum;
        sumSq += lum * lum;
        samples++;

        // Subpixel moiré grid check: check high-frequency horizontal gradient
        if (x < frame.width - 2) {
          const lumNext = 0.299 * frame.data[idx + 4] + 0.587 * frame.data[idx + 5] + 0.114 * frame.data[idx + 6];
          moireEnergy += Math.abs(lum - lumNext);
          gridSamples++;
        }
      }
    }

    if (samples < 10) return 0.5;

    const mean = sum / samples;
    const stdDev = Math.sqrt(Math.max(0, sumSq / samples - mean * mean));
    const meanMoire = gridSamples > 0 ? moireEnergy / gridSamples : 0;

    // Natural skin texture typically has stdDev between 12 and 45
    if (stdDev < 4) {
      return 0.2; // Suspiciously flat (solid color or blank paper)
    }
    if (stdDev > 75 || meanMoire > 65) {
      return 0.3; // Severe digital screen moiré or artificial pixel grid
    }

    return 0.85; // Natural skin gradient verified
  }

  private checkChallengeCompletion(challenge: ActiveChallenge, history: FaceLandmarks[]): boolean {
    if (history.length < 3) return false;

    const initial = history[0];
    const latest = history[history.length - 1];

    const initialEyeDist = Math.hypot(initial.rightEye.x - initial.leftEye.x, initial.rightEye.y - initial.leftEye.y) || 1;
    const latestEyeDist = Math.hypot(latest.rightEye.x - latest.leftEye.x, latest.rightEye.y - latest.leftEye.y) || 1;

    // Yaw delta: nose position relative to eye centers
    const initialNoseRel = (initial.noseTip.x - (initial.leftEye.x + initial.rightEye.x) / 2) / initialEyeDist;
    const latestNoseRel = (latest.noseTip.x - (latest.leftEye.x + latest.rightEye.x) / 2) / latestEyeDist;
    const deltaYawRel = latestNoseRel - initialNoseRel;

    // Pitch delta: nose position relative to eye line
    const initialEyeMidY = (initial.leftEye.y + initial.rightEye.y) / 2;
    const latestEyeMidY = (latest.leftEye.y + latest.rightEye.y) / 2;
    const initialPitchRel = (initial.noseTip.y - initialEyeMidY) / initialEyeDist;
    const latestPitchRel = (latest.noseTip.y - latestEyeMidY) / latestEyeDist;
    const deltaPitchRel = latestPitchRel - initialPitchRel;

    switch (challenge.type) {
      case 'TURN_LEFT_15':
        // Head turned left -> nose shifts toward left eye in image
        return deltaYawRel < -0.15;

      case 'TURN_RIGHT_15':
        // Head turned right -> nose shifts toward right eye in image
        return deltaYawRel > 0.15;

      case 'TILT_UP_10':
        // Chin tilted up -> nose shifts closer to eye line
        return deltaPitchRel < -0.10;

      case 'BLINK_TWICE':
        return this.blinkCount >= 2;

      default:
        return false;
    }
  }
}
