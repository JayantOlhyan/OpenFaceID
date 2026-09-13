/**
 * OpenFaceID Developer Example: Liveness & Presentation Attack Detection
 *
 * Purpose:
 *   Demonstrates passive micro-motion evaluation and active challenge-response
 *   presentation attack detection (PAD).
 *
 * Requirements:
 *   - Node.js >= 22.0.0
 *
 * Run Command:
 *   node --experimental-strip-types examples/liveness.ts
 *
 * Expected Output:
 *   Evaluation results for bona fide live presentation, 2D static attack,
 *   and active challenge lifecycle.
 *
 * Security Considerations:
 *   OpenFaceID requires liveness verification before presence authorization
 *   to reject printed photos and digital screen replays.
 */

import { LivenessDetector } from '../packages/vision/src/index.ts';
import { createSyntheticFrame, createSyntheticLandmarks } from './demo/fixtures.ts';

async function run() {
  console.log('=== OpenFaceID Example: Liveness & Anti-Spoofing (PAD) ===\n');

  const liveness = new LivenessDetector();
  const frame = createSyntheticFrame();

  // 1. Passive Evaluation: 2D Static Photo Attack (Zero landmark variance)
  const staticHistory = [
    createSyntheticLandmarks(0, 0),
    createSyntheticLandmarks(0, 0),
    createSyntheticLandmarks(0, 0),
  ];
  const staticResult = await liveness.evaluateLiveness([frame], staticHistory, 'light');
  console.log(`1. 2D Static Photo Presentation Attack:`);
  console.log(`   Passed:          ${staticResult.passed ? 'YES' : 'NO (BLOCKED)'}`);
  console.log(`   Motion Variance: ${staticResult.motionVariance.toFixed(4)} (Threshold: > 0.005)`);
  console.log(`   Reason:          ${staticResult.reason}`);

  // 2. Passive Evaluation: Bona Fide Live Presentation (Natural micro-motion)
  const liveHistory = [
    createSyntheticLandmarks(0, 0),
    createSyntheticLandmarks(1, 0),
    createSyntheticLandmarks(-1, 1),
  ];
  const liveResult = await liveness.evaluateLiveness([frame], liveHistory, 'light');
  console.log(`\n2. Bona Fide Live Presentation:`);
  console.log(`   Passed:          ${liveResult.passed ? 'YES (PASSED)' : 'NO'}`);
  console.log(`   Motion Variance: ${liveResult.motionVariance.toFixed(4)}`);
  console.log(`   Score:           ${liveResult.score.toFixed(2)}`);

  // 3. Active Challenge-Response (Strong Mode)
  console.log(`\n3. Active Challenge Lifecycle (Strong Mode):`);
  const challenge = liveness.startNewChallenge();
  console.log(`   Prompt:          "${challenge.prompt}"`);
  console.log(`   Challenge Type:  ${challenge.type}`);
  console.log(`   State:           ${liveness.getState()}`);
  console.log(`   Timeout:         ${challenge.timeoutMs} ms`);

  frame.zeroize();
  console.log('\n✓ Liveness example completed successfully.');
}

run().catch(console.error);
