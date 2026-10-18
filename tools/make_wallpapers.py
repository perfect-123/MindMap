"""Generate the new tab wallpapers in extension/wallpapers/.

Each wallpaper is a tiny (44x54) pre-blurred colour field in the same layout
as the original "dusk" aura: a cool blob top-left, a warm blob top-right, a
glow in the middle, fading to a dark base. The new tab stretches it to full
screen with a CSS blur, so the files stay ~3 KB.

    python3 tools/make_wallpapers.py

dusk.png is the original and is not regenerated here.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

W, H = 44, 54
OUT = Path(__file__).resolve().parent.parent / "extension" / "wallpapers"

# name: (top-left, top-right, centre glow, dark base)
WALLPAPERS = {
    "ocean":    ("#6cc0e4", "#2a6f98", "#3aa0bd", "#08182a"),
    "forest":   ("#94cc9a", "#3a7258", "#6aa070", "#0b1a14"),
    "ember":    ("#eba06a", "#8c4468", "#d26a44", "#1c0e12"),
    "mono":     ("#c4cad3", "#747b87", "#9aa0a9", "#0e1014"),
    # brain states (healthy reuses dusk)
    "thriving": ("#6ad6ea", "#22b884", "#38b3a6", "#08191f"),
    "sluggish": ("#988877", "#a2573a", "#7c6452", "#120e0c"),
    "rotting":  ("#5e6572", "#675e57", "#55555a", "#0c0c0e"),
}


def rgb(hex_):
    return np.array([int(hex_[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)


def blob(cx, cy, rx, ry):
    """Soft elliptical falloff, 1 at the centre → 0 at the edge."""
    y, x = np.mgrid[0:H, 0:W]
    d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    return np.clip(1 - d, 0, 1) ** 1.6


def make(tl, tr, mid, base):
    img = np.tile(rgb(base), (H, W, 1))
    layers = [
        (rgb(tl), blob(0.10 * W, 0.05 * H, 0.75 * W, 0.45 * H), 0.95),
        (rgb(tr), blob(0.95 * W, 0.08 * H, 0.65 * W, 0.40 * H), 0.85),
        (rgb(mid), blob(0.45 * W, 0.50 * H, 0.70 * W, 0.38 * H), 0.95),
    ]
    for colour, mask, strength in layers:
        a = (mask * strength)[..., None]
        img = img * (1 - a) + colour * a
    # fade the bottom into the base, like the original
    fade = np.clip((np.arange(H) / H - 0.65) / 0.35, 0, 1)[:, None, None]
    img = img * (1 - fade * 0.7) + rgb(base) * (fade * 0.7)
    out = Image.fromarray(img.clip(0, 255).astype("uint8"), "RGB")
    return out.filter(ImageFilter.GaussianBlur(4))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, colours in WALLPAPERS.items():
        make(*colours).save(OUT / f"{name}.png", optimize=True)
        print("wrote", name)
