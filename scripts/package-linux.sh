#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINUX_DIR="$DIR/dist/linux"

echo "=== Building OpenFaceID Linux Desktop Package ==="

rm -rf "$LINUX_DIR"
mkdir -p "$LINUX_DIR/bin"
mkdir -p "$LINUX_DIR/share/applications"
mkdir -p "$LINUX_DIR/share/icons/hicolor/scalable/apps"

# 1. Desktop Entry Specification
cat << 'DESKTOP' > "$LINUX_DIR/share/applications/openfaceid.desktop"
[Desktop Entry]
Type=Application
Name=OpenFaceID
GenericName=Face Recognition & Presence Utility
Comment=Local facial presence detection and biometric verification for desktop systems
Exec=openfaceid %u
Icon=openfaceid
Terminal=false
Categories=Utility;Security;System;
StartupNotify=true
X-GNOME-Autostart-enabled=true
DESKTOP

# 2. Linux Launcher Script
cat << 'LAUNCHER' > "$LINUX_DIR/bin/openfaceid"
#!/bin/bash
CURRENT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
NODE_BIN="$(which node || echo "/usr/bin/node")"

export NODE_ENV="production"
export OFID_DESKTOP_STANDALONE="true"

exec "$NODE_BIN" --experimental-strip-types "$CURRENT_DIR/apps/desktop/serve.js" "$@"
LAUNCHER

chmod +x "$LINUX_DIR/bin/openfaceid"

# 3. Compile Linux PAM module if GCC is available
if which gcc >/dev/null 2>&1 && [ -f "$DIR/packages/platform/native/linux/pam_openfaceid.c" ]; then
  echo "Compiling pam_openfaceid.so..."
  mkdir -p "$LINUX_DIR/lib/security"
  gcc -O3 -fPIC -shared -lpam "$DIR/packages/platform/native/linux/pam_openfaceid.c" -o "$LINUX_DIR/lib/security/pam_openfaceid.so" 2>/dev/null || echo "Note: Local PAM compilation skipped (requires libpam0g-dev on Linux)"
fi

# 4. Copy models and installer
mkdir -p "$LINUX_DIR/models"
if [ -d "$DIR/models" ]; then
  cp -r "$DIR/models/"* "$LINUX_DIR/models/" 2>/dev/null || true
fi
cp "$DIR/scripts/install-linux-pam.sh" "$LINUX_DIR/bin/" 2>/dev/null || true

# 5. Create tarball
VERSION="0.2.1-rc.1"
TAR_PATH="$DIR/dist/openfaceid-${VERSION}-linux-x86_64.tar.gz"
(cd "$DIR/dist" && tar -czf "$TAR_PATH" "linux")
echo "✓ Created $TAR_PATH"

echo "=== Linux Packaging Complete ==="
