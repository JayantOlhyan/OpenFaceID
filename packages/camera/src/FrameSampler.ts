import type { CameraFrame } from './types.ts';

export class FrameSampler {
  private targetFps: number;
  private minIntervalMs: number;
  private lastSampleTimeMs: number = 0;
  private frameIndex: number = 0;

  constructor(targetFps: number = 60) {
    this.targetFps = Math.max(0.5, Math.min(120, targetFps));
    this.minIntervalMs = 1000 / this.targetFps;
  }

  public setTargetFps(fps: number): void {
    this.targetFps = Math.max(0.5, Math.min(120, fps));
    this.minIntervalMs = 1000 / this.targetFps;
  }

  public getTargetFps(): number {
    return this.targetFps;
  }

  public shouldSample(nowMs: number = Date.now()): boolean {
    if (nowMs - this.lastSampleTimeMs >= this.minIntervalMs) {
      this.lastSampleTimeMs = nowMs;
      return true;
    }
    return false;
  }

  public createFrame(width: number, height: number, fillData?: Uint8ClampedArray): CameraFrame {
    const size = width * height * 4;
    const buffer = fillData ? new Uint8ClampedArray(fillData) : new Uint8ClampedArray(size);
    const index = ++this.frameIndex;

    const frame: CameraFrame = {
      data: buffer,
      width,
      height,
      timestamp: Date.now(),
      frameIndex: index,
      zeroize: () => {
        // Securely wipe RAM pixel data
        buffer.fill(0);
      },
    };

    return frame;
  }
}
