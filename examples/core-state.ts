/**
 * OpenFaceID Developer Example: Authoritative Presence State Transitions
 *
 * Purpose:
 *   Demonstrates subscribing to and inspecting authoritative state transitions
 *   using CanonicalStateMachine (the single source of truth for presence).
 *
 * Requirements:
 *   - Node.js >= 22.0.0
 *
 * Run Command:
 *   node --experimental-strip-types examples/core-state.ts
 *
 * Expected Output:
 *   Initial state snapshot, state transitions, and fail-closed multiple-face defense.
 *
 * Security Considerations:
 *   The authoritative state machine enforces strict fail-closed presence:
 *   PRESENCE_AUTHORIZED requires both valid identity matching and active liveness.
 *   Multiple faces immediately trigger PRESENCE_AMBIGUOUS and revoke authorization.
 */

import { CanonicalStateMachine } from '../packages/core/src/index.ts';

async function run() {
  console.log('=== OpenFaceID Example: Core Presence State ===\n');

  // 1. Initialize CanonicalStateMachine
  const machine = new CanonicalStateMachine(20);
  let snapshot = machine.getSnapshot();

  console.log('1. Initial Authoritative State:');
  console.log(`   System:       ${snapshot.system}`);
  console.log(`   Camera:       ${snapshot.camera}`);
  console.log(`   Presence:     ${snapshot.presence}`);
  console.log(`   Reason:       ${snapshot.unauthorizedReason}`);

  // 2. Subscribe to State Changes
  machine.subscribe((updated) => {
    console.log(`\n[State Transition Event] -> Presence: ${updated.presence}`);
    if (updated.unauthorizedReason) {
      console.log(`   Reason: ${updated.unauthorizedReason}`);
    }
  });

  // 3. Camera is ready
  console.log('\n2. Hardware Event: Camera Initialized');
  machine.setCameraState('CAMERA_READY');

  // 4. Face detected, recognized, and liveness passed -> Authorized
  console.log('\n3. Vision Event: Face Detected + Liveness Passed + Identity Recognized');
  machine.updateVisionState({
    faceCount: 1,
    detectionState: 'FACE_DETECTED',
    livenessState: 'LIVENESS_PASSED',
    identityState: 'IDENTITY_RECOGNIZED',
    identityId: 'usr_alice_01',
    identityName: 'Alice',
  });

  snapshot = machine.getSnapshot();
  console.log(`   Presence:     \x1b[32m${snapshot.presence}\x1b[0m`);
  console.log(`   Identity:     ${snapshot.activeIdentityName} (${snapshot.activeIdentityId})`);
  console.log(`   Expires in:   ${snapshot.presenceSession.timeoutSec}s`);

  // 5. Multiple Faces Attack Defense: Second face enters view
  console.log('\n4. Security Event: Multiple Faces Detected (Tailgating / Shoulder Surfing)');
  machine.updateVisionState({
    faceCount: 2,
    detectionState: 'MULTIPLE_FACES',
    livenessState: 'LIVENESS_PASSED',
    identityState: 'IDENTITY_RECOGNIZED',
  });

  snapshot = machine.getSnapshot();
  console.log(`   Presence:     \x1b[33m${snapshot.presence}\x1b[0m (PRESENCE_AMBIGUOUS)`);
  console.log(`   Authorized:   ${snapshot.activeIdentityId || 'None (Revoked)'}`);
  console.log(`   Reason:       ${snapshot.unauthorizedReason}`);

  console.log('\n✓ Core state example completed successfully.');
}

run().catch(console.error);
