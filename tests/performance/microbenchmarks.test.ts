import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import { FrameSampler, type CameraFrame } from '../../packages/camera/src/index.ts';
import {
  CanonicalStateMachine,
  NotificationManager,
  NotificationPolicy,
} from '../../packages/core/src/index.ts';
import {
  ArcFaceEmbedder,
  FaceRecognizer,
  LivenessDetector,
  type FaceLandmarks,
} from '../../packages/vision/src/index.ts';

const sampler = new FrameSampler(30);

function createTestFrame(w = 640, h = 480): CameraFrame {
  const frame = sampler.createFrame(w, h);
  for (let i = 0; i < frame.data.length; i += 4) {
    const x = (i / 4) % w;
    const y = Math.floor((i / 4) / w);
    const texture = ((x ^ y) & 0x1f) * 3;
    frame.data[i] = Math.min(255, 128 + texture);
    frame.data[i + 1] = Math.min(255, 128 + texture);
    frame.data[i + 2] = Math.min(255, 128 + texture);
    frame.data[i + 3] = 255;
  }
  return frame;
}

function getTestLandmarks(): FaceLandmarks {
  return {
    leftEye: { x: 280, y: 200 },
    rightEye: { x: 360, y: 200 },
    noseTip: { x: 320, y: 240 },
    leftMouth: { x: 290, y: 280 },
    rightMouth: { x: 350, y: 280 },
  };
}

describe('Deterministic Performance Microbenchmarks (Phase 8)', () => {
  it('measures ArcFace 512D feature embedding extraction latency and normalization', async () => {
    const embedder = new ArcFaceEmbedder();
    const frame = createTestFrame();
    const landmarks = getTestLandmarks();
    const ITERATIONS = 50;
    // JIT Warmup to prevent cold-start compilation spikes
    for (let w = 0; w < 5; w++) {
      await embedder.embed(frame, landmarks);
    }

    const latencies: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const t0 = performance.now();
      const embedding = await embedder.embed(frame, landmarks);
      const t1 = performance.now();
      latencies.push(t1 - t0);

      assert.equal(embedding.length, 512);
      let normSq = 0;
      for (let j = 0; j < embedding.length; j++) normSq += embedding[j] * embedding[j];
      assert.ok(Math.abs(Math.sqrt(normSq) - 1.0) < 1e-3, 'Embedding must be unit length L2 normalized');
    }

    latencies.sort((a, b) => a - b);
    const median = latencies[Math.floor(ITERATIONS * 0.5)];
    const p95 = latencies[Math.floor(ITERATIONS * 0.95)];

    assert.ok(median < 5.0, `Median embedding extraction must be < 5.0ms (observed: ${median.toFixed(3)}ms)`);
    assert.ok(p95 < 15.0, `P95 embedding extraction must be < 15.0ms (observed: ${p95.toFixed(3)}ms)`);
  });

  it('measures gallery matching scalability across gallery sizes (1, 10, 25, 50)', async () => {
    const embedder = new ArcFaceEmbedder();
    const frame = createTestFrame();
    const probe = await embedder.embed(frame, getTestLandmarks());

    const gallerySizes = [1, 10, 25, 50];
    for (const size of gallerySizes) {
      const gallery = new Map<string, Float32Array[]>();
      for (let i = 0; i < size; i++) {
        const poses: Float32Array[] = [];
        for (let p = 0; p < 5; p++) {
          const v = new Float32Array(512);
          for (let d = 0; d < 512; d++) v[d] = Math.sin(i * 10 + p + d);
          let n = 0;
          for (let d = 0; d < 512; d++) n += v[d] * v[d];
          const len = Math.sqrt(n) || 1;
          for (let d = 0; d < 512; d++) v[d] /= len;
          poses.push(v);
        }
        gallery.set(`user_${i}`, poses);
      }

      const ITERATIONS = 100;
      const latencies: number[] = [];
      for (let k = 0; k < ITERATIONS; k++) {
        const t0 = performance.now();
        let bestScore = -1;
        let matchedId: string | null = null;
        for (const [id, poses] of gallery.entries()) {
          for (const pose of poses) {
            const score = embedder.calculateCosineSimilarity(probe, pose);
            if (score > bestScore) {
              bestScore = score;
              matchedId = id;
            }
          }
        }
        const t1 = performance.now();
        latencies.push(t1 - t0);
      }

      latencies.sort((a, b) => a - b);
      const p95 = latencies[Math.floor(ITERATIONS * 0.95)];
      assert.ok(p95 < 5.0, `P95 matching for gallery size ${size} must be < 5.0ms (observed: ${p95.toFixed(4)}ms)`);
    }
  });

  it('measures liveness detection motion variance latency', async () => {
    const liveness = new LivenessDetector();
    const lm1 = getTestLandmarks();
    const lm2 = { ...lm1, noseTip: { x: lm1.noseTip.x + 2, y: lm1.noseTip.y + 1 } };
    const lm3 = { ...lm1, noseTip: { x: lm1.noseTip.x - 1, y: lm1.noseTip.y - 1 } };
    const naturalHistory = [lm1, lm2, lm3];
    const frames = [createTestFrame(), createTestFrame(), createTestFrame()];

    const ITERATIONS = 50;
    const latencies: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const t0 = performance.now();
      const res = await liveness.evaluateLiveness(frames, naturalHistory, 'light');
      const t1 = performance.now();
      latencies.push(t1 - t0);
      assert.ok(res.passed, 'Natural micro-motion should pass');
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(ITERATIONS * 0.95)];
    assert.ok(p95 < 3.0, `P95 liveness evaluation must be < 3.0ms (observed: ${p95.toFixed(4)}ms)`);
  });

  it('measures canonical state transition and event throughput', () => {
    const fsm = new CanonicalStateMachine();
    const ITERATIONS = 500;
    const t0 = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      fsm.setCameraState('CAMERA_READY');
      fsm.updateVisionState({
        faceCount: 1,
        detectionState: 'FACE_DETECTED',
        livenessState: 'LIVENESS_PASSED',
        identityState: 'IDENTITY_RECOGNIZED',
        identityId: 'usr_01',
        identityName: 'Alice',
      });
      fsm.updateVisionState({
        faceCount: 0,
        detectionState: 'NO_FACE',
        livenessState: 'LIVENESS_REQUIRED',
        identityState: 'IDENTITY_UNKNOWN',
        identityId: null,
        identityName: null,
      });
    }

    const t1 = performance.now();
    const totalMs = t1 - t0;
    const perCycleUs = (totalMs / ITERATIONS) * 1000;

    assert.ok(perCycleUs < 100, `Each atomic state update cycle must take < 100us (observed: ${perCycleUs.toFixed(2)}us)`);
  });

  it('measures notification policy decision and rate-limiting throughput', async () => {
    NotificationManager.resetInstance();
    const mockAdapter = {
      showNotification: async () => true,
    } as any;
    const notifMgr = NotificationManager.getInstance({ adapter: mockAdapter });
    notifMgr.setAdapter(mockAdapter);
    notifMgr.clearHistory();

    const ITERATIONS = 30;
    const t0 = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      const payload = NotificationPolicy.createPayload('CAMERA_DISCONNECTED');
      if (payload) {
        await notifMgr.notify(payload);
      }
    }

    const t1 = performance.now();
    const totalMs = t1 - t0;
    const avgMs = totalMs / ITERATIONS;

    assert.ok(avgMs < 5.0, `Average notification throughput must be < 5.0ms (observed: ${avgMs.toFixed(4)}ms)`);
    const dispatched = notifMgr.getHistory().filter((h) => h.dispatched);
    assert.equal(dispatched.length, 1, 'Exactly 1 notification dispatched; remaining 29 suppressed by cooldown');
  });

  it('measures timing-safe IPC token validation throughput', () => {
    const secret = crypto.randomBytes(24).toString('hex');
    const validCandidate = secret;
    const invalidCandidate = crypto.randomBytes(24).toString('hex');

    const ITERATIONS = 1000;
    const t0 = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      const cand = i % 2 === 0 ? validCandidate : invalidCandidate;
      const bSecret = Buffer.from(secret);
      const bCand = Buffer.from(cand);
      const valid = bSecret.length === bCand.length && crypto.timingSafeEqual(bSecret, bCand);
      assert.equal(valid, i % 2 === 0);
    }

    const t1 = performance.now();
    const totalMs = t1 - t0;
    const avgUs = (totalMs / ITERATIONS) * 1000;

    assert.ok(avgUs < 20, `Timing safe validation must be < 20us per call (observed: ${avgUs.toFixed(2)}us)`);
  });

  it('measures memory zeroization throughput on 1080p uncompressed frame buffer (7.91 MB)', () => {
    const BUFFER_SIZE = 1920 * 1080 * 4; // 8,294,400 bytes
    const buffer = new Uint8ClampedArray(BUFFER_SIZE).fill(255);

    const ITERATIONS = 20;
    const latencies: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      buffer.fill(128);
      const t0 = performance.now();
      buffer.fill(0);
      const t1 = performance.now();
      latencies.push(t1 - t0);

      assert.equal(buffer[0], 0);
      assert.equal(buffer[BUFFER_SIZE - 1], 0);
    }

    latencies.sort((a, b) => a - b);
    const median = latencies[Math.floor(ITERATIONS * 0.5)];
    assert.ok(median < 15.0, `7.91 MB buffer zeroization must be < 15.0ms (observed: ${median.toFixed(2)}ms)`);
  });

  it('verifies transient embedding memory does not leak across iterations', async () => {
    const embedder = new ArcFaceEmbedder();
    const frame = createTestFrame();
    const lm = getTestLandmarks();

    const memBefore = process.memoryUsage().heapUsed;
    const ITERATIONS = 500;

    for (let i = 0; i < ITERATIONS; i++) {
      const v = await embedder.embed(frame, lm);
      assert.equal(v.length, 512);
    }

    const memAfter = process.memoryUsage().heapUsed;
    const growthMb = (memAfter - memBefore) / (1024 * 1024);

    assert.ok(growthMb < 15.0, `Heap growth after 500 iterations must be < 15 MB (observed: ${growthMb.toFixed(2)} MB)`);
  });
});
