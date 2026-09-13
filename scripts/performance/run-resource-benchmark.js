import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DesktopEngine } from '../../apps/desktop/src/daemon.ts';
import { ArcFaceEmbedder } from '../../packages/vision/src/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../data/performance');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function runResourceBenchmark() {
  console.log('========================================================================');
  console.log('OPENFACEID — PHASE 8 RUNTIME RESOURCE & MEMORY BENCHMARK');
  console.log('========================================================================');

  const engine = new DesktopEngine({ leaveTimeoutSec: 15, gracePeriodSec: 3 });
  await engine.initialize();

  const w = 640;
  const h = 480;
  function makeFrame(idx = 0) {
    const b = new Uint8ClampedArray(w * h * 4).fill(128);
    return { data: b, width: w, height: h, pixelFormat: 'RGBA', timestamp: Date.now(), frameIndex: idx, zeroize: () => b.fill(0) };
  }

  // 1. Measure Resource Profiles Across 8 States
  console.log('1. Measuring CPU, RSS, Heap & External Memory Across 8 Runtime States...');
  const states = [
    { name: '1. Idle (Process Running)', setup: async () => {} },
    { name: '2. Daemon Active (Camera Inactive)', setup: async () => engine.cameraManager.stopCapture() },
    { name: '3. Camera Active (No Face)', setup: async () => engine.canonicalFsm.setCameraState('CAMERA_READY') },
    { name: '4. Face Visible', setup: async () => engine.canonicalFsm.updateVisionState({ faceCount: 1, detectionState: 'FACE_DETECTED', livenessState: 'LIVENESS_RUNNING', identityState: 'IDENTITY_UNKNOWN' }) },
    { name: '5. Continuous Recognition', setup: async () => { for (let i = 0; i < 20; i++) await engine.processFrame(makeFrame(i)); } },
    { name: '6. Liveness Evaluation', setup: async () => engine.canonicalFsm.updateVisionState({ faceCount: 1, detectionState: 'FACE_DETECTED', livenessState: 'LIVENESS_RUNNING', identityState: 'IDENTITY_UNKNOWN' }) },
    { name: '7. Multiple Faces (Fail-Closed)', setup: async () => engine.canonicalFsm.updateVisionState({ faceCount: 2, detectionState: 'MULTIPLE_FACES', livenessState: 'LIVENESS_REQUIRED', identityState: 'IDENTITY_UNKNOWN' }) },
    { name: '8. Privacy Pause Active', setup: async () => engine.canonicalFsm.setPrivacyPaused(true) },
  ];

  const stateProfiles = [];
  for (const s of states) {
    const cpuBefore = process.cpuUsage();
    const t0 = performance.now();

    await s.setup();
    await new Promise(r => setTimeout(r, 100)); // Sample window

    const t1 = performance.now();
    const cpuDiff = process.cpuUsage(cpuBefore);
    const memAfter = process.memoryUsage();

    const elapsedMs = t1 - t0;
    const cpuPercent = +(((cpuDiff.user + cpuDiff.system) / 1000 / elapsedMs) * 100).toFixed(1);

    stateProfiles.push({
      state: s.name,
      rssMb: +(memAfter.rss / (1024 * 1024)).toFixed(2),
      heapUsedMb: +(memAfter.heapUsed / (1024 * 1024)).toFixed(2),
      heapTotalMb: +(memAfter.heapTotal / (1024 * 1024)).toFixed(2),
      externalMb: +(memAfter.external / (1024 * 1024)).toFixed(2),
      cpuUsagePercent: cpuPercent,
    });
  }

  console.log('| Runtime State                             | RSS (MB) | Heap Used | Heap Total | External | CPU (%) |');
  console.log('|-------------------------------------------|----------|-----------|------------|----------|---------|');
  for (const p of stateProfiles) {
    console.log(`| ${p.state.padEnd(41)} | ${p.rssMb.toString().padStart(8)} | ${p.heapUsedMb.toString().padStart(9)} | ${p.heapTotalMb.toString().padStart(10)} | ${p.externalMb.toString().padStart(8)} | ${p.cpuUsagePercent.toString().padStart(7)} |`);
  }

  // 2. Repeated Lifecycle Stress & Memory Leak Audit (50 cycles)
  console.log('\n2. Auditing Memory Stability Across Repeated Lifecycle Cycles (50 iterations)...');
  console.log('   (Cycle: Camera Stop -> Start -> Recognition -> Liveness -> Privacy Pause -> Resume)');

  const lifecycleCheckpoints = [];
  const startMem = process.memoryUsage();
  lifecycleCheckpoints.push({
    cycle: 0,
    rssMb: +(startMem.rss / (1024 * 1024)).toFixed(2),
    heapUsedMb: +(startMem.heapUsed / (1024 * 1024)).toFixed(2),
    heapTotalMb: +(startMem.heapTotal / (1024 * 1024)).toFixed(2),
    externalMb: +(startMem.external / (1024 * 1024)).toFixed(2),
  });

  const CHECKPOINT_INTERVALS = [10, 25, 50];

  for (let c = 1; c <= 50; c++) {
    // 1. Camera stop
    engine.cameraManager.stopCapture();
    // 2. Camera start
    await engine.cameraManager.startCapture(() => {});
    // 3. Process recognition frame
    await engine.processFrame(makeFrame(c));
    // 4. Liveness state update
    engine.canonicalFsm.updateVisionState({ faceCount: 1, detectionState: 'FACE_DETECTED', livenessState: 'LIVENESS_PASSED', identityState: 'IDENTITY_RECOGNIZED', identityId: 'usr_bench', identityName: 'Bench User' });
    // 5. Privacy pause
    engine.pausePrivacy();
    // 6. Resume
    engine.resumePrivacy();

    // Allow event loop tick
    await new Promise(r => setImmediate(r));

    if (CHECKPOINT_INTERVALS.includes(c)) {
      const mem = process.memoryUsage();
      lifecycleCheckpoints.push({
        cycle: c,
        rssMb: +(mem.rss / (1024 * 1024)).toFixed(2),
        heapUsedMb: +(mem.heapUsed / (1024 * 1024)).toFixed(2),
        heapTotalMb: +(mem.heapTotal / (1024 * 1024)).toFixed(2),
        externalMb: +(mem.external / (1024 * 1024)).toFixed(2),
      });
    }
  }

  console.log('| Lifecycle Cycle Checkpoint | RSS (MB) | Heap Used | Heap Total | External (MB) | ΔRSS (MB) |');
  console.log('|----------------------------|----------|-----------|------------|---------------|-----------|');
  const baseRss = lifecycleCheckpoints[0].rssMb;
  for (const cp of lifecycleCheckpoints) {
    const deltaRss = +(cp.rssMb - baseRss).toFixed(2);
    console.log(`| Cycle ${cp.cycle.toString().padEnd(20)} | ${cp.rssMb.toString().padStart(8)} | ${cp.heapUsedMb.toString().padStart(9)} | ${cp.heapTotalMb.toString().padStart(10)} | ${cp.externalMb.toString().padStart(13)} | ${deltaRss.toString().padStart(9)} |`);
  }

  const finalCycleMem = lifecycleCheckpoints[lifecycleCheckpoints.length - 1];
  const finalDeltaRss = finalCycleMem.rssMb - baseRss;
  let classification = 'STABLE';
  if (finalDeltaRss > 50) classification = 'CONFIRMED LEAK';
  else if (finalDeltaRss > 25) classification = 'LIKELY LEAK';
  else if (finalDeltaRss > 10) classification = 'INVESTIGATE';
  else if (finalDeltaRss > 0) classification = 'PROBABLE RUNTIME CACHE';
  else classification = 'STABLE';

  console.log(`   Memory Classification: ${classification} (Total ΔRSS after 50 cycles: ${finalDeltaRss.toFixed(2)} MB)`);

  // 3. Transient Embedding Memory Accumulation Test (100, 500, 1000, 2500, 5000 iterations)
  console.log('\n3. Testing Transient Embedding Vector Memory Accumulation...');
  const embedder = new ArcFaceEmbedder();
  const dummyLandmarks = {
    leftEye: { x: 280, y: 200 },
    rightEye: { x: 360, y: 200 },
    noseTip: { x: 320, y: 240 },
    leftMouth: { x: 290, y: 280 },
    rightMouth: { x: 350, y: 280 },
  };

  const dummyFrame = makeFrame(0);
  const memBatches = [100, 500, 1000, 2500, 5000];
  const memBatchResults = [];

  for (const count of memBatches) {
    const memStart = process.memoryUsage().heapUsed;
    const t0 = performance.now();

    for (let i = 0; i < count; i++) {
      const v = await embedder.embed(dummyFrame, dummyLandmarks);
      if (v[0] === 999999) console.log('impossible');
    }

    const t1 = performance.now();
    const memEnd = process.memoryUsage().heapUsed;
    const growthMb = +((memEnd - memStart) / (1024 * 1024)).toFixed(2);
    const avgLatencyMs = +((t1 - t0) / count).toFixed(3);

    memBatchResults.push({
      iterations: count,
      durationMs: +(t1 - t0).toFixed(1),
      avgLatencyMs,
      heapGrowthMb: growthMb,
      leakDetected: growthMb > 25.0,
    });
  }

  console.log('| Iterations | Duration (ms) | Avg Latency (ms) | Heap Growth (MB) | Leak Status |');
  console.log('|------------|---------------|------------------|------------------|-------------|');
  for (const m of memBatchResults) {
    console.log(`| ${m.iterations.toString().padEnd(10)} | ${m.durationMs.toString().padEnd(13)} | ${m.avgLatencyMs.toString().padEnd(16)} | ${m.heapGrowthMb.toString().padEnd(16)} | ${m.leakDetected ? 'LEAK DETECTED' : 'BOUNDED (OK) '} |`);
  }

  // 4. Buffer Zeroization Throughput (1080p, 720p, 480p)
  console.log('\n4. Measuring Memory Zeroization Latency across Video Resolutions...');
  const resolutions = [
    { name: '1080p FHD (1920x1080)', bytes: 1920 * 1080 * 4 },
    { name: '720p HD (1280x720)', bytes: 1280 * 720 * 4 },
    { name: '480p SD (640x480)', bytes: 640 * 480 * 4 },
  ];

  const zeroizationResults = [];
  for (const res of resolutions) {
    const buf = new Uint8ClampedArray(res.bytes);
    const times = [];
    for (let i = 0; i < 50; i++) {
      buf.fill(200);
      const t0 = performance.now();
      buf.fill(0);
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];

    zeroizationResults.push({
      resolution: res.name,
      uncompressedBytes: res.bytes,
      sizeMb: +(res.bytes / (1024 * 1024)).toFixed(2),
      medianMs: +median.toFixed(3),
      p95Ms: +p95.toFixed(3),
    });
  }

  console.log('| Resolution              | Uncompressed Size | Median (ms) | P95 (ms)  |');
  console.log('|-------------------------|-------------------|-------------|-----------|');
  for (const z of zeroizationResults) {
    console.log(`| ${z.resolution.padEnd(23)} | ${(z.sizeMb + ' MB').padEnd(17)} | ${z.medianMs.toString().padStart(9)} ms | ${z.p95Ms.toString().padStart(7)} ms |`);
  }

  await engine.shutdown();

  const finalOutput = {
    benchmarkMetadata: {
      benchmarkId: 'PERF-RES-001',
      provenance: 'Runtime Resource, Lifecycle Stress & Buffer Zeroization Benchmark',
      timestamp: new Date().toISOString(),
      commit: '3d665ef',
      host: { platform: process.platform, arch: process.arch, node: process.version },
    },
    stateProfiles,
    lifecycleStressAudit: {
      checkpoints: lifecycleCheckpoints,
      totalCycles: 50,
      baseRssMb: baseRss,
      finalRssMb: finalCycleMem.rssMb,
      deltaRssMb: +finalDeltaRss.toFixed(2),
      classification,
    },
    transientVectorAccumulation: memBatchResults,
    zeroizationThroughput: zeroizationResults,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'resource-benchmark.json'), JSON.stringify(finalOutput, null, 2));
  console.log('\nArtifact written to: data/performance/resource-benchmark.json');
  console.log('========================================================================');
}

runResourceBenchmark().catch(err => {
  console.error('Resource benchmark error:', err);
  process.exit(1);
});
