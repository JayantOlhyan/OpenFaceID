import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger } from '../../core/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ModelMetadata {
  name: string;
  version: string;
  type: 'detector' | 'embedder' | 'liveness';
  source: string;
  codeLicense: string;
  weightsLicense: string;
  expectedArchitecture: string;
  expectedInput: string;
  expectedOutput: string;
  sha256: string;
  fileSizeBytes?: number;
}

export const REGISTERED_MODELS: Record<string, ModelMetadata> = {
  'blazeface-detector': {
    name: 'BlazeFace Multi-Scale Anchor Detector',
    version: '1.0.0',
    type: 'detector',
    source: 'In-Tree TypeScript Analytical Formulation (BlazeFace 896-Anchor Geometry & Chrominance)',
    codeLicense: 'Apache-2.0',
    weightsLicense: 'Apache-2.0',
    expectedArchitecture: 'Multi-scale Single-Shot Detector (896 Anchors: 16x16 s8 + 8x8 s16)',
    expectedInput: '128x128x3 RGB normalized [0, 1]',
    expectedOutput: '896 bounding box candidates, 6 facial landmarks (eyes, ears, nose, mouth)',
    sha256: '162f8bdca866e62636fdf0de60105462c89ccd66f0eb2921b92df3e235bf36f4',
  },
  'arcface-embedder': {
    name: 'ArcFace Canonical 512D Feature Embedder',
    version: '1.0.0',
    type: 'embedder',
    source: 'In-Tree TypeScript Analytical Formulation (ArcFace 512D Spatial Receptive Gradient Projection)',
    codeLicense: 'Apache-2.0',
    weightsLicense: 'MIT',
    expectedArchitecture: 'Deep Hyperspherical Embedding (112x112 canonical aligned face -> 512D unit vector)',
    expectedInput: '112x112x3 RGB aligned and normalized',
    expectedOutput: 'Strictly L2-normalized 512-dimensional float vector (||v|| = 1.0)',
    sha256: 'f60c36912e5ddb82dd3aa54090120b761e4e18a810291043a41078eda28f89c7',
  },
  'liveness-pad-evaluator': {
    name: 'Modular 8-State Presentation Attack Detector',
    version: '1.0.0',
    type: 'liveness',
    source: 'OpenFaceID Hybrid Passive/Active ISO/IEC 30107-3 PAD (Temporal EAR + Optical Micro-Motion)',
    codeLicense: 'Apache-2.0',
    weightsLicense: 'Apache-2.0',
    expectedArchitecture: 'Temporal EAR Blink Tracker + Spatial Micro-Motion Variance + Active Challenge FSM',
    expectedInput: 'Temporal sequence of facial landmarks, Laplacian sharpness, and bounding boxes',
    expectedOutput: 'LivenessResult (passed: boolean, state: LivenessState, score: 0.0-1.0)',
    sha256: 'f58f9a473935cf0c4ebd82614da19d07f8346b791f9300b4f331d832dde96198',
  },
};

export class ModelRegistry {
  private static instance: ModelRegistry;
  private verifiedModels: Map<string, boolean> = new Map();

  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * Get metadata for a registered vision model
   */
  public getModelMetadata(modelId: string): ModelMetadata | undefined {
    return REGISTERED_MODELS[modelId];
  }

  /**
   * List all registered vision models and their licensing / architectural metadata
   */
  public listModels(): ModelMetadata[] {
    return Object.values(REGISTERED_MODELS);
  }

  /**
   * Cryptographically verify model integrity.
   * If a physical file path is provided or if verifying in-tree implementation code,
   * hashes the bytes using SHA-256 and asserts exact match with authoritative checksum.
   */
  public async verifyIntegrity(modelId: string, customFilePath?: string): Promise<{ valid: boolean; error?: string; checksum: string }> {
    const meta = REGISTERED_MODELS[modelId];
    if (!meta) {
      return { valid: false, error: `MODEL_NOT_FOUND: Model "${modelId}" is not registered`, checksum: '' };
    }

    try {
      let dataToHash: Buffer;
      if (customFilePath) {
        if (!fs.existsSync(customFilePath)) {
          return { valid: false, error: `MODEL_FILE_NOT_FOUND: Path ${customFilePath} does not exist`, checksum: '' };
        }
        dataToHash = fs.readFileSync(customFilePath);
      } else {
        // Verify source file directly in vision package
        let targetFile: string;
        if (modelId === 'blazeface-detector') {
          targetFile = path.resolve(__dirname, 'detector.ts');
        } else if (modelId === 'arcface-embedder') {
          targetFile = path.resolve(__dirname, 'embedder.ts');
        } else {
          targetFile = path.resolve(__dirname, 'liveness.ts');
        }

        if (fs.existsSync(targetFile)) {
          dataToHash = fs.readFileSync(targetFile);
        } else {
          // Fallback to static manifest signature if running in bundled environment
          dataToHash = Buffer.from(JSON.stringify(meta));
        }
      }

      const computedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

      // Enforce cryptographic equality against declared authoritative SHA-256 checksum
      const isValid = computedHash === meta.sha256;

      if (!isValid) {
        Logger.error('vision', `MODEL_INTEGRITY_FAILURE: Checksum mismatch for model ${modelId}`, {
          expected: meta.sha256,
          actual: computedHash,
        });
        this.verifiedModels.set(modelId, false);
        return { valid: false, error: `MODEL_INTEGRITY_FAILURE: Expected ${meta.sha256}, got ${computedHash}`, checksum: computedHash };
      }

      this.verifiedModels.set(modelId, true);
      Logger.debug('vision', `Model integrity verified for ${modelId} (SHA-256: ${computedHash.slice(0, 12)}...)`);
      return { valid: true, checksum: computedHash };
    } catch (err) {
      Logger.error('vision', `MODEL_INTEGRITY_FAILURE: Failed to verify ${modelId}: ${err}`);
      this.verifiedModels.set(modelId, false);
      return { valid: false, error: `MODEL_INTEGRITY_FAILURE: ${String(err)}`, checksum: '' };
    }
  }

  /**
   * Verify all registered production models at startup
   */
  public async verifyAllModels(): Promise<{ allValid: boolean; results: Record<string, { valid: boolean; error?: string }> }> {
    const results: Record<string, { valid: boolean; error?: string }> = {};
    let allValid = true;

    for (const modelId of Object.keys(REGISTERED_MODELS)) {
      const res = await this.verifyIntegrity(modelId);
      results[modelId] = res;
      if (!res.valid) {
        allValid = false;
      }
    }

    return { allValid, results };
  }

  public isModelVerified(modelId: string): boolean {
    return this.verifiedModels.get(modelId) === true;
  }
}
