#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.2.1"
RELEASE="1"
ARCH="x86_64"
RPM_ROOT="$DIR/dist/rpm_build"

echo "=== Building OpenFaceID RedHat/Fedora (.rpm) Package ==="

rm -rf "$RPM_ROOT"
mkdir -p "$RPM_ROOT/SPECS"
mkdir -p "$RPM_ROOT/SOURCES"
mkdir -p "$RPM_ROOT/BUILD"
mkdir -p "$RPM_ROOT/RPMS"
mkdir -p "$RPM_ROOT/SRPMS"

# 1. Generate RPM Spec File
cat << SPEC > "$RPM_ROOT/SPECS/openfaceid.spec"
Name:           openfaceid
Version:        ${VERSION}
Release:        ${RELEASE}%{?dist}
Summary:        Local facial presence detection and biometric verification for Linux desktops
License:        Apache-2.0
URL:            https://github.com/JayantOlhyan/OpenFaceID
BuildArch:      ${ARCH}
Requires:       nodejs >= 22.0.0

%description
SightLock (OpenFaceID) provides privacy-preserving facial recognition
and presence tracking using standard 2D webcams. Biometric vectors are
encrypted with AES-256-GCM and stored exclusively on local disk with zero
cloud egress.

%prep
# No prep required for pre-built layout

%build
# Pre-built payload

%install
rm -rf \$RPM_BUILD_ROOT
mkdir -p \$RPM_BUILD_ROOT/usr/bin
mkdir -p \$RPM_BUILD_ROOT/usr/share/applications
mkdir -p \$RPM_BUILD_ROOT/usr/lib/systemd/user
mkdir -p \$RPM_BUILD_ROOT/usr/lib/openfaceid

# Launcher
cat << 'WRAPPER' > \$RPM_BUILD_ROOT/usr/bin/openfaceid
#!/bin/bash
export NODE_ENV="production"
export OFID_DESKTOP_STANDALONE="true"
exec node --experimental-strip-types /usr/lib/openfaceid/apps/desktop/serve.js "\$@"
WRAPPER
chmod 755 \$RPM_BUILD_ROOT/usr/bin/openfaceid

# Desktop entry
cat << 'DESKTOP' > \$RPM_BUILD_ROOT/usr/share/applications/openfaceid.desktop
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

# Systemd user service
cat << 'SERVICE' > \$RPM_BUILD_ROOT/usr/lib/systemd/user/openfaceid.service
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

%files
/usr/bin/openfaceid
/usr/share/applications/openfaceid.desktop
/usr/lib/systemd/user/openfaceid.service

%changelog
* Mon Sep 14 2026 Jayant Olhyan <https://github.com/JayantOlhyan/OpenFaceID> - 0.2.1-1
- Initial cross-platform packaging with event-driven face unlock lifecycle.
SPEC

echo "✓ Created RPM spec file at $RPM_ROOT/SPECS/openfaceid.spec"

# 2. Build RPM package if rpmbuild is available
if which rpmbuild >/dev/null 2>&1; then
  rpmbuild --define "_topdir $RPM_ROOT" -bb "$RPM_ROOT/SPECS/openfaceid.spec"
  RPM_FILE=$(find "$RPM_ROOT/RPMS" -name "*.rpm" | head -n 1)
  if [ -n "$RPM_FILE" ]; then
    cp "$RPM_FILE" "$DIR/dist/"
    echo "✓ Created $(basename "$RPM_FILE") in dist/"
  fi
else
  echo "ℹ Note: rpmbuild is not available on host system; RPM tree and spec ready at $RPM_ROOT"
fi

echo "=== RPM Packaging Complete ==="
