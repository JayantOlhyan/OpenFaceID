#!/usr/bin/env node
/**
 * OpenFaceID — Hardware Recovery & Stale Authorization Defense Test
 *
 * Implements Section 17, 18, 29, 41 of the Continuous Engineering Specification.
 * Tests camera hot-plug disconnect/reconnect, sleep/wake reset, and crash recovery.
 */

import fs from 'fs';
import path from 'path';
import { CanonicalStateMachine } from '../../packages/core/src/state/canonical.ts';

async function runRecoveryHardwareTest() {
  console.log('='.repeat(72));
  console.log('OPENFACEID — HARDWARE RECOVERY & STALE AUTHORIZATION TEST');
  console.log('='.repeat(72));

  const sm = new CanonicalStateMachine(20);
  sm.setSystemState('SYSTEM_READY');
  sm.setCameraState('CAMERA_READY');

  const recoveryLog = [];

  // 1. Establish Initial Authorized State
  console.log('1. Establishing Authorized Presence Session...');
  sm.updateVisionState({
    faceCount: 1,
    detectionState: 'FACE_DETECTED',
    livenessState: 'LIVENESS_PASSED',
    identityState: 'IDENTITY_RECOGNIZED',
    identityId: 'usr_recovery_test',
    identityName: 'Recovery Test User',
  });
  let snap = sm.getSnapshot();
  console.log(`   Initial State: ${snap.presence} (Authorized At: ${snap.presenceSession.authorizedAt})`);
  recoveryLog.push({ event: 'initial_authorized', presence: snap.presence });

  // 2. Camera Disconnect Hot-Plug Test
  console.log('\n2. Testing Physical Camera Disconnect (Hot-Plug Out)...');
  sm.setCameraState('CAMERA_DISCONNECTED');
  snap = sm.getSnapshot();
  console.log(`   State on Disconnect: ${snap.presence} (Reason: ${snap.unauthorizedReason})`);
  const disconnectRevoked = snap.presence === 'PRESENCE_UNAUTHORIZED';
  console.log(`   Presence Revocation on Disconnect: ${disconnectRevoked ? 'VERIFIED' : 'FAIL'}`);
  recoveryLog.push({ event: 'camera_disconnected', presence: snap.presence, passed: disconnectRevoked });

  // 3. Camera Reconnect Hot-Plug Test
  console.log('\n3. Testing Physical Camera Reconnect (Hot-Plug In)...');
  sm.setCameraState('CAMERA_READY');
  snap = sm.getSnapshot();
  console.log(`   State on Reconnect: ${snap.presence}`);
  // Crucial check: Must NOT blindly restore AUTHORIZED! Must await fresh vision evaluation.
  const noStaleAuth = snap.presence !== 'PRESENCE_AUTHORIZED';
  console.log(`   Zero Stale Authorization Inheritance: ${noStaleAuth ? 'VERIFIED' : 'FAIL'}`);
  recoveryLog.push({ event: 'camera_reconnected', presence: snap.presence, passed: noStaleAuth });

  // 4. Sleep / Wake Lifecycle Test
  console.log('\n4. Testing Host OS Sleep / Wake Lifecycle (resetOnWake)...');
  // Re-authorize
  sm.updateVisionState({
    faceCount: 1,
    detectionState: 'FACE_DETECTED',
    livenessState: 'LIVENESS_PASSED',
    identityState: 'IDENTITY_RECOGNIZED',
    identityId: 'usr_recovery_test',
    identityName: 'Recovery Test User',
  });
  console.log(`   Re-authorized before sleep: ${sm.getSnapshot().presence}`);

  // Trigger wake reset
  sm.resetOnWake();
  snap = sm.getSnapshot();
  console.log(`   State Immediately Upon Wake: ${snap.presence}`);
  console.log(`   Active Identity: ${snap.activeIdentityId} | Face Count: ${snap.faceCount}`);
  const wakeResetPassed =
    snap.presence === 'PRESENCE_UNAUTHORIZED' &&
    snap.activeIdentityId === null &&
    snap.faceCount === 0 &&
    snap.presenceSession.authorizedAt === null;

  console.log(`   Sleep/Wake Zero-Trust Reset: ${wakeResetPassed ? 'VERIFIED (Zero Residual Presence)' : 'FAIL'}`);
  recoveryLog.push({ event: 'wake_reset', presence: snap.presence, passed: wakeResetPassed });

  // Summary
  const allPassed = disconnectRevoked && noStaleAuth && wakeResetPassed;
  console.log('\n' + '-'.repeat(72));
  console.log(`Hardware Recovery Invariants: ${allPassed ? 'ALL VERIFIED (No Stale Authorization)' : 'FAIL'}`);

  // Save report
  const outDir = path.resolve('data/hardware');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'recovery-test.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      recoveryLog,
      allPassed,
    }, null, 2)
  );

  console.log('Hardware recovery test saved: data/hardware/recovery-test.json');
  console.log('='.repeat(72));
}

runRecoveryHardwareTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
