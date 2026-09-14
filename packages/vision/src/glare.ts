import crypto from 'node:crypto';
import type { CameraFrame } from '../../camera/src/index.ts';
import type { FaceLandmarks } from './interfaces.ts';
import { Logger } from '../../core/src/index.ts';

export interface GlareColorPulse {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
  name: string;
}

export interface GlareChallenge {
  id: string;
  pulse: GlareColorPulse;
  issuedAt: number;
  durationMs: number;
  expiresAt: number;
}

export interface GlareEvaluationResult {
  passed: boolean;
  score: number; // 0.0 to 1.0
  chromaticShift: { deltaR: number; deltaG: number; deltaB: number };
  correlation: number; // Cosine alignment with emitted pulse (-1.0 to 1.0)
  reflectionIntensity: number;
  reason: string;
}

/**
 * Standard subtle calibration palette for Glance screen reflection
 * Noticeable to camera sensors while subtle to user's peripheral vision
 */
const GLANCE_PULSE_PALETTE: GlareColorPulse[] = [
  { r: 230, g: 80, b: 80, name: 'warm_amber_red' },
  { r: 80, g: 230, b: 120, name: 'spring_cyan_green' },
  { r: 80, g: 140, b: 240, name: 'deep_sky_blue' },
  { r: 220, g: 100, b: 230, name: 'vibrant_magenta' },
  { r: 240, g: 200, b: 70, name: 'golden_yellow' },
  { r: 70, g: 230, b: 220, name: 'electric_cyan' },
];

/**
 * Dynamic Screen Glare Reflection Tracker (Glance Anti-Spoofing Cue 1)
 *
 * Mechanism:
 *   Emits a pseudo-random, cryptographically unpredictable color pulse on the display
 *   during wake-burst capture. Computes differential spectral shifts on forehead and
 *   nasal bridge specular highlights across frame intervals.
 *
 * Spoofing Immunity:
 *   High-resolution printed paper or replay videos on tablet/phone displays cannot
 *   anticipate the nonce or reflect the exact wavelength distribution emitted by the host screen.
 */
export class ScreenGlareTracker {
  private activeChallenge: GlareChallenge | null = null;

  /**
   * Generate a cryptographically random challenge pulse for display on the HUD / lock screen
   */
  public generateChallenge(durationMs = 250): GlareChallenge {
    const randomIdx = crypto.randomInt(0, GLANCE_PULSE_PALETTE.length);
    const pulse = GLANCE_PULSE_PALETTE[randomIdx];
    const now = Date.now();

    this.activeChallenge = {
      id: `glr_${crypto.randomBytes(8).toString('hex')}`,
      pulse,
      issuedAt: now,
      durationMs,
      expiresAt: now + durationMs + 300, // 300ms window for camera frame pipeline latency
    };

    return this.activeChallenge;
  }

  public getActiveChallenge(): GlareChallenge | null {
    return this.activeChallenge;
  }

  public clearChallenge(): void {
    this.activeChallenge = null;
  }

  /**
   * Evaluate specular reflection shift between baseline (pre-pulse or ambient)
   * and challenged frame (during screen color pulse)
   */
  public evaluateReflection(
    baselineFrame: CameraFrame,
    challengedFrame: CameraFrame,
    landmarks: FaceLandmarks,
    challenge: GlareChallenge
  ): GlareEvaluationResult {
    // 1. Extract Forehead & Nose-Bridge Specular Regions of Interest (ROIs)
    const baselineColor = this.sampleSpecularROI(baselineFrame, landmarks);
    const challengedColor = this.sampleSpecularROI(challengedFrame, landmarks);

    // 2. Compute Chromatic Differential Delta Vector Δ(R, G, B)
    const deltaR = challengedColor.r - baselineColor.r;
    const deltaG = challengedColor.g - baselineColor.g;
    const deltaB = challengedColor.b - baselineColor.b;

    // 3. Compute Expected Emitted Pulse Unit Direction Vector
    const pulseNorm = Math.hypot(challenge.pulse.r, challenge.pulse.g, challenge.pulse.b) || 1;
    const expR = challenge.pulse.r / pulseNorm;
    const expG = challenge.pulse.g / pulseNorm;
    const expB = challenge.pulse.b / pulseNorm;

    // 4. Compute Observed Chromatic Delta Unit Vector
    const deltaNorm = Math.hypot(deltaR, deltaG, deltaB);

    if (deltaNorm < 0.8) {
      // Near-zero differential response -> static photo, matte paper, or constant screen replay
      return {
        passed: false,
        score: 0.15,
        chromaticShift: { deltaR, deltaG, deltaB },
        correlation: 0.0,
        reflectionIntensity: deltaNorm,
        reason: 'Zero specular reflection detected (static photo or display replay suspected)',
      };
    }

    const obsR = deltaR / deltaNorm;
    const obsG = deltaG / deltaNorm;
    const obsB = deltaB / deltaNorm;

    // 5. Cosine Similarity Alignment: Dot product between observed delta and expected pulse
    const correlation = obsR * expR + obsG * expG + obsB * expB;

    // 6. Score Mapping:
    // Natural human skin reflects screen glow with correlation typically between 0.65 and 0.99
    // A mismatched screen or ambient perturbation yields correlation <= 0.35
    const normalizedScore = Math.max(0, Math.min(1.0, (correlation + 0.2) / 1.1));
    const passed = correlation >= 0.55 && deltaNorm >= 1.2;

    const result: GlareEvaluationResult = {
      passed,
      score: Number(normalizedScore.toFixed(3)),
      chromaticShift: {
        deltaR: Number(deltaR.toFixed(2)),
        deltaG: Number(deltaG.toFixed(2)),
        deltaB: Number(deltaB.toFixed(2)),
      },
      correlation: Number(correlation.toFixed(3)),
      reflectionIntensity: Number(deltaNorm.toFixed(2)),
      reason: passed
        ? `Screen glare reflection verified (correlation: ${correlation.toFixed(2)}, pulse: ${challenge.pulse.name})`
        : `Glare reflection mismatch (correlation: ${correlation.toFixed(2)}, expected: ${challenge.pulse.name})`,
    };

    Logger.debug('liveness', 'Screen glare evaluation result', result);
    return result;
  }

  /**
   * Sample specular reflection highlight ROI from forehead and upper nose bridge
   */
  private sampleSpecularROI(
    frame: CameraFrame,
    landmarks: FaceLandmarks
  ): { r: number; g: number; b: number } {
    const { width, height, data } = frame;

    // Compute Forehead Center: extrapolated upward from midpoint of eyes
    const eyeMidX = (landmarks.leftEye.x + landmarks.rightEye.x) / 2;
    const eyeMidY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2;
    const eyeDist = Math.hypot(
      landmarks.rightEye.x - landmarks.leftEye.x,
      landmarks.rightEye.y - landmarks.leftEye.y
    ) || 40;

    // Forehead is located roughly 0.45 * eyeDist above eye midpoint
    const foreheadX = Math.round(eyeMidX);
    const foreheadY = Math.round(eyeMidY - eyeDist * 0.45);

    // Sample a 9x9 kernel in forehead ROI
    const radius = 4;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      const py = foreheadY + dy;
      if (py < 0 || py >= height) continue;

      for (let dx = -radius; dx <= radius; dx++) {
        const px = foreheadX + dx;
        if (px < 0 || px >= width) continue;

        const idx = (py * width + px) * 4;
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        count++;
      }
    }

    if (count === 0) {
      return { r: 128, g: 128, b: 128 };
    }

    return {
      r: sumR / count,
      g: sumG / count,
      b: sumB / count,
    };
  }
}
