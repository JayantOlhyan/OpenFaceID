import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LivenessDetector,
  ScreenGlareTracker,
  LandmarkDepthAnalyzer,
  type FaceLandmarks,
} from '../../packages/vision/src/index.ts';
import type { CameraFrame } from '../../packages/camera/src/index.ts';

function createSyntheticFrame(
  width = 640,
  height = 480,
  baseColor = { r: 160, g: 130, b: 110 },
  highlightOffset = { r: 0, g: 0, b: 0 }
): CameraFrame {
  const size = width * height * 4;
  const data = new Uint8ClampedArray(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Subtle natural skin gradient texture (stdDev ~ 15)
      const textureNoise = Math.sin(x * 0.15) * 8 + Math.cos(y * 0.15) * 8;

      // Forehead region roughly centered around (320, 180)
      const isForehead = Math.hypot(x - 320, y - 180) < 25;

      if (isForehead) {
        data[idx] = Math.max(0, Math.min(255, baseColor.r + highlightOffset.r + textureNoise));
        data[idx + 1] = Math.max(0, Math.min(255, baseColor.g + highlightOffset.g + textureNoise));
        data[idx + 2] = Math.max(0, Math.min(255, baseColor.b + highlightOffset.b + textureNoise));
      } else {
        data[idx] = Math.max(0, Math.min(255, baseColor.r + textureNoise));
        data[idx + 1] = Math.max(0, Math.min(255, baseColor.g + textureNoise));
        data[idx + 2] = Math.max(0, Math.min(255, baseColor.b + textureNoise));
      }
      data[idx + 3] = 255;
    }
  }

  return {
    data,
    width,
    height,
    pixelFormat: 'RGBA',
    timestamp: Date.now(),
    frameIndex: 1,
    zeroize: () => data.fill(0),
  };
}

const canonicalLandmarks: FaceLandmarks = {
  leftEye: { x: 280, y: 220 },
  rightEye: { x: 360, y: 220 },
  noseTip: { x: 320, y: 260 },
  leftMouth: { x: 290, y: 310 },
  rightMouth: { x: 350, y: 310 },
};

describe('Glance-Style 5-Cue Liveness Detection (Phase 3)', () => {
  describe('Cue 1: Dynamic Screen Glare Reflection Tracker', () => {
    const tracker = new ScreenGlareTracker();

    it('generates random challenges with nonces and valid pulse colors', () => {
      const challenge1 = tracker.generateChallenge(250);
      const challenge2 = tracker.generateChallenge(250);

      assert.ok(challenge1.id.startsWith('glr_'));
      assert.notEqual(challenge1.id, challenge2.id);
      assert.ok(challenge1.pulse.r >= 0 && challenge1.pulse.r <= 255);
      assert.ok(challenge1.pulse.g >= 0 && challenge1.pulse.g <= 255);
      assert.ok(challenge1.pulse.b >= 0 && challenge1.pulse.b <= 255);
    });

    it('verifies genuine matching screen glare reflection on skin highlight', () => {
      const challenge = tracker.generateChallenge(250);
      const pulse = challenge.pulse;

      // Baseline frame under neutral ambient light
      const baseline = createSyntheticFrame(640, 480, { r: 140, g: 120, b: 100 }, { r: 0, g: 0, b: 0 });

      // Challenged frame with specular reflection matching emitted screen color pulse
      const challenged = createSyntheticFrame(
        640,
        480,
        { r: 140, g: 120, b: 100 },
        {
          r: Math.round(pulse.r * 0.18),
          g: Math.round(pulse.g * 0.18),
          b: Math.round(pulse.b * 0.18),
        }
      );

      const result = tracker.evaluateReflection(baseline, challenged, canonicalLandmarks, challenge);

      assert.equal(result.passed, true);
      assert.ok(result.correlation > 0.65, `Expected correlation > 0.65, got ${result.correlation}`);
      assert.ok(result.score >= 0.70);
      assert.ok(result.reflectionIntensity > 2.0);
    });

    it('rejects static photo with zero specular differential response', () => {
      const challenge = tracker.generateChallenge(250);

      // Two identical frames simulate a printed photograph with unchanging ambient light
      const frame1 = createSyntheticFrame(640, 480, { r: 150, g: 150, b: 150 });
      const frame2 = createSyntheticFrame(640, 480, { r: 150, g: 150, b: 150 });

      const result = tracker.evaluateReflection(frame1, frame2, canonicalLandmarks, challenge);

      assert.equal(result.passed, false);
      assert.ok(result.score <= 0.20);
      assert.ok(result.reflectionIntensity < 0.8);
      assert.ok(result.reason.includes('Zero specular reflection detected'));
    });

    it('rejects mismatched chromatic shift (replay video or foreign display)', () => {
      const challenge = tracker.generateChallenge(250);
      const redChallenge: GlareChallenge = {
        ...challenge,
        pulse: { r: 240, g: 20, b: 20, name: 'warm_amber_red' },
      };

      // Emitting red pulse but camera observes an inverted cyan shift
      const baseline = createSyntheticFrame(640, 480, { r: 140, g: 120, b: 100 }, { r: 0, g: 0, b: 0 });
      const challenged = createSyntheticFrame(640, 480, { r: 140, g: 120, b: 100 }, { r: -15, g: 25, b: 30 });

      const result = tracker.evaluateReflection(baseline, challenged, canonicalLandmarks, redChallenge);

      assert.equal(result.passed, false);
      assert.ok(result.correlation < 0.55);
    });
  });

  describe('Cue 2: 3D Volumetric Landmark Parallax Analyzer', () => {
    const analyzer = new LandmarkDepthAnalyzer();

    it('confirms 3D volumetric depth on authentic human face landmarks', () => {
      // Natural human face with 3D relief and subtle head rotation
      const lm1: FaceLandmarks = { ...canonicalLandmarks };
      const lm2: FaceLandmarks = {
        ...canonicalLandmarks,
        noseTip: { x: canonicalLandmarks.noseTip.x + 3, y: canonicalLandmarks.noseTip.y + 1 },
      };
      const lm3: FaceLandmarks = {
        ...canonicalLandmarks,
        noseTip: { x: canonicalLandmarks.noseTip.x - 2, y: canonicalLandmarks.noseTip.y - 1 },
      };

      const result = analyzer.analyzeDepth([lm1, lm2, lm3]);

      assert.equal(result.passed, true);
      assert.equal(result.isPlanar, false);
      assert.ok(result.score >= 0.55);
      assert.ok(result.estimatedReliefRatio > 0.08);
    });

    it('detects flat 2D planar photos without volumetric parallax', () => {
      // Exactly identical landmarks (static printed photo held in front of lens)
      const staticHistory = [canonicalLandmarks, canonicalLandmarks, canonicalLandmarks, canonicalLandmarks];

      const result = analyzer.analyzeDepth(staticHistory);

      assert.equal(result.isPlanar, true);
      assert.equal(result.passed, false);
      assert.ok(result.parallaxDisparity < 0.003);
    });
  });

  describe('Cues 3-5: Integrated 5-Cue LivenessDetector', () => {
    const detector = new LivenessDetector();

    it('passes fast passive burst with combined 3D depth and screen glare', async () => {
      const tracker = detector.getGlareTracker();
      const challenge = tracker.generateChallenge(250);

      const f1 = createSyntheticFrame(640, 480, { r: 140, g: 120, b: 100 }, { r: 0, g: 0, b: 0 });
      const f2 = createSyntheticFrame(
        640,
        480,
        { r: 140, g: 120, b: 100 },
        {
          r: Math.round(challenge.pulse.r * 0.15),
          g: Math.round(challenge.pulse.g * 0.15),
          b: Math.round(challenge.pulse.b * 0.15),
        }
      );

      const lm1: FaceLandmarks = { ...canonicalLandmarks };
      const lm2: FaceLandmarks = {
        ...canonicalLandmarks,
        noseTip: { x: canonicalLandmarks.noseTip.x + 2, y: canonicalLandmarks.noseTip.y + 1 },
      };

      const result = await detector.evaluateLiveness([f1, f2], [lm1, lm2], 'light', challenge);

      assert.equal(result.passed, true);
      assert.equal(result.state, 'LIVENESS_PASSED');
      assert.ok(result.score >= 0.65);
      assert.ok(result.cueBreakdown !== undefined);
      assert.ok(result.cueBreakdown?.depth !== undefined);
      assert.ok(result.cueBreakdown?.glare !== undefined);
    });

    it('rejects digital screen replay with periodic moiré grid artifacts', async () => {
      const fMoiré = createSyntheticFrame(640, 480, { r: 140, g: 120, b: 100 });

      // Inject alternating high-frequency subpixel stripes simulating an OLED/LCD display
      for (let y = 245; y < 275; y++) {
        for (let x = 305; x < 335; x++) {
          const idx = (y * 640 + x) * 4;
          if (x % 2 === 0) {
            fMoiré.data[idx] = 250;
            fMoiré.data[idx + 1] = 250;
            fMoiré.data[idx + 2] = 250;
          } else {
            fMoiré.data[idx] = 10;
            fMoiré.data[idx + 1] = 10;
            fMoiré.data[idx + 2] = 10;
          }
        }
      }

      const staticHistory = [canonicalLandmarks, canonicalLandmarks];
      const result = await detector.evaluateLiveness([fMoiré, fMoiré], staticHistory, 'light');

      assert.equal(result.passed, false);
      assert.ok(result.score <= 0.40);
    });

    it('supports seamless polymorphic invocation with single frame', async () => {
      const frame = createSyntheticFrame();
      const result = await detector.evaluateLiveness(
        frame as any,
        { x: 100, y: 100, width: 200, height: 200 } as any,
        canonicalLandmarks as any
      );

      assert.ok(typeof result.passed === 'boolean');
      assert.ok(typeof result.score === 'number');
    });
  });
});
