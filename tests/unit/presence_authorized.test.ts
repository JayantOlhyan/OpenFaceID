import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PresenceTracker } from '../../packages/presence/src/index.ts';
import { EventBus } from '../../packages/core/src/index.ts';

describe('Authorized Presence Verification (Phase 3)', () => {
  it('strictly requires authorized identity and liveness to transition to USER_PRESENT', () => {
    const tracker = new PresenceTracker({
      leaveTimeoutSec: 10,
      gracePeriodSec: 2,
      requireAuthorizedIdentity: true,
    });

    assert.equal(tracker.getState(), 'UNKNOWN');
    assert.equal(tracker.getLastAuthorizedIdentity(), null);

    // 1. Unknown face detected -> does NOT transition to USER_PRESENT
    tracker.onUnknownFaceDetected();
    assert.equal(tracker.getState(), 'UNKNOWN');
    assert.equal(tracker.getLastAuthorizedIdentity(), null);

    // 2. Authorized presence verified with identity and liveness -> transitions to USER_PRESENT
    tracker.onAuthorizedPresence('usr_test_01', 'Test User');
    assert.equal(tracker.getState(), 'USER_PRESENT');
    assert.equal(tracker.getLastAuthorizedIdentity(), 'usr_test_01');

    // 3. Unknown face detected while user present does not reset authorized identity
    tracker.onUnknownFaceDetected();
    assert.equal(tracker.getLastAuthorizedIdentity(), 'usr_test_01');
  });

  it('handles absence timeout and grace period cycles properly', () => {
    const tracker = new PresenceTracker({
      leaveTimeoutSec: 8,
      gracePeriodSec: 2,
      requireAuthorizedIdentity: true,
    });

    tracker.onAuthorizedPresence('usr_01', 'Alice');
    assert.equal(tracker.getState(), 'USER_PRESENT');

    // 1 second elapsed -> still USER_PRESENT
    const now = Date.now();
    tracker.onNoFaceDetected(now + 1000);
    assert.equal(tracker.getState(), 'USER_PRESENT');

    // 3 seconds elapsed -> GRACE_PERIOD
    tracker.onNoFaceDetected(now + 3000);
    assert.equal(tracker.getState(), 'GRACE_PERIOD');

    // 9 seconds elapsed -> USER_LEFT
    tracker.onNoFaceDetected(now + 9000);
    assert.equal(tracker.getState(), 'USER_LEFT');
  });
});
