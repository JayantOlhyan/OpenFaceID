import { performance } from 'perf_hooks';
import { DesktopEngine } from '../apps/desktop/src/daemon.ts';
import { EventBus } from '../packages/core/src/index.ts';

async function runLongRunTest() {
  console.log('=== OpenFaceID Phase 5 Long-Run Stability & Soak Test ===');
  const engine = new DesktopEngine({ leaveTimeoutSec: 15, gracePeriodSec: 3 });
  await engine.initialize();

  const memInitial = process.memoryUsage();
  const cpuStart = process.cpuUsage();
  const tStart = performance.now();

  console.log(`Initial RSS:  ${(memInitial.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Initial Heap: ${(memInitial.heapUsed / (1024 * 1024)).toFixed(2)} MB`);

  const ITERATIONS = 1000;
  console.log(`\nProcessing ${ITERATIONS} continuous frame cycles through full vision & canonical presence pipeline...`);

  // Synthesize test frames
  const w = 640;
  const h = 480;
  for (let i = 0; i < ITERATIONS; i++) {
    const buffer = new Uint8ClampedArray(w * h * 4).fill(120);
    const frame = {
      data: buffer,
      width: w,
      height: h,
      pixelFormat: 'RGBA',
      timestamp: Date.now(),
      frameIndex: i,
      zeroize: () => buffer.fill(0),
    };

    await engine.processFrame(frame);

    // Periodically simulate disconnect & reconnect cycle
    if (i === 300 || i === 700) {
      EventBus.getInstance().emit('CAMERA_DISCONNECTED', { deviceId: 'cam_test', timestamp: Date.now() });
      await new Promise((r) => setTimeout(r, 10));
      EventBus.getInstance().emit('CAMERA_CONNECTED', { deviceId: 'cam_test', timestamp: Date.now() });
    }
  }

  // Force V8 GC if available or wait for event loop ticks
  if (global.gc) global.gc();
  await new Promise((r) => setTimeout(r, 100));

  const memFinal = process.memoryUsage();
  const cpuDiff = process.cpuUsage(cpuStart);
  const tElapsed = performance.now() - tStart;

  const rssGrowthMb = (memFinal.rss - memInitial.rss) / (1024 * 1024);
  const heapGrowthMb = (memFinal.heapUsed - memInitial.heapUsed) / (1024 * 1024);
  const avgFrameTimeMs = tElapsed / ITERATIONS;

  console.log('\n=== Soak Test Results ===');
  console.log(`Processed Frames:     ${ITERATIONS}`);
  console.log(`Total Elapsed Time:   ${(tElapsed / 1000).toFixed(2)}s`);
  console.log(`Average Cycle Time:   ${avgFrameTimeMs.toFixed(3)}ms`);
  console.log(`Final RSS:            ${(memFinal.rss / (1024 * 1024)).toFixed(2)} MB (delta: ${rssGrowthMb.toFixed(2)} MB)`);
  console.log(`Final Heap Used:      ${(memFinal.heapUsed / (1024 * 1024)).toFixed(2)} MB (delta: ${heapGrowthMb.toFixed(2)} MB)`);
  console.log(`CPU Time (usr/sys):   ${(cpuDiff.user / 1000).toFixed(1)}ms / ${(cpuDiff.system / 1000).toFixed(1)}ms`);

  const state = await engine.getAuthoritativeState();
  console.log(`Final Canonical State: ${state.canonicalState.presence}`);
  console.log(`Camera State:          ${state.camera.status}`);

  await engine.shutdown();
  console.log('✓ Long-Run Stability & Soak Test PASSED without unhandled rejections or crashes.\n');
}

runLongRunTest().catch((err) => {
  console.error('Long-run test failed:', err);
  process.exit(1);
});
