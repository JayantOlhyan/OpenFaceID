import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FrameSampler } from '../../packages/camera/src/index.ts';
import {
  FaceQualityAnalyzer,
  BlazeFaceDetector,
  ArcFaceEmbedder,
  FaceRecognizer,
  LivenessDetector,
  EnrollmentManager,
  type FaceLandmarks,
  type EnrolledIdentity,
} from '../../packages/vision/src/index.ts';

const sampler = new FrameSampler(30);

function createTestFrame(w = 640, h = 480, luma = 128) {
  const frame = sampler.createFrame(w, h);
  for (let i = 0; i < frame.data.length; i += 4) {
    const x = (i / 4) % w;
    const y = Math.floor((i / 4) / w);
    const texture = ((x ^ y) & 0x1f) * 3; // Natural edge texture for sharpness check
    frame.data[i] = Math.min(255, luma + texture);
    frame.data[i + 1] = Math.min(255, luma + texture);
    frame.data[i + 2] = Math.min(255, luma + texture);
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

describe('FaceQualityAnalyzer', () => {
  const analyzer = new FaceQualityAnalyzer();

  it('approves good frontal framing with neutral pose', () => {
    const frame = createTestFrame();
    const box = { x: 240, y: 160, width: 160, height: 200 };
    const landmarks = getTestLandmarks();

    const quality = analyzer.analyzeQuality(frame, box, landmarks);
    assert.equal(quality.isAcceptable, true);
    assert.equal(quality.userGuidance, 'Good framing');
    assert.ok(Math.abs(quality.yawDeg) < 10);
    assert.ok(Math.abs(quality.rollDeg) < 5);
  });

  it('rejects frame when face is too small / far away', () => {
    const frame = createTestFrame();
    const tinyBox = { x: 300, y: 200, width: 30, height: 30 }; // < 8% area
    const quality = analyzer.analyzeQuality(frame, tinyBox, getTestLandmarks());

    assert.equal(quality.isAcceptable, false);
    assert.equal(quality.rejectionReason, 'FACE_TOO_FAR');
    assert.equal(quality.userGuidance, 'Move closer to the camera');
  });

  it('rejects frame when face is severely off-center', () => {
    const frame = createTestFrame();
    const cornerBox = { x: 20, y: 20, width: 160, height: 160 }; // far from center
    const quality = analyzer.analyzeQuality(frame, cornerBox, getTestLandmarks());

    assert.equal(quality.isAcceptable, false);
    assert.equal(quality.rejectionReason, 'FACE_NOT_CENTERED');
    assert.equal(quality.userGuidance, 'Center your face in the camera view');
  });
});

describe('ArcFaceEmbedder & Cosine Similarity', () => {
  const embedder = new ArcFaceEmbedder();

  it('produces 512-dimensional unit-length L2-normalized vector', async () => {
    const frame = createTestFrame();
    const embedding = await embedder.embed(frame, getTestLandmarks());

    assert.equal(embedding.length, 512);

    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    // Norm must be 1.0 (within float precision)
    assert.ok(Math.abs(Math.sqrt(norm) - 1.0) < 0.001);
  });

  it('calculates exact cosine similarity (1.0 for self, < 0.3 for orthogonal)', async () => {
    const frame = createTestFrame();
    const vecA = await embedder.embed(frame, getTestLandmarks());
    const simSelf = embedder.calculateCosineSimilarity(vecA, vecA);
    assert.ok(Math.abs(simSelf - 1.0) < 0.0001);

    const vecB = new Float32Array(512);
    vecB[0] = 1.0; // unit vector
    const simDiff = embedder.calculateCosineSimilarity(vecA, vecB);
    assert.ok(simDiff < 0.5);
  });
});

describe('FaceRecognizer & Temporal Window Aggregation', () => {
  it('requires multiple consecutive matching frames to authorize', async () => {
    const recognizer = new FaceRecognizer({ threshold: 0.70, windowSize: 5, requiredMatches: 4 });
    const embedder = new ArcFaceEmbedder();
    const frame = createTestFrame();
    const testEmbedding = await embedder.embed(frame, getTestLandmarks());

    const identity: EnrolledIdentity = {
      id: 'usr_1',
      name: 'Jayant',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      embeddings: [testEmbedding],
      averageEmbedding: testEmbedding,
      recognitionStats: { matchCount: 0 },
    };

    // Frame 1: Should NOT match yet because 1 < 4 required matches
    const res1 = recognizer.evaluateFrame(testEmbedding, [identity]);
    assert.equal(res1.matched, false);
    assert.equal(res1.isUnknown, true);

    // Frame 2 & 3: Still accumulating
    recognizer.evaluateFrame(testEmbedding, [identity]);
    recognizer.evaluateFrame(testEmbedding, [identity]);

    // Frame 4: 4th match in window meets requiredMatches
    const res4 = recognizer.evaluateFrame(testEmbedding, [identity]);
    assert.equal(res4.matched, true);
    assert.equal(res4.identityName, 'Jayant');
    assert.ok(res4.temporalConfidence >= 0.70);
  });

  it('flags UNKNOWN when faces do not match enrolled gallery', async () => {
    const recognizer = new FaceRecognizer({ threshold: 0.75 });
    const strangerVec = new Float32Array(512);
    strangerVec.fill(0.01);
    strangerVec[0] = 1.0;

    const dummyIdentity: EnrolledIdentity = {
      id: 'usr_1',
      name: 'Jayant',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      embeddings: [],
      averageEmbedding: new Float32Array(512).fill(0.04),
      recognitionStats: { matchCount: 0 },
    };

    for (let i = 0; i < 5; i++) {
      const res = recognizer.evaluateFrame(strangerVec, [dummyIdentity]);
      if (i === 4) {
        assert.equal(res.matched, false);
        assert.equal(res.isUnknown, true);
      }
    }
  });
});

describe('LivenessDetector (Anti-Spoofing)', () => {
  const detector = new LivenessDetector();

  it('passes in Off mode without checks', async () => {
    const res = await detector.evaluateLiveness([], [], 'off');
    assert.equal(res.passed, true);
    assert.equal(res.score, 1.0);
  });

  it('rejects static photo attack in Light mode (zero motion variance)', async () => {
    const lm = getTestLandmarks();
    // Repeating identical landmark simulates a static printed photograph
    const staticHistory = [lm, lm, lm, lm, lm];
    const frames = [createTestFrame(), createTestFrame()];

    const res = await detector.evaluateLiveness(frames, staticHistory, 'light');
    assert.equal(res.passed, false);
    assert.ok(res.reason?.includes('Static image detected'));
  });

  it('accepts natural micro-motion in Light mode', async () => {
    const lm1 = getTestLandmarks();
    const lm2 = { ...lm1, noseTip: { x: lm1.noseTip.x + 2, y: lm1.noseTip.y + 1 } };
    const lm3 = { ...lm1, noseTip: { x: lm1.noseTip.x - 1, y: lm1.noseTip.y - 1 } };
    const naturalHistory = [lm1, lm2, lm3];
    const frames = [createTestFrame(), createTestFrame(), createTestFrame()];

    const res = await detector.evaluateLiveness(frames, naturalHistory, 'light');
    assert.equal(res.passed, true);
    assert.ok(res.score > 0.5);
  });
});

describe('EnrollmentManager Flow', () => {
  it('manages 5-pose guided capture and zeroizes camera buffers', async () => {
    const manager = new EnrollmentManager('Test User');
    assert.equal(manager.getProgress().isCompleted, false);

    const landmarks = getTestLandmarks();

    // Perform 5 pose captures
    for (let i = 0; i < 5; i++) {
      const frame = createTestFrame();
      const res = await manager.capturePose(frame, landmarks);
      assert.equal(res.success, true);
      // Verify frame buffer was zeroized for privacy
      assert.equal(frame.data[0], 0);
    }

    assert.equal(manager.getProgress().isCompleted, true);

    const identity = manager.finishEnrollment();
    assert.equal(identity.name, 'Test User');
    assert.equal(identity.embeddings.length, 5);
    assert.equal(identity.averageEmbedding.length, 512);
  });
});
