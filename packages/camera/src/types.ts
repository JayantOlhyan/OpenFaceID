export type PixelFormat = 'RGBA' | 'RGB' | 'BGRA' | 'YUV420P' | 'NV12';

export interface CameraCapabilities {
  width: number;
  height: number;
  maxFps: number;
  pixelFormats?: PixelFormat[];
}

export interface CameraDevice {
  id: string;
  deviceId: string; // alias for compatibility
  name: string;
  label: string; // alias for compatibility
  manufacturer?: string;
  groupId?: string;
  isDefault: boolean;
  capabilities: CameraCapabilities[];
  resolutions: Array<{ width: number; height: number; maxFps: number }>; // alias for compatibility
  isSynthetic?: boolean;
}

export type CameraPermissionStatus =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'restricted'
  | 'unavailable';

export type CameraState =
  | 'uninitialized'
  | 'requesting_permission'
  | 'active'
  | 'throttled'
  | 'paused'
  | 'error'
  | 'disconnected'
  | 'closed';

export interface CameraFrame {
  timestamp: number;
  width: number;
  height: number;
  pixelFormat: PixelFormat;
  data: Uint8ClampedArray; // RGBA pixel buffer in RAM
  frameIndex: number;
  zeroize: () => void; // Explicit RAM memory wiper
}

export interface CameraOptions {
  preferredDeviceId?: string;
  preferredWidth?: number;
  preferredHeight?: number;
  targetFps?: number; // dynamic throttling
  isTestMode?: boolean;
  isSyntheticFallback?: boolean;
}
