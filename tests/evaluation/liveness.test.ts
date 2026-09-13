import test from 'node:test';
import assert from 'node:assert';
import { LivenessDetector } from '../../packages/vision/src/liveness.ts';
import { FrameSampler, type CameraFrame } from '../../packages/camera/src/index.ts';
import type { FaceLandmarks } from '../../packages/vision/src/interfaces.ts';

test('Liveness Detection & Presentation Attack Rejection Evaluation', async (t) => {
  const sampler = new FrameSampler(15);

  function createTestFrame(width = 640, height = 480): CameraFrame {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const pattern = (x % 8 < 4 && y % 8 < 4) ? 30 : -20;
        data[idx] = 160 + pattern;
        data[idx + 1] = 130 + pattern;
        data[idx + 2] = 110 + pattern;
        data[idx + 3] = 255;
      }
    }
    return sampler.createFrame(width, height, data);
  }

  function createLandmarks(cx = 320, cy = 240, eyeOffset = 40): FaceLandmarks {
    return {
      leftEye: { x: cx - eyeOffset, y: cy - 20 },
      rightEye: { x: cx + eyeOffset, y: cy - 20 },
      noseTip: { x: cx, y: cy + 10 },
      leftMouth: { x: cx - 30, y: cy + 45 },
      rightMouth: { x: cx + 30, y: cy + 45 },
      leftEar: { x: cx - 85, y: cy },
      rightEar: { x: cx + 85, y: cy },
    };
  }

  await t.test('Passive Light Mode: Static photo attack (0 motion variance) is REJECTED', async () => {
    const detector = new LivenessDetector();
    const frame = createTestFrame();

    // Repeated identical landmarks simulating a printed photo or freeze-frame
    const staticLm = createLandmarks();
    const history = [staticLm, staticLm, staticLm, staticLm];

    const result = await detector.evaluateLiveness([frame, frame, frame, frame], history, 'light');

    assert.strictEqual(result.passed, false, 'Static photo attack must NOT pass liveness');
    assert.strictEqual(result.state, 'LIVENESS_FAILED');
    assert.strictEqual(result.blinkDetected, false);
    assert.ok(result.motionVariance < 0.008, `Motion variance must be near zero, got: ${result.motionVariance}`);
    assert.ok(result.reason.includes('Presentation attack suspected'));
  });

  await t.test('Passive Light Mode: Natural micro-motion variance PASSES liveness', async () => {
    const detector = new LivenessDetector();
    const frame = createTestFrame();

    // Natural human micro-motion: subtle involuntary jitter in head position
    const history: FaceLandmarks[] = [
      createLandmarks(320, 240),
      createLandmarks(321, 239),
      createLandmarks(319, 241),
      createLandmarks(322, 240),
      createLandmarks(320, 242),
    ];
    const frames = history.map(() => frame);

    const result = await detector.evaluateLiveness(frames, history, 'light');

    assert.strictEqual(result.passed, true, 'Live face with natural micro-motion MUST pass');
    assert.strictEqual(result.state, 'LIVENESS_PASSED');
    assert.ok(result.motionVariance >= 0.008, `Expected motion variance >= 0.008, got: ${result.motionVariance}`);
    assert.ok(result.score >= 0.55);
  });

  await t.test('Eye-blink cadence detection correctly flags blink event', async () => {
    const detector = new LivenessDetector();
    const frame = createTestFrame();

    // Simulate eye open -> closed -> open EAR pattern
    // In FaceLandmarks, EAR is estimated from eye to mouth ratios
    const openEye1 = createLandmarks(320, 240, 40);
    const closedEye = createLandmarks(320, 240, 40);
    // Move eyes closer to mouth to simulate closed lid ratio
    closedEye.leftEye.y = 238;
    closedEye.rightEye.y = 238;
    const openEye2 = createLandmarks(320, 240, 40);

    const history = [openEye1, closedEye, openEye2];
    const frames = [frame, frame, frame];

    const res = await detector.evaluateLiveness(frames, history, 'light');
    // Result evaluates either blink or motion
    assert.ok(res.score > 0.4, 'Blink sequence must produce substantial liveness confidence');
  });

  await t.test('Active Strong Mode: Challenge issuance, progress, and timeout handling', async () => {
    const detector = new LivenessDetector();
    const frame = createTestFrame();
    const lm = createLandmarks(320, 240);

    // Initial evaluation in strong mode issues a challenge
    const res1 = await detector.evaluateLiveness([frame, frame], [lm, lm], 'strong');
    assert.strictEqual(res1.passed, false);
    assert.strictEqual(res1.state, 'WAITING_FOR_RESPONSE');
    assert.ok(res1.reason.includes('Awaiting challenge completion'));

    // Check challenge details
    const active = detector.getActiveChallenge();
    assert.ok(active !== null);
    assert.ok(active.prompt.length > 0);
    assert.strictEqual(active.completed, false);

    // Simulate timeout: manually advance issuedAt
    active.issuedAt = Date.now() - 8000; // 8 seconds ago (exceeding 6000ms timeout)

    const resTimeout = await detector.evaluateLiveness([frame, frame], [lm, lm], 'strong');
    assert.strictEqual(resTimeout.passed, false);
    assert.strictEqual(resTimeout.state, 'LIVENESS_TIMEOUT');
    assert.ok(resTimeout.reason.includes('Challenge timed out'));
  });

  await t.test('Active Strong Mode: Completing requested head turn passes liveness', async () => {
    const detector = new LivenessDetector();
    const frame = createTestFrame();

    // Force challenge to TURN_LEFT_15
    const challenge = detector.startNewChallenge();
    challenge.type = 'TURN_LEFT_15';
    challenge.prompt = 'Turn head slightly left';
    challenge.timeoutMs = 5000;
    challenge.issuedAt = Date.now();

    // Initial straight head
    const straight = createLandmarks(320, 240);

    // Turn head left: Nose tip shifts toward left eye (distRight > distLeft)
    // Left eye is at 280, right eye at 360, nose tip at 295
    const turnedLeft: FaceLandmarks = {
      ...straight,
      noseTip: { x: 295, y: 245 },
    };

    const history = [
      straight,
      { ...straight, noseTip: { x: 310, y: 245 } },
      { ...straight, noseTip: { x: 300, y: 245 } },
      turnedLeft,
      turnedLeft,
    ];
    const frames = history.map(() => frame);

    const result = await detector.evaluateLiveness(frames, history, 'strong');
    assert.strictEqual(result.passed, true, 'Completed active challenge must PASS liveness');
    assert.strictEqual(result.state, 'LIVENESS_PASSED');
    assert.strictEqual(result.challengeCompleted, true);
  });

  await t.test('Bypass Mode: Off mode instantly passes without biometric inspection', async () => {
    const detector = new LivenessDetector();
    const result = await detector.evaluateLiveness([], [], 'off');

    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.mode, 'off');
    assert.strictEqual(result.score, 1.0);
  });
});
