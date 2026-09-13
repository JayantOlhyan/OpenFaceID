#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$DIR/dist/macos"
VERSION="0.2.1-rc.1"
ARCH="arm64"
APP_DIR="$DIST_DIR/OpenFaceID.app"
DMG_PATH="$DIST_DIR/OpenFaceID-${VERSION}-${ARCH}.dmg"
ZIP_PATH="$DIST_DIR/OpenFaceID-${VERSION}-macos.zip"

echo "============================================================"
echo " Packaging OpenFaceID macOS Release Artifacts"
echo " Version: $VERSION"
echo " Architecture: $ARCH"
echo "============================================================"

# Ensure app is built first
if [ ! -d "$APP_DIR" ]; then
  echo "OpenFaceID.app not found. Running build first..."
  "$DIR/scripts/build-macos.sh"
fi

# 1. Package ZIP
echo "[1/3] Packaging ZIP archive..."
rm -f "$ZIP_PATH"
(cd "$DIST_DIR" && zip -r -q "OpenFaceID-${VERSION}-macos.zip" "OpenFaceID.app")
echo "  ✓ Created $ZIP_PATH ($(du -h "$ZIP_PATH" | cut -f1))"

# 2. Package DMG with Custom Finder Window Layout (Glance parity)
echo "[2/3] Packaging DMG disk image with Finder layout..."
TEMP_DMG="$DIST_DIR/temp_rw.dmg"
rm -f "$TEMP_DMG" "$DMG_PATH"

# Create 150MB writable staging disk
hdiutil create -size 150m -fs HFS+ -volname "OpenFaceID" "$TEMP_DMG" >/dev/null

# Mount staging disk
MOUNT_DIR="/Volumes/OpenFaceID"
if [ -d "$MOUNT_DIR" ]; then
  hdiutil detach "$MOUNT_DIR" -force >/dev/null 2>&1 || true
fi

hdiutil attach "$TEMP_DMG" -readwrite -noverify -noautoopen >/dev/null

# Copy app bundle & create Applications symlink
cp -R "$APP_DIR" "$MOUNT_DIR/"
ln -s /Applications "$MOUNT_DIR/Applications"

# Configure Finder visual presentation
APPLESCRIPT="
tell application \"Finder\"
  tell disk \"OpenFaceID\"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {400, 200, 1000, 580}
    set theViewOptions to the icon view options of container window
    set icon size of theViewOptions to 128
    set arrangement of theViewOptions to not arranged
    set position of item \"OpenFaceID.app\" of container window to {160, 190}
    set position of item \"Applications\" of container window to {440, 190}
    update without registering applications
    delay 1
    close
  end tell
end tell
"

osascript -e "$APPLESCRIPT" >/dev/null 2>&1 || echo "  ℹ Note: Finder layout script bypassed (headless environment)"

# Detach staging image
sleep 1
hdiutil detach "$MOUNT_DIR" >/dev/null 2>&1 || hdiutil detach "$MOUNT_DIR" -force >/dev/null 2>&1

# Convert to final compressed read-only UDZO image
hdiutil convert "$TEMP_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG_PATH" >/dev/null
rm -f "$TEMP_DMG"
echo "  ✓ Created $DMG_PATH ($(du -h "$DMG_PATH" | cut -f1))"

# 3. Synchronize to root dist/ and generate SHA-256 Checksums
echo "[3/3] Synchronizing release artifacts & calculating checksums..."
mkdir -p "$DIR/dist"
cp -f "$DMG_PATH" "$DIR/dist/"
cp -f "$ZIP_PATH" "$DIR/dist/"

(
  cd "$DIR/dist"
  shasum -a 256 "OpenFaceID-${VERSION}-${ARCH}.dmg" > "$DMG_PATH.sha256"
  shasum -a 256 "OpenFaceID-${VERSION}-macos.zip" > "$ZIP_PATH.sha256"
  shasum -a 256 "OpenFaceID-${VERSION}-${ARCH}.dmg" "OpenFaceID-${VERSION}-macos.zip" > "$DIR/dist/SHA256SUMS"
)
echo "  ✓ Checksums:"
cat "$DIR/dist/SHA256SUMS"

echo "============================================================"
echo " macOS Release Packaging Complete!"
echo " DMG: $DMG_PATH"
echo " ZIP: $ZIP_PATH"
echo "============================================================"
