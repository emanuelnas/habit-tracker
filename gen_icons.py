# -*- coding: utf-8 -*-
"""מייצר את אייקוני האפליקציה: הכיתוב Log בלבן על רקע שחור."""
from PIL import Image, ImageDraw, ImageFont
import os

FONT = "/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf"
BG = (0, 0, 0)
FG = (255, 255, 255)
TEXT = "Log"
OUT = "src"

def fit_font(size, target_ratio):
    """מוצא גודל פונט שבו רוחב הטקסט הוא אחוז מסוים מהקנבס."""
    lo, hi = 8, size * 2
    best = ImageFont.truetype(FONT, 12)
    while lo <= hi:
        mid = (lo + hi) // 2
        f = ImageFont.truetype(FONT, mid)
        w = f.getbbox(TEXT)[2] - f.getbbox(TEXT)[0]
        if w <= size * target_ratio:
            best = f; lo = mid + 1
        else:
            hi = mid - 1
    return best

def make(size, ratio=0.62, path=None):
    """מרכוז לפי הפיקסלים שנצבעו בפועל, לא לפי מדדי הפונט — כך אין הטיה
       מהשוליים הפנימיים של האות ומהזנב היורד של ה-g."""
    f = fit_font(size, ratio)
    pad = size
    scratch = Image.new("L", (size + pad * 2, size + pad * 2), 0)
    ImageDraw.Draw(scratch).text((pad, pad), TEXT, font=f, fill=255)
    box = scratch.getbbox()
    glyphs = scratch.crop(box)

    img = Image.new("RGB", (size, size), BG)
    x = round((size - glyphs.width) / 2)
    y = round((size - glyphs.height) / 2)
    img.paste(Image.new("RGB", glyphs.size, FG), (x, y), glyphs)
    img.save(path, "PNG")
    return path

os.makedirs(OUT, exist_ok=True)
make(180, 0.62, os.path.join(OUT, "apple-touch-icon.png"))
make(192, 0.62, os.path.join(OUT, "icon-192.png"))
make(512, 0.62, os.path.join(OUT, "icon-512.png"))
make(512, 0.42, os.path.join(OUT, "icon-512-maskable.png"))  # שוליים למסכה של אנדרואיד
make(32,  0.72, os.path.join(OUT, "favicon-32.png"))
print("icons written")
