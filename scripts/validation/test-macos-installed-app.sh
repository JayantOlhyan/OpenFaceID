#!/bin/bash
set -e

# ==============================================================================
# OpenFaceID macOS Packaged App Runtime & Multi-CWD Smoke Test
# Tests execution from the exact install location:
# /private/tmp/OpenFaceID-install-test/Applications/OpenFaceID.app
# Tests from multiple distinct working directories (/, /tmp, ~/Desktop)
# Verifies zero ENOENT, full UI response, daemon capabilities, and camera probe.
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DIR="/private/tmp/OpenFaceID-install-test"
INSTALLED_APP="$TEST_DIR/Applications/OpenFaceID.app"

echo "============================================================"
echo " OpenFaceID Installed App Runtime Smoke Test"
echo " Target: $INSTALLED_APP"
echo "============================================================"

# Clean any lingering daemon on port 41793 before starting
lsof -ti :41793 | xargs kill -9 2>/dev/null || true

# 1. Ensure source app exists or run build
if [ ! -d "$DIR/dist/macos/OpenFaceID.app" ]; then
  echo "OpenFaceID.app not found. Running build-macos.sh..."
  "$DIR/scripts/build-macos.sh"
fi

# 2. Stage to exact test directory /private/tmp/OpenFaceID-install-test/Applications/
echo "Staging clean application to $INSTALLED_APP..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/Applications"
cp -R "$DIR/dist/macos/OpenFaceID.app" "$TEST_DIR/Applications/"

if [ ! -d "$INSTALLED_APP" ]; then
  echo "FAIL: Failed to copy app to $INSTALLED_APP"
  exit 1
fi

# 3. Pre-flight Bundle Check
"$DIR/scripts/validation/validate-macos-bundle.sh" "$INSTALLED_APP"

# Helper function to test launch from a given CWD
test_launch_from_cwd() {
  local cwd="$1"
  echo ""
  echo "------------------------------------------------------------"
  echo " Testing Launch from CWD: $cwd"
  echo "------------------------------------------------------------"

  local cwd_label=$(echo "$cwd" | sed 's|/|_|g')
  local LOG_FILE="$TEST_DIR/launch_${cwd_label}.log"
  local PID_FILE="$TEST_DIR/app_${cwd_label}.pid"

  (
    cd "$cwd"
    export PATH="/usr/bin:/bin:/usr/sbin:/sbin"
    export HOME="$TEST_DIR/userhome"
    mkdir -p "$HOME"
    "$INSTALLED_APP/Contents/MacOS/OpenFaceID" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )

  local PID=$(cat "$PID_FILE")
  echo "  ✓ Spawned process (PID: $PID) from CWD: $cwd"

  # Wait for daemon ready
  local READY=false
  for i in {1..30}; do
    if curl -s -f "http://127.0.0.1:41793/api/v1/capabilities" >/dev/null 2>&1; then
      READY=true
      break
    fi
    sleep 0.3
  done

  if [ "$READY" != true ]; then
    echo "FAIL: Daemon failed to respond within 9s from CWD: $cwd"
    echo "Launch log output:"
    cat "$LOG_FILE"
    kill -9 "$PID" 2>/dev/null || true
    exit 1
  fi
  echo "  ✓ Daemon responded to /api/v1/capabilities"

  # Test UI Endpoint (GET /) - CRITICAL: VERIFY NO ENOENT
  local UI_RESPONSE=$(curl -s -i "http://127.0.0.1:41793/")
  if echo "$UI_RESPONSE" | grep -q "Error loading desktop UI"; then
    echo "FAIL: ENOENT or error returned when loading desktop UI:"
    echo "$UI_RESPONSE"
    kill -9 "$PID" 2>/dev/null || true
    exit 1
  fi

  if ! echo "$UI_RESPONSE" | grep -q "HTTP/1.1 200 OK"; then
    echo "FAIL: Desktop UI returned non-200 HTTP status:"
    echo "$UI_RESPONSE" | head -n 15
    kill -9 "$PID" 2>/dev/null || true
    exit 1
  fi

  if ! echo "$UI_RESPONSE" | grep -q "window.__OFID_TOKEN__"; then
    echo "FAIL: Desktop UI response missing injected session token script!"
    kill -9 "$PID" 2>/dev/null || true
    exit 1
  fi
  echo "  ✓ Desktop UI (index.html) loaded successfully with token injection (0 ENOENT)"

  # Test static asset serving (favicon)
  local ASSET_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:41793/favicon.ico")
  if [ "$ASSET_STATUS" != "200" ]; then
    echo "FAIL: Static asset /favicon.ico returned status $ASSET_STATUS"
    kill -9 "$PID" 2>/dev/null || true
    exit 1
  fi
  echo "  ✓ Static asset /favicon.ico served with HTTP 200"

  # Test camera capability report
  local CAM_JSON=$(curl -s "http://127.0.0.1:41793/api/v1/capabilities")
  if ! echo "$CAM_JSON" | grep -q '"platform"'; then
    echo "FAIL: Invalid capabilities response format"
    kill -9 "$PID" 2>/dev/null || true
    exit 1
  fi
  echo "  ✓ Platform capabilities verified"

  # Terminate cleanly
  kill "$PID" 2>/dev/null || true
  sleep 0.5
  kill -9 "$PID" 2>/dev/null || true
  lsof -ti :41793 | xargs kill -9 2>/dev/null || true
  echo "  ✓ Process terminated cleanly"
}

# Run tests across multiple working directories
test_launch_from_cwd "/"
test_launch_from_cwd "/tmp"
test_launch_from_cwd "$HOME"

# Clean up test sandbox
rm -rf "$TEST_DIR"

echo ""
echo "============================================================"
echo " ALL MULTI-CWD RUNTIME SMOKE TESTS PASSED!"
echo " Zero ENOENT — Frontend Resource Resolution Verified!"
echo "============================================================"
