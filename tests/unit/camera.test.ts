import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FrameSampler, CameraManager } from '../../packages/camera/src/index.ts';

describe('FrameSampler & Memory Zeroize', () => {
  it('throttles frame rate to target FPS interval', () => {
    const sampler = new FrameSampler(10); // 100ms interval
    const t0 = 1000;

    assert.equal(sampler.shouldSample(t0), true);
    assert.equal(sampler.shouldSample(t0 + 50), false); // only 50ms elapsed
    assert.equal(sampler.shouldSample(t0 + 105), true); // 105ms elapsed
  });

  it('allocates frame and securely zeroizes memory buffer on discard', () => {
    const sampler = new FrameSampler(15);
    const frame = sampler.createFrame(10, 10);

    // Write dummy pixel data
    frame.data[0] = 255;
    frame.data[1] = 128;
    assert.equal(frame.data[0], 255);

    // Call zeroize()
    frame.zeroize();
    assert.equal(frame.data[0], 0);
    assert.equal(frame.data[1], 0);
  });
});

describe('CameraManager Lifecycle', () => {
  it('enumerates camera devices and selects default sensor', async () => {
    const manager = new CameraManager();
    const devices = await manager.enumerateDevices();

    assert.ok(devices.length > 0);
    assert.equal(devices[0].isDefault, true);

    const selected = await manager.selectDevice(devices[0].deviceId);
    assert.equal(selected, true);
  });

  it('starts capture stream, delivers frames, and stops capture', async () => {
    const manager = new CameraManager({ targetFps: 30, preferredWidth: 320, preferredHeight: 240 });
    let frameReceived = false;

    await manager.startCapture((frame) => {
      frameReceived = true;
      assert.equal(frame.width, 320);
      assert.equal(frame.height, 240);
      frame.zeroize();
    });

    assert.equal(manager.getState(), 'active');

    // Wait 50ms for frame
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(frameReceived, true);

    manager.stopCapture();
    assert.equal(manager.getState(), 'paused');
  });

  it('handles disconnect and reconnect recovery', async () => {
    const manager = new CameraManager();
    await manager.startCapture(() => {});
    assert.equal(manager.getState(), 'active');

    manager.simulateDisconnect();
    assert.equal(manager.getState(), 'disconnected');

    const reconnected = await manager.attemptReconnect();
    assert.equal(reconnected, true);
    assert.equal(manager.getState(), 'active');

    manager.stopCapture();
  });
});
