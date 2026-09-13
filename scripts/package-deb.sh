#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.2.1-rc.1"
ARCH="amd64"
DEB_ROOT="$DIR/dist/deb_build/openfaceid_${VERSION}_${ARCH}"

echo "=== Building OpenFaceID Debian (.deb) Package ==="

rm -rf "$DIR/dist/deb_build"
mkdir -p "$DEB_ROOT/DEBIAN"
mkdir -p "$DEB_ROOT/usr/bin"
mkdir -p "$DEB_ROOT/usr/share/applications"
mkdir -p "$DEB_ROOT/usr/lib/systemd/user"
mkdir -p "$DEB_ROOT/usr/lib/openfaceid"

# 1. Control File
cat << CONTROL > "$DEB_ROOT/DEBIAN/control"
Package: openfaceid
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Depends: nodejs (>= 22.0.0)
Maintainer: Jayant Olhyan <https://github.com/JayantOlhyan/OpenFaceID>
Description: Local facial presence detection and biometric verification for Linux desktops.
 SightLock (OpenFaceID) provides privacy-preserving facial recognition
 and presence tracking using standard 2D webcams. Biometric vectors are
 encrypted with AES-256-GCM and stored exclusively on local disk.
CONTROL

# 2. Desktop Launcher
cat << 'DESKTOP' > "$DEB_ROOT/usr/share/applications/openfaceid.desktop"
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

# 3. Systemd User Service
cat << 'SERVICE' > "$DEB_ROOT/usr/lib/systemd/user/openfaceid.service"
[Unit]
Description=OpenFaceID Background Presence Service
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/openfaceid
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
SERVICE

# 4. Executable wrapper
cat << 'WRAPPER' > "$DEB_ROOT/usr/bin/openfaceid"
#!/bin/bash
export NODE_ENV="production"
export OFID_DESKTOP_STANDALONE="true"
exec node --experimental-strip-types /usr/lib/openfaceid/apps/desktop/serve.js "$@"
WRAPPER

chmod 755 "$DEB_ROOT/usr/bin/openfaceid"

# 5. Build Debian Package if dpkg-deb is available
if which dpkg-deb >/dev/null 2>&1; then
  DEB_OUTPUT="$DIR/dist/openfaceid_${VERSION}_${ARCH}.deb"
  dpkg-deb --build "$DEB_ROOT" "$DEB_OUTPUT"
  echo "✓ Created $DEB_OUTPUT"
else
  echo "ℹ Note: dpkg-deb is not available on host system; deb directory structure created at $DEB_ROOT"
fi

echo "=== Debian Packaging Complete ==="
