"""
Draws the two sample pictures used in the README: a sunset and an animated
plasma. Both are made from nothing but math, so they carry no license.

    python docs/media/make_samples.py

Needs Pillow and NumPy. (The Earth photo is NASA's, see samples/README.md.)
"""
import os

import numpy as np
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")


def sunset():
    W, H = 1200, 720
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    yn = y / H

    def lerp(a, b, t):
        return a + (b - a) * t[..., None]

    # the sky, from deep violet down to a warm horizon
    stops = [(0.0, (24, 20, 78)), (0.38, (120, 38, 128)), (0.62, (232, 82, 96)),
             (0.78, (255, 150, 70)), (1.0, (255, 214, 120))]
    sky = np.zeros((H, W, 3), np.float32)
    t = np.clip(yn / 0.78, 0, 1)
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        m = (t >= p0) & (t <= p1)
        u = (t - p0) / (p1 - p0)
        sky[m] = lerp(np.array(c0, np.float32), np.array(c1, np.float32), u)[m]

    # the sun and its glow
    sx, sy, r = W * 0.62, H * 0.56, 78
    d = np.hypot(x - sx, y - sy)
    glow = np.exp(-(d / 220) ** 2)[..., None]
    sky = sky * (1 - 0.55 * glow) + np.array([255, 196, 110], np.float32) * 0.55 * glow
    disc = np.clip((r - d) / 3, 0, 1)[..., None]
    sky = sky * (1 - disc) + np.array([255, 238, 190], np.float32) * disc

    # a few stars in the dark part
    rng = np.random.default_rng(7)
    for _ in range(140):
        px, py = rng.integers(0, W), rng.integers(0, int(H * 0.3))
        brightness = rng.uniform(0.5, 1) * (1 - py / (H * 0.3))
        sky[py, px] = np.minimum(255, sky[py, px] + 200 * brightness)

    # three ridges of mountains, each darker than the one behind
    def ridge(base, amp, freqs, seed):
        g = np.random.default_rng(seed)
        out = np.full(W, base, np.float32)
        for f in freqs:
            out += amp / f * np.sin(2 * np.pi * f * np.arange(W) / W * 1.7 + g.uniform(0, 6.28))
        return out

    img = sky
    layers = [(0.60, 38, [1, 2, 3, 5], 1, (112, 52, 120)),
              (0.70, 30, [1, 3, 4, 7], 2, (70, 34, 104)),
              (0.82, 22, [2, 3, 6, 9], 3, (34, 22, 70))]
    for base, amp, freqs, seed, color in layers:
        top = ridge(base * H, amp, freqs, seed)
        mask = y >= top[None, :]
        haze = np.clip((y - top[None, :]) / 160, 0, 1)[..., None]
        c = np.array(color, np.float32)
        shade = c * (1 - 0.25 * haze) + np.array([20, 12, 48], np.float32) * 0.25 * haze
        img = np.where(mask[..., None], shade, img)

    # water with the sun's reflection
    water = y > H * 0.9
    reflection = np.exp(-((x - sx) / 70) ** 2) * (0.5 + 0.5 * np.sin(y * 0.6))
    img = np.where(water[..., None],
                   img * 0.55 + np.array([255, 170, 100], np.float32)[None, None, :] * (reflection[..., None] * 0.5),
                   img)

    picture = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    picture.save(os.path.join(OUT, "sunset.jpg"), quality=90, optimize=True)


def plasma():
    """Layered sine waves that loop seamlessly."""
    W, H, N = 320, 200, 48
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    x /= W
    y /= H
    frames = []
    for i in range(N):
        t = 2 * np.pi * i / N
        v = (np.sin(6 * x + t) + np.sin(5 * y - t) + np.sin(5 * (x + y) + t)
             + np.sin(np.hypot(x - .5 + .3 * np.sin(t), y - .5 + .3 * np.cos(t)) * 12 - 2 * t))
        v = (v + 4) / 8
        r = 0.5 + 0.5 * np.sin(2 * np.pi * (v + 0.00))
        g = 0.5 + 0.5 * np.sin(2 * np.pi * (v + 0.33))
        b = 0.5 + 0.5 * np.sin(2 * np.pi * (v + 0.67))
        frames.append(Image.fromarray((np.stack([r, g, b], -1) * 255).astype(np.uint8)))
    frames[0].save(os.path.join(OUT, "plasma.gif"), save_all=True, append_images=frames[1:],
                   duration=60, loop=0, optimize=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    sunset()
    plasma()
    print("wrote", os.listdir(OUT))
