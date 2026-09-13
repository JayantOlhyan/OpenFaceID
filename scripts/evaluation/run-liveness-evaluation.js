#!/usr/bin/env node
/**
 * OpenFaceID — Liveness & Presentation Attack Detection (PAD) Evaluation Runner
 *
 * Evaluates passive and active presentation attack resistance:
 * - Printed photo attack
 * - Screen replay attack
 * - Freeze-frame attack
 * - Live bona fide presentation with natural micro-motion
 * - Active challenge compliance and timeout
 *
 * Computes ISO/IEC 30107-3 biometric presentation attack metrics:
 * - APCER (Attack Presentation Classification Error Rate)
 * - BPCER (Bona Fide Presentation Classification Error Rate)
 */

import fs from 'fs';
import path from 'path';
import { LivenessDetector } from '../../packages/vision/src/liveness.ts';
import { FrameSampler } from '../../packages/camera/src/index.ts';

async function runLivenessEvaluation() {
  console.log('='.repeat(72));
  console.log('OPENFACEID — LIVENESS & PRESENTATION ATTACK DETECTION BENCHMARK');
  console.log('='.repeat(72));

  const sampler = new FrameSampler(15);

  function makeFrame(w = 640, h = 480, texturePattern = 30) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const pat = (x % 6 < 3 && y % 6 < 3) ? texturePattern : -texturePattern;
        data[idx] = 160 + pat;
        data[idx + 1] = 135 + pat;
        data[idx + 2] = 115 + pat;
        data[idx + 3] = 255;
      }
    }
    return sampler.createFrame(w, h, data);
  }

  function makeLandmarks(cx = 320, cy = 240, jitter = 0) {
    return {
      leftEye: { x: cx - 40 + jitter, y: cy - 20 + jitter },
      rightEye: { x: cx + 40 + jitter, y: cy - 20 + jitter },
      noseTip: { x: cx + jitter, y: cy + 10 + jitter },
      leftMouth: { x: cx - 30 + jitter, y: cy + 45 + jitter },
      rightMouth: { x: cx + 30 + jitter, y: cy + 45 + jitter },
      leftEar: { x: cx - 85 + jitter, y: cy + jitter },
      rightEar: { x: cx + 85 + jitter, y: cy + jitter },
    };
  }

  const detector = new LivenessDetector();
  const testScenarios = [];

  // Scenario 1: Bona Fide Live Presentations (30 trials)
  let livePass = 0;
  let liveFail = 0;
  for (let i = 0; i < 30; i++) {
    const frame = makeFrame(640, 480, 25);
    // Subtle involuntary head tremor (0.5 - 2px)
    const history = [
      makeLandmarks(320, 240, 0),
      makeLandmarks(320, 240, 1.2),
      makeLandmarks(320, 240, -0.8),
      makeLandmarks(320, 240, 1.5),
      makeLandmarks(320, 240, 0.4),
    ];
    const frames = history.map(() => frame);
    const res = await detector.evaluateLiveness(frames, history, 'light');
    if (res.passed) livePass++;
    else liveFail++;
  }
  testScenarios.push({
    name: 'Bona Fide Live Presentation',
    type: 'Bona Fide',
    trials: 30,
    passed: livePass,
    failed: liveFail,
    classification: livePass === 30 ? 'RESISTANT' : 'PARTIALLY DEGRADED',
  });

  // Scenario 2: 2D Printed Photo Attacks (30 trials)
  let photoPass = 0;
  let photoBlocked = 0;
  for (let i = 0; i < 30; i++) {
    const frame = makeFrame(640, 480, 10);
    // Static identical landmarks across all frames
    const staticLm = makeLandmarks(320, 240, 0);
    const history = [staticLm, staticLm, staticLm, staticLm, staticLm];
    const frames = history.map(() => frame);
    const res = await detector.evaluateLiveness(frames, history, 'light');
    if (res.passed) photoPass++;
    else photoBlocked++;
  }
  testScenarios.push({
    name: '2D Static Photo Presentation Attack',
    type: 'Attack',
    trials: 30,
    passed: photoPass,
    failed: photoBlocked,
    classification: photoPass === 0 ? 'RESISTANT (Zero Bypass)' : 'VULNERABLE',
  });

  // Scenario 3: Video Replay / Freeze Frame Attack (30 trials)
  let replayPass = 0;
  let replayBlocked = 0;
  for (let i = 0; i < 30; i++) {
    const frame = makeFrame(640, 480, 5); // Low texture screen moiré
    const lm = makeLandmarks(320, 240, 0.1); // Sub-pixel camera sensor noise only
    const history = [lm, lm, lm, lm, lm];
    const frames = history.map(() => frame);
    const res = await detector.evaluateLiveness(frames, history, 'light');
    if (res.passed) replayPass++;
    else replayBlocked++;
  }
  testScenarios.push({
    name: 'Digital Screen Replay / Freeze Frame',
    type: 'Attack',
    trials: 30,
    passed: replayPass,
    failed: replayBlocked,
    classification: replayPass === 0 ? 'RESISTANT (Zero Bypass)' : 'VULNERABLE',
  });

  // Scenario 4: Active Challenge Non-Compliance (Attack trying to ignore prompt) (20 trials)
  let challengeIgnorePass = 0;
  let challengeIgnoreBlocked = 0;
  for (let i = 0; i < 20; i++) {
    const d = new LivenessDetector();
    const frame = makeFrame();
    const lm = makeLandmarks(320, 240, 0);
    // Issue challenge
    await d.evaluateLiveness([frame, frame], [lm, lm], 'strong');
    // Simulate timeout without performing challenge
    const active = d.getActiveChallenge();
    if (active) active.issuedAt = Date.now() - 8000;
    const res = await d.evaluateLiveness([frame, frame], [lm, lm], 'strong');
    if (res.passed) challengeIgnorePass++;
    else challengeIgnoreBlocked++;
  }
  testScenarios.push({
    name: 'Active Challenge Non-Compliance (Timeout)',
    type: 'Attack',
    trials: 20,
    passed: challengeIgnorePass,
    failed: challengeIgnoreBlocked,
    classification: challengeIgnorePass === 0 ? 'RESISTANT (Timed Out)' : 'VULNERABLE',
  });

  // Scenario 5: Active Challenge Compliance (Live user complies with head turn) (20 trials)
  let challengeCompliedPass = 0;
  let challengeCompliedFail = 0;
  for (let i = 0; i < 20; i++) {
    const d = new LivenessDetector();
    const frame = makeFrame();
    const c = d.startNewChallenge();
    c.type = 'TURN_LEFT_15';
    c.timeoutMs = 6000;
    c.issuedAt = Date.now();

    const straight = makeLandmarks(320, 240, 0);
    const turned = { ...straight, noseTip: { x: 295, y: 245 } };
    const history = [straight, straight, turned, turned];
    const frames = history.map(() => frame);

    const res = await d.evaluateLiveness(frames, history, 'strong');
    if (res.passed) challengeCompliedPass++;
    else challengeCompliedFail++;
  }
  testScenarios.push({
    name: 'Active Challenge Compliance (Head Turn)',
    type: 'Bona Fide',
    trials: 20,
    passed: challengeCompliedPass,
    failed: challengeCompliedFail,
    classification: challengeCompliedPass === 20 ? 'ROBUST COMPLIANCE' : 'INTERMITTENT',
  });

  // Calculate APCER and BPCER
  const totalAttacks = 30 + 30 + 20;
  const attackPasses = photoPass + replayPass + challengeIgnorePass;
  const apcer = (attackPasses / totalAttacks) * 100;

  const totalBonaFide = 30 + 20;
  const bonaFideFails = liveFail + challengeCompliedFail;
  const bpcer = (bonaFideFails / totalBonaFide) * 100;

  console.log('| Scenario                               | Type      | Trials | Passed | Blocked | Security Status          |');
  console.log('|----------------------------------------|-----------|--------|--------|---------|--------------------------|');
  for (const s of testScenarios) {
    console.log(
      `| ${s.name.padEnd(38)} | ${s.type.padEnd(9)} | ${String(s.trials).padEnd(6)} | ${String(s.passed).padEnd(6)} | ${String(s.failed).padEnd(7)} | ${s.classification.padEnd(24)} |`
    );
  }
  console.log('-'.repeat(72));
  console.log(`ISO/IEC 30107-3 Presentation Attack Detection Metrics:`);
  console.log(`- APCER (Attack Presentation Classification Error Rate): ${apcer.toFixed(2)}% (Target: < 1.0%)`);
  console.log(`- BPCER (Bona Fide Presentation Classification Error Rate): ${bpcer.toFixed(2)}% (Target: < 5.0%)`);
  console.log('='.repeat(72));

  const outDir = path.resolve('data/evaluation');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'liveness-eval.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), apcer, bpcer, testScenarios }, null, 2)
  );
}

runLivenessEvaluation().catch((err) => {
  console.error(err);
  process.exit(1);
});
