#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "============================================================"
echo " Building and Packaging OpenFaceID Multi-Platform Releases"
echo "============================================================"

# 1. macOS packaging (if on Darwin)
if [ "$(uname -s)" = "Darwin" ]; then
  echo ""
  echo "--- [1/4] Packaging macOS Distribution (.dmg, .zip, .app) ---"
  "$DIR/scripts/package-macos.sh"
else
  echo ""
  echo "--- [1/4] Skipping macOS packaging (host is not Darwin) ---"
fi

# 2. Linux packaging (tarball, deb, rpm)
echo ""
echo "--- [2/4] Packaging Linux Distributions (.tar.gz, .deb, .rpm) ---"
"$DIR/scripts/package-linux.sh"
"$DIR/scripts/package-deb.sh"
"$DIR/scripts/package-rpm.sh"

# 3. Windows packaging staging
echo ""
echo "--- [3/4] Staging Windows Distribution & Installer Files ---"
mkdir -p "$DIR/dist/windows"
cat << 'CMD' > "$DIR/dist/windows/OpenFaceID.cmd"
@echo off
set "ROOT_DIR=%~dp0..\.."
set "NODE_ENV=production"
set "OFID_DESKTOP_STANDALONE=true"
node --experimental-strip-types "%ROOT_DIR%\apps\desktop\serve.js" %*
CMD

cat << 'REG' > "$DIR/dist/windows/register-autostart.reg"
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run]
"OpenFaceID"="\"C:\\Program Files\\OpenFaceID\\OpenFaceID.cmd\""
REG

echo "✓ Staged OpenFaceID.cmd and register-autostart.reg in dist/windows"

# 4. Generate Cryptographic Release Manifest & Update Checksums
echo ""
echo "--- [4/4] Generating Release Manifest & SHA256 Checksums ---"
node --experimental-strip-types "$DIR/scripts/generate-release-manifest.js"

# 5. Inject calculated DMG checksum into Homebrew Cask formula if available
DMG_PATH="$DIR/dist/OpenFaceID-0.2.1-rc.1-arm64.dmg"
CASK_PATH="$DIR/packaging/homebrew/openfaceid.rb"
if [ -f "$DMG_PATH" ] && [ -f "$CASK_PATH" ]; then
  DMG_SHA=$(shasum -a 256 "$DMG_PATH" | cut -d ' ' -f 1)
  sed -i '' "s/sha256 \".*\"/sha256 \"$DMG_SHA\"/" "$CASK_PATH" 2>/dev/null || \
  sed -i '' "s/sha256 :no_check/sha256 \"$DMG_SHA\"/" "$CASK_PATH" 2>/dev/null || true
  echo "✓ Updated Homebrew Cask formula with DMG SHA-256: $DMG_SHA"
fi

echo ""
echo "============================================================"
echo " OpenFaceID Phase 5 Packaging Complete!"
echo " Release artifacts available in: $DIR/dist"
echo "============================================================"
