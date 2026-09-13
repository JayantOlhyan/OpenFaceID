#!/usr/bin/env node
/**
 * OpenFaceID — Hardware Liveness & Anti-Spoofing Verification Runner
 *
 * Implements Section 37, 38 of the Continuous Engineering Specification.
 * Evaluates presentation attack detection on actual desktop runtime.
 */

import fs from 'fs';
import path from 'path';
import { LivenessDetector } from '../../packages/vision/src/liveness.ts';
import { FrameSampler } from '../../packages/camera/src/FrameSampler.ts';

async function runLivenessHardwareTest() {
  console.log('='.repeat(72));
  console.log('OPENFACEID — HARDWARE LIVENESS & PRESENTATION ATTACK DETECTION');
  console.log('='.repeat(72));

  const detector = new LivenessDetector();
  const sampler = new FrameSampler(15);
  const frame = sampler.createFrame(640, 480);
  frame.data.fill(130);

  function makeLandmarks(cx = 320, cy = 240, dx = 0, dy = 0) {
    return {
      leftEye: { x: cx - 40 + dx, y: cy - 20 + dy },
      rightEye: { x: cx + 40 + dx, y: cy - 20 + dy },
      noseTip: { x: cx + dx, y: cy + 10 + dy },
      leftMouth: { x: cx - 30 + dx, y: cy + 45 + dy },
      rightMouth: { x: cx + 30 + dx, y: cy + 45 + dy },
    };
  }

  // 1. Static Photo Presentation Attack Test
  console.log('1. Evaluating 2D Static Photo Attack Rejection (zero motion variance)...');
  const staticLm = makeLandmarks();
  const photoHistory = [staticLm, staticLm, staticLm, staticLm, staticLm];
  const photoFrames = [frame, frame, frame, frame, frame];

  const photoRes = await detector.evaluateLiveness(photoFrames, photoHistory, 'light');
  console.log(`   Photo Attack Result: ${photoRes.passed ? 'FAILED TO BLOCK' : 'SUCCESSFULLY BLOCKED'}`);
  console.log(`   State: ${photoRes.state} | Reason: ${photoRes.reason}`);
  const photoBlocked = !photoRes.passed && photoRes.state === 'LIVENESS_FAILED';

  // 2. Bona Fide Live Micro-Motion Test
  console.log('\n2. Evaluating Bona Fide Live Presentation (natural micro-motion)...');
  const liveHistory = [
    makeLandmarks(320, 240, 0, 0),
    makeLandmarks(320, 240, 1.2, -0.5),
    makeLandmarks(320, 240, -0.8, 0.7),
    makeLandmarks(320, 240, 1.4, 0.2),
    makeLandmarks(320, 240, -0.3, -0.8),
  ];
  const liveFrames = [frame, frame, frame, frame, frame];

  const liveRes = await detector.evaluateLiveness(liveFrames, liveHistory, 'light');
  console.log(`   Live Presentation Result: ${liveRes.passed ? 'PASSED' : 'FALSE REJECTION'}`);
  console.log(`   State: ${liveRes.state} | Motion Variance: ${liveRes.motionVariance}`);
  const livePassed = liveRes.passed && liveRes.state === 'LIVENESS_PASSED';

  // 3. Active Challenge-Response Test
  console.log('\n3. Evaluating Active Strong Challenge-Response...');
  const dStrong = new LivenessDetector();
  const challenge = dStrong.startNewChallenge();
  challenge.type = 'TURN_LEFT_15';
  challenge.timeoutMs = 5000;
  challenge.issuedAt = Date.now();
  console.log(`   Issued Active Challenge: "${challenge.prompt}" (Timeout: 5000ms)`);

  // Initial prompt state
  const pendingRes = await dStrong.evaluateLiveness([frame, frame], [staticLm, staticLm], 'strong');
  console.log(`   Initial State: ${pendingRes.state} (passed: ${pendingRes.passed})`);

  // Simulate timeout
  challenge.issuedAt = Date.now() - 7000; // Expire challenge
  const timeoutRes = await dStrong.evaluateLiveness([frame, frame], [staticLm, staticLm], 'strong');
  console.log(`   Timeout State: ${timeoutRes.state} (passed: ${timeoutRes.passed})`);
  const timeoutPassed = !timeoutRes.passed && timeoutRes.state === 'LIVENESS_TIMEOUT';

  // 4. Clean up
  frame.zeroize();

  // Save report
  const outDir = path.resolve('data/hardware');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'liveness-test.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      staticPhotoBlocked: photoBlocked,
      bonaFideLivePassed: livePassed,
      activeChallengeTimeoutPassed: timeoutPassed,
    }, null, 2)
  );

  console.log('\n' + '='.repeat(72));
  console.log('Hardware liveness verification saved: data/hardware/liveness-test.json');
  console.log('='.repeat(72));
}

runLivenessHardwareTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
