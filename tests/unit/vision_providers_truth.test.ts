import fs from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AnalyticalEmbedderProvider,
  CoreMLEmbedderProvider,
  OnnxEmbedderProvider,
  resolveEmbedderProvider,
} from '../../packages/vision/src/providers.ts';

describe('Phase 13 — Real Neural Inference & Vision Provider Truth', () => {
  const hasWeights = fs.existsSync('models/arcface-mobilefacenet.onnx') || fs.existsSync('packages/vision/models/arcface-mobilefacenet.onnx');

  it('AnalyticalEmbedderProvider is always available and produces 512D normalized embeddings', async () => {
    const provider = new AnalyticalEmbedderProvider();
    assert.equal(await provider.isAvailable(), true);
    assert.equal(provider.type, 'analytical');

    const mockFrame = {
      data: new Uint8ClampedArray(112 * 112 * 4).fill(128),
      width: 112,
      height: 112,
      timestamp: Date.now(),
      format: 'rgba' as const,
    };

    const mockLandmarks = {
      leftEye: { x: 38, y: 52 },
      rightEye: { x: 74, y: 52 },
      noseTip: { x: 56, y: 70 },
      leftMouth: { x: 42, y: 88 },
      rightMouth: { x: 70, y: 88 },
      leftEar: { x: 20, y: 60 },
      rightEar: { x: 92, y: 60 },
    };

    const embedding = await provider.embed(mockFrame, mockLandmarks);
    assert.equal(embedding.length, 512);

    let normSq = 0;
    for (let i = 0; i < embedding.length; i++) normSq += embedding[i] * embedding[i];
    assert.ok(Math.abs(Math.sqrt(normSq) - 1.0) < 1e-4, 'Embedding must be unit-normalized');
  });

  it('CoreMLEmbedderProvider executes real neural inference on Apple Silicon when weights exist', async () => {
    const provider = new CoreMLEmbedderProvider();
    const available = await provider.isAvailable();

    if (process.platform === 'darwin') {
      if (hasWeights) {
        assert.equal(available, true, 'CoreML must be available when arcface-mobilefacenet.onnx is present');

        const mockFrame = {
          data: new Uint8ClampedArray(112 * 112 * 4).fill(128),
          width: 112,
          height: 112,
          timestamp: Date.now(),
          format: 'rgba' as const,
        };

        const mockLandmarks = {
          leftEye: { x: 38, y: 52 },
          rightEye: { x: 74, y: 52 },
          noseTip: { x: 56, y: 70 },
          leftMouth: { x: 42, y: 88 },
          rightMouth: { x: 70, y: 88 },
          leftEar: { x: 20, y: 60 },
          rightEar: { x: 92, y: 60 },
        };

        const embedding = await provider.embed(mockFrame, mockLandmarks);
        assert.equal(embedding.length, 512, 'Neural forward pass must output 512D vector');

        let normSq = 0;
        for (let i = 0; i < embedding.length; i++) normSq += embedding[i] * embedding[i];
        assert.ok(Math.abs(Math.sqrt(normSq) - 1.0) < 1e-4, 'Neural vector must be L2-normalized');
      } else {
        assert.equal(available, false, 'CoreML must report unavailable when weights are absent (no silent fallback)');
      }
    }
  });

  it('OnnxEmbedderProvider executes real neural inference and produces 512D embeddings', async () => {
    const provider = new OnnxEmbedderProvider();
    const available = await provider.isAvailable();

    if (hasWeights) {
      assert.equal(available, true, 'ONNX provider must be available when arcface-mobilefacenet.onnx is present');

      const mockFrame = {
        data: new Uint8ClampedArray(112 * 112 * 4).fill(128),
        width: 112,
        height: 112,
        timestamp: Date.now(),
        format: 'rgba' as const,
      };

      const mockLandmarks = {
        leftEye: { x: 38, y: 52 },
        rightEye: { x: 74, y: 52 },
        noseTip: { x: 56, y: 70 },
        leftMouth: { x: 42, y: 88 },
        rightMouth: { x: 70, y: 88 },
        leftEar: { x: 20, y: 60 },
        rightEar: { x: 92, y: 60 },
      };

      const embedding = await provider.embed(mockFrame, mockLandmarks);
      assert.equal(embedding.length, 512, 'ONNX forward pass must output 512D vector');

      let normSq = 0;
      for (let i = 0; i < embedding.length; i++) normSq += embedding[i] * embedding[i];
      assert.ok(Math.abs(Math.sqrt(normSq) - 1.0) < 1e-4, 'Neural vector must be L2-normalized');
    } else {
      assert.equal(available, false, 'ONNX provider must report unavailable when weights are absent (no silent fallback)');
    }
  });

  it('resolveEmbedderProvider resolves real neural provider in auto mode', async () => {
    const resolved = await resolveEmbedderProvider('auto');
    if (hasWeights) {
      if (process.platform === 'darwin') {
        assert.equal(resolved.type, 'coreml');
      } else {
        assert.equal(resolved.type, 'onnx');
      }
    } else {
      assert.equal(resolved.type, 'analytical', 'Must fall back to analytical when weights are not downloaded');
    }
  });
});
