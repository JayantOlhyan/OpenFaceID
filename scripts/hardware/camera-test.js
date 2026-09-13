#!/usr/bin/env node
/**
 * OpenFaceID — Hardware Camera Validation Runner
 *
 * Implements Section 15, 16, 21, 25 of the Continuous Engineering Specification.
 * Tests physical camera device enumeration, resolution capabilities, and backpressure.
 */

import fs from 'fs';
import path from 'path';
import { CameraManager } from '../../packages/camera/src/CameraManager.ts';
import { FrameSampler } from '../../packages/camera/src/FrameSampler.ts';

async function runCameraValidation() {
  console.log('='.repeat(72));
  console.log('OPENFACEID — HARDWARE CAMERA VALIDATION RUNNER');
  console.log('='.repeat(72));

  const manager = new CameraManager();
  const sampler = new FrameSampler(30);

  // 1. Enumerate physical devices
  console.log('1. Probing video capture devices on host system...');
  const devices = await manager.enumerateDevices();
  console.log(`Discovered ${devices.length} capture device(s):`);

  for (const dev of devices) {
    const hwType = dev.isSynthetic ? 'Synthetic / Virtual' : 'Physical Hardware';
    console.log(`   * ${dev.name} [${hwType}]`);
    console.log(`     Device ID: ${dev.id}`);
    if (dev.capabilities) {
      console.log(`     Supported Modes: ${dev.capabilities.map((c) => `${c.width}x${c.height}@${c.maxFps}fps`).join(', ')}`);
    }
  }

  // 2. Permission check
  console.log('\n2. Verifying camera permission status...');
  const permission = await manager.checkPermission();
  console.log(`   Permission state: ${permission.toUpperCase()}`);

  // 3. Resolution Matrix Validation
  console.log('\n3. Validating Resolution Matrix (640x480, 1280x720, 1920x1080)...');
  const resolutionsToTest = [
    { name: '480p SD', width: 640, height: 480 },
    { name: '720p HD', width: 1280, height: 720 },
    { name: '1080p FHD', width: 1920, height: 1080 },
  ];

  const resolutionResults = [];
  const primaryDev = devices[0];

  for (const res of resolutionsToTest) {
    const isSupported = primaryDev?.capabilities?.some(
      (c) => c.width >= res.width && c.height >= res.height
    ) ?? false;

    const frame = sampler.createFrame(res.width, res.height);
    const byteSize = frame.data.length;
    const mbSize = (byteSize / (1024 * 1024)).toFixed(2);

    console.log(`   * ${res.name} (${res.width}x${res.height}): ${isSupported ? 'SUPPORTED' : 'NOT SUPPORTED'} (~${mbSize} MB/frame)`);
    resolutionResults.push({
      name: res.name,
      width: res.width,
      height: res.height,
      supported: isSupported,
      frameSizeBytes: byteSize,
    });
  }

  // 4. Memory Backpressure Test
  console.log('\n4. Testing Downstream Backpressure Dropping...');
  const bpManager = new CameraManager({ targetFps: 60 });
  let processedCount = 0;

  await bpManager.startCapture(async (frame) => {
    processedCount++;
    await new Promise((r) => setTimeout(r, 60));
    frame.zeroize();
  });

  await new Promise((r) => setTimeout(r, 180));
  bpManager.stopCapture();

  console.log(`   At 60 FPS over 180ms (~11 theoretical ticks), processed: ${processedCount} frames`);
  const backpressurePassed = processedCount <= 4 && processedCount >= 1;
  console.log(`   Backpressure Queue Protection: ${backpressurePassed ? 'VERIFIED (Dropped ~' + (11 - processedCount) + ' frames)' : 'FAIL'}`);

  // 5. Lifecycle Stop
  console.log('   Camera lifecycle successfully paused.');

  // Save report
  const outDir = path.resolve('data/hardware');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'camera-test.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      devices,
      permission,
      resolutionResults,
      backpressure: {
        processed: processedCount,
        passed: backpressurePassed,
      },
    }, null, 2)
  );

  console.log('\n' + '='.repeat(72));
  console.log(`Camera validation artifact saved: data/hardware/camera-test.json`);
  console.log('='.repeat(72));
}

runCameraValidation().catch((err) => {
  console.error('Camera validation failed:', err);
  process.exit(1);
});
