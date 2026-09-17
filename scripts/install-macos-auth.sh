#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAM_LIB_DIR="/usr/local/lib/pam"
PAM_TARGET="$PAM_LIB_DIR/pam_openfaceid.so"
SOCKET_DIR="/var/run/openfaceid"

if [ "$1" == "--uninstall" ]; then
  echo "Uninstalling OpenFaceID macOS PAM authentication..."
  if [ -f "/etc/pam.d/sudo_local.bak" ]; then
    sudo mv "/etc/pam.d/sudo_local.bak" "/etc/pam.d/sudo_local" 2>/dev/null || true
  elif [ -f "/etc/pam.d/sudo_local" ]; then
    sudo sed -i '' '/pam_openfaceid/d' "/etc/pam.d/sudo_local" || true
  fi

  if [ -f "/etc/pam.d/screensaver.bak" ]; then
    sudo cp "/etc/pam.d/screensaver.bak" "/etc/pam.d/screensaver" 2>/dev/null || true
  elif [ -f "/etc/pam.d/screensaver" ]; then
    sudo sed -i '' '/pam_openfaceid/d' "/etc/pam.d/screensaver" || true
  fi

  sudo rm -f "$PAM_TARGET"
  echo "✓ OpenFaceID macOS PAM module uninstalled."
  exit 0
fi

echo "============================================================"
echo " Installing OpenFaceID Native macOS PAM Module"
echo " Target: $PAM_TARGET"
echo "============================================================"

# 1. Compile PAM module
echo "[1/4] Compiling native pam_openfaceid_mac.so..."
make -C "$DIR/packages/platform/native/macos"

# 2. Install library
echo "[2/4] Installing library to $PAM_LIB_DIR..."
sudo mkdir -p "$PAM_LIB_DIR"
sudo cp "$DIR/packages/platform/native/macos/pam_openfaceid_mac.so" "$PAM_TARGET"
sudo chmod 755 "$PAM_TARGET"
sudo chown root:wheel "$PAM_TARGET"
echo "  ✓ Installed $PAM_TARGET"

# 3. Create runtime socket directory
echo "[3/4] Configuring runtime socket directory ($SOCKET_DIR)..."
sudo mkdir -p "$SOCKET_DIR"
sudo chmod 777 "$SOCKET_DIR"
echo "  ✓ Configured socket directory"

# 4. Configure PAM stack
echo "[4/4] Configuring macOS PAM rules..."

# Sudo configuration via sudo_local (Apple standard for macOS 14+)
if [ ! -f "/etc/pam.d/sudo_local" ]; then
  echo "auth sufficient $PAM_TARGET" | sudo tee "/etc/pam.d/sudo_local" > /dev/null
else
  if ! grep -q "pam_openfaceid.so" "/etc/pam.d/sudo_local"; then
    sudo cp "/etc/pam.d/sudo_local" "/etc/pam.d/sudo_local.bak"
    echo -e "auth sufficient $PAM_TARGET\n$(cat /etc/pam.d/sudo_local)" | sudo tee "/etc/pam.d/sudo_local" > /dev/null
  fi
fi
echo "  ✓ Configured /etc/pam.d/sudo_local"

# Screensaver unlock configuration
if ! grep -q "pam_openfaceid.so" "/etc/pam.d/screensaver"; then
  sudo cp "/etc/pam.d/screensaver" "/etc/pam.d/screensaver.bak"
  echo -e "auth       sufficient     $PAM_TARGET\n$(cat /etc/pam.d/screensaver)" | sudo tee "/etc/pam.d/screensaver" > /dev/null
  echo "  ✓ Configured /etc/pam.d/screensaver"
fi

echo "============================================================"
echo " macOS Native Authentication Installed Successfully!"
echo " Face unlock is now active for screen unlock and sudo."
echo " To uninstall at any time: sudo ./scripts/install-macos-auth.sh --uninstall"
echo "============================================================"
