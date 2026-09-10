import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PresenceTracker } from '../../packages/presence/src/index.ts';
import { PolicyEngine, ActionDispatcher } from '../../packages/automation/src/index.ts';
import { EventBus } from '../../packages/core/src/index.ts';

describe('PresenceTracker Lifecycle', () => {
  it('detects user presence, enters grace period, and transitions to USER_LEFT on absence timeout', () => {
    const tracker = new PresenceTracker({ leaveTimeoutSec: 10, gracePeriodSec: 2 });

    // 1. Face seen
    tracker.onFaceDetected();
    assert.equal(tracker.getState(), 'USER_PRESENT');

    // 2. 1 second elapsed (within normal presence)
    const t1 = Date.now() + 1000;
    tracker.onNoFaceDetected(t1);
    assert.equal(tracker.getState(), 'USER_PRESENT');

    // 3. 3 seconds elapsed (exceeds 2s grace period)
    const t3 = Date.now() + 3000;
    tracker.onNoFaceDetected(t3);
    assert.equal(tracker.getState(), 'GRACE_PERIOD');

    // 4. Face returns during grace period -> restores USER_PRESENT
    tracker.onFaceDetected();
    assert.equal(tracker.getState(), 'USER_PRESENT');

    // 5. 11 seconds elapsed -> triggers USER_LEFT
    const t11 = Date.now() + 11000;
    tracker.onNoFaceDetected(t11);
    assert.equal(tracker.getState(), 'USER_LEFT');
  });
});

describe('PolicyEngine & ActionDispatcher', () => {
  it('triggers lock action upon receiving USER_LEFT event', async () => {
    let lockDispatched = false;
    // Intercept ActionDispatcher
    const originalDispatch = ActionDispatcher.dispatch;
    ActionDispatcher.dispatch = async (action) => {
      if (action === 'lock_screen') {
        lockDispatched = true;
        return true;
      }
      return false;
    };

    const policy = new PolicyEngine({
      lockOnLeave: true,
      pauseAppOnLeave: false,
      notifyOnMatch: false,
    });

    // Fire USER_LEFT event through EventBus
    EventBus.getInstance().emit('USER_LEFT', { absentDurationMs: 15000 });

    // Allow event loop tick
    await new Promise((r) => setTimeout(r, 20));

    assert.equal(lockDispatched, true);

    policy.destroy();
    ActionDispatcher.dispatch = originalDispatch;
  });

  it('triggers notification upon receiving IDENTITY_MATCHED event', async () => {
    let notifyDispatched = false;
    const originalDispatch = ActionDispatcher.dispatch;
    ActionDispatcher.dispatch = async (action, payload) => {
      if (action === 'notify') {
        notifyDispatched = true;
        assert.ok(payload.body?.includes('Jayant'));
        return true;
      }
      return false;
    };

    const policy = new PolicyEngine({
      lockOnLeave: false,
      pauseAppOnLeave: false,
      notifyOnMatch: true,
    });

    EventBus.getInstance().emit('IDENTITY_MATCHED', { identityName: 'Jayant' });

    await new Promise((r) => setTimeout(r, 20));
    assert.equal(notifyDispatched, true);

    policy.destroy();
    ActionDispatcher.dispatch = originalDispatch;
  });
});
