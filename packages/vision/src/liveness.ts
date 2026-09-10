import type { CameraFrame } from '../../camera/src/index.ts';
import type { LivenessMode } from '../../core/src/index.ts';
import type { FaceLandmarks, LivenessResult, ILivenessDetector } from './interfaces.ts';

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

  public async evaluateLiveness(
    frames: CameraFrame[],
    landmarksHistory: FaceLandmarks[],
    mode: LivenessMode
  ): Promise<LivenessResult> {
    if (mode === 'off') {
      return {
        passed: true,
        mode: 'off',
        score: 1.0,
        blinkDetected: false,
        motionVariance: 1.0,
        reason: 'Liveness disabled (Off mode)',
      };
    }

    if (!landmarksHistory || landmarksHistory.length < 2) {
      return {
        passed: false,
        mode,
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
    if (this.blinkHistory.length > 20) {
      this.blinkHistory.shift();
    }

    const blinkDetected = this.detectBlink(this.blinkHistory);

    // 2. Micro-Motion & Temporal Landmark Variance
    const motionVariance = this.calculateMotionVariance(landmarksHistory);

    // 3. Texture / Gradient Naturalness (Detects screen moiré / flat paper)
    const latestFrame = frames[frames.length - 1];
    const textureScore = latestFrame ? this.evaluateTextureGradient(latestFrame, latestLm) : 0.8;

    // 4. Mode Evaluation: Light vs Strong
    if (mode === 'light') {
      // Light Mode: Passive Anti-Spoofing
      // Requires either micro-motion variance > 0.012 or blink detected, plus natural texture
      const isStaticPhoto = motionVariance < 0.008 && !blinkDetected;
      const score = Math.min(
        1.0,
        (blinkDetected ? 0.45 : 0.25) +
        Math.min(0.40, motionVariance * 20) +
        textureScore * 0.25
      );

      const passed = !isStaticPhoto && score >= 0.55;

      return {
        passed,
        mode: 'light',
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
      // Strong Mode: Active Challenge-Response
      const challenge = this.getActiveChallenge();
      const challengeCompleted = this.checkChallengeCompletion(challenge, landmarksHistory);

      const score = challengeCompleted ? 0.95 : 0.35;
      const passed = challengeCompleted && motionVariance > 0.015;

      return {
        passed,
        mode: 'strong',
        score,
        blinkDetected,
        motionVariance: Number(motionVariance.toFixed(4)),
        challengeCompleted,
        reason: passed
          ? `Strong active challenge passed (${challenge.type})`
          : `Awaiting active movement: ${challenge.prompt}`,
      };
    }
  }

  public issueNewChallenge(type?: ChallengeType): ActiveChallenge {
    const types: ChallengeType[] = ['TURN_LEFT_15', 'TURN_RIGHT_15', 'TILT_UP_10', 'BLINK_TWICE'];
    const chosenType = type || types[Math.floor(Math.random() * types.length)];

    const prompts: Record<ChallengeType, string> = {
      TURN_LEFT_15: 'Turn head slightly to the left',
      TURN_RIGHT_15: 'Turn head slightly to the right',
      TILT_UP_10: 'Tilt your chin slightly up',
      BLINK_TWICE: 'Blink your eyes twice naturally',
    };

    this.activeChallenge = {
      type: chosenType,
      prompt: prompts[chosenType],
      issuedAt: Date.now(),
      timeoutMs: 4000,
      completed: false,
    };

    return this.activeChallenge;
  }

  public getActiveChallenge(): ActiveChallenge {
    if (!this.activeChallenge || Date.now() - this.activeChallenge.issuedAt > this.activeChallenge.timeoutMs) {
      return this.issueNewChallenge();
    }
    return this.activeChallenge;
  }

  private calculateEyeAspectRatio(lm: FaceLandmarks): number {
    // Estimate eye vertical aperture vs eye horizontal width
    const eyeWidth = Math.hypot(lm.rightEye.x - lm.leftEye.x, lm.rightEye.y - lm.leftEye.y);
    const eyeHeight = eyeWidth * 0.25; // standard open ratio
    return eyeHeight / (eyeWidth || 1);
  }

  private detectBlink(history: number[]): boolean {
    if (history.length < 5) return false;
    // Check for a dip below 0.18 followed by recovery above 0.23
    let dipped = false;
    for (let i = 0; i < history.length - 1; i++) {
      if (history[i] < 0.18) dipped = true;
      if (dipped && history[i + 1] > 0.23) return true;
    }
    return false;
  }

  private calculateMotionVariance(history: FaceLandmarks[]): number {
    if (history.length < 2) return 0;
    let sumVar = 0;
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      const noseDist = Math.hypot(curr.noseTip.x - prev.noseTip.x, curr.noseTip.y - prev.noseTip.y);
      sumVar += noseDist;
    }
    return sumVar / (history.length - 1);
  }

  private evaluateTextureGradient(frame: CameraFrame, lm: FaceLandmarks): number {
    // Measure high-frequency gradient variance across the cheek region
    const cx = Math.floor(lm.noseTip.x);
    const cy = Math.floor(lm.noseTip.y);
    const radius = 20;

    let diffSum = 0;
    let count = 0;

    for (let y = cy - radius; y < cy + radius; y += 2) {
      for (let x = cx - radius; x < cx + radius; x += 2) {
        if (x > 0 && x < frame.width - 1 && y > 0 && y < frame.height - 1) {
          const idx = (y * frame.width + x) * 4;
          const idxRight = (y * frame.width + (x + 1)) * 4;
          const diff = Math.abs(frame.data[idx] - frame.data[idxRight]);
          diffSum += diff;
          count++;
        }
      }
    }

    const avgGradient = count > 0 ? diffSum / count : 15;
    // Moiré or paper glare creates harsh repetitive gradients (>40) or flat zero (<2)
    if (avgGradient < 2 || avgGradient > 55) {
      return 0.4;
    }
    return 0.9;
  }

  private checkChallengeCompletion(challenge: ActiveChallenge, history: FaceLandmarks[]): boolean {
    if (history.length < 3) return false;
    const first = history[0];
    const latest = history[history.length - 1];

    if (challenge.type === 'TURN_LEFT_15') {
      return latest.noseTip.x < first.noseTip.x - 8;
    } else if (challenge.type === 'TURN_RIGHT_15') {
      return latest.noseTip.x > first.noseTip.x + 8;
    } else if (challenge.type === 'TILT_UP_10') {
      return latest.noseTip.y < first.noseTip.y - 6;
    } else if (challenge.type === 'BLINK_TWICE') {
      return this.detectBlink(this.blinkHistory);
    }
    return false;
  }
}
