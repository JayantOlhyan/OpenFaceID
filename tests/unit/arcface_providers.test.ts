import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArcFaceEmbedder,
  AnalyticalEmbedderProvider,
  CoreMLEmbedderProvider,
  OnnxEmbedderProvider,
  resolveEmbedderProvider,
  ModelRegistry,
  type FaceLandmarks,
} from '../../packages/vision/src/index.ts';
import type { CameraFrame } from '../../packages/camera/src/index.ts';

function createMockFrame(width = 640, height = 480): CameraFrame {
  const size = width * height * 4;
  const data = new Uint8ClampedArray(size);
  for (let i = 0; i < size; i += 4) {
    data[i] = 120;     // R
    data[i + 1] = 130; // G
    data[i + 2] = 140; // B
    data[i + 3] = 255; // A
  }
  return {
    data,
    width,
    height,
    pixelFormat: 'RGBA',
    timestamp: Date.now(),
    frameIndex: 1,
    zeroize: () => data.fill(0),
  };
}

const mockLandmarks: FaceLandmarks = {
  leftEye: { x: 280, y: 220 },
  rightEye: { x: 360, y: 220 },
  noseTip: { x: 320, y: 260 },
  leftMouth: { x: 290, y: 310 },
  rightMouth: { x: 350, y: 310 },
};

describe('ArcFace Multi-Provider Architecture (Phase 2)', () => {
  it('AnalyticalEmbedderProvider produces strictly L2-normalized 512D vectors', async () => {
    const provider = new AnalyticalEmbedderProvider();
    assert.equal(provider.type, 'analytical');
    assert.equal(await provider.isAvailable(), true);

    const frame = createMockFrame();
    const embedding = await provider.embed(frame, mockLandmarks);

    assert.equal(embedding.length, 512);

    let normSq = 0;
    for (let i = 0; i < embedding.length; i++) {
      normSq += embedding[i] * embedding[i];
    }
    const norm = Math.sqrt(normSq);
    assert.ok(Math.abs(norm - 1.0) < 0.001, `Vector must have unit length, got ${norm}`);
  });

  it('CoreMLEmbedderProvider correctly identifies and produces valid 512D embeddings', async () => {
    const provider = new CoreMLEmbedderProvider();
    assert.equal(provider.type, 'coreml');

    if (process.platform === 'darwin') {
      assert.equal(await provider.isAvailable(), true);
    }

    const frame = createMockFrame();
    const embedding = await provider.embed(frame, mockLandmarks);
    assert.equal(embedding.length, 512);

    let normSq = 0;
    for (let i = 0; i < embedding.length; i++) {
      normSq += embedding[i] * embedding[i];
    }
    assert.ok(Math.abs(Math.sqrt(normSq) - 1.0) < 0.001);
  });

  it('OnnxEmbedderProvider identifies and produces valid 512D embeddings with fallback', async () => {
    const provider = new OnnxEmbedderProvider();
    assert.equal(provider.type, 'onnx');

    const frame = createMockFrame();
    const embedding = await provider.embed(frame, mockLandmarks);
    assert.equal(embedding.length, 512);

    let normSq = 0;
    for (let i = 0; i < embedding.length; i++) {
      normSq += embedding[i] * embedding[i];
    }
    assert.ok(Math.abs(Math.sqrt(normSq) - 1.0) < 0.001);
  });

  it('ArcFaceEmbedder resolves best platform provider and allows dynamic switching', async () => {
    const embedder = new ArcFaceEmbedder('auto');

    // On macOS, auto mode routes to CoreML; on other OSes, to ONNX or analytical
    const active = embedder.getActiveProvider();
    assert.ok(['coreml', 'onnx', 'analytical'].includes(active));

    // Dynamic switch to analytical
    await embedder.setProvider('analytical');
    assert.equal(embedder.getActiveProvider(), 'analytical');

    const frame = createMockFrame();
    const vec1 = await embedder.embed(frame, mockLandmarks);
    assert.equal(vec1.length, 512);

    // Dynamic switch to coreml (if macOS) or onnx
    if (process.platform === 'darwin') {
      await embedder.setProvider('coreml');
      assert.equal(embedder.getActiveProvider(), 'coreml');
    } else {
      await embedder.setProvider('onnx');
      assert.equal(embedder.getActiveProvider(), 'onnx');
    }

    const capabilities = await embedder.getCapabilities();
    assert.equal(capabilities.analyticalAvailable, true);
    assert.ok(typeof capabilities.coremlAvailable === 'boolean');
    assert.ok(typeof capabilities.onnxAvailable === 'boolean');
  });

  it('ModelRegistry registers CoreML and ONNX deep-learning models', () => {
    const registry = ModelRegistry.getInstance();

    const coremlMeta = registry.getModelMetadata('arcface-coreml-mobilefacenet');
    assert.ok(coremlMeta);
    assert.equal(coremlMeta?.type, 'embedder');
    assert.ok(coremlMeta?.expectedArchitecture.includes('MobileFaceNet'));

    const onnxMeta = registry.getModelMetadata('arcface-onnx-mobilefacenet');
    assert.ok(onnxMeta);
    assert.equal(onnxMeta?.type, 'embedder');
    assert.ok(onnxMeta?.expectedArchitecture.includes('MobileFaceNet'));
  });
});
