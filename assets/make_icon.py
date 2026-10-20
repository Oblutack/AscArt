"""
Draws the app icon: a halftone "A" in the app's palette.

    python assets/make_icon.py

Writes icon.png (512px, used on Linux/macOS and for the window) and icon.ico
(Windows, several sizes) next to this script. Needs only Pillow.
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))

BACKGROUND = (33, 37, 41)  # --shadow-grey
BORDER = (73, 80, 87)  # --iron-grey
DOT = (173, 181, 189)  # --pale-slate-2
HIGHLIGHT = (248, 249, 250)  # --bright-snow

SIZE = 1024
GRID = 24  # dots per side
SUPERSAMPLE = 4


def letter_mask(size):
    """The letter A as a grayscale image (white on black)"""
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    stroke = int(size * 0.17)

    apex = (size * 0.5, size * 0.13)
    left = (size * 0.17, size * 0.87)
    right = (size * 0.83, size * 0.87)

    draw.line([left, apex, right], fill=255, width=stroke, joint='curve')
    draw.line([(size * 0.30, size * 0.64), (size * 0.70, size * 0.64)], fill=255, width=int(stroke * 0.8))
    return mask


def draw_icon():
    image = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    margin = int(SIZE * 0.04)
    radius = int(SIZE * 0.2)
    box = (margin, margin, SIZE - margin, SIZE - margin)
    draw.rounded_rectangle(box, radius=radius, fill=BACKGROUND, outline=BORDER, width=int(SIZE * 0.012))

    # How much of each grid cell the letter covers decides the dot size
    coverage = letter_mask(GRID * SUPERSAMPLE * 8).resize((GRID, GRID), Image.Resampling.BOX)

    inner = SIZE - 2 * int(SIZE * 0.17)
    origin = int(SIZE * 0.17)
    cell = inner / GRID

    for gy in range(GRID):
        for gx in range(GRID):
            amount = coverage.getpixel((gx, gy)) / 255
            if amount < 0.05:
                continue
            r = (amount ** 0.6) * cell * 0.5 * 1.05
            cx = origin + (gx + 0.5) * cell
            cy = origin + (gy + 0.5) * cell
            # Brighter towards the top, like light falling on the letter
            blend = 1 - gy / GRID
            color = tuple(int(DOT[i] + (HIGHLIGHT[i] - DOT[i]) * blend * 0.6) for i in range(3))
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)

    return image


if __name__ == '__main__':
    icon = draw_icon()
    icon.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(HERE, 'icon.png'))
    icon.save(
        os.path.join(HERE, 'icon.ico'),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print('wrote icon.png and icon.ico')
