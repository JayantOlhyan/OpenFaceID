#!/usr/bin/env python3
"""
Install Official OpenFaceID Branding Assets
Copies user-provided master images and generates high-fidelity favicons and .icns
without altering the original image pixels.
"""
import os
import shutil
import subprocess
from PIL import Image

SRC_ICON = "/Users/jayantolhyan/.gemini/antigravity-ide/brain/e481692f-f61a-4563-b4d2-0be21a51eb35/.user_uploaded/media_1789319761735.jpg"
SRC_FULL = "/Users/jayantolhyan/.gemini/antigravity-ide/brain/e481692f-f61a-4563-b4d2-0be21a51eb35/.user_uploaded/media_1789319761751.jpg"

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Target directories
DIRS = [
    os.path.join(ROOT_DIR, "assets"),
    os.path.join(ROOT_DIR, "apps/desktop/assets"),
    os.path.join(ROOT_DIR, "apps/desktop/packaging/macos"),
    os.path.join(ROOT_DIR, "website/assets"),
]

for d in DIRS:
    os.makedirs(d, exist_ok=True)

# 1. Load Master Images
im_icon = Image.open(SRC_ICON)
im_full = Image.open(SRC_FULL)

print(f"Master Icon dimensions: {im_icon.size}")
print(f"Master Full Logo dimensions: {im_full.size}")

# 2. Save PNG Masters Losslessly (PNG-24)
targets_icon = [
    os.path.join(ROOT_DIR, "assets/openfaceid-icon.png"),
    os.path.join(ROOT_DIR, "apps/desktop/assets/icon.png"),
    os.path.join(ROOT_DIR, "apps/desktop/packaging/macos/AppIcon-1024.png"),
    os.path.join(ROOT_DIR, "website/assets/icon.png"),
]

targets_full = [
    os.path.join(ROOT_DIR, "assets/openfaceid-logo-full.png"),
    os.path.join(ROOT_DIR, "apps/desktop/assets/logo-full.png"),
    os.path.join(ROOT_DIR, "website/assets/logo-full.png"),
]

for dest in targets_icon:
    im_icon.save(dest, format="PNG", optimize=True)
    print(f"Saved icon master -> {dest}")

for dest in targets_full:
    im_full.save(dest, format="PNG", optimize=True)
    print(f"Saved full logo master -> {dest}")

# 3. Generate Favicons using High-Fidelity LANCZOS Downsampling
fav_targets = [
    (16, "favicon-16x16.png"),
    (32, "favicon-32x32.png"),
    (48, "favicon-48x48.png"),
    (180, "apple-touch-icon.png"),
    (192, "android-chrome-192x192.png"),
    (512, "android-chrome-512x512.png"),
]

# Generate in website/ and apps/desktop/
for size, name in fav_targets:
    res = im_icon.resize((size, size), Image.Resampling.LANCZOS)
    res.save(os.path.join(ROOT_DIR, f"website/{name}"), format="PNG", optimize=True)
    res.save(os.path.join(ROOT_DIR, f"apps/desktop/{name}"), format="PNG", optimize=True)
    print(f"Generated {name} ({size}x{size})")

# Generate multi-resolution .ico
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
ico_imgs = [im_icon.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
ico_path_web = os.path.join(ROOT_DIR, "website/favicon.ico")
ico_path_app = os.path.join(ROOT_DIR, "apps/desktop/favicon.ico")
ico_imgs[0].save(ico_path_web, format="ICO", sizes=ico_sizes, append_images=ico_imgs[1:])
ico_imgs[0].save(ico_path_app, format="ICO", sizes=ico_sizes, append_images=ico_imgs[1:])
print(f"Generated multi-resolution favicon.ico -> {ico_path_web}, {ico_path_app}")

# 4. Generate macOS .icns for Application Bundle
iconset_dir = os.path.join(ROOT_DIR, "apps/desktop/packaging/macos/OpenFaceID.iconset")
os.makedirs(iconset_dir, exist_ok=True)

icns_specs = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]

for sz, filename in icns_specs:
    resized = im_icon.resize((sz, sz), Image.Resampling.LANCZOS)
    resized.save(os.path.join(iconset_dir, filename), format="PNG")

icns_out = os.path.join(ROOT_DIR, "apps/desktop/packaging/macos/OpenFaceID.icns")
subprocess.check_call(["iconutil", "-c", "icns", iconset_dir, "-o", icns_out])
shutil.rmtree(iconset_dir)
print(f"Generated pristine macOS icon -> {icns_out}")
