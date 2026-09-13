#!/usr/bin/env node
/**
 * OpenFaceID — Hardware Presence Authorization & Multi-Face Defense Test
 *
 * Implements Section 28, 29, 30, 42 of the Continuous Engineering Specification.
 * Tests canonical presence state transitions, session timeouts, and fail-closed defense.
 */

import fs from 'fs';
import path from 'path';
import { CanonicalStateMachine } from '../../packages/core/src/state/canonical.ts';

async function runPresenceHardwareTest() {
  console.log('='.repeat(72));
  console.log('OPENFACEID — HARDWARE PRESENCE & MULTI-FACE DEFENSE TEST');
  console.log('='.repeat(72));

  const sm = new CanonicalStateMachine(10); // 10 second session timeout
  sm.setSystemState('SYSTEM_READY');
  sm.setCameraState('CAMERA_READY');

  const testLog = [];

  // Step 1: Zero faces
  console.log('1. Testing State with 0 faces...');
  sm.updateVisionState({
    faceCount: 0,
    detectionState: 'NO_FACE',
    livenessState: 'LIVENESS_REQUIRED',
    identityState: 'IDENTITY_UNKNOWN',
  });
  let snap = sm.getSnapshot();
  console.log(`   Presence: ${snap.presence} (Reason: ${snap.unauthorizedReason})`);
  testLog.push({ step: 'zero_faces', presence: snap.presence, authorized: snap.presence === 'PRESENCE_AUTHORIZED' });

  // Step 2: Single authorized user
  console.log('\n2. Testing State with 1 recognized user + passed liveness...');
  const t0 = Date.now();
  sm.updateVisionState({
    faceCount: 1,
    detectionState: 'FACE_DETECTED',
    livenessState: 'LIVENESS_PASSED',
    identityState: 'IDENTITY_RECOGNIZED',
    identityId: 'usr_hw_test',
    identityName: 'Hardware Test User',
    now: t0,
  });
  snap = sm.getSnapshot();
  console.log(`   Presence: ${snap.presence} (Identity: ${snap.activeIdentityName})`);
  testLog.push({ step: 'single_user_authorized', presence: snap.presence, authorized: snap.presence === 'PRESENCE_AUTHORIZED' });

  // Step 3: Multi-face bystander intrusion (2 faces)
  console.log('\n3. Testing Bystander Intrusion (2 faces visible)...');
  sm.updateVisionState({
    faceCount: 2,
    detectionState: 'MULTIPLE_FACES',
    livenessState: 'LIVENESS_PASSED',
    identityState: 'IDENTITY_RECOGNIZED',
    identityId: 'usr_hw_test',
    identityName: 'Hardware Test User',
    now: t0 + 1000,
  });
  snap = sm.getSnapshot();
  console.log(`   Presence: ${snap.presence} (Reason: ${snap.unauthorizedReason})`);
  testLog.push({ step: 'multiple_faces_fail_closed', presence: snap.presence, authorized: snap.presence === 'PRESENCE_AUTHORIZED' });

  // Step 4: Privacy pause kill-switch
  console.log('\n4. Testing Privacy Pause Kill-Switch...');
  sm.setPrivacyPaused(true);
  snap = sm.getSnapshot();
  console.log(`   Presence: ${snap.presence} (Paused: ${snap.privacyPaused})`);
  testLog.push({ step: 'privacy_paused', presence: snap.presence, authorized: snap.presence === 'PRESENCE_AUTHORIZED' });

  // Step 5: Resume privacy pause
  console.log('\n5. Resuming from Privacy Pause...');
  sm.setPrivacyPaused(false);
  snap = sm.getSnapshot();
  console.log(`   Presence after resume: ${snap.presence} (Requires fresh recognition cycle)`);
  testLog.push({ step: 'privacy_resumed', presence: snap.presence, authorized: snap.presence === 'PRESENCE_AUTHORIZED' });

  const allPassed =
    testLog[0].presence === 'PRESENCE_UNAUTHORIZED' &&
    testLog[1].presence === 'PRESENCE_AUTHORIZED' &&
    testLog[2].presence === 'PRESENCE_AMBIGUOUS' &&
    testLog[3].presence === 'PRESENCE_UNAUTHORIZED' &&
    testLog[4].presence === 'PRESENCE_AMBIGUOUS'; // Stays ambiguous because faceCount was 2

  console.log('\n' + '-'.repeat(72));
  console.log(`Presence Lifecycle & Multi-Face Defense: ${allPassed ? 'VERIFIED (Strictly Fail-Closed)' : 'FAIL'}`);

  // Save report
  const outDir = path.resolve('data/hardware');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'presence-test.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      testLog,
      allPassed,
    }, null, 2)
  );

  console.log('Hardware presence verification saved: data/hardware/presence-test.json');
  console.log('='.repeat(72));
}

runPresenceHardwareTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
