"""
Writes the fixture pictures and the expected output of the Python engine for
them. The Go tests (internal/engine/parity_test.go) check that the Go engine
produces the same art.

    cd python
    python ../cli/testdata/make_golden.py

Only needs Pillow and NumPy. Re-run it (and commit the result) when the Python
conversion is meant to change.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'python'))

from core.image_processor import ImageProcessor  # noqa: E402


def fixtures():
    y, x = np.mgrid[0:80, 0:160]
    gradient = np.stack([x * 255 // 159, y * 255 // 79, 255 - x * 255 // 159], axis=-1).astype(np.uint8)

    stripes = np.zeros((60, 120, 3), dtype=np.uint8)
    for i, color in enumerate([(220, 40, 40), (40, 200, 60), (50, 70, 230), (240, 220, 40)]):
        stripes[:, i * 30:(i + 1) * 30] = color

    return {
        'flat_red': np.full((64, 64, 3), (200, 60, 60), dtype=np.uint8),
        'flat_gray': np.full((64, 96, 3), (128, 128, 128), dtype=np.uint8),
        'flat_dark': np.full((40, 80, 3), (12, 20, 30), dtype=np.uint8),
        'gradient': gradient,
        'stripes': stripes,
    }


# name of the case, fixture, Python options
CASES = [
    ('flat_red_plain', 'flat_red', {'width': 20}),
    ('flat_red_sepia', 'flat_red', {'width': 20, 'colorScheme': 'sepia'}),
    ('flat_red_grayscale', 'flat_red', {'width': 20, 'colorScheme': 'grayscale'}),
    ('flat_red_blue', 'flat_red', {'width': 20, 'colorScheme': 'blue'}),
    ('flat_red_green', 'flat_red', {'width': 20, 'colorScheme': 'green'}),
    ('flat_red_red', 'flat_red', {'width': 20, 'colorScheme': 'red'}),
    ('flat_red_purple', 'flat_red', {'width': 20, 'colorScheme': 'purple'}),
    ('flat_red_cyan', 'flat_red', {'width': 20, 'colorScheme': 'cyan'}),
    ('flat_red_blocks', 'flat_red', {'width': 20, 'charset': 'blocks'}),
    ('flat_red_custom', 'flat_red', {'width': 20, 'charset': 'custom', 'customChars': '.oO#'}),
    ('flat_red_escaped', 'flat_red', {'width': 12, 'charset': 'custom', 'customChars': '<&>'}),
    ('flat_red_bright', 'flat_red', {'width': 20, 'brightness': 40}),
    ('flat_red_dim', 'flat_red', {'width': 20, 'brightness': -40}),
    ('flat_red_contrast', 'flat_red', {'width': 20, 'contrast': 160}),
    ('flat_red_invert', 'flat_red', {'width': 20, 'invert': True}),
    ('flat_red_ratio', 'flat_red', {'width': 24, 'ratio': '16:9'}),
    ('flat_gray_plain', 'flat_gray', {'width': 30}),
    ('flat_gray_dark_ramp', 'flat_gray', {'width': 30, 'charset': 'custom', 'customChars': 'ABC'}),
    ('flat_dark_plain', 'flat_dark', {'width': 16}),
    ('flat_dark_dither', 'flat_dark', {'width': 8, 'dither': True}),
    ('flat_gray_keep', 'flat_gray', {'keepOriginal': True}),
    ('gradient_plain', 'gradient', {'width': 40}),
    ('gradient_sepia_blocks', 'gradient', {'width': 40, 'charset': 'blocks', 'colorScheme': 'sepia'}),
    ('stripes_plain', 'stripes', {'width': 40}),
]


def main():
    out = os.path.join(HERE, 'golden')
    os.makedirs(out, exist_ok=True)

    for name, pixels in fixtures().items():
        Image.fromarray(pixels).save(os.path.join(HERE, f'{name}.png'))

    manifest = []
    for case, fixture, options in CASES:
        grid = ImageProcessor().process_to_grid(os.path.join(HERE, f'{fixture}.png'), options)
        with open(os.path.join(out, f'{case}.html'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(grid.to_html())
        with open(os.path.join(out, f'{case}.txt'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(grid.to_text())
        manifest.append({'case': case, 'fixture': fixture, 'options': options,
                         'cols': grid.cols, 'rows': grid.rows})

    with open(os.path.join(HERE, 'golden.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    print(f'wrote {len(manifest)} cases')


if __name__ == '__main__':
    main()
