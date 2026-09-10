export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId?: string;
  isDefault: boolean;
  resolutions: Array<{ width: number; height: number; maxFps: number }>;
}

export type CameraState =
  | 'uninitialized'
  | 'requesting_permission'
  | 'active'
  | 'throttled'
  | 'paused'
  | 'error'
  | 'disconnected';

export interface CameraFrame {
  data: Uint8ClampedArray; // RGBA pixel buffer in RAM
  width: number;
  height: number;
  timestamp: number;
  frameIndex: number;
  zeroize: () => void; // Explicit RAM memory wiper
}

export interface CameraOptions {
  preferredDeviceId?: string;
  preferredWidth?: number;
  preferredHeight?: number;
  targetFps?: number; // dynamic throttling
  isSyntheticFallback?: boolean;
}
