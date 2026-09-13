#!/usr/bin/env python3
"""
Generate macOS AppIcon for OpenFaceID (SightLock)
Generates high-res 1024x1024 PNG and builds OpenFaceID.icns using sips and iconutil.
"""
import os
import subprocess
from PIL import Image, ImageDraw, ImageFilter

WIDTH = 1024
HEIGHT = 1024

# Create RGBA canvas
img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Outer margin for macOS squircle
margin = 80
rect = [margin, margin, WIDTH - margin, HEIGHT - margin]
corner_radius = 190

# Draw squircle shadow
shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
s_draw = ImageDraw.Draw(shadow)
s_draw.rounded_rectangle([margin, margin + 14, WIDTH - margin, HEIGHT - margin + 14], radius=corner_radius, fill=(0, 0, 0, 160))
shadow = shadow.filter(ImageFilter.GaussianBlur(28))
img = Image.alpha_composite(shadow, img)
draw = ImageDraw.Draw(img)

# Base background: deep space blue gradient
for y in range(margin, HEIGHT - margin):
    progress = (y - margin) / (HEIGHT - 2 * margin)
    r = int(12 + progress * 8)
    g = int(16 + progress * 16)
    b = int(28 + progress * 32)
    draw.line([(margin, y), (WIDTH - margin, y)], fill=(r, g, b, 255))

# Mask with rounded rectangle
mask = Image.new("L", (WIDTH, HEIGHT), 0)
m_draw = ImageDraw.Draw(mask)
m_draw.rounded_rectangle(rect, radius=corner_radius, fill=255)

# Border glow
border_img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
b_draw = ImageDraw.Draw(border_img)
b_draw.rounded_rectangle(rect, radius=corner_radius, outline=(59, 130, 246, 120), width=4)

# Biometric Reticle & Face Glyphs
cx, cy = WIDTH // 2, HEIGHT // 2 - 15

# Outer scanning ring
b_draw.arc([cx - 290, cy - 290, cx + 290, cy + 290], start=30, end=150, fill=(16, 185, 129, 200), width=8)
b_draw.arc([cx - 290, cy - 290, cx + 290, cy + 290], start=210, end=330, fill=(59, 130, 246, 200), width=8)

# Mid dashed reticle
b_draw.arc([cx - 230, cy - 230, cx + 230, cy + 230], start=0, end=70, fill=(59, 130, 246, 140), width=5)
b_draw.arc([cx - 230, cy - 230, cx + 230, cy + 230], start=90, end=160, fill=(59, 130, 246, 140), width=5)
b_draw.arc([cx - 230, cy - 230, cx + 230, cy + 230], start=180, end=250, fill=(16, 185, 129, 140), width=5)
b_draw.arc([cx - 230, cy - 230, cx + 230, cy + 230], start=270, end=340, fill=(16, 185, 129, 140), width=5)

# Biometric corner brackets
bracket_len = 50
pad = 260
# Top-Left
b_draw.line([(cx - pad, cy - pad + bracket_len), (cx - pad, cy - pad), (cx - pad + bracket_len, cy - pad)], fill=(59, 130, 246, 240), width=10)
# Top-Right
b_draw.line([(cx + pad - bracket_len, cy - pad), (cx + pad, cy - pad), (cx + pad, cy - pad + bracket_len)], fill=(59, 130, 246, 240), width=10)
# Bottom-Left
b_draw.line([(cx - pad, cy + pad - bracket_len), (cx - pad, cy + pad), (cx - pad + bracket_len, cy + pad)], fill=(16, 185, 129, 240), width=10)
# Bottom-Right
b_draw.line([(cx + pad - bracket_len, cy + pad), (cx + pad, cy + pad), (cx + pad, cy + pad - bracket_len)], fill=(16, 185, 129, 240), width=10)

# Face Contour Silhouette
# Head outline
b_draw.ellipse([cx - 130, cy - 170, cx + 130, cy + 110], outline=(248, 250, 252, 230), width=8)
# Eyes
b_draw.ellipse([cx - 65, cy - 60, cx - 35, cy - 30], fill=(59, 130, 246, 255))
b_draw.ellipse([cx + 35, cy - 60, cx + 65, cy - 30], fill=(59, 130, 246, 255))
# Nose bridge / tip
b_draw.line([(cx, cy - 30), (cx, cy + 10)], fill=(148, 163, 184, 200), width=6)
b_draw.line([(cx, cy + 10), (cx - 15, cy + 18)], fill=(148, 163, 184, 200), width=6)
# Smile / chin accent
b_draw.arc([cx - 45, cy + 10, cx + 45, cy + 60], start=30, end=150, fill=(16, 185, 129, 240), width=7)

# Security Lock Badge at bottom-center
shield_cy = cy + 180
# Shield glow
b_draw.ellipse([cx - 80, shield_cy - 60, cx + 80, shield_cy + 80], fill=(16, 185, 129, 45))
# Shield shape
shield_points = [
    (cx - 50, shield_cy - 30),
    (cx + 50, shield_cy - 30),
    (cx + 50, shield_cy + 15),
    (cx, shield_cy + 65),
    (cx - 50, shield_cy + 15),
]
b_draw.polygon(shield_points, fill=(17, 24, 39, 240), outline=(16, 185, 129, 255))
# Checkmark inside shield
b_draw.line([(cx - 22, shield_cy + 12), (cx - 6, shield_cy + 28), (cx + 24, shield_cy - 4)], fill=(16, 185, 129, 255), width=8)

# Composite masked background and border
final_bg = Image.composite(img, Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0)), mask)
final_app_icon = Image.alpha_composite(final_bg, border_img)

out_dir = "apps/desktop/packaging/macos"
os.makedirs(out_dir, exist_ok=True)
png_path = os.path.join(out_dir, "AppIcon-1024.png")
final_app_icon.save(png_path)
print(f"Created {png_path}")

# Build iconset
iconset_dir = os.path.join(out_dir, "OpenFaceID.iconset")
os.makedirs(iconset_dir, exist_ok=True)

sizes = [
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

for sz, name in sizes:
    dest = os.path.join(iconset_dir, name)
    resized = final_app_icon.resize((sz, sz), Image.LANCZOS)
    resized.save(dest)

icns_path = os.path.join(out_dir, "OpenFaceID.icns")
cmd = ["iconutil", "-c", "icns", iconset_dir, "-o", icns_path]
subprocess.check_call(cmd)
print(f"Generated {icns_path}")
