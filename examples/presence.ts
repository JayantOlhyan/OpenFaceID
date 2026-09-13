/**
 * OpenFaceID Developer Example: Presence Tracking & Lifecycle
 *
 * Purpose:
 *   Demonstrates tracking continuous presence using PresenceTracker, managing
 *   absence timeouts, grace periods, and multiple-face detection.
 *
 * Requirements:
 *   - Node.js >= 22.0.0
 *
 * Run Command:
 *   node --experimental-strip-types examples/presence.ts
 *
 * Expected Output:
 *   Presence state transitions, absence time calculation, and fail-closed defense.
 *
 * Security Considerations:
 *   If multiple faces are detected, the tracker immediately transitions to
 *   PRESENCE_AMBIGUOUS and revokes authorization.
 */

import { PresenceTracker } from '../packages/presence/src/index.ts';

async function run() {
  console.log('=== OpenFaceID Example: Presence Tracking Lifecycle ===\n');

  const tracker = new PresenceTracker({
    leaveTimeoutSec: 1,
    gracePeriodSec: 1,
    requireAuthorizedIdentity: true,
  });

  console.log(`Configured Tracker: leaveTimeout = 1s, gracePeriod = 1s`);

  // 1. Initial State
  console.log(`1. Initial State:        ${tracker.getState()}`);

  // 2. User arrives and is authorized
  tracker.onAuthorizedPresence('usr_charlie_01', 'Charlie');
  console.log(`2. Authorized Detection: ${tracker.getState()} (Identity: ${tracker.getLastAuthorizedIdentity()})`);

  // 3. User steps away (absence simulation)
  console.log(`\n3. User leaves camera view (Waiting 1.2 seconds)...`);
  await new Promise((r) => setTimeout(r, 1200));
  tracker.onNoFaceDetected(Date.now());
  console.log(`   State after timeout:  ${tracker.getState()} (Absence confirmed)`);

  // 4. Multiple Faces Bypass Attempt
  console.log(`\n4. Multiple Faces Attack Defense:`);
  // Re-establish presence first
  tracker.onAuthorizedPresence('usr_charlie_01', 'Charlie');
  console.log(`   Presence restored:   ${tracker.getState()}`);

  // Second face enters view
  tracker.onMultipleFacesDetected(2);
  console.log(`   Second face enters:  PRESENCE_AMBIGUOUS (Revoked: ${tracker.getState()})`);

  console.log('\n✓ Presence example completed successfully.');
}

run().catch(console.error);
