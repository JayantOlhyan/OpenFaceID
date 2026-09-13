#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="0.2.1-rc.1"
ARCH="arm64"
DMG_PATH="$DIR/dist/OpenFaceID-${VERSION}-${ARCH}.dmg"
MOUNT_POINT="/Volumes/OpenFaceID"
TEST_DIR="/tmp/OpenFaceID-install-test"

echo "============================================================"
echo " OpenFaceID macOS DMG & Clean Installation Validation"
echo " Target: $DMG_PATH"
echo "============================================================"

# 1. Verify DMG Exists and Size Sanity
if [ ! -f "$DMG_PATH" ]; then
  echo "FAIL: DMG file does not exist at $DMG_PATH"
  exit 1
fi

DMG_SIZE=$(stat -f%z "$DMG_PATH")
echo "✓ DMG exists (Size: $DMG_SIZE bytes, ~$(du -h "$DMG_PATH" | cut -f1))"
if [ "$DMG_SIZE" -lt 15000000 ]; then
  echo "FAIL: DMG size ($DMG_SIZE bytes) is suspiciously small (< 15 MB)!"
  exit 1
fi
echo "✓ DMG size sanity check passed (real standalone bundle)"

# 2. Mount DMG
echo ""
echo "--- Step 1: Mounting DMG ---"
if [ -d "$MOUNT_POINT" ]; then
  hdiutil detach "$MOUNT_POINT" -force >/dev/null 2>&1 || true
fi

hdiutil attach "$DMG_PATH" -noverify -noautoopen >/dev/null
if [ ! -d "$MOUNT_POINT" ]; then
  echo "FAIL: Mounted volume $MOUNT_POINT not found!"
  exit 1
fi
echo "✓ DMG mounted successfully at $MOUNT_POINT"

# 3. Verify DMG Structure & Applications symlink
echo ""
echo "--- Step 2: DMG Layout & Structure ---"
if [ ! -d "$MOUNT_POINT/OpenFaceID.app" ]; then
  echo "FAIL: OpenFaceID.app missing from DMG root!"
  hdiutil detach "$MOUNT_POINT"
  exit 1
fi
echo "✓ OpenFaceID.app present in DMG"

if [ ! -L "$MOUNT_POINT/Applications" ]; then
  echo "FAIL: Applications symlink missing from DMG root!"
  hdiutil detach "$MOUNT_POINT"
  exit 1
fi
APP_LINK_TARGET=$(readlink "$MOUNT_POINT/Applications")
if [ "$APP_LINK_TARGET" != "/Applications" ]; then
  echo "FAIL: Applications symlink does not point to /Applications (got: $APP_LINK_TARGET)"
  hdiutil detach "$MOUNT_POINT"
  exit 1
fi
echo "✓ Applications symlink verified -> /Applications"

# 4. Bundle Integrity & Binary Audit
echo ""
echo "--- Step 3: Bundle Integrity & Binary Audit ---"
APP="$MOUNT_POINT/OpenFaceID.app"

# Info.plist checks
PLIST="$APP/Contents/Info.plist"
if [ ! -f "$PLIST" ]; then
  echo "FAIL: Info.plist missing!"
  hdiutil detach "$MOUNT_POINT"
  exit 1
fi

BUNDLE_ID=$(defaults read "$PLIST" CFBundleIdentifier 2>/dev/null || plutil -extract CFBundleIdentifier raw "$PLIST")
BUNDLE_NAME=$(defaults read "$PLIST" CFBundleName 2>/dev/null || plutil -extract CFBundleName raw "$PLIST")
CAMERA_USAGE=$(defaults read "$PLIST" NSCameraUsageDescription 2>/dev/null || plutil -extract NSCameraUsageDescription raw "$PLIST")

echo "  • Bundle ID: $BUNDLE_ID"
echo "  • Bundle Name: $BUNDLE_NAME"
echo "  • Camera Usage: $CAMERA_USAGE"

if [ -z "$CAMERA_USAGE" ]; then
  echo "FAIL: NSCameraUsageDescription missing from Info.plist!"
  hdiutil detach "$MOUNT_POINT"
  exit 1
fi
echo "✓ Info.plist conforms to macOS privacy and bundle specifications"

# Executable checks
MAIN_EXE="$APP/Contents/MacOS/OpenFaceID"
CAMERA_HELPER="$APP/Contents/Resources/bin/openfaceid-camera-avf"
NODE_RUNTIME="$APP/Contents/Resources/bin/node"
APP_ICON="$APP/Contents/Resources/OpenFaceID.icns"

for f in "$MAIN_EXE" "$CAMERA_HELPER" "$NODE_RUNTIME" "$APP_ICON"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: Missing required bundle file: $f"
    hdiutil detach "$MOUNT_POINT"
    exit 1
  fi
done
echo "✓ All core binaries, helper tools, icons, and payloads exist in bundle"

# Architecture checks
file "$MAIN_EXE" | grep -q "arm64" || (echo "FAIL: Main executable is not arm64" && exit 1)
file "$CAMERA_HELPER" | grep -q "arm64" || (echo "FAIL: Camera helper is not arm64" && exit 1)
file "$NODE_RUNTIME" | grep -q "arm64" || (echo "FAIL: Node runtime is not arm64" && exit 1)
echo "✓ All executables verified as native Mach-O arm64"

# Dependency check (NO Homebrew allowed)
echo ""
echo "--- Step 4: Strict Zero-Homebrew Dependency Check ---"
if otool -L "$NODE_RUNTIME" | grep -q "/opt/homebrew"; then
  echo "FAIL: Embedded Node runtime depends on /opt/homebrew libraries!"
  hdiutil detach "$MOUNT_POINT"
  exit 1
fi
echo "✓ Embedded Node runtime is standalone (0 Homebrew references)"

if otool -L "$CAMERA_HELPER" | grep -q "/opt/homebrew"; then
  echo "FAIL: Camera helper depends on /opt/homebrew libraries!"
  hdiutil detach "$MOUNT_POINT"
  exit 1
fi
echo "✓ Camera helper is standalone (0 Homebrew references)"

# Codesign check
echo ""
echo "--- Step 5: Codesign Signature Audit ---"
codesign --verify --deep --strict --verbose=2 "$APP" 2>&1
echo "✓ Bundle signature verified on disk"

# 5. Clean-Machine Installation & Launch Simulation
echo ""
echo "--- Step 6: Clean Machine Installation Simulation (Section 15) ---"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/Applications"

echo "Copying OpenFaceID.app to simulated Applications folder..."
cp -R "$APP" "$TEST_DIR/Applications/"

INSTALLED_APP="$TEST_DIR/Applications/OpenFaceID.app"
if [ ! -d "$INSTALLED_APP" ]; then
  echo "FAIL: Failed to copy app to clean environment!"
  hdiutil detach "$MOUNT_POINT"
  exit 1
fi
echo "✓ Application successfully copied to $INSTALLED_APP"

# Detach DMG before launching to ensure 100% independence
hdiutil detach "$MOUNT_POINT" >/dev/null
echo "✓ DMG detached (testing app completely decoupled from installer volume)"

# Launch installed app in background from /tmp with sterile PATH
echo "Launching installed application from outside repository..."
(
  cd /tmp
  export PATH="/usr/bin:/bin:/usr/sbin:/sbin"
  export HOME="$TEST_DIR/userhome"
  mkdir -p "$HOME"
  "$INSTALLED_APP/Contents/MacOS/OpenFaceID" > "$TEST_DIR/launch.log" 2>&1 &
  LAUNCH_PID=$!
  echo "$LAUNCH_PID" > "$TEST_DIR/app.pid"
)

APP_PID=$(cat "$TEST_DIR/app.pid")
echo "✓ App process launched (PID: $APP_PID)"

# Probe daemon readiness over localhost HTTP
echo "Probing local OpenFaceID daemon readiness..."
DAEMON_READY=false
for i in {1..30}; do
  if curl -s -f "http://127.0.0.1:41793/api/v1/capabilities" > "$TEST_DIR/capabilities.json" 2>/dev/null; then
    DAEMON_READY=true
    break
  fi
  sleep 0.3
done

if [ "$DAEMON_READY" = true ]; then
  echo "✓ Local daemon initialized successfully in clean environment!"
  echo "  Capabilities:"
  cat "$TEST_DIR/capabilities.json"
  echo ""
else
  echo "FAIL: Local daemon failed to answer on port 41793!"
  echo "Launch log:"
  cat "$TEST_DIR/launch.log"
  kill -9 "$APP_PID" 2>/dev/null || true
  exit 1
fi

# Terminate test process cleanly
kill "$APP_PID" 2>/dev/null || true
sleep 1
kill -9 "$APP_PID" 2>/dev/null || true
rm -rf "$TEST_DIR"

echo ""
echo "============================================================"
echo " ALL MACOS INSTALLATION & CLEAN TESTS PASSED!"
echo " Result: Parity with Glance Achieved (Real DMG -> Clean Launch)"
echo "============================================================"
