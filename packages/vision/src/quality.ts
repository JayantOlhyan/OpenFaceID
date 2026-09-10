import type { CameraFrame } from '../../camera/src/index.ts';
import type { BoundingBox, FaceLandmarks, FaceQualityScore, IFaceQualityAnalyzer } from './interfaces.ts';

export class FaceQualityAnalyzer implements IFaceQualityAnalyzer {
  public analyzeQuality(
    frame: CameraFrame,
    box: BoundingBox,
    landmarks: FaceLandmarks
  ): FaceQualityScore {
    const frameArea = frame.width * frame.height;
    const faceArea = box.width * box.height;
    const sizeRatio = faceArea / (frameArea || 1);

    // 1. Centering Check (normalized distance from frame center)
    const frameCenterX = frame.width / 2;
    const frameCenterY = frame.height / 2;
    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;

    const dx = (faceCenterX - frameCenterX) / frameCenterX;
    const dy = (faceCenterY - frameCenterY) / frameCenterY;
    const centering = Math.sqrt(dx * dx + dy * dy);

    // 2. Brightness & Sharpness Estimation from Face Crop
    const { brightness, sharpness } = this.calculateBrightnessAndSharpness(frame, box);

    // 3. Head Pose Estimation (Yaw, Pitch, Roll) from 5 Landmarks
    const rollRad = Math.atan2(
      landmarks.rightEye.y - landmarks.leftEye.y,
      landmarks.rightEye.x - landmarks.leftEye.x
    );
    const rollDeg = (rollRad * 180) / Math.PI;

    // Yaw: asymmetry between nose tip and left/right eye distance
    const distLeft = Math.hypot(landmarks.noseTip.x - landmarks.leftEye.x, landmarks.noseTip.y - landmarks.leftEye.y);
    const distRight = Math.hypot(landmarks.rightEye.x - landmarks.noseTip.x, landmarks.rightEye.y - landmarks.noseTip.y);
    const totalEyeDist = Math.hypot(landmarks.rightEye.x - landmarks.leftEye.x, landmarks.rightEye.y - landmarks.leftEye.y) || 1;
    const yawDeg = ((distRight - distLeft) / totalEyeDist) * 60; // Approximate yaw in degrees

    // Pitch: vertical offset of nose relative to eye-mouth midpoint
    const eyeMidY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2;
    const mouthMidY = (landmarks.leftMouth.y + landmarks.rightMouth.y) / 2;
    const faceHeightEstimate = mouthMidY - eyeMidY || 1;
    const noseRelY = (landmarks.noseTip.y - eyeMidY) / faceHeightEstimate;
    const pitchDeg = (noseRelY - 0.5) * 60; // Approximate pitch in degrees

    // 4. Decision & Guidance Logic
    let isAcceptable = true;
    let rejectionReason: string | undefined;
    let userGuidance = 'Good framing';

    if (sizeRatio < 0.08) {
      isAcceptable = false;
      rejectionReason = 'FACE_TOO_FAR';
      userGuidance = 'Move closer to the camera';
    } else if (sizeRatio > 0.75) {
      isAcceptable = false;
      rejectionReason = 'FACE_TOO_CLOSE';
      userGuidance = 'Move slightly farther away';
    } else if (centering > 0.35) {
      isAcceptable = false;
      rejectionReason = 'FACE_NOT_CENTERED';
      userGuidance = 'Center your face in the camera view';
    } else if (brightness < 35) {
      isAcceptable = false;
      rejectionReason = 'TOO_DARK';
      userGuidance = 'More lighting needed';
    } else if (brightness > 235) {
      isAcceptable = false;
      rejectionReason = 'TOO_BRIGHT';
      userGuidance = 'Reduce glare or bright backlighting';
    } else if (sharpness < 50) {
      isAcceptable = false;
      rejectionReason = 'BLURRY';
      userGuidance = 'Hold steady, image is blurry';
    } else if (Math.abs(yawDeg) > 35 || Math.abs(pitchDeg) > 30 || Math.abs(rollDeg) > 25) {
      isAcceptable = false;
      rejectionReason = 'EXTREME_ANGLE';
      userGuidance = 'Look more directly at the screen';
    }

    return {
      sharpness: Math.round(sharpness),
      brightness: Math.round(brightness),
      centering: Number(centering.toFixed(3)),
      sizeRatio: Number(sizeRatio.toFixed(3)),
      yawDeg: Number(yawDeg.toFixed(1)),
      pitchDeg: Number(pitchDeg.toFixed(1)),
      rollDeg: Number(rollDeg.toFixed(1)),
      isAcceptable,
      rejectionReason,
      userGuidance,
    };
  }

  private calculateBrightnessAndSharpness(
    frame: CameraFrame,
    box: BoundingBox
  ): { brightness: number; sharpness: number } {
    const x0 = Math.max(0, Math.floor(box.x));
    const y0 = Math.max(0, Math.floor(box.y));
    const x1 = Math.min(frame.width, Math.floor(box.x + box.width));
    const y1 = Math.min(frame.height, Math.floor(box.y + box.height));

    let sumLuma = 0;
    let pixelCount = 0;

    // Step sampling to maintain high speed (<1ms)
    const step = 2;
    const grayCrop: number[][] = [];

    for (let y = y0; y < y1; y += step) {
      const row: number[] = [];
      for (let x = x0; x < x1; x += step) {
        const idx = (y * frame.width + x) * 4;
        const r = frame.data[idx];
        const g = frame.data[idx + 1];
        const b = frame.data[idx + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        sumLuma += luma;
        pixelCount++;
        row.push(luma);
      }
      grayCrop.push(row);
    }

    const brightness = pixelCount > 0 ? sumLuma / pixelCount : 120;

    // Laplacian Variance Operator on grayscale crop
    let laplacianVariance = 100;
    if (grayCrop.length > 2 && grayCrop[0].length > 2) {
      const laplacianValues: number[] = [];
      let sumLap = 0;

      for (let r = 1; r < grayCrop.length - 1; r++) {
        for (let c = 1; c < grayCrop[0].length - 1; c++) {
          const val =
            grayCrop[r + 1][c] +
            grayCrop[r - 1][c] +
            grayCrop[r][c + 1] +
            grayCrop[r][c - 1] -
            4 * grayCrop[r][c];
          laplacianValues.push(val);
          sumLap += val;
        }
      }

      const meanLap = sumLap / (laplacianValues.length || 1);
      let sumSqDiff = 0;
      for (const v of laplacianValues) {
        sumSqDiff += (v - meanLap) ** 2;
      }
      laplacianVariance = sumSqDiff / (laplacianValues.length || 1);
    }

    return { brightness, sharpness: Math.max(10, laplacianVariance) };
  }
}
