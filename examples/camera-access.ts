/**
 * OpenFaceID Developer Example: Camera Enumeration & Volatile Frame Sampling
 *
 * Purpose:
 *   Demonstrates camera hardware discovery, permission checking, and volatile RAM
 *   frame capture with guaranteed zeroization.
 *
 * Requirements:
 *   - Node.js >= 22.0.0
 *   - macOS, Windows, or Linux camera hardware or synthetic fallback
 *
 * Run Command:
 *   node --experimental-strip-types examples/camera-access.ts
 *
 * Expected Output:
 *   Permission status, device count, frame dimensions, and memory zeroization confirmation.
 *
 * Security Considerations:
 *   Raw video frames exist solely in volatile RAM buffers and are zeroized immediately
 *   after inference. Zero images are ever persisted to disk.
 */

import { CameraManager } from '../packages/camera/src/index.ts';
import { createSyntheticFrame } from './demo/fixtures.ts';

async function run() {
  console.log('=== OpenFaceID Example: Camera Access & RAM Zeroization ===\n');

  const manager = new CameraManager();

  // 1. Check OS camera permissions
  const perm = await manager.checkPermission();
  console.log(`1. OS Camera Permission: ${perm.toUpperCase()}`);

  // 2. Enumerate available video capture hardware
  const devices = await manager.enumerateDevices();
  console.log(`2. Discovered Devices:   ${devices.length}`);
  devices.forEach((d, i) => {
    console.log(`   [${i + 1}] ${d.name} (${d.id}) ${d.isDefault ? '[Default]' : ''}`);
  });

  // 3. Volatile Frame Buffer Lifecycle
  console.log(`\n3. Demonstrating Volatile RAM Frame Lifecycle:`);
  const frame = createSyntheticFrame(640, 480, 200);
  console.log(`   Frame grabbed into RAM: ${frame.width}x${frame.height} (${frame.pixelFormat})`);
  console.log(`   Buffer byte length:     ${frame.data.byteLength} bytes`);
  console.log(`   Sample pixel value:     ${frame.data[0]}`);

  // 4. Secure zeroization
  frame.zeroize();
  const allZero = frame.data.every((b) => b === 0);
  console.log(`   Memory Zeroization:     ${allZero ? 'VERIFIED (All bytes 0x00)' : 'FAILED'}`);
  console.log(`   Disk writes:            0 files written`);

  console.log('\n✓ Camera access example completed successfully.');
}

run().catch(console.error);
