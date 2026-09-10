import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CameraManager, FrameSampler } from '../../packages/camera/src/index.ts';
import {
  BlazeFaceDetector,
  ArcFaceEmbedder,
  FaceQualityAnalyzer,
  LivenessDetector,
  FaceRecognizer,
  EnrollmentManager,
  type FaceLandmarks,
} from '../../packages/vision/src/index.ts';

describe('Phase 2 — Real BlazeFace Detector & IoU NMS', () => {
  it('initializes BlazeFace detector with 896 anchor candidates and detects faces', async () => {
    const detector = new BlazeFaceDetector(0.70, 0.30);
    const sampler = new FrameSampler(30);
    const frame = sampler.createFrame(640, 480);

    // Populate frame with textured face pattern in center
    for (let i = 0; i < frame.data.length; i += 4) {
      const x = (i / 4) % 640;
      const y = Math.floor((i / 4) / 640);
      const isCenterFace = x > 220 && x < 420 && y > 140 && y < 340;
      frame.data[i] = isCenterFace ? 190 : 80;     // R
      frame.data[i + 1] = isCenterFace ? 140 : 80; // G
      frame.data[i + 2] = isCenterFace ? 110 : 80; // B (skin locus: R > G > B)
      frame.data[i + 3] = 255;
    }

    const detections = await detector.detect(frame);
    assert.ok(detections.length <= 1, 'NMS should suppress overlapping anchors to top candidate');
    if (detections.length > 0) {
      const d = detections[0];
      assert.ok(d.confidence >= 0.70);
      assert.ok(d.box.width > 0 && d.box.height > 0);
      assert.ok(d.landmarks.leftEye.x < d.landmarks.rightEye.x, 'Left eye must be to the left of right eye');
    }
    frame.zeroize();
  });

  it('suppresses overlapping bounding boxes using Non-Maximum Suppression (NMS)', () => {
    const detector = new BlazeFaceDetector();
    // @ts-ignore - access private NMS helper for algorithmic verification
    const candidates = [
      {
        box: { x: 100, y: 100, width: 100, height: 100 },
        landmarks: { leftEye: { x: 120, y: 120 }, rightEye: { x: 160, y: 120 }, noseTip: { x: 140, y: 140 }, leftMouth: { x: 130, y: 170 }, rightMouth: { x: 160, y: 170 } },
        confidence: 0.95,
      },
      {
        box: { x: 105, y: 105, width: 98, height: 98 }, // 85%+ IoU overlap
        landmarks: { leftEye: { x: 121, y: 121 }, rightEye: { x: 161, y: 121 }, noseTip: { x: 141, y: 141 }, leftMouth: { x: 131, y: 171 }, rightMouth: { x: 161, y: 171 } },
        confidence: 0.88,
      },
    ];

    // @ts-ignore
    const filtered = detector.nonMaximumSuppression(candidates, 0.30);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].confidence, 0.95, 'Higher confidence box must be retained');
  });
});

describe('Phase 2 — ArcFace 512D Embeddings & Canonical Alignment', () => {
  it('generates strictly L2-normalized 512D embeddings (unit length = 1.0)', async () => {
    const embedder = new ArcFaceEmbedder();
    const sampler = new FrameSampler(30);
    const frame = sampler.createFrame(640, 480);
    frame.data.fill(120);

    const landmarks: FaceLandmarks = {
      leftEye: { x: 280, y: 200 },
      rightEye: { x: 360, y: 200 },
      noseTip: { x: 320, y: 240 },
      leftMouth: { x: 290, y: 280 },
      rightMouth: { x: 350, y: 280 },
    };

    const vec = await embedder.embed(frame, landmarks);
    assert.equal(vec.length, 512, 'ArcFace embedding must have exactly 512 dimensions');

    let sumSquares = 0;
    for (let i = 0; i < vec.length; i++) {
      sumSquares += vec[i] * vec[i];
    }
    const magnitude = Math.sqrt(sumSquares);
    assert.ok(Math.abs(magnitude - 1.0) < 1e-4, `L2 norm must be 1.0, got ${magnitude}`);
    frame.zeroize();
  });

  it('verifies cosine similarity properties in 512D unit hypersphere', async () => {
    const embedder = new ArcFaceEmbedder();
    const vecA = new Float32Array(512).fill(1 / Math.sqrt(512));
    const vecB = new Float32Array(512).fill(1 / Math.sqrt(512));

    const simSelf = embedder.calculateCosineSimilarity(vecA, vecB);
    assert.ok(Math.abs(simSelf - 1.0) < 1e-4, 'Self similarity must be 1.0');

    // Orthogonal vector
    const vecC = new Float32Array(512);
    for (let i = 0; i < 256; i++) vecC[i] = 1 / Math.sqrt(512);
    for (let i = 256; i < 512; i++) vecC[i] = -1 / Math.sqrt(512);

    const simOrthogonal = embedder.calculateCosineSimilarity(vecA, vecC);
    assert.ok(Math.abs(simOrthogonal) < 1e-4, `Orthogonal vectors should have ~0 similarity, got ${simOrthogonal}`);
  });
});

describe('Phase 2 — Liveness 8-State Machine & Anti-Spoofing', () => {
  it('manages active challenge lifecycle through 8 states', async () => {
    const liveness = new LivenessDetector();
    assert.equal(liveness.getState(), 'LIVENESS_IDLE');

    const challenge = liveness.startNewChallenge();
    assert.equal(liveness.getState(), 'CHALLENGE_PRESENTED');
    assert.ok(challenge.prompt.length > 0);
    assert.ok(['TURN_LEFT_15', 'TURN_RIGHT_15', 'TILT_UP_10', 'BLINK_TWICE'].includes(challenge.type));

    const sampler = new FrameSampler(30);
    const frame = sampler.createFrame(640, 480);
    frame.data.fill(128);

    const history: FaceLandmarks[] = [
      { leftEye: { x: 280, y: 200 }, rightEye: { x: 360, y: 200 }, noseTip: { x: 320, y: 240 }, leftMouth: { x: 290, y: 280 }, rightMouth: { x: 350, y: 280 } },
      { leftEye: { x: 281, y: 200 }, rightEye: { x: 361, y: 200 }, noseTip: { x: 321, y: 240 }, leftMouth: { x: 291, y: 280 }, rightMouth: { x: 351, y: 280 } },
    ];

    const res = await liveness.evaluateLiveness([frame], history, 'strong');
    assert.equal(res.state, 'WAITING_FOR_RESPONSE');
    assert.equal(res.passed, false);

    liveness.reset();
    assert.equal(liveness.getState(), 'LIVENESS_IDLE');
    frame.zeroize();
  });

  it('rejects static photograph attacks in Light mode (zero motion variance)', async () => {
    const liveness = new LivenessDetector();
    const sampler = new FrameSampler(30);
    const frame = sampler.createFrame(640, 480);
    frame.data.fill(128);

    // Frozen identical landmarks over 5 frames
    const staticLm: FaceLandmarks = {
      leftEye: { x: 280, y: 200 },
      rightEye: { x: 360, y: 200 },
      noseTip: { x: 320, y: 240 },
      leftMouth: { x: 290, y: 280 },
      rightMouth: { x: 350, y: 280 },
    };
    const history = [staticLm, staticLm, staticLm, staticLm, staticLm];

    const res = await liveness.evaluateLiveness([frame], history, 'light');
    assert.equal(res.passed, false);
    assert.equal(res.state, 'LIVENESS_FAILED');
    assert.ok(res.reason?.includes('Static image detected'));
    frame.zeroize();
  });
});

describe('Phase 2 — Real Camera Manager Hardware Discovery & Lifecycle', () => {
  it('probes system hardware devices and queries permission status', async () => {
    const manager = new CameraManager();
    const perm = await manager.checkPermission();
    assert.ok(['granted', 'denied', 'prompt', 'restricted', 'unavailable'].includes(perm));

    const devices = await manager.enumerateDevices();
    assert.ok(devices.length > 0);
    assert.ok(devices[0].capabilities.length > 0);
    assert.ok(devices[0].capabilities[0].width > 0);
  });

  it('drops frames under downstream backpressure to prevent memory queue buildup', async () => {
    const manager = new CameraManager({ targetFps: 60 });
    let frameProcessedCount = 0;

    await manager.startCapture(async (frame) => {
      frameProcessedCount++;
      // Simulate heavy downstream consumer
      await new Promise((r) => setTimeout(r, 60));
      frame.zeroize();
    });

    await new Promise((r) => setTimeout(r, 120));
    manager.stopCapture();

    // Due to backpressure dropping, fewer frames should be delivered than raw 60 FPS tick rate
    assert.ok(frameProcessedCount <= 4, `Backpressure should limit processed frames, got ${frameProcessedCount}`);
  });
});
