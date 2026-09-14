#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreVideo/CoreVideo.h>
#import <CoreMedia/CoreMedia.h>
#import <Accelerate/Accelerate.h>

/**
 * OpenFaceID Native AVFoundation Camera Helper
 * Provides real hardware discovery, TCC permission handling, and raw frame streaming.
 * Zero simulation. Real optical hardware only.
 */

@interface CameraStreamer : NSObject <AVCaptureVideoDataOutputSampleBufferDelegate>
@property (nonatomic, strong) AVCaptureSession *session;
@property (nonatomic, assign) uint64_t frameIndex;
@property (nonatomic, assign) BOOL isRunning;
@property (nonatomic, assign) int targetFps;
@property (nonatomic, assign) NSTimeInterval lastFrameTime;
@end

@implementation CameraStreamer

- (instancetype)init {
    self = [super init];
    if (self) {
        _frameIndex = 0;
        _isRunning = NO;
        _targetFps = 30;
        _lastFrameTime = 0;
    }
    return self;
}

- (void)captureOutput:(AVCaptureOutput *)output
didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer
       fromConnection:(AVCaptureConnection *)connection {
    if (!self.isRunning) return;

    NSTimeInterval now = [[NSDate date] timeIntervalSince1970];
    if (self.targetFps > 0 && (now - self.lastFrameTime) < (1.0 / (double)self.targetFps * 0.70)) {
        return; // Frame rate throttling allowing clock jitter headroom
    }
    self.lastFrameTime = now;

    CVImageBufferRef imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
    if (!imageBuffer) return;

    if (CVPixelBufferLockBaseAddress(imageBuffer, 0) != kCVReturnSuccess) {
        return;
    }

    size_t width = CVPixelBufferGetWidth(imageBuffer);
    size_t height = CVPixelBufferGetHeight(imageBuffer);
    size_t bytesPerRow = CVPixelBufferGetBytesPerRow(imageBuffer);
    uint8_t *baseAddress = (uint8_t *)CVPixelBufferGetBaseAddress(imageBuffer);

    if (!baseAddress || width == 0 || height == 0) {
        CVPixelBufferUnlockBaseAddress(imageBuffer, 0);
        return;
    }

    // High-performance hardware SIMD channel swap BGRA -> RGBA using Apple Accelerate
    const uint8_t permuteMap[4] = { 2, 1, 0, 3 }; // B->R, G->G, R->B, A->A
    vImage_Buffer vBuf = {
        .data = baseAddress,
        .height = height,
        .width = width,
        .rowBytes = bytesPerRow
    };
    vImagePermuteChannels_ARGB8888(&vBuf, &vBuf, permuteMap, kvImageNoFlags);

    self.frameIndex++;
    uint32_t payloadLen = (uint32_t)(width * height * 4);
    uint64_t timestampMs = (uint64_t)(now * 1000.0);

    // Protocol Header: 28 bytes total
    // [0..3]:   "OFID" (magic)
    // [4..7]:   uint32 width (LE)
    // [8..11]:  uint32 height (LE)
    // [12..15]: "RGBA" (format)
    // [16..23]: uint64 timestampMs (LE)
    // [24..27]: uint32 payloadLen (LE)
    uint8_t header[28];
    header[0] = 'O'; header[1] = 'F'; header[2] = 'I'; header[3] = 'D';

    uint32_t uWidth = (uint32_t)width;
    uint32_t uHeight = (uint32_t)height;
    memcpy(&header[4], &uWidth, 4);
    memcpy(&header[8], &uHeight, 4);

    header[12] = 'R'; header[13] = 'G'; header[14] = 'B'; header[15] = 'A';
    memcpy(&header[16], &timestampMs, 8);
    memcpy(&header[24], &payloadLen, 4);

    // Write header to stdout
    size_t wHead = fwrite(header, 1, 28, stdout);
    if (wHead != 28) {
        CVPixelBufferUnlockBaseAddress(imageBuffer, 0);
        self.isRunning = NO;
        return;
    }

    // Write pixel payload
    if (bytesPerRow == width * 4) {
        size_t wBody = fwrite(baseAddress, 1, payloadLen, stdout);
        if (wBody != payloadLen) {
            CVPixelBufferUnlockBaseAddress(imageBuffer, 0);
            self.isRunning = NO;
            return;
        }
    } else {
        // Stride handling
        for (size_t row = 0; row < height; row++) {
            fwrite(baseAddress + (row * bytesPerRow), 1, width * 4, stdout);
        }
    }
    fflush(stdout);

    CVPixelBufferUnlockBaseAddress(imageBuffer, 0);
}

@end

// Helper to query available video devices
static NSArray<AVCaptureDevice *> *getAvailableDevices() {
    NSMutableArray<AVCaptureDeviceType> *types = [NSMutableArray arrayWithObject:AVCaptureDeviceTypeBuiltInWideAngleCamera];
    if (@available(macOS 14.0, *)) {
        [types addObject:AVCaptureDeviceTypeExternal];
    }
    AVCaptureDeviceDiscoverySession *discovery = [AVCaptureDeviceDiscoverySession
        discoverySessionWithDeviceTypes:types
        mediaType:AVMediaTypeVideo
        position:AVCaptureDevicePositionUnspecified];
    return discovery.devices;
}

// Convert AVAuthorizationStatus to string
static NSString *authStatusToString(AVAuthorizationStatus status) {
    switch (status) {
        case AVAuthorizationStatusAuthorized: return @"authorized";
        case AVAuthorizationStatusDenied: return @"denied";
        case AVAuthorizationStatusRestricted: return @"restricted";
        case AVAuthorizationStatusNotDetermined: return @"notDetermined";
        default: return @"unknown";
    }
}

static void printDevicesJson() {
    NSArray<AVCaptureDevice *> *devices = getAvailableDevices();
    AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];

    NSMutableArray *devList = [NSMutableArray array];
    for (NSUInteger i = 0; i < devices.count; i++) {
        AVCaptureDevice *d = devices[i];
        int devMaxFps = 30;
        for (AVCaptureDeviceFormat *f in d.formats) {
            for (AVFrameRateRange *r in f.videoSupportedFrameRateRanges) {
                if ((int)r.maxFrameRate > devMaxFps) {
                    devMaxFps = (int)r.maxFrameRate;
                }
            }
        }
        NSMutableArray *resolutions = [NSMutableArray array];
        [resolutions addObject:@{@"width": @1920, @"height": @1080, @"maxFps": @(devMaxFps), @"pixelFormats": @[@"BGRA", @"NV12"]}];
        [resolutions addObject:@{@"width": @1280, @"height": @720, @"maxFps": @(devMaxFps), @"pixelFormats": @[@"BGRA", @"NV12"]}];
        [resolutions addObject:@{@"width": @640, @"height": @480, @"maxFps": @(devMaxFps), @"pixelFormats": @[@"BGRA", @"NV12"]}];

        [devList addObject:@{
            @"id": d.uniqueID,
            @"deviceId": d.uniqueID,
            @"name": d.localizedName,
            @"label": d.localizedName,
            @"isDefault": @(i == 0),
            @"isSynthetic": @NO,
            @"capabilities": resolutions,
            @"resolutions": resolutions
        }];
    }

    NSDictionary *root = @{
        @"permission": authStatusToString(status),
        @"devices": devList,
        @"count": @(devices.count),
        @"timestamp": [[NSDate date] description]
    };

    NSData *data = [NSJSONSerialization dataWithJSONObject:root options:NSJSONWritingPrettyPrinted error:nil];
    if (data) {
        NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        printf("%s\n", [str UTF8String]);
        fflush(stdout);
    }
}

static void requestPermissionAndOutputJson() {
    AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
    if (status == AVAuthorizationStatusNotDetermined) {
        dispatch_semaphore_t sem = dispatch_semaphore_create(0);
        [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo completionHandler:^(BOOL granted) {
            dispatch_semaphore_signal(sem);
        }];
        dispatch_time_t timeout = dispatch_time(DISPATCH_TIME_NOW, 10 * NSEC_PER_SEC);
        dispatch_semaphore_wait(sem, timeout);
        status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
    }

    NSString *statusStr = authStatusToString(status);
    NSString *perm = [statusStr isEqualToString:@"authorized"] ? @"granted" :
                     [statusStr isEqualToString:@"denied"] ? @"denied" :
                     [statusStr isEqualToString:@"restricted"] ? @"restricted" : @"prompt";

    NSDictionary *outDict = @{
        @"status": statusStr,
        @"permission": perm,
        @"granted": @([statusStr isEqualToString:@"authorized"])
    };
    NSData *data = [NSJSONSerialization dataWithJSONObject:outDict options:0 error:nil];
    if (data) {
        NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        printf("%s\n", [str UTF8String]);
        fflush(stdout);
    }
}

static int startStreaming(NSString *targetDeviceId, int reqWidth, int reqHeight, int reqFps) {
    NSArray<AVCaptureDevice *> *devices = getAvailableDevices();
    if (devices.count == 0) {
        fprintf(stderr, "Error: No video capture devices available\n");
        return 1;
    }

    AVCaptureDevice *selectedDevice = nil;
    if (targetDeviceId && targetDeviceId.length > 0 && ![targetDeviceId isEqualToString:@"default"]) {
        for (AVCaptureDevice *d in devices) {
            if ([d.uniqueID isEqualToString:targetDeviceId]) {
                selectedDevice = d;
                break;
            }
        }
    }
    if (!selectedDevice) {
        selectedDevice = devices.firstObject;
    }

    fprintf(stderr, "[openfaceid-camera-avf] Using camera: %s (%s)\n",
            [selectedDevice.localizedName UTF8String], [selectedDevice.uniqueID UTF8String]);

    NSError *error = nil;
    AVCaptureDeviceInput *input = [AVCaptureDeviceInput deviceInputWithDevice:selectedDevice error:&error];
    if (error || !input) {
        fprintf(stderr, "Error creating device input: %s\n",
                [[error localizedDescription] UTF8String]);
        return 2;
    }

    AVCaptureSession *session = [[AVCaptureSession alloc] init];
    if ([session canAddInput:input]) {
        [session addInput:input];
    } else {
        fprintf(stderr, "Error: Cannot add input to capture session\n");
        return 3;
    }

    int targetW = reqWidth > 0 ? reqWidth : 1280;
    int targetH = reqHeight > 0 ? reqHeight : 720;

    if (targetW >= 1920) {
        if ([session canSetSessionPreset:AVCaptureSessionPreset1920x1080]) {
            [session setSessionPreset:AVCaptureSessionPreset1920x1080];
        }
    } else if (targetW >= 1280) {
        if ([session canSetSessionPreset:AVCaptureSessionPreset1280x720]) {
            [session setSessionPreset:AVCaptureSessionPreset1280x720];
        }
    } else {
        if ([session canSetSessionPreset:AVCaptureSessionPreset640x480]) {
            [session setSessionPreset:AVCaptureSessionPreset640x480];
        }
    }

    AVCaptureVideoDataOutput *output = [[AVCaptureVideoDataOutput alloc] init];
    output.videoSettings = @{
        (id)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
        (id)kCVPixelBufferWidthKey: @(targetW),
        (id)kCVPixelBufferHeightKey: @(targetH)
    };
    output.alwaysDiscardsLateVideoFrames = YES;

    CameraStreamer *streamer = [[CameraStreamer alloc] init];
    streamer.session = session;
    streamer.isRunning = YES;

    int maxSupportedFps = 30;
    for (AVFrameRateRange *range in selectedDevice.activeFormat.videoSupportedFrameRateRanges) {
        if ((int)range.maxFrameRate > maxSupportedFps) {
            maxSupportedFps = (int)range.maxFrameRate;
        }
    }
    int desiredFps = reqFps > 0 ? reqFps : maxSupportedFps;
    if (desiredFps > maxSupportedFps) {
        desiredFps = maxSupportedFps;
    }

    // Configure hardware frame duration to lock target FPS without auto-exposure throttling
    NSError *lockErr = nil;
    if ([selectedDevice lockForConfiguration:&lockErr]) {
        CMTime frameDuration = CMTimeMake(1, (int32_t)desiredFps);
        selectedDevice.activeVideoMinFrameDuration = frameDuration;
        selectedDevice.activeVideoMaxFrameDuration = frameDuration;
        [selectedDevice unlockForConfiguration];
        fprintf(stderr, "[openfaceid-camera-avf] Device locked to %d FPS (hardware max: %d FPS)\n", desiredFps, maxSupportedFps);
    } else {
        fprintf(stderr, "[openfaceid-camera-avf] Note: Could not lock device configuration: %s\n",
                [[lockErr localizedDescription] UTF8String]);
    }
    streamer.targetFps = desiredFps;

    dispatch_queue_t queue = dispatch_queue_create("openfaceid.camera.stream", DISPATCH_QUEUE_SERIAL);
    [output setSampleBufferDelegate:streamer queue:queue];

    if ([session canAddOutput:output]) {
        [session addOutput:output];
    } else {
        fprintf(stderr, "Error: Cannot add video output to capture session\n");
        return 4;
    }

    [session startRunning];
    fprintf(stderr, "[openfaceid-camera-avf] Capture session started at %d fps\n", streamer.targetFps);

    // Keep running until stdin closes or SIGINT/SIGTERM
    while (streamer.isRunning && [session isRunning]) {
        [[NSRunLoop currentRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.1]];
        if (feof(stdin)) {
            break;
        }
    }

    [session stopRunning];
    fprintf(stderr, "[openfaceid-camera-avf] Session stopped. Streamed %llu frames\n", streamer.frameIndex);
    return 0;
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 2) {
            printf("Usage: openfaceid-camera-avf <devices|permission|stream> [deviceId] [width] [height] [fps]\n");
            return 1;
        }

        NSString *command = [NSString stringWithUTF8String:argv[1]];
        if ([command isEqualToString:@"devices"]) {
            printDevicesJson();
            return 0;
        } else if ([command isEqualToString:@"permission"]) {
            requestPermissionAndOutputJson();
            return 0;
        } else if ([command isEqualToString:@"stream"]) {
            NSString *devId = (argc > 2) ? [NSString stringWithUTF8String:argv[2]] : @"default";
            int width = (argc > 3) ? atoi(argv[3]) : 1280;
            int height = (argc > 4) ? atoi(argv[4]) : 720;
            int fps = (argc > 5) ? atoi(argv[5]) : 30;
            return startStreaming(devId, width, height, fps);
        } else {
            fprintf(stderr, "Unknown command: %s\n", [command UTF8String]);
            return 1;
        }
    }
}
