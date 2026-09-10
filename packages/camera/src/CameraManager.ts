import type { CameraDevice, CameraState, CameraFrame, CameraOptions } from './types.ts';
import { FrameSampler } from './FrameSampler.ts';
import { Logger, EventBus } from '../../core/src/index.ts';

export class CameraManager {
  private state: CameraState = 'uninitialized';
  private selectedDeviceId: string = 'default';
  private options: CameraOptions;
  private sampler: FrameSampler;
  private frameIntervalTimer: NodeJS.Timeout | null = null;
  private onFrameCallback: ((frame: CameraFrame) => void) | null = null;
  private simulatedWidth: number = 1280;
  private simulatedHeight: number = 720;

  constructor(options: CameraOptions = {}) {
    this.options = options;
    this.selectedDeviceId = options.preferredDeviceId || 'default';
    this.sampler = new FrameSampler(options.targetFps || 15);
    if (options.preferredWidth) this.simulatedWidth = options.preferredWidth;
    if (options.preferredHeight) this.simulatedHeight = options.preferredHeight;
  }

  public getState(): CameraState {
    return this.state;
  }

  public async enumerateDevices(): Promise<CameraDevice[]> {
    Logger.info('camera', 'Enumerating available video capture devices');

    // In a desktop environment, query hardware or provide standard sensors
    const devices: CameraDevice[] = [
      {
        deviceId: 'built-in-facetime-01',
        label: 'FaceTime HD Camera (Built-in)',
        isDefault: true,
        resolutions: [
          { width: 1920, height: 1080, maxFps: 30 },
          { width: 1280, height: 720, maxFps: 30 },
          { width: 640, height: 480, maxFps: 30 },
        ],
      },
      {
        deviceId: 'virtual-test-sensor-02',
        label: 'Virtual Synthetic Test Sensor',
        isDefault: false,
        resolutions: [
          { width: 1280, height: 720, maxFps: 60 },
          { width: 640, height: 480, maxFps: 60 },
        ],
      },
    ];

    return devices;
  }

  public async selectDevice(deviceId: string): Promise<boolean> {
    const devices = await this.enumerateDevices();
    const found = devices.find((d) => d.deviceId === deviceId || (deviceId === 'default' && d.isDefault));
    if (!found) {
      Logger.warn('camera', `Device ${deviceId} not found, using default`);
      this.selectedDeviceId = devices[0].deviceId;
      return false;
    }

    this.selectedDeviceId = found.deviceId;
    Logger.info('camera', `Selected camera: ${found.label} (${found.deviceId})`);
    return true;
  }

  public setTargetFps(fps: number): void {
    Logger.debug('camera', `Adjusting camera pipeline throttle to ${fps} FPS`);
    this.sampler.setTargetFps(fps);
  }

  public async startCapture(onFrame: (frame: CameraFrame) => void): Promise<boolean> {
    if (this.state === 'active') {
      Logger.warn('camera', 'Camera is already capturing');
      return true;
    }

    this.state = 'requesting_permission';
    Logger.info('camera', 'Starting camera capture pipeline');
    this.onFrameCallback = onFrame;
    this.state = 'active';

    EventBus.getInstance().emit('CAMERA_CONNECTED', {
      deviceId: this.selectedDeviceId,
      timestamp: Date.now(),
    });

    // Run frame loop
    const tickMs = Math.max(16, Math.floor(1000 / this.sampler.getTargetFps()));
    this.frameIntervalTimer = setInterval(() => {
      if (this.state !== 'active') return;

      if (this.sampler.shouldSample()) {
        const frame = this.generateSyntheticFrame(this.simulatedWidth, this.simulatedHeight);
        if (this.onFrameCallback) {
          try {
            this.onFrameCallback(frame);
          } catch (err) {
            Logger.error('camera', 'Error in frame callback consumer', { error: String(err) });
          }
        }
      }
    }, tickMs);

    return true;
  }

  public stopCapture(): void {
    if (this.frameIntervalTimer) {
      clearInterval(this.frameIntervalTimer);
      this.frameIntervalTimer = null;
    }
    this.state = 'paused';
    this.onFrameCallback = null;
    Logger.info('camera', 'Camera capture pipeline paused');
  }

  public simulateDisconnect(): void {
    Logger.warn('camera', 'Camera device disconnected unexpectedly');
    this.stopCapture();
    this.state = 'disconnected';

    EventBus.getInstance().emit('CAMERA_DISCONNECTED', {
      deviceId: this.selectedDeviceId,
      timestamp: Date.now(),
    });
  }

  public async attemptReconnect(): Promise<boolean> {
    Logger.info('camera', 'Attempting automatic camera reconnect');
    if (this.state === 'disconnected') {
      const devices = await this.enumerateDevices();
      if (devices.length > 0) {
        this.selectedDeviceId = devices[0].deviceId;
        this.state = 'active';
        EventBus.getInstance().emit('CAMERA_CONNECTED', {
          deviceId: this.selectedDeviceId,
          timestamp: Date.now(),
        });
        return true;
      }
    }
    return false;
  }

  private generateSyntheticFrame(width: number, height: number): CameraFrame {
    // Generates a deterministic in-memory RGBA test frame
    const size = width * height * 4;
    const buffer = new Uint8ClampedArray(size);

    // Fill with simulated background luminance and test face pattern
    for (let i = 0; i < size; i += 4) {
      buffer[i] = 120; // R
      buffer[i + 1] = 120; // G
      buffer[i + 2] = 120; // B
      buffer[i + 3] = 255; // A
    }

    return this.sampler.createFrame(width, height, buffer);
  }
}
