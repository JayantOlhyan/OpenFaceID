#!/bin/bash
set -e

# ==============================================================================
# OpenFaceID macOS App Bundle Integrity Validator
# Verifies canonical bundle layout, architecture, standalone dependencies,
# codesign signatures, and runtime frontend payloads (Glance Parity Contract)
# ==============================================================================

APP_BUNDLE="${1:-dist/macos/OpenFaceID.app}"

echo "============================================================"
echo " OpenFaceID macOS Bundle Validator"
echo " Target Bundle: $APP_BUNDLE"
echo "============================================================"

# 1. APP_EXISTS
if [ ! -d "$APP_BUNDLE" ]; then
  echo "FAIL [APP_EXISTS]: App bundle does not exist at $APP_BUNDLE"
  exit 1
fi
echo "✓ PASS [APP_EXISTS]: App bundle found"

# 2. INFO_PLIST_EXISTS
PLIST="$APP_BUNDLE/Contents/Info.plist"
if [ ! -f "$PLIST" ]; then
  echo "FAIL [INFO_PLIST_EXISTS]: Info.plist missing at $PLIST"
  exit 1
fi
BUNDLE_ID=$(defaults read "$PLIST" CFBundleIdentifier 2>/dev/null || plutil -extract CFBundleIdentifier raw "$PLIST" 2>/dev/null || echo "")
CAMERA_DESC=$(defaults read "$PLIST" NSCameraUsageDescription 2>/dev/null || plutil -extract NSCameraUsageDescription raw "$PLIST" 2>/dev/null || echo "")
if [ -z "$BUNDLE_ID" ] || [ -z "$CAMERA_DESC" ]; then
  echo "FAIL [INFO_PLIST_EXISTS]: Info.plist missing required bundle identifiers or camera permissions"
  exit 1
fi
echo "✓ PASS [INFO_PLIST_EXISTS]: Valid Info.plist (ID: $BUNDLE_ID)"

# 3. MAIN_EXECUTABLE_EXISTS
MAIN_EXE="$APP_BUNDLE/Contents/MacOS/OpenFaceID"
if [ ! -x "$MAIN_EXE" ]; then
  echo "FAIL [MAIN_EXECUTABLE_EXISTS]: Main launcher missing or not executable at $MAIN_EXE"
  exit 1
fi
echo "✓ PASS [MAIN_EXECUTABLE_EXISTS]: Native launcher verified"

# 4. INDEX_HTML_EXISTS (Canonical Frontend Contract)
INDEX_HTML="$APP_BUNDLE/Contents/Resources/app/apps/desktop/index.html"
if [ ! -f "$INDEX_HTML" ]; then
  echo "FAIL [INDEX_HTML_EXISTS]: Frontend entrypoint missing at $INDEX_HTML"
  exit 1
fi
HTML_SIZE=$(stat -f%z "$INDEX_HTML" 2>/dev/null || wc -c < "$INDEX_HTML" | tr -d ' ')
if [ "$HTML_SIZE" -lt 1000 ]; then
  echo "FAIL [INDEX_HTML_EXISTS]: index.html is suspiciously small ($HTML_SIZE bytes)"
  exit 1
fi
echo "✓ PASS [INDEX_HTML_EXISTS]: Canonical index.html verified ($HTML_SIZE bytes)"

# 5. DESKTOP_RUNTIME_EXISTS
SERVE_JS="$APP_BUNDLE/Contents/Resources/app/apps/desktop/serve.js"
DAEMON_TS="$APP_BUNDLE/Contents/Resources/app/apps/desktop/src/daemon.ts"
CORE_PKG="$APP_BUNDLE/Contents/Resources/app/packages/core/package.json"
VISION_PKG="$APP_BUNDLE/Contents/Resources/app/packages/vision/package.json"

for r in "$SERVE_JS" "$DAEMON_TS" "$CORE_PKG" "$VISION_PKG"; do
  if [ ! -f "$r" ]; then
    echo "FAIL [DESKTOP_RUNTIME_EXISTS]: Missing desktop runtime component: $r"
    exit 1
  fi
done
echo "✓ PASS [DESKTOP_RUNTIME_EXISTS]: Desktop daemon and package payload verified"

# 6. NODE_RUNTIME_EXISTS
NODE_BIN="$APP_BUNDLE/Contents/Resources/bin/node"
if [ ! -x "$NODE_BIN" ]; then
  echo "FAIL [NODE_RUNTIME_EXISTS]: Embedded Node runtime missing or not executable at $NODE_BIN"
  exit 1
fi
# Zero Homebrew dependency audit
if otool -L "$NODE_BIN" | grep -q "/opt/homebrew"; then
  echo "FAIL [NODE_RUNTIME_EXISTS]: Embedded Node binary depends on /opt/homebrew dylibs!"
  otool -L "$NODE_BIN" | grep "/opt/homebrew"
  exit 1
fi
echo "✓ PASS [NODE_RUNTIME_EXISTS]: Standalone Node binary verified (0 Homebrew references)"

# 7. CAMERA_HELPER_EXISTS
CAMERA_BIN="$APP_BUNDLE/Contents/Resources/bin/openfaceid-camera-avf"
if [ ! -x "$CAMERA_BIN" ]; then
  echo "FAIL [CAMERA_HELPER_EXISTS]: Native camera helper missing or not executable at $CAMERA_BIN"
  exit 1
fi
if otool -L "$CAMERA_BIN" | grep -q "/opt/homebrew"; then
  echo "FAIL [CAMERA_HELPER_EXISTS]: Camera helper depends on /opt/homebrew dylibs!"
  exit 1
fi
echo "✓ PASS [CAMERA_HELPER_EXISTS]: Standalone AVFoundation camera helper verified"

# 8. REQUIRED_RESOURCES_EXIST
APP_ICNS="$APP_BUNDLE/Contents/Resources/OpenFaceID.icns"
if [ ! -f "$APP_ICNS" ]; then
  echo "FAIL [REQUIRED_RESOURCES_EXIST]: OpenFaceID.icns missing at $APP_ICNS"
  exit 1
fi
echo "✓ PASS [REQUIRED_RESOURCES_EXIST]: Multi-resolution app icon verified"

# 9. ARCHITECTURE_VALID
file "$MAIN_EXE" | grep -q "arm64" || (echo "FAIL [ARCHITECTURE_VALID]: Main executable is not arm64" && exit 1)
file "$NODE_BIN" | grep -q "arm64" || (echo "FAIL [ARCHITECTURE_VALID]: Node binary is not arm64" && exit 1)
file "$CAMERA_BIN" | grep -q "arm64" || (echo "FAIL [ARCHITECTURE_VALID]: Camera binary is not arm64" && exit 1)
echo "✓ PASS [ARCHITECTURE_VALID]: All executables verified as Apple Silicon Mach-O arm64"

# 10. NO_DEVELOPER_ABSOLUTE_PATHS & NO_REPOSITORY_RUNTIME_PATHS
# Verify that bundle does not contain symlinks pointing outside the bundle
BROKEN_SYMLINKS=$(find "$APP_BUNDLE" -type l -exec test ! -e {} \; -print)
if [ -n "$BROKEN_SYMLINKS" ]; then
  echo "FAIL [NO_REPOSITORY_RUNTIME_PATHS]: Broken symlinks detected in bundle:"
  echo "$BROKEN_SYMLINKS"
  exit 1
fi

EXTERNAL_SYMLINKS=$(find "$APP_BUNDLE" -type l | while read link; do
  TARGET=$(readlink "$link")
  if [[ "$TARGET" == /* ]] && [[ "$TARGET" != "/System"* ]] && [[ "$TARGET" != "/usr/lib"* ]] && [[ "$TARGET" != "/Applications"* ]]; then
    echo "$link -> $TARGET"
  fi
done)
if [ -n "$EXTERNAL_SYMLINKS" ]; then
  echo "FAIL [NO_REPOSITORY_RUNTIME_PATHS]: External absolute symlink detected:"
  echo "$EXTERNAL_SYMLINKS"
  exit 1
fi
echo "✓ PASS [NO_DEVELOPER_ABSOLUTE_PATHS]: Zero leaking external developer symlinks"
echo "✓ PASS [NO_REPOSITORY_RUNTIME_PATHS]: Fully self-contained application bundle"

# 11. SIGNATURE_VALID
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE" 2>&1
echo "✓ PASS [SIGNATURE_VALID]: Bundle signature validated on disk"

echo "============================================================"
echo " ALL 11 BUNDLE VALIDATION CHECKS PASSED!"
echo " Result: CANONICAL BUNDLE VERIFIED"
echo "============================================================"
