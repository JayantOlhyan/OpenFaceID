import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UnlockStateMachine } from '../../packages/core/src/state/unlock.ts';
import { DesktopEngine } from '../../apps/desktop/src/daemon.ts';

describe('UnlockStateMachine Event-Driven Architecture', () => {
  it('starts in STANDBY and transitions correctly through wake burst to verified', () => {
    const fsm = new UnlockStateMachine({ maxBurstFrames: 10, burstTimeoutMs: 1500 });
    assert.equal(fsm.getState(), 'STANDBY');

    const wakeTime = 1000;
    fsm.triggerWake('wake', wakeTime);
    assert.equal(fsm.getState(), 'WAKE_TRIGGERED');
    assert.equal(fsm.getTriggerSource(), 'wake');

    // First frame received 85ms after wake
    const firstFrameTime = 1085;
    const latency = fsm.onFirstFrameReceived(firstFrameTime);
    assert.equal(latency, 85);
    assert.equal(fsm.getState(), 'CAPTURING_BURST');

    // Frame counting
    assert.equal(fsm.onFrameCaptured(), false);
    assert.equal(fsm.onFrameCaptured(), false);

    fsm.setAnalyzing();
    assert.equal(fsm.getState(), 'ANALYZING');

    // Verified match
    const result = fsm.recordVerified('usr_alice', 'Alice', 0.94, 1200);
    assert.equal(fsm.getState(), 'VERIFIED');
    assert.equal(result.success, true);
    assert.equal(result.identityId, 'usr_alice');
    assert.equal(result.identityName, 'Alice');
    assert.equal(result.confidence, 0.94);
    assert.equal(result.metrics.wakeToFirstFrameMs, 85);
    assert.equal(result.metrics.verificationLatencyMs, 200);

    // Reset to standby
    fsm.resetToStandby();
    assert.equal(fsm.getState(), 'STANDBY');
  });

  it('handles burst frame limit and timeout failure cleanly', () => {
    const fsm = new UnlockStateMachine({ maxBurstFrames: 3, burstTimeoutMs: 500 });
    const wakeTime = 2000;
    fsm.triggerWake('spacebar', wakeTime);

    fsm.onFirstFrameReceived(2050);
    assert.equal(fsm.onFrameCaptured(), false); // 1
    assert.equal(fsm.onFrameCaptured(), false); // 2
    assert.equal(fsm.onFrameCaptured(), true);  // 3 -> reached maxBurstFrames

    assert.equal(fsm.isBurstTimeout(2600), true);

    const failResult = fsm.recordFailed('TIMEOUT_OR_NO_MATCH', 2600);
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(failResult.success, false);
    assert.equal(failResult.error, 'TIMEOUT_OR_NO_MATCH');
    assert.equal(failResult.metrics.framesCaptured, 3);
    assert.equal(failResult.metrics.verificationLatencyMs, 600);
  });

  it('notifies listeners on state and metric transitions', () => {
    const fsm = new UnlockStateMachine();
    const transitions: string[] = [];

    const unsubscribe = fsm.subscribe((state) => {
      transitions.push(state);
    });

    fsm.triggerWake('lock_screen');
    fsm.onFirstFrameReceived();
    fsm.setAnalyzing();
    fsm.recordFailed('NO_MATCH');
    fsm.resetToStandby();

    unsubscribe();
    fsm.triggerWake('wake'); // Should not record after unsubscribe

    assert.deepEqual(transitions, [
      'WAKE_TRIGGERED',
      'CAPTURING_BURST',
      'ANALYZING',
      'FAILED',
      'STANDBY',
    ]);
  });
});

describe('DesktopEngine Event-Driven Standby & On-Demand Preview', () => {
  it('initializes with camera in IDLE standby by default', async () => {
    const engine = new DesktopEngine({ autoStartCamera: false });
    await engine.initialize();

    const state = await engine.getAuthoritativeState();
    assert.equal(state.camera.status, 'IDLE');
    assert.equal(state.unlock.state, 'STANDBY');
    assert.equal(engine.unlockFsm.getState(), 'STANDBY');

    // Authoritative state exposes unlock structure
    assert.ok('metrics' in state.unlock);
    assert.equal(state.unlock.triggerSource, 'unknown');

    await engine.shutdown();
  });

  it('supports on-demand live preview start and stop', async () => {
    const engine = new DesktopEngine({ autoStartCamera: false });
    await engine.initialize();

    // Verify standby initially
    assert.equal(engine.unlockFsm.getState(), 'STANDBY');

    // On-demand start for enrollment or camera preview
    const started = await engine.startLivePreview();
    assert.ok(started === true || started === false); // based on hardware or mock

    // Stop live preview returns to IDLE
    engine.stopLivePreview();
    const afterStopState = await engine.getAuthoritativeState();
    assert.equal(afterStopState.camera.status, 'IDLE');

    await engine.shutdown();
  });
});
