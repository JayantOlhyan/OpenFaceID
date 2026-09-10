# OpenFaceID (SightLock) — Troubleshooting & FAQ

This guide provides actionable solutions to common operational and diagnostic states.

---

## 1. Camera Issues

### "Camera Permission Denied"
- **macOS**: Go to `System Settings > Privacy & Security > Camera` and toggle access for OpenFaceID / Terminal.
- **Windows**: Go to `Settings > Privacy & Security > Camera` and ensure *"Allow desktop apps to access your camera"* is enabled.
- **Linux**: Ensure your user account belongs to the `video` group:
  ```bash
  sudo usermod -aG video $USER
  ```
  Then log out and log back in.

### "No Camera Found" / "Camera Disconnected"
- Ensure external USB cameras are firmly seated.
- Run `openfaceid camera list` to inspect discovered sensors.
- If another application (e.g. Zoom, Teams) holds an exclusive hardware lock, close the conflicting app.

---

## 2. Recognition & Enrollment Issues

### "Face Not Centered" or "More Light Needed"
- OpenFaceID's `FaceQualityAnalyzer` rejects captures with poor contrast or extreme yaw/pitch angles.
- Center your face in the camera view and avoid strong backlighting (such as sitting directly in front of a bright sunny window).

### "Recognition Rate Low" / "False Rejections"
- Add a dedicated secondary identity profile for alternate appearances (e.g. *Jayant with Glasses* or *Jayant with Hat*).
- You can also adjust the similarity threshold in **Security & Privacy Settings** (Default: `0.72`, lower to `0.68` for higher tolerance).

---

## 3. Liveness Issues

### "Presentation Attack Suspected (Static Image Detected)"
- In `Light` mode, the system checks for natural involuntary micro-movements or blinks. If sitting rigidly motionless without blinking, blink once or tilt your head gently.
- If testing in an environment with fixed lighting and high camera noise reduction, switch to `Strong` mode to use active challenge prompts.

---

## 4. Keystore Issues

### "OS Keystore Unavailable"
- If the system Keychain or Secret Service daemon is locked or unreachable, OpenFaceID safely falls back to a machine-bound salted key.
- To re-enable native OS keyring, ensure your desktop session keyring daemon (GNOME Keyring, KDE KWallet, or macOS login keychain) is unlocked.
