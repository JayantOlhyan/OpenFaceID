import crypto from 'crypto';
import type { CameraFrame } from '../../camera/src/index.ts';
import type { EnrolledIdentity, FaceLandmarks, FaceQualityScore } from './interfaces.ts';
import { ArcFaceEmbedder } from './embedder.ts';
import { FaceQualityAnalyzer } from './quality.ts';

export type EnrollmentPose =
  | 'LOOK_STRAIGHT'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'LOOK_UP'
  | 'LOOK_DOWN';

export interface PoseTarget {
  pose: EnrollmentPose;
  title: string;
  description: string;
  expectedYawMin: number;
  expectedYawMax: number;
  expectedPitchMin: number;
  expectedPitchMax: number;
}

export const ENROLLMENT_POSES: PoseTarget[] = [
  {
    pose: 'LOOK_STRAIGHT',
    title: 'Look Directly at Camera',
    description: 'Keep your face centered with a neutral, natural expression.',
    expectedYawMin: -15,
    expectedYawMax: 15,
    expectedPitchMin: -15,
    expectedPitchMax: 15,
  },
  {
    pose: 'TURN_LEFT',
    title: 'Turn Head Slightly Left',
    description: 'Turn your head approximately 15° to the left.',
    expectedYawMin: -35,
    expectedYawMax: -10,
    expectedPitchMin: -20,
    expectedPitchMax: 20,
  },
  {
    pose: 'TURN_RIGHT',
    title: 'Turn Head Slightly Right',
    description: 'Turn your head approximately 15° to the right.',
    expectedYawMin: 10,
    expectedYawMax: 35,
    expectedPitchMin: -20,
    expectedPitchMax: 20,
  },
  {
    pose: 'LOOK_UP',
    title: 'Tilt Chin Slightly Up',
    description: 'Tilt your chin up gently while maintaining camera focus.',
    expectedYawMin: -20,
    expectedYawMax: 20,
    expectedPitchMin: -30,
    expectedPitchMax: -8,
  },
  {
    pose: 'LOOK_DOWN',
    title: 'Tilt Head Slightly Down',
    description: 'Tilt your head down slightly.',
    expectedYawMin: -20,
    expectedYawMax: 20,
    expectedPitchMin: 8,
    expectedPitchMax: 30,
  },
];

export interface EnrollmentProgress {
  currentPoseIndex: number;
  totalPoses: number;
  currentTarget: PoseTarget;
  isCompleted: boolean;
  capturedEmbeddingsCount: number;
  latestQuality?: FaceQualityScore;
}

export class EnrollmentManager {
  private identityId: string;
  private identityName: string;
  private currentStepIndex: number = 0;
  private capturedEmbeddings: Float32Array[] = [];
  private embedder: ArcFaceEmbedder;
  private qualityAnalyzer: FaceQualityAnalyzer;

  constructor(identityName: string) {
    this.identityId = 'usr_' + crypto.randomBytes(6).toString('hex');
    this.identityName = identityName.trim();
    this.embedder = new ArcFaceEmbedder();
    this.qualityAnalyzer = new FaceQualityAnalyzer();
  }

  public getProgress(): EnrollmentProgress {
    const isCompleted = this.currentStepIndex >= ENROLLMENT_POSES.length;
    return {
      currentPoseIndex: this.currentStepIndex,
      totalPoses: ENROLLMENT_POSES.length,
      currentTarget: ENROLLMENT_POSES[Math.min(this.currentStepIndex, ENROLLMENT_POSES.length - 1)],
      isCompleted,
      capturedEmbeddingsCount: this.capturedEmbeddings.length,
    };
  }

  public async capturePose(
    frame: CameraFrame,
    landmarks: FaceLandmarks
  ): Promise<{ success: boolean; error?: string; progress: EnrollmentProgress }> {
    if (this.currentStepIndex >= ENROLLMENT_POSES.length) {
      return { success: true, progress: this.getProgress() };
    }

    try {
      // 1. Analyze Quality
      const box = {
        x: Math.min(landmarks.leftEye.x, landmarks.leftMouth.x) - 40,
        y: Math.min(landmarks.leftEye.y, landmarks.rightEye.y) - 60,
        width: 180,
        height: 220,
      };
      const quality = this.qualityAnalyzer.analyzeQuality(frame, box, landmarks);

      if (!quality.isAcceptable) {
        return {
          success: false,
          error: quality.userGuidance,
          progress: { ...this.getProgress(), latestQuality: quality },
        };
      }

      // 2. Extract 512D ArcFace Embedding
      const embedding = await this.embedder.embed(frame, landmarks);
      this.capturedEmbeddings.push(embedding);
      this.currentStepIndex++;

      return {
        success: true,
        progress: { ...this.getProgress(), latestQuality: quality },
      };
    } finally {
      // CRITICAL PRIVACY RULE: Zeroize RAM camera frame immediately
      frame.zeroize();
    }
  }

  public finishEnrollment(): EnrolledIdentity {
    if (this.capturedEmbeddings.length === 0) {
      throw new Error('Cannot finalize enrollment with zero captured embeddings');
    }

    // Compute average embedding vector across all captured poses
    const dim = ArcFaceEmbedder.EMBEDDING_DIM;
    const avgVector = new Float32Array(dim);

    for (const emb of this.capturedEmbeddings) {
      for (let i = 0; i < dim; i++) {
        avgVector[i] += emb[i];
      }
    }

    // Normalize average vector
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      norm += avgVector[i] * avgVector[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dim; i++) {
        avgVector[i] /= norm;
      }
    }

    const now = Date.now();
    return {
      id: this.identityId,
      name: this.identityName,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      embeddings: this.capturedEmbeddings,
      averageEmbedding: avgVector,
      recognitionStats: {
        matchCount: 0,
      },
      modelMetadata: {
        modelId: 'arcface-analytical-512d',
        modelVersion: '1.0.0',
        embeddingDim: ArcFaceEmbedder.EMBEDDING_DIM,
        embeddingFormat: 'float32-l2-normalized',
        normalization: 'unit-hypersphere-l2',
        creationVersion: '0.2.0',
      },
    };
  }
}
