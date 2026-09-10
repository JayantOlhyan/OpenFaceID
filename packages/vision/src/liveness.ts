import type { CameraFrame } from '../../camera/src/index.ts';
import type { LivenessMode } from '../../core/src/index.ts';
import type { FaceLandmarks, LivenessResult, LivenessState, ILivenessDetector } from './interfaces.ts';

export type ChallengeType = 'TURN_LEFT_15' | 'TURN_RIGHT_15' | 'TILT_UP_10' | 'BLINK_TWICE';

export interface ActiveChallenge {
  type: ChallengeType;
  prompt: string;
  issuedAt: number;
  timeoutMs: number;
  completed: boolean;
}

export class LivenessDetector implements ILivenessDetector {
  private activeChallenge: ActiveChallenge | null = null;
  private blinkHistory: number[] = []; // Rolling EAR history
  private state: LivenessState = 'LIVENESS_IDLE';
  private blinkCount: number = 0;
  private lastBlinkTimestamp: number = 0;

  public getState(): LivenessState {
    return this.state;
  }

  public async evaluateLiveness(
    frames: CameraFrame[],
    landmarksHistory: FaceLandmarks[],
    mode: LivenessMode
  ): Promise<LivenessResult> {
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

    // 1. Calculate Eye Aspect Ratio (EAR) on Most Recent Frame
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

    // 2. Micro-Motion & Temporal Landmark Variance
    const motionVariance = this.calculateMotionVariance(landmarksHistory);

    // 3. Texture / Gradient Naturalness (Detects screen moiré / flat paper)
    const latestFrame = frames[frames.length - 1];
    const textureScore = latestFrame ? this.evaluateTextureGradient(latestFrame, latestLm) : 0.8;

    // 4. Mode Evaluation: Light (Passive) vs Strong (Active Challenge)
    if (mode === 'light') {
      // Light Mode: Passive Anti-Spoofing
      // Requires micro-motion variance > 0.008 or blink detected, plus natural texture
      const isStaticPhoto = motionVariance < 0.008 && !blinkDetected;
      const score = Math.min(
        1.0,
        (blinkDetected ? 0.45 : 0.25) +
        Math.min(0.40, motionVariance * 20) +
        textureScore * 0.25
      );

      const passed = !isStaticPhoto && score >= 0.55;
      this.state = passed ? 'LIVENESS_PASSED' : isStaticPhoto ? 'LIVENESS_FAILED' : 'WAITING_FOR_RESPONSE';

      return {
        passed,
        mode: 'light',
        state: this.state,
        score: Number(score.toFixed(3)),
        blinkDetected,
        motionVariance: Number(motionVariance.toFixed(4)),
        reason: passed
          ? 'Passive liveness confirmed (Micro-motion & texture verified)'
          : isStaticPhoto
          ? 'Presentation attack suspected: Static image detected'
          : 'Liveness score below threshold',
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
    // Measures spatial standard deviation on face crop to distinguish real 3D skin from flat screens
    const nx = Math.floor(landmarks.noseTip.x);
    const ny = Math.floor(landmarks.noseTip.y);

    let sum = 0;
    let sumSq = 0;
    let samples = 0;

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
      }
    }

    if (samples < 10) return 0.5;

    const mean = sum / samples;
    const stdDev = Math.sqrt(Math.max(0, sumSq / samples - mean * mean));

    // Natural skin texture typically has stdDev between 12 and 45
    if (stdDev < 4) {
      return 0.2; // Suspiciously flat (e.g. solid color or blank screen)
    }
    if (stdDev > 75) {
      return 0.3; // High moiré pattern or severe screen glare
    }

    return 0.85; // Natural skin gradient
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
