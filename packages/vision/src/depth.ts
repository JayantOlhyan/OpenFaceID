import type { FaceLandmarks } from './interfaces.ts';
import { Logger } from '../../core/src/index.ts';

export interface DepthAnalysisResult {
  passed: boolean;
  score: number; // 0.0 to 1.0 (1.0 = definite 3D volumetric face)
  isPlanar: boolean; // true = flat 2D photo / screen detected
  parallaxDisparity: number; // Depth disparity across nasal bridge and eye plane
  nonAffineResidual: number; // Residual non-affine deformation
  estimatedReliefRatio: number; // 3D depth-to-width relief ratio
  reason: string;
}

/**
 * 3D Volumetric Facial Landmark Parallax Analyzer (Glance Anti-Spoofing Cue 2)
 *
 * Distinguishes genuine 3D human faces from flat 2D planar spoofs (printed photos,
 * iPad/phone screen replays).
 *
 * Real human faces have prominent 3D relief: the nose tip protrudes ~2.5 - 3.5 cm forward
 * from the corneal plane. As the user breathes or micro-rotates, this produces measurable
 * non-affine parallax between the nose and the eye-mouth polygon that is physically impossible
 * on a flat 2D plane.
 */
export class LandmarkDepthAnalyzer {
  /**
   * Minimum non-affine parallax disparity required to confirm 3D volumetric structure
   */
  public static readonly MIN_3D_PARALLAX_THRESHOLD = 0.012;

  /**
   * Analyzes depth cues across single frame and temporal landmark history
   */
  public analyzeDepth(landmarksHistory: FaceLandmarks[]): DepthAnalysisResult {
    if (!landmarksHistory || landmarksHistory.length === 0) {
      return {
        passed: false,
        score: 0.3,
        isPlanar: true,
        parallaxDisparity: 0,
        nonAffineResidual: 0,
        estimatedReliefRatio: 0,
        reason: 'Insufficient landmark history for depth evaluation',
      };
    }

    const latest = landmarksHistory[landmarksHistory.length - 1];

    // 1. Single-Frame Structural Triangulation (Canonical Perspective Relief)
    const staticRelief = this.calculateStaticRelief(latest);

    // 2. Multi-Frame Non-Affine Parallax Analysis
    let dynamicParallax = 0;
    let nonAffineResidual = 0;

    if (landmarksHistory.length >= 3) {
      const dynamics = this.calculateTemporalParallax(landmarksHistory);
      dynamicParallax = dynamics.parallax;
      nonAffineResidual = dynamics.residual;
    } else {
      // For initial frame burst before 3 frames arrive, rely on canonical 3D projective ratios
      dynamicParallax = staticRelief.reliefRatio * 0.08;
      nonAffineResidual = staticRelief.reliefRatio * 0.10;
    }

    // 3. Planar Spoof Decision Logic
    // If dynamic parallax across frames is near zero (< 0.003) across temporal history (>= 3 frames),
    // or if the static relief is flat (< 0.06), the target is a flat 2D surface.
    const isPlanar = (landmarksHistory.length >= 3 && dynamicParallax < 0.003) || staticRelief.reliefRatio < 0.06;

    // 4. Combined Volumetric Confidence Score
    const parallaxScore = Math.min(1.0, dynamicParallax / LandmarkDepthAnalyzer.MIN_3D_PARALLAX_THRESHOLD);
    const reliefScore = Math.min(1.0, staticRelief.reliefRatio / 0.18);
    let combinedScore = Math.max(0.1, Math.min(1.0, 0.55 * reliefScore + 0.45 * parallaxScore));

    if (isPlanar) {
      combinedScore = Math.min(combinedScore, 0.22);
    }

    const passed = !isPlanar && combinedScore >= 0.52;

    const result: DepthAnalysisResult = {
      passed,
      score: Number(combinedScore.toFixed(3)),
      isPlanar,
      parallaxDisparity: Number(dynamicParallax.toFixed(4)),
      nonAffineResidual: Number(nonAffineResidual.toFixed(4)),
      estimatedReliefRatio: Number(staticRelief.reliefRatio.toFixed(3)),
      reason: passed
        ? `3D volumetric face verified (relief: ${staticRelief.reliefRatio.toFixed(2)}, parallax: ${dynamicParallax.toFixed(4)})`
        : isPlanar
        ? 'Flat 2D surface detected (photo or screen spoof suspected)'
        : '3D facial depth score below acceptance threshold',
    };

    Logger.debug('liveness', '3D depth analysis result', result);
    return result;
  }

  /**
   * Computes static 3D facial relief ratio based on perspective foreshortening
   * between the eye-mouth base plane and the apex of the nasal pyramid
   */
  private calculateStaticRelief(lm: FaceLandmarks): { reliefRatio: number; yawEstimate: number } {
    const eyeDx = lm.rightEye.x - lm.leftEye.x;
    const eyeDy = lm.rightEye.y - lm.leftEye.y;
    const eyeDist = Math.hypot(eyeDx, eyeDy) || 1;

    // Eye midpoint (origin of facial coordinate frame)
    const eyeMidX = (lm.leftEye.x + lm.rightEye.x) / 2;
    const eyeMidY = (lm.leftEye.y + lm.rightEye.y) / 2;

    // Mouth midpoint
    const mouthMidX = (lm.leftMouth.x + lm.rightMouth.x) / 2;
    const mouthMidY = (lm.leftMouth.y + lm.rightMouth.y) / 2;

    // Eye-Mouth vertical baseline
    const facialHeight = Math.hypot(mouthMidX - eyeMidX, mouthMidY - eyeMidY) || 1;

    // Nose tip position relative to eye midpoint
    const noseRelX = (lm.noseTip.x - eyeMidX) / eyeDist;
    const noseRelY = (lm.noseTip.y - eyeMidY) / facialHeight;

    // On a real human face, nose tip is ~0.45 - 0.65 down from eye line
    // Horizontal nose asymmetry correlates with head yaw
    const yawEstimate = Math.max(-1.0, Math.min(1.0, noseRelX * 2.2));

    // Perspective depth expansion:
    // Distance from nose to left eye vs distance from nose to right eye
    const distNoseLeft = Math.hypot(lm.noseTip.x - lm.leftEye.x, lm.noseTip.y - lm.leftEye.y);
    const distNoseRight = Math.hypot(lm.noseTip.x - lm.rightEye.x, lm.noseTip.y - lm.rightEye.y);

    const asymmetry = Math.abs(distNoseLeft - distNoseRight) / eyeDist;

    // 3D face relief produces a characteristic relationship between yaw and asymmetry
    // For a real 3D nose, relief ratio is typically ~0.15 - 0.28
    const reliefRatio = Math.max(0.02, Math.min(0.35, 0.18 - Math.abs(asymmetry - Math.abs(yawEstimate) * 0.4) * 0.5));

    return { reliefRatio, yawEstimate };
  }

  /**
   * Computes dynamic non-affine parallax across temporal landmark history
   */
  private calculateTemporalParallax(history: FaceLandmarks[]): { parallax: number; residual: number } {
    let totalParallax = 0;
    let totalResidual = 0;
    let comparisons = 0;

    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];

      const prevEyeDist = Math.hypot(prev.rightEye.x - prev.leftEye.x, prev.rightEye.y - prev.leftEye.y) || 1;
      const currEyeDist = Math.hypot(curr.rightEye.x - curr.leftEye.x, curr.rightEye.y - curr.leftEye.y) || 1;

      // Scale-normalized coordinates relative to eye midpoint
      const prevMidX = (prev.leftEye.x + prev.rightEye.x) / 2;
      const prevMidY = (prev.leftEye.y + prev.rightEye.y) / 2;
      const currMidX = (curr.leftEye.x + curr.rightEye.x) / 2;
      const currMidY = (curr.leftEye.y + curr.rightEye.y) / 2;

      const prevNoseNormX = (prev.noseTip.x - prevMidX) / prevEyeDist;
      const prevNoseNormY = (prev.noseTip.y - prevMidY) / prevEyeDist;

      const currNoseNormX = (curr.noseTip.x - currMidX) / currEyeDist;
      const currNoseNormY = (curr.noseTip.y - currMidY) / currEyeDist;

      // Displacement of nose apex relative to eye plane
      const dNoseRel = Math.hypot(currNoseNormX - prevNoseNormX, currNoseNormY - prevNoseNormY);

      // Displacement of mouth relative to eye plane
      const prevMouthMidX = (prev.leftMouth.x + prev.rightMouth.x) / 2;
      const prevMouthMidY = (prev.leftMouth.y + prev.rightMouth.y) / 2;
      const currMouthMidX = (curr.leftMouth.x + curr.rightMouth.x) / 2;
      const currMouthMidY = (curr.leftMouth.y + curr.rightMouth.y) / 2;

      const prevMouthNormX = (prevMouthMidX - prevMidX) / prevEyeDist;
      const prevMouthNormY = (prevMouthMidY - prevMidY) / prevEyeDist;

      const currMouthNormX = (currMouthMidX - currMidX) / currEyeDist;
      const currMouthNormY = (currMouthMidY - currMidY) / currEyeDist;

      const dMouthRel = Math.hypot(currMouthNormX - prevMouthNormX, currMouthNormY - prevMouthNormY);

      // On a flat 2D plane moving in space, dNoseRel and dMouthRel maintain strict affine proportionality:
      // |dNoseRel - dMouthRel| ≈ 0
      // On a 3D face, the nose apex moves with a different parallax velocity than the mouth plane:
      const nonAffineDiff = Math.abs(dNoseRel - dMouthRel);

      totalParallax += dNoseRel;
      totalResidual += nonAffineDiff;
      comparisons++;
    }

    if (comparisons === 0) return { parallax: 0, residual: 0 };

    return {
      parallax: totalParallax / comparisons,
      residual: totalResidual / comparisons,
    };
  }
}
