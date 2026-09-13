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

# 2. Package DMG with Applications link
echo "[2/3] Packaging DMG disk image..."
DMG_STAGING="$DIST_DIR/dmg-staging"
rm -rf "$DMG_STAGING" "$DMG_PATH"
mkdir -p "$DMG_STAGING"

cp -R "$APP_DIR" "$DMG_STAGING/"
ln -s /Applications "$DMG_STAGING/Applications"

hdiutil create -volname "OpenFaceID" \
  -srcfolder "$DMG_STAGING" \
  -ov -format UDZO \
  "$DMG_PATH"

rm -rf "$DMG_STAGING"
echo "  ✓ Created $DMG_PATH ($(du -h "$DMG_PATH" | cut -f1))"

# 3. Generate SHA-256 Checksums
echo "[3/3] Generating SHA-256 checksums..."
mkdir -p "$DIR/dist"
(
  cd "$DIST_DIR"
  shasum -a 256 "OpenFaceID-${VERSION}-${ARCH}.dmg" > "$DMG_PATH.sha256"
  shasum -a 256 "OpenFaceID-${VERSION}-macos.zip" > "$ZIP_PATH.sha256"
  cat "$DMG_PATH.sha256" "$ZIP_PATH.sha256" > "$DIR/dist/SHA256SUMS"
)
echo "  ✓ Checksums:"
cat "$DIR/dist/SHA256SUMS"

echo "============================================================"
echo " macOS Release Packaging Complete!"
echo " DMG: $DMG_PATH"
echo " ZIP: $ZIP_PATH"
echo "============================================================"
