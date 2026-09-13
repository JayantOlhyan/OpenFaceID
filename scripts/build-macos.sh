#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$DIR/dist/macos"
APP_DIR="$DIST_DIR/OpenFaceID.app"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RESOURCES_DIR="$APP_DIR/Contents/Resources"
BIN_DIR="$RESOURCES_DIR/bin"
APP_PAYLOAD_DIR="$RESOURCES_DIR/app"

echo "============================================================"
echo " Building OpenFaceID Standalone macOS Desktop Application"
echo " Target: macOS 14/15+ (Apple Silicon arm64)"
echo "============================================================"

# 1. Clean and prepare dist directory
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR"
mkdir -p "$BIN_DIR"
mkdir -p "$APP_PAYLOAD_DIR"

# 2. Build Native AVFoundation Camera Helper
echo "[1/6] Building native AVFoundation camera engine..."
mkdir -p "$DIR/packages/camera/bin"
clang -O3 -fobjc-arc \
  -framework AVFoundation \
  -framework CoreMedia \
  -framework CoreVideo \
  -framework Foundation \
  "$DIR/packages/camera/native/openfaceid-camera-avf.m" \
  -o "$DIR/packages/camera/bin/openfaceid-camera-avf"
chmod +x "$DIR/packages/camera/bin/openfaceid-camera-avf"
cp "$DIR/packages/camera/bin/openfaceid-camera-avf" "$BIN_DIR/openfaceid-camera-avf"
echo "  ✓ Bundled openfaceid-camera-avf binary"

# 3. Generate App Icons if missing
if [ ! -f "$DIR/apps/desktop/packaging/macos/OpenFaceID.icns" ]; then
  echo "[2/6] Generating OpenFaceID.icns..."
  python3 "$DIR/scripts/generate-app-icon.py"
fi
cp "$DIR/apps/desktop/packaging/macos/OpenFaceID.icns" "$RESOURCES_DIR/OpenFaceID.icns"
echo "  ✓ Bundled OpenFaceID.icns"

# 4. Compile Native Cocoa + WebKit Launcher Executable
echo "[3/6] Compiling native Swift Cocoa launcher..."
swiftc -O -framework Cocoa -framework WebKit \
  "$DIR/apps/desktop/launcher/OpenFaceIDLauncher.swift" \
  -o "$MACOS_DIR/OpenFaceID"
chmod +x "$MACOS_DIR/OpenFaceID"
echo "  ✓ Created Mach-O launcher at Contents/MacOS/OpenFaceID"

# 5. Bundle Runtime (Node.js)
echo "[4/6] Bundling embedded standalone Node runtime..."
CACHE_NODE="$DIR/.cache/node-darwin-arm64/bin/node"
if [ ! -f "$CACHE_NODE" ]; then
  echo "  Downloading official standalone Node.js (Darwin arm64)..."
  mkdir -p "$DIR/.cache/node-darwin-arm64"
  curl -sSL "https://nodejs.org/dist/v22.14.0/node-v22.14.0-darwin-arm64.tar.gz" | tar -xz -C "$DIR/.cache/node-darwin-arm64" --strip-components=1
fi

if [ ! -f "$CACHE_NODE" ]; then
  echo "Error: Failed to obtain standalone Node runtime!"
  exit 1
fi

cp "$CACHE_NODE" "$BIN_DIR/node"
chmod +x "$BIN_DIR/node"
echo "  ✓ Embedded standalone Node binary (zero Homebrew dependencies)"

# Verify no Homebrew references in embedded node
if otool -L "$BIN_DIR/node" | grep -q "/opt/homebrew"; then
  echo "Error: Embedded Node binary still references /opt/homebrew!"
  exit 1
fi

# 6. Copy App Payload & Info.plist
echo "[5/6] Bundling application source and assets..."
cp "$DIR/apps/desktop/packaging/macos/Info.plist" "$APP_DIR/Contents/Info.plist"
echo "APPL????" > "$APP_DIR/Contents/PkgInfo"

# Copy package sources
mkdir -p "$APP_PAYLOAD_DIR/apps"
mkdir -p "$APP_PAYLOAD_DIR/packages"
cp -R "$DIR/apps/desktop" "$APP_PAYLOAD_DIR/apps/"
cp -R "$DIR/packages" "$APP_PAYLOAD_DIR/"
cp "$DIR/package.json" "$APP_PAYLOAD_DIR/"
if [ -f "$DIR/tsconfig.json" ]; then
  cp "$DIR/tsconfig.json" "$APP_PAYLOAD_DIR/"
fi

# Verify canonical frontend existence immediately
if [ ! -f "$APP_PAYLOAD_DIR/apps/desktop/index.html" ]; then
  echo "Error: Canonical index.html not found in $APP_PAYLOAD_DIR/apps/desktop/index.html!"
  exit 1
fi
echo "  ✓ Bundled application payload (apps/desktop, packages, configurations)"

# 7. Ad-Hoc Code Signing (Nested binaries first, then outer bundle)
echo "[6/6] Applying ad-hoc codesign to bundle..."
codesign --force --sign - "$BIN_DIR/openfaceid-camera-avf"
codesign --force --sign - "$BIN_DIR/node"
codesign --force --sign - "$MACOS_DIR/OpenFaceID"
codesign --force --deep --sign - "$APP_DIR"
echo "  ✓ Verifying bundle signature:"
codesign --verify --deep --strict --verbose=2 "$APP_DIR"

# 8. Run Full Bundle Validation Suite
echo ""
"$DIR/scripts/validation/validate-macos-bundle.sh" "$APP_DIR"

echo "============================================================"
echo " Build Succeeded & Validated!"
echo " Application: $APP_DIR"
echo "============================================================"
