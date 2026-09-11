#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$DIR/dist/OpenFaceID.app"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RESOURCES_DIR="$APP_DIR/Contents/Resources"

echo "=== Building OpenFaceID macOS Desktop Application Bundle ==="

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# 1. Copy Info.plist
cp "$DIR/apps/desktop/packaging/macos/Info.plist" "$APP_DIR/Contents/Info.plist"

# 2. Generate macOS Launcher Script
cat << 'LAUNCHER' > "$MACOS_DIR/OpenFaceID"
#!/bin/bash
CURRENT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
NODE_BIN="$(which node || echo "/opt/homebrew/bin/node")"

export NODE_ENV="production"
export OFID_DESKTOP_STANDALONE="true"

# Launch desktop daemon & UI
exec "$NODE_BIN" --experimental-strip-types "$CURRENT_DIR/apps/desktop/serve.js" "$@"
LAUNCHER

chmod +x "$MACOS_DIR/OpenFaceID"

# 3. Create simple AppIcon placeholder
echo "APPL????" > "$APP_DIR/Contents/PkgInfo"

echo "✓ Created $APP_DIR"

# 4. Package macOS zip archive
VERSION="0.2.0-rc.1"
ZIP_PATH="$DIR/dist/OpenFaceID-${VERSION}-macos.zip"
rm -f "$ZIP_PATH"
(cd "$DIR/dist" && zip -r -q "OpenFaceID-${VERSION}-macos.zip" "OpenFaceID.app")
echo "✓ Created $ZIP_PATH"

# 5. Create DMG if permitted
if which hdiutil >/dev/null 2>&1; then
  DMG_PATH="$DIR/dist/OpenFaceID-${VERSION}-arm64.dmg"
  rm -f "$DMG_PATH"
  echo "Attempting macOS Disk Image creation ($DMG_PATH)..."
  if hdiutil create -volname "OpenFaceID" -srcfolder "$APP_DIR" -ov -format UDZO "$DMG_PATH" 2>/dev/null; then
    echo "✓ Created $DMG_PATH"
  else
    echo "ℹ Note: hdiutil disk image creation restricted in sandbox environment; zip bundle available."
  fi
fi

echo "=== macOS Packaging Complete ==="
