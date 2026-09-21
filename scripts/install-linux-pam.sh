#!/bin/bash
# ==============================================================================
# OpenFaceID Linux PAM Module Installer
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAM_SRC_DIR="$DIR/packages/platform/native/linux"

echo "============================================================"
echo " OpenFaceID Linux PAM Module Installation"
echo "============================================================"

if [ "$EUID" -ne 0 ]; then
  echo "Error: This installer must be executed as root (sudo)."
  exit 1
fi

if [ "$1" == "--uninstall" ]; then
  echo "Uninstalling OpenFaceID Linux PAM module..."
  rm -f /lib/x86_64-linux-gnu/security/pam_openfaceid.so \
        /lib/aarch64-linux-gnu/security/pam_openfaceid.so \
        /lib64/security/pam_openfaceid.so \
        /lib/security/pam_openfaceid.so
  rm -rf /run/openfaceid
  echo "✓ pam_openfaceid.so removed from system."
  echo "Remember to remove 'auth sufficient pam_openfaceid.so' lines from /etc/pam.d/ configurations."
  exit 0
fi

# Check build prerequisites
if ! command -v gcc >/dev/null 2>&1; then
  echo "Error: gcc is required. Install build essentials:"
  echo "  Ubuntu/Debian: sudo apt-get install build-essential libpam0g-dev"
  echo "  Fedora/RHEL:   sudo dnf install gcc pam-devel"
  exit 1
fi

echo "[1/3] Compiling pam_openfaceid.so..."
make -C "$PAM_SRC_DIR" clean
make -C "$PAM_SRC_DIR"

echo "[2/3] Installing shared object to system PAM security library directory..."
make -C "$PAM_SRC_DIR" install

echo "[3/3] Creating runtime socket directory..."
mkdir -p /run/openfaceid
chmod 0755 /run/openfaceid

echo ""
echo "============================================================"
echo " Installation Complete!"
echo "============================================================"
echo "To enable face unlock for login and sudo, add the following"
echo "as the FIRST auth line in your target PAM configuration:"
echo ""
echo "  auth  sufficient  pam_openfaceid.so"
echo ""
echo "Target files:"
echo "  - /etc/pam.d/sudo              (Face unlock for terminal sudo)"
echo "  - /etc/pam.d/gdm-password      (GNOME Display Manager)"
echo "  - /etc/pam.d/sddm              (KDE SDDM)"
echo "  - /etc/pam.d/lightdm           (LightDM)"
echo "  - /etc/pam.d/common-auth       (Global system auth)"
echo "============================================================"
