# OpenFaceID macOS Real Camera Failure — Root Cause & Reproduction Report

**Date**: September 13, 2026  
**Environment**: macOS 15.6+ Sequoia (Darwin 25.6.0 arm64, Apple M4)  
**Host Hardware**: MacBook Air (Built-in "MacBook Air Camera", 1080p@30fps)  
**Target Version**: 0.2.1-rc.1  
**Target Commit**: 2bbe16710c389ff378d1686207431599b502d352  

---

## 1. Actual Failure Reproduction

### User Execution Sequence & What Actually Happened

1. **Launch Command**:
   ```bash
   npm run desktop
   # which runs: node --experimental-strip-types apps/desktop/serve.js
   ```
2. **Application Path**:
   `http://127.0.0.1:41793/`
3. **Application Packaging Failure**:
   When launching `dist/OpenFaceID.app/Contents/MacOS/OpenFaceID` as installed in `/Applications`:
   - The launcher script executes:
     ```bash
     CURRENT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
     exec "$NODE_BIN" --experimental-strip-types "$CURRENT_DIR/apps/desktop/serve.js"
     ```
   - When located in `/Applications/OpenFaceID.app/Contents/MacOS/`, `CURRENT_DIR` resolves to `/Applications`.
   - **Result**: Immediate fatal crash: `Cannot find module '/Applications/apps/desktop/serve.js'`. The app cannot run outside the git development repository!
4. **macOS Camera Permission Behavior**:
   - `CameraManager.ts` lines 58–79 attempted to detect permissions via `execFileSync('/opt/homebrew/bin/ffmpeg', ['-f', 'avfoundation', ...])`.
   - On standard Macs without `ffmpeg` installed, `ffmpeg` was not found (`findFfmpegPath() === 'ffmpeg'`, `ENOENT`), falling back to `prompt`.
   - Because no native AVFoundation permission API (`AVCaptureDevice.requestAccess(for: .video)`) was called by the runtime, macOS never presented the native TCC camera permission dialog for OpenFaceID.
5. **Camera Device Discovery**:
   - `CameraManager.ts` lines 112–147 executed `system_profiler SPCameraDataType` as a text scrape.
   - It guessed fixed capabilities (`1920x1080, 1280x720, 640x480`) without enumerating real AVFoundation formats.
6. **Frame Acquisition & Buffer Contents**:
   - **CRITICAL DEFECT**: In `CameraManager.ts` lines 326 and 393–423:
     ```typescript
     private createRealCameraFrame(width: number, height: number): CameraFrame {
       this.frameCount++;
       const size = width * height * 4;
       const buffer = new Uint8ClampedArray(size);
       for (let i = 0; i < size; i += 4) {
         buffer[i] = 128;     // R
         buffer[i + 1] = 130; // G
         buffer[i + 2] = 132; // B
         buffer[i + 3] = 255; // A
       }
       return { data: buffer, width, height, pixelFormat: 'RGBA', ... };
     }
     ```
   - **Actual Frame Data**: Flat uniform grey buffer (`[128, 130, 132, 255]`). Zero physical photons or camera frames were captured!
7. **Frame Dimensions & Format**:
   - Synthesized as 1280x720 RGBA in memory, with zero connection to the physical sensor.
8. **Face Detection**:
   - Because the frame buffer was flat grey, `BlazeFaceDetector` evaluated anchor luminance differences and found no valid facial contours or features. Detection returned `NO FACE` (or noisy candidate boxes depending on thresholds).
9. **Embedding Pipeline**:
   - In `apps/desktop/serve.js` lines 389–416, enrollment fell back to mathematical sine waves:
     ```typescript
     const val = Math.sin((i + 1) * 0.137 + (p + 1) * 0.314 + body.name.length * 0.05);
     ```
   - Real facial feature vectors were never extracted from real face crops.
10. **Recognition & Liveness**:
    - With flat grey frames, recognition could not match any genuine face.
    - Liveness micro-motion optical flow on identical synthetic grey frames produced 0.000 variance, failing presentation attack detection.
11. **User Interface**:
    - `apps/desktop/index.html` lines 771–780 contained an unlinked static `<div>` placeholder:
      ```html
      <div class="preview-box">
        <div style="text-align: center; color: var(--text-muted); padding: 20px;">
          <p style="font-size: 13px; margin-bottom: 6px;">Webcam Sensor Preview</p>
        </div>
      </div>
      ```
    - There was no video feed, no canvas rendering, and no visual camera stream presented to the user.

---

## 2. Pipeline Breakpoint Analysis

| Stage | Expected Implementation | Actual State in RC | Root Cause |
| :--- | :--- | :--- | :--- |
| **1. AVFoundation Device Query** | Native `AVCaptureDeviceDiscoverySession` | `system_profiler` text scrape fallback | No native compiled AVFoundation helper |
| **2. TCC Permission Request** | `AVCaptureDevice.requestAccess` | Non-functional `ffmpeg` CLI probe | Fails silently if ffmpeg not installed |
| **3. Frame Capture** | `AVCaptureSession` + `AVCaptureVideoDataOutput` | `setInterval` calling synthetic grey buffer generator | `createRealCameraFrame` stub in `CameraManager.ts` |
| **4. Pixel Buffer Extraction** | `CVPixelBuffer` -> RGBA/BGRA byte array | Zero memory allocation from camera driver | Fake buffer in RAM |
| **5. Vision Pipeline Delivery** | Real frame passed to `BlazeFaceDetector` | Grey buffer passed to `BlazeFaceDetector` | Upstream capture missing |
| **6. Real Face Detection** | Detected face bounding box from optical feed | Zero real faces detected | No video feed |
| **7. Real Embedding Generation** | ArcFace on aligned facial crop | Synthetic sine-wave vectors | Fallback stubs in `serve.js` |
| **8. UI Video Stream** | Low-latency live stream (MJPEG / Canvas) | Static text placeholder | No video stream route in `serve.js` |
| **9. Standalone `.app`** | Self-contained bundle with bundled Node runtime | Broken script referencing dev repo via `cd ../../..` | Incomplete packaging script |

---

## 3. Real Hardware Capability Verified on Host

Using direct Objective-C / Swift AVFoundation compilation on this machine:
- **Discovered Camera**: `MacBook Air Camera` (`6C707041-05AC-0010-000C-000000000001`), `Iriun Camera` (`5A0B78EA-4C72-485C-B87D-086EC8E5E180`).
- **Permission Status**: Requested and GRANTED (`AVAuthorizationStatusAuthorized = 3`).
- **Physical Capture Test**: Real frames successfully acquired at 1920x1080@30fps in `kCVPixelFormatType_32BGRA` with non-zero pixel payloads (`sampleSum > 4,000,000`).
- **Conclusion**: The host hardware and operating system are fully capable of native AVFoundation capture. The failure was entirely due to missing native integration in the codebase.
