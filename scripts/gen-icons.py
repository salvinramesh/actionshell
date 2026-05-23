#!/usr/bin/env python3
"""Generate ActionShell icons for all required sizes."""
import os
import struct
import zlib
from PIL import Image, ImageDraw, ImageFont

RESOURCES = "/var/www/actionshell/resources/icons"
os.makedirs(RESOURCES, exist_ok=True)

def draw_icon(size):
    """Draw the ActionShell logo at given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background rounded rect
    r = size // 8
    bg_color = (17, 23, 40, 255)       # Dark navy
    accent = (0, 212, 255, 255)         # Electric cyan
    white = (255, 255, 255, 255)

    # Draw rounded rectangle background
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=bg_color)

    # Scale factor
    s = size / 40.0

    # Draw "A" chevron (white) — left part of logo
    p = int(3 * s)
    # Letter A shape: two diagonal lines + crossbar
    lw = max(1, int(2.5 * s))
    # Left diagonal
    draw.line([(int(7*s), int(28*s)), (int(13*s), int(13*s))], fill=white, width=lw)
    # Right diagonal
    draw.line([(int(13*s), int(13*s)), (int(19*s), int(28*s))], fill=white, width=lw)
    # Crossbar
    draw.line([(int(10*s), int(22*s)), (int(16*s), int(22*s))], fill=white, width=lw)

    # Draw ">" arrow (cyan) — right part
    draw.line([(int(22*s), int(14*s)), (int(29*s), int(21*s))], fill=accent, width=lw)
    draw.line([(int(29*s), int(21*s)), (int(22*s), int(28*s))], fill=accent, width=lw)

    return img

# Generate PNG sizes for Linux
sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
imgs = {}
for sz in sizes:
    img = draw_icon(sz)
    path = os.path.join(RESOURCES, f"{sz}x{sz}.png")
    img.save(path, "PNG")
    imgs[sz] = img
    print(f"Generated {sz}x{sz}.png")

# Generate main 512x512 icon.png
imgs[512].save(os.path.join(RESOURCES, "icon.png"), "PNG")
print("Generated icon.png (512x512)")

# Generate icon.icns for macOS (multi-size PNG bundle)
# electron-builder handles icns from the png dir
# Create 256x256 as the primary fallback
imgs[256].save(os.path.join(RESOURCES, "icon.icns.png"), "PNG")

# Generate icon.ico for Windows (multi-size ICO)
ico_sizes = [16, 32, 48, 64, 128, 256]
ico_imgs = [imgs[s].resize((s, s), Image.LANCZOS) for s in ico_sizes]
ico_path = os.path.join(RESOURCES, "icon.ico")
ico_imgs[0].save(
    ico_path, format="ICO",
    sizes=[(s, s) for s in ico_sizes],
    append_images=ico_imgs[1:]
)
print(f"Generated icon.ico ({len(ico_sizes)} sizes)")

print("\n✅ All icons generated successfully!")
print(f"Location: {RESOURCES}")
