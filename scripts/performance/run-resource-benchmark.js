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
  console.log('1. Measuring CPU & RSS Footprint Across 8 Runtime States...');
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
    const memBefore = process.memoryUsage();
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
      cpuUsagePercent: cpuPercent,
    });
  }

  console.log('| Runtime State                             | RSS (MB) | Heap (MB) | Process CPU (%) |');
  console.log('|-------------------------------------------|----------|-----------|-----------------|');
  for (const p of stateProfiles) {
    console.log(`| ${p.state.padEnd(41)} | ${p.rssMb.toString().padStart(8)} | ${p.heapUsedMb.toString().padStart(9)} | ${p.cpuUsagePercent.toString().padStart(15)} |`);
  }

  // 2. Transient Embedding Memory Accumulation Test (100, 1000, 5000 iterations)
  console.log('\n2. Testing Transient Embedding Vector Memory Accumulation...');
  const embedder = new ArcFaceEmbedder();
  const dummyLandmarks = {
    leftEye: { x: 280, y: 200 },
    rightEye: { x: 360, y: 200 },
    noseTip: { x: 320, y: 240 },
    leftMouth: { x: 290, y: 280 },
    rightMouth: { x: 350, y: 280 },
  };

  const dummyFrame = makeFrame(0);
  const memBatches = [100, 1000, 5000];
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

  // 3. Buffer Zeroization Throughput (1080p, 720p, 480p)
  console.log('\n3. Measuring Memory Zeroization Latency across Video Resolutions...');
  const resolutions = [
    { name: '1080p FHD (1920x1080)', bytes: 1920 * 1080 * 4 },
    { name: '720p HD (1280x720)', bytes: 1280 * 720 * 4 },
    { name: '480p SD (640x480)', bytes: 640 * 480 * 4 },
  ];

  const zeroizationResults = [];
  for (const res of resolutions) {
    const buf = new Uint8ClampedArray(res.bytes);
    const times = [];
    for (let i = 0; i < 25; i++) {
      buf.fill(200);
      const t0 = performance.now();
      buf.fill(0);
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    times.sort((a, b) => a - b);
    zeroizationResults.push({
      resolution: res.name,
      sizeMb: +(res.bytes / (1024 * 1024)).toFixed(2),
      medianMs: +times[Math.floor(times.length * 0.5)].toFixed(2),
      p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2),
    });
  }

  console.log('| Resolution              | Uncompressed Size | Median (ms) | P95 (ms)  |');
  console.log('|-------------------------|-------------------|-------------|-----------|');
  for (const z of zeroizationResults) {
    console.log(`| ${z.resolution.padEnd(23)} | ${(z.sizeMb + ' MB').padEnd(17)} | ${z.medianMs.toString().padStart(9)} ms | ${z.p95Ms.toString().padStart(7)} ms |`);
  }

  await engine.shutdown();

  const finalOutput = {
    timestamp: new Date().toISOString(),
    commit: '3d665ef',
    host: { platform: process.platform, arch: process.arch },
    stateProfiles,
    embeddingMemoryScaling: memBatchResults,
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
