#!/usr/bin/env python3
"""
Generate high-resolution 'Download for Mac' button matching the user's reference design.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 520, 172
radius = 42

# Create base canvas with transparency
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))

# 1. Draw glowing cyan/blue border
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
g_draw = ImageDraw.Draw(glow)
margin = 8
rect = [margin, margin, W - margin, H - margin]
g_draw.rounded_rectangle(rect, radius=radius, outline=(0, 160, 255, 255), width=8)

# Blur glow slightly for that neon edge
glow_blur = glow.filter(ImageFilter.GaussianBlur(3))

# Combine glow with crisp outline
g_draw.rounded_rectangle(rect, radius=radius, outline=(0, 166, 255, 255), width=7)
img = Image.alpha_composite(glow_blur, glow)

# Fill white inside
draw = ImageDraw.Draw(img)
inner_rect = [margin + 4, margin + 4, W - margin - 4, H - margin - 4]
draw.rounded_rectangle(inner_rect, radius=radius - 4, fill=(255, 255, 255, 255))

# 2. Add Left Icon (OpenFaceID official Face ID icon)
icon_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets/openfaceid-icon.png")
if os.path.exists(icon_path):
    icon = Image.open(icon_path).convert("RGBA")
    icon_size = 112
    icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    
    # Mask icon with rounded squircle
    mask = Image.new("L", (icon_size, icon_size), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([0, 0, icon_size, icon_size], radius=24, fill=255)
    
    icon_x = margin + 20
    icon_y = (H - icon_size) // 2
    img.paste(icon, (icon_x, icon_y), mask)

# 3. Add Typography
try:
    font_bold = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 44)
except Exception:
    font_bold = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 42)

text_x = icon_x + icon_size + 24
text_y1 = (H // 2) - 48
text_y2 = (H // 2) + 6

draw.text((text_x, text_y1), "Download", font=font_bold, fill=(10, 10, 15, 255))
draw.text((text_x, text_y2), "for Mac", font=font_bold, fill=(10, 10, 15, 255))

out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets/download-for-mac-button.png")
img.save(out_path, format="PNG", optimize=True)
print(f"Generated button -> {out_path} ({W}x{H})")
