import { execFileSync, spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  CameraDevice,
  CameraState,
  CameraFrame,
  CameraOptions,
  CameraPermissionStatus,
  CameraCapabilities,
} from './types.ts';
import { FrameSampler } from './FrameSampler.ts';
import { Logger, EventBus } from '../../core/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CameraDiagnosticCounters {
  fps: number;
  framesReceived: number;
  framesProcessed: number;
  framesDropped: number;
  invalidFrames: number;
  cameraReconnects: number;
  lastLatencyMs: number;
}

function findNativeAvfBinary(): string | null {
  const candidates = [
    process.env.OFID_CAMERA_BIN,
    path.join(__dirname, '../bin/openfaceid-camera-avf'),
    path.join(__dirname, '../../packages/camera/bin/openfaceid-camera-avf'),
    path.join(process.cwd(), 'packages/camera/bin/openfaceid-camera-avf'),
    path.join(process.cwd(), 'bin/openfaceid-camera-avf'),
    path.join(path.dirname(process.execPath), 'openfaceid-camera-avf'),
    path.join(path.dirname(process.execPath), '../Resources/bin/openfaceid-camera-avf'),
    path.join(path.dirname(process.execPath), 'bin/openfaceid-camera-avf'),
    '/usr/local/bin/openfaceid-camera-avf',
  ];
  for (const cand of candidates) {
    try {
      if (cand && fs.existsSync(cand)) return cand;
    } catch {
      // Ignored
    }
  }
  return null;
}

export class CameraManager {
  private state: CameraState = 'uninitialized';
  private selectedDeviceId: string = 'default';
  private options: CameraOptions;
  private sampler: FrameSampler;
  private onFrameCallback: ((frame: CameraFrame) => void) | null = null;
  private currentWidth: number = 1280;
  private currentHeight: number = 720;
  private isProcessingFrame: boolean = false;
  private cachedDevices: CameraDevice[] | null = null;
  private frameCount: number = 0;
  private nativeProcess: ChildProcess | null = null;
  private nativeStreamBuffer: Buffer = Buffer.alloc(0);
  private simulationTimer: NodeJS.Timeout | null = null;
  private fpsWindowStart: number = Date.now();
  private fpsWindowFrames: number = 0;

  private diagnostics: CameraDiagnosticCounters = {
    fps: 0,
    framesReceived: 0,
    framesProcessed: 0,
    framesDropped: 0,
    invalidFrames: 0,
    cameraReconnects: 0,
    lastLatencyMs: 0,
  };

  private onPreviewCallback: ((frame: CameraFrame) => void) | null = null;

  constructor(options: CameraOptions = {}) {
    this.options = options;
    this.selectedDeviceId = options.preferredDeviceId || 'default';
    this.sampler = new FrameSampler(options.targetFps || 60);
    if (options.preferredWidth) this.currentWidth = options.preferredWidth;
    if (options.preferredHeight) this.currentHeight = options.preferredHeight;
  }

  public setOnPreviewCallback(callback: ((frame: CameraFrame) => void) | null): void {
    this.onPreviewCallback = callback;
  }

  public getState(): CameraState {
    return this.state;
  }

  public getDiagnostics(): CameraDiagnosticCounters & { state: CameraState; deviceId: string } {
    return {
      state: this.state,
      deviceId: this.selectedDeviceId,
      ...this.diagnostics,
    };
  }

  public async checkPermission(): Promise<CameraPermissionStatus> {
    const platform = process.platform;
    try {
      if (platform === 'darwin') {
        const avf = findNativeAvfBinary();
        if (avf) {
          try {
            const out = execFileSync(avf, ['permission'], {
              timeout: 3000,
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
            });
            const parsed = JSON.parse(out.trim());
            return (parsed.permission as CameraPermissionStatus) || 'prompt';
          } catch {
            return 'prompt';
          }
        }
        return 'prompt';
      } else if (platform === 'linux') {
        const videoNodes = fs.readdirSync('/dev').filter((f) => f.startsWith('video'));
        if (videoNodes.length === 0) return 'unavailable';
        try {
          fs.accessSync(`/dev/${videoNodes[0]}`, fs.constants.R_OK);
          return 'granted';
        } catch {
          return 'denied';
        }
      } else if (platform === 'win32') {
        return 'prompt';
      }
    } catch {
      return 'unavailable';
    }
    return 'prompt';
  }

  public async enumerateDevices(): Promise<CameraDevice[]> {
    Logger.info('camera', 'Enumerating available video capture devices');

    if (this.cachedDevices && this.cachedDevices.length > 0) {
      return this.cachedDevices;
    }

    const platform = process.platform;
    const discovered: CameraDevice[] = [];

    if (platform === 'darwin') {
      const avf = findNativeAvfBinary();
      if (avf) {
        try {
          const out = execFileSync(avf, ['devices'], {
            timeout: 3000,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          });
          const parsed = JSON.parse(out);
          if (parsed && Array.isArray(parsed.devices)) {
            for (const d of parsed.devices) {
              discovered.push({
                id: d.id,
                deviceId: d.deviceId || d.id,
                name: d.name,
                label: d.label || d.name,
                isDefault: Boolean(d.isDefault),
                isSynthetic: false,
                capabilities: d.capabilities || [],
                resolutions: d.resolutions || [],
              });
            }
          }
        } catch (err) {
          Logger.warn('camera', 'Native AVFoundation discovery failed, attempting fallback', { error: String(err) });
        }
      }
    } else if (platform === 'linux') {
      try {
        if (fs.existsSync('/sys/class/video4linux')) {
          const vNodes = fs.readdirSync('/sys/class/video4linux');
          for (const node of vNodes) {
            const namePath = `/sys/class/video4linux/${node}/name`;
            let devName = node;
            if (fs.existsSync(namePath)) {
              devName = fs.readFileSync(namePath, 'utf8').trim();
            }
            const devCaps: CameraCapabilities[] = [
              { width: 1280, height: 720, maxFps: 30, pixelFormats: ['YUV420P', 'RGBA'] },
              { width: 640, height: 480, maxFps: 30, pixelFormats: ['YUV420P', 'RGBA'] },
            ];
            discovered.push({
              id: `/dev/${node}`,
              deviceId: `/dev/${node}`,
              name: devName,
              label: devName,
              isDefault: discovered.length === 0,
              capabilities: devCaps,
              resolutions: devCaps,
              isSynthetic: false,
            });
          }
        }
      } catch {
        // Handled below
      }
    }

    // Explicit test mode fallback ONLY when requested or in simulation mode
    if (discovered.length === 0) {
      const isSimulation = process.env.OPENFACEID_SIMULATION === '1' || this.options.isTestMode;
      if (isSimulation) {
        const defaultCaps: CameraCapabilities[] = [
          { width: 1280, height: 720, maxFps: 30, pixelFormats: ['RGBA'] },
          { width: 640, height: 480, maxFps: 30, pixelFormats: ['RGBA'] },
        ];
        discovered.push({
          id: 'test-sensor-01',
          deviceId: 'test-sensor-01',
          name: 'Test Synthetic Camera',
          label: 'Test Synthetic Camera',
          isDefault: true,
          capabilities: defaultCaps,
          resolutions: defaultCaps,
          isSynthetic: true,
        });
      }
    }

    this.cachedDevices = discovered;
    return discovered;
  }

  public async selectDevice(deviceId: string): Promise<boolean> {
    const devices = await this.enumerateDevices();
    const found = devices.find(
      (d) => d.id === deviceId || d.deviceId === deviceId || (deviceId === 'default' && d.isDefault)
    );
    if (!found) {
      if (devices.length > 0) {
        this.selectedDeviceId = devices[0].deviceId;
        return true;
      }
      Logger.warn('camera', `Device ${deviceId} not found`);
      return false;
    }

    this.selectedDeviceId = found.deviceId;
    Logger.info('camera', `Selected camera: ${found.name} (${found.deviceId})`);
    return true;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  public getSelectedDevice(): CameraDevice | null {
    if (!this.cachedDevices || this.cachedDevices.length === 0) return null;
    return (
      this.cachedDevices.find((d) => d.deviceId === this.selectedDeviceId || d.id === this.selectedDeviceId) ||
      this.cachedDevices[0] ||
      null
    );
  }

  public async open(deviceId: string): Promise<void> {
    await this.selectDevice(deviceId);
    this.state = 'paused';
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
    Logger.info('camera', 'Starting real hardware camera capture pipeline');
    this.onFrameCallback = onFrame;

    const platform = process.platform;
    const avf = findNativeAvfBinary();
    const isSimulation = process.env.OPENFACEID_SIMULATION === '1' || this.options.isTestMode;

    if (platform === 'darwin' && avf && !isSimulation) {
      return this.startNativeAvfCapture();
    }

    // In unit test mode ONLY
    if (isSimulation) {
      return this.startSimulationCapture();
    }

    Logger.error('camera', 'Real camera capture unavailable on this platform/configuration (simulation disabled in production)');
    this.state = 'error';
    return false;
  }

  private startNativeAvfCapture(): boolean {
    const avf = findNativeAvfBinary();
    if (!avf) {
      this.state = 'error';
      return false;
    }

    const devId = this.selectedDeviceId || 'default';
    const targetFps = this.sampler.getTargetFps() || 60;

    try {
      this.nativeProcess = spawn(
        avf,
        ['stream', devId, String(this.currentWidth), String(this.currentHeight), String(targetFps)],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch (err) {
      Logger.error('camera', 'Failed to spawn native camera helper', { error: String(err) });
      this.state = 'error';
      return false;
    }

    this.state = 'active';
    this.nativeStreamBuffer = Buffer.alloc(0);

    EventBus.getInstance().emit('CAMERA_CONNECTED', {
      deviceId: this.selectedDeviceId,
      timestamp: Date.now(),
    });

    this.nativeProcess.stdout?.on('data', (chunk: Buffer) => {
      this.handleNativeData(chunk);
    });

    this.nativeProcess.stderr?.on('data', (errChunk: Buffer) => {
      Logger.debug('camera', `[avf] ${errChunk.toString('utf8').trim()}`);
    });

    this.nativeProcess.on('exit', (code) => {
      Logger.warn('camera', `Native camera process exited with code ${code}`);
      if (this.state === 'active') {
        this.state = 'disconnected';
        EventBus.getInstance().emit('CAMERA_DISCONNECTED', {
          deviceId: this.selectedDeviceId,
          timestamp: Date.now(),
        });
      }
    });

    this.nativeProcess.on('error', (err) => {
      Logger.error('camera', 'Native camera process error', { error: String(err) });
      this.state = 'error';
    });

    return true;
  }

  private handleNativeData(chunk: Buffer): void {
    this.nativeStreamBuffer = Buffer.concat([this.nativeStreamBuffer, chunk]);

    // Protocol Header: 28 bytes
    // [0..3]:   "OFID"
    // [4..7]:   width (uint32 LE)
    // [8..11]:  height (uint32 LE)
    // [12..15]: format ("BGRA")
    // [16..23]: timestamp (uint64 LE)
    // [24..27]: payloadLen (uint32 LE)
    while (this.nativeStreamBuffer.length >= 28) {
      const magic = this.nativeStreamBuffer.toString('utf8', 0, 4);
      if (magic !== 'OFID') {
        // Resync: advance 1 byte
        this.diagnostics.invalidFrames++;
        this.nativeStreamBuffer = this.nativeStreamBuffer.subarray(1);
        continue;
      }

      const frameWidth = this.nativeStreamBuffer.readUInt32LE(4);
      const frameHeight = this.nativeStreamBuffer.readUInt32LE(8);
      const payloadLen = this.nativeStreamBuffer.readUInt32LE(24);

      if (frameWidth === 0 || frameHeight === 0 || payloadLen !== frameWidth * frameHeight * 4) {
        this.diagnostics.invalidFrames++;
        this.nativeStreamBuffer = this.nativeStreamBuffer.subarray(4);
        continue;
      }

      if (this.nativeStreamBuffer.length < 28 + payloadLen) {
        // Wait for full frame
        break;
      }

      const rawPayload = this.nativeStreamBuffer.subarray(28, 28 + payloadLen);
      this.nativeStreamBuffer = this.nativeStreamBuffer.subarray(28 + payloadLen);

      this.frameCount++;
      this.diagnostics.framesReceived++;
      if (!this.options.preferredWidth) {
        this.currentWidth = frameWidth;
        this.currentHeight = frameHeight;
      }

      // Update FPS counter
      const now = Date.now();
      this.fpsWindowFrames++;
      if (now - this.fpsWindowStart >= 1000) {
        this.diagnostics.fps = Number(((this.fpsWindowFrames * 1000) / (now - this.fpsWindowStart)).toFixed(1));
        this.fpsWindowFrames = 0;
        this.fpsWindowStart = now;
      }

      // In-place BGRA to RGBA conversion
      const rawData = new Uint8ClampedArray(rawPayload.buffer, rawPayload.byteOffset, rawPayload.length);
      for (let i = 0; i < rawData.length; i += 4) {
        const b = rawData[i];
        rawData[i] = rawData[i + 2]; // R = B
        rawData[i + 2] = b;          // B = old R
      }

      // If caller requested specific dimensions, resample real frame
      let finalData = rawData;
      const targetW = this.currentWidth;
      const targetH = this.currentHeight;
      if (frameWidth !== targetW || frameHeight !== targetH) {
        finalData = new Uint8ClampedArray(targetW * targetH * 4);
        const xRatio = frameWidth / targetW;
        const yRatio = frameHeight / targetH;
        for (let dy = 0; dy < targetH; dy++) {
          const sy = Math.min(frameHeight - 1, Math.floor(dy * yRatio));
          for (let dx = 0; dx < targetW; dx++) {
            const sx = Math.min(frameWidth - 1, Math.floor(dx * xRatio));
            const srcIdx = (sy * frameWidth + sx) * 4;
            const dstIdx = (dy * targetW + dx) * 4;
            finalData[dstIdx] = rawData[srcIdx];
            finalData[dstIdx + 1] = rawData[srcIdx + 1];
            finalData[dstIdx + 2] = rawData[srcIdx + 2];
            finalData[dstIdx + 3] = rawData[srcIdx + 3];
          }
        }
      }

      let zeroed = false;
      const zeroize = () => {
        if (!zeroed) {
          finalData.fill(0);
          zeroed = true;
        }
      };

      const frame: CameraFrame = {
        data: finalData,
        width: targetW,
        height: targetH,
        pixelFormat: 'RGBA',
        timestamp: now,
        frameIndex: this.frameCount,
        zeroize,
      };

      // 1. Deliver real-time preview frame with zero latency (unblocked by vision inference)
      if (this.onPreviewCallback) {
        try {
          this.onPreviewCallback(frame);
        } catch (err) {
          Logger.debug('camera', 'Preview callback error', { error: String(err) });
        }
      }

      // 2. Vision Inference Backpressure Check: Skip inference if previous inference is still computing
      if (this.isProcessingFrame) {
        this.diagnostics.framesDropped++;
        continue;
      }

      // Frame Rate Throttling for vision inference
      if (!this.sampler.shouldSample(now)) {
        this.diagnostics.framesDropped++;
        continue;
      }

      if (this.onFrameCallback) {
        const startProc = Date.now();
        this.isProcessingFrame = true;
        this.diagnostics.framesProcessed++;
        try {
          const res = this.onFrameCallback(frame);
          if (res && typeof (res as any).then === 'function') {
            (res as Promise<void>).finally(() => {
              this.diagnostics.lastLatencyMs = Date.now() - startProc;
              this.isProcessingFrame = false;
            });
          } else {
            this.diagnostics.lastLatencyMs = Date.now() - startProc;
            this.isProcessingFrame = false;
          }
        } catch (err) {
          this.isProcessingFrame = false;
          Logger.error('camera', 'Error in frame callback consumer', { error: String(err) });
        }
      }
    }
  }

  private startSimulationCapture(): boolean {
    Logger.warn('camera', 'Starting simulation camera capture (test mode)');
    this.state = 'active';
    const tickMs = Math.max(16, Math.floor(1000 / this.sampler.getTargetFps()));
    this.simulationTimer = setInterval(() => {
      if (this.state !== 'active') return;
      if (this.sampler.shouldSample()) {
        if (this.isProcessingFrame) {
          this.diagnostics.framesDropped++;
          return;
        }
        this.frameCount++;
        this.diagnostics.framesReceived++;
        this.diagnostics.framesProcessed++;

        const width = this.currentWidth;
        const height = this.currentHeight;
        const size = width * height * 4;
        const buffer = new Uint8ClampedArray(size);
        for (let i = 0; i < size; i += 4) {
          buffer[i] = 128;
          buffer[i + 1] = 130;
          buffer[i + 2] = 132;
          buffer[i + 3] = 255;
        }

        let zeroed = false;
        const frame: CameraFrame = {
          data: buffer,
          width,
          height,
          pixelFormat: 'RGBA',
          timestamp: Date.now(),
          frameIndex: this.frameCount,
          zeroize: () => {
            if (!zeroed) {
              buffer.fill(0);
              zeroed = true;
            }
          },
        };

        if (this.onPreviewCallback) {
          try {
            this.onPreviewCallback(frame);
          } catch {}
        }

        if (this.onFrameCallback) {
          this.isProcessingFrame = true;
          try {
            const res = this.onFrameCallback(frame);
            if (res && typeof (res as any).then === 'function') {
              (res as Promise<void>).finally(() => {
                this.isProcessingFrame = false;
              });
            } else {
              this.isProcessingFrame = false;
            }
          } catch {
            this.isProcessingFrame = false;
          }
        }
      }
    }, tickMs);

    return true;
  }

  public stopCapture(): void {
    if (this.nativeProcess) {
      try {
        this.nativeProcess.kill('SIGTERM');
      } catch {
        // Ignored
      }
      this.nativeProcess = null;
    }
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
    this.state = 'paused';
    this.onFrameCallback = null;
    this.nativeStreamBuffer = Buffer.alloc(0);
    Logger.info('camera', 'Camera capture pipeline paused');
  }

  public async close(): Promise<void> {
    this.stopCapture();
    this.state = 'closed';
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
    this.diagnostics.cameraReconnects++;
    if (this.state === 'disconnected') {
      this.cachedDevices = null;
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
}
