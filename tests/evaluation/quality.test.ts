import test from 'node:test';
import assert from 'node:assert';
import { FaceQualityAnalyzer } from '../../packages/vision/src/quality.ts';
import { FrameSampler, type CameraFrame } from '../../packages/camera/src/index.ts';
import type { BoundingBox, FaceLandmarks } from '../../packages/vision/src/interfaces.ts';

test('Face Quality Analysis & Environmental Boundary Evaluation', async (t) => {
  const analyzer = new FaceQualityAnalyzer();
  const sampler = new FrameSampler(15);

  function createCustomFrame(
    width = 640,
    height = 480,
    baseBrightness = 150,
    withTexture = true
  ): CameraFrame {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const pattern = withTexture && (x % 6 < 3 && y % 6 < 3) ? 35 : 0;
        const val = Math.max(0, Math.min(255, baseBrightness + pattern));
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    return sampler.createFrame(width, height, data);
  }

  function createLandmarks(cx = 320, cy = 240, eyeDist = 80): FaceLandmarks {
    return {
      leftEye: { x: cx - eyeDist / 2, y: cy - 25 },
      rightEye: { x: cx + eyeDist / 2, y: cy - 25 },
      noseTip: { x: cx, y: cy + 5 },
      leftMouth: { x: cx - 30, y: cy + 45 },
      rightMouth: { x: cx + 30, y: cy + 45 },
      leftEar: { x: cx - eyeDist, y: cy - 10 },
      rightEar: { x: cx + eyeDist, y: cy - 10 },
    };
  }

  await t.test('Nominal desktop framing passes quality analysis', () => {
    const frame = createCustomFrame(640, 480, 140, true);
    const box: BoundingBox = { x: 220, y: 130, width: 200, height: 220 };
    const landmarks = createLandmarks(320, 240);

    const q = analyzer.analyzeQuality(frame, box, landmarks);
    assert.strictEqual(q.isAcceptable, true, `Expected nominal framing to be acceptable, reason: ${q.rejectionReason}`);
    assert.strictEqual(q.rejectionReason, undefined);
    assert.ok(q.sharpness >= 50);
    assert.ok(q.brightness >= 35 && q.brightness <= 235);
  });

  await t.test('FACE_TOO_FAR: Size ratio below 0.08 is rejected', () => {
    const frame = createCustomFrame(640, 480, 140, true);
    // 640 * 480 = 307200. Box 100x100 = 10000 -> ratio ~ 0.032 (< 0.08)
    const box: BoundingBox = { x: 270, y: 190, width: 100, height: 100 };
    const landmarks = createLandmarks(320, 240, 40);

    const q = analyzer.analyzeQuality(frame, box, landmarks);
    assert.strictEqual(q.isAcceptable, false);
    assert.strictEqual(q.rejectionReason, 'FACE_TOO_FAR');
    assert.strictEqual(q.userGuidance, 'Move closer to the camera');
  });

  await t.test('FACE_TOO_CLOSE: Size ratio above 0.75 is rejected', () => {
    const frame = createCustomFrame(640, 480, 140, true);
    // Box 580x420 = 243600 -> ratio ~ 0.79 (> 0.75)
    const box: BoundingBox = { x: 30, y: 30, width: 580, height: 420 };
    const landmarks = createLandmarks(320, 240, 200);

    const q = analyzer.analyzeQuality(frame, box, landmarks);
    assert.strictEqual(q.isAcceptable, false);
    assert.strictEqual(q.rejectionReason, 'FACE_TOO_CLOSE');
    assert.strictEqual(q.userGuidance, 'Move slightly farther away');
  });

  await t.test('FACE_NOT_CENTERED: Centering distance above 0.35 is rejected', () => {
    const frame = createCustomFrame(640, 480, 140, true);
    // Shift face far towards top-left corner
    const box: BoundingBox = { x: 40, y: 40, width: 200, height: 220 };
    const landmarks = createLandmarks(140, 150);

    const q = analyzer.analyzeQuality(frame, box, landmarks);
    assert.strictEqual(q.isAcceptable, false);
    assert.strictEqual(q.rejectionReason, 'FACE_NOT_CENTERED');
    assert.strictEqual(q.userGuidance, 'Center your face in the camera view');
  });

  await t.test('TOO_DARK: Low ambient illumination (brightness < 35) is rejected', () => {
    const frame = createCustomFrame(640, 480, 20, false);
    const box: BoundingBox = { x: 220, y: 130, width: 200, height: 220 };
    const landmarks = createLandmarks(320, 240);

    const q = analyzer.analyzeQuality(frame, box, landmarks);
    assert.strictEqual(q.isAcceptable, false);
    assert.strictEqual(q.rejectionReason, 'TOO_DARK');
    assert.strictEqual(q.userGuidance, 'More lighting needed');
  });

  await t.test('TOO_BRIGHT: Direct glare or overexposure (brightness > 235) is rejected', () => {
    const frame = createCustomFrame(640, 480, 250, false);
    const box: BoundingBox = { x: 220, y: 130, width: 200, height: 220 };
    const landmarks = createLandmarks(320, 240);

    const q = analyzer.analyzeQuality(frame, box, landmarks);
    assert.strictEqual(q.isAcceptable, false);
    assert.strictEqual(q.rejectionReason, 'TOO_BRIGHT');
    assert.strictEqual(q.userGuidance, 'Reduce glare or bright backlighting');
  });

  await t.test('BLURRY: Out of focus frame with flat texture (sharpness < 50) is rejected', () => {
    const frame = createCustomFrame(640, 480, 140, false); // No texture -> sharpness = 10
    const box: BoundingBox = { x: 220, y: 130, width: 200, height: 220 };
    const landmarks = createLandmarks(320, 240);

    const q = analyzer.analyzeQuality(frame, box, landmarks);
    assert.strictEqual(q.isAcceptable, false);
    assert.strictEqual(q.rejectionReason, 'BLURRY');
    assert.strictEqual(q.userGuidance, 'Hold steady, image is blurry');
  });

  await t.test('EXTREME_ANGLE: Head yaw exceeding 35 degrees is rejected', () => {
    const frame = createCustomFrame(640, 480, 140, true);
    const box: BoundingBox = { x: 220, y: 130, width: 200, height: 220 };

    // Extreme yaw: nose tip pushed far right towards right eye
    const landmarks: FaceLandmarks = {
      leftEye: { x: 280, y: 215 },
      rightEye: { x: 360, y: 215 },
      noseTip: { x: 355, y: 245 }, // Nose very close to right eye -> large yaw
      leftMouth: { x: 290, y: 285 },
      rightMouth: { x: 350, y: 285 },
      leftEar: { x: 240, y: 230 },
      rightEar: { x: 400, y: 230 },
    };

    const q = analyzer.analyzeQuality(frame, box, landmarks);
    assert.strictEqual(q.isAcceptable, false);
    assert.strictEqual(q.rejectionReason, 'EXTREME_ANGLE');
    assert.strictEqual(q.userGuidance, 'Look more directly at the screen');
  });
});
