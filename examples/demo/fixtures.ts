/**
 * OpenFaceID Developer Example: Synthetic Demonstration Fixtures
 * Non-biometric, purely mathematical synthetic fixtures for offline testing.
 *
 * NOTE: OpenFaceID strictly prohibits committing real human facial photos or
 * biometric datasets to git. This file contains purely synthetic mock data.
 */

import type { CameraFrame } from '../../packages/camera/src/index.ts';
import type { FaceLandmarks } from '../../packages/vision/src/index.ts';

export function createSyntheticFrame(width = 640, height = 480, pattern = 128): CameraFrame {
  const buffer = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < buffer.length; i += 4) {
    const px = (i / 4) % width;
    const py = Math.floor((i / 4) / width);
    const grad = ((px * pattern) ^ py) & 0xff;
    buffer[i] = grad;
    buffer[i + 1] = (grad + pattern) & 0xff;
    buffer[i + 2] = pattern;
    buffer[i + 3] = 255;
  }
  let zeroed = false;

  return {
    data: buffer,
    width,
    height,
    pixelFormat: 'RGBA',
    timestamp: Date.now(),
    frameIndex: 1,
    zeroize: () => {
      if (!zeroed) {
        buffer.fill(0);
        zeroed = true;
      }
    },
  };
}

export function createSyntheticLandmarks(offsetX = 0, offsetY = 0): FaceLandmarks {
  return {
    leftEye: { x: 260 + offsetX, y: 190 + offsetY },
    rightEye: { x: 380 + offsetX, y: 190 + offsetY },
    noseTip: { x: 320 + offsetX, y: 250 + offsetY },
    leftMouth: { x: 270 + offsetX, y: 320 + offsetY },
    rightMouth: { x: 370 + offsetX, y: 320 + offsetY },
  };
}
