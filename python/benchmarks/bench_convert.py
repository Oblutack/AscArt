"""
Rough timings for the converter on a synthetic photo-like image.

    python benchmarks/bench_convert.py

Run from the python/ folder. Prints time and output size for a normal
conversion and for halftone dithering, so changes to the pipeline can be
compared before/after.
"""
import os
import sys
import tempfile
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from core.image_processor import ImageProcessor  # noqa: E402


def make_test_image(path, width=1600, height=1200):
    """Smooth gradients plus a little noise, roughly like a photo"""
    rng = np.random.default_rng(1)
    y, x = np.mgrid[0:height, 0:width]
    r = 127 + 120 * np.sin(x / 140.0) * np.cos(y / 190.0)
    g = 127 + 120 * np.sin((x + y) / 210.0)
    b = 127 + 120 * np.cos(x / 260.0 - y / 170.0)
    img = np.stack([r, g, b], axis=-1) + rng.normal(0, 3, (height, width, 3))
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(path)


def bench(label, path, options, repeat=3):
    processor = ImageProcessor()
    best = None
    result = ''
    for _ in range(repeat):
        start = time.perf_counter()
        result = processor.process_and_convert(path, options)
        elapsed = time.perf_counter() - start
        best = elapsed if best is None else min(best, elapsed)
    print(f'{label:<28} {best * 1000:8.0f} ms   {len(result) / 1024:9.1f} KB')


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 'bench.png')
        make_test_image(path)
        print(f'{"case":<28} {"best time":>11}   {"output":>12}')
        bench('ascii, width 120', path, {'width': 120})
        bench('ascii, width 300', path, {'width': 300})
        bench('ascii, width 300 sepia', path, {'width': 300, 'colorScheme': 'sepia'})
        bench('halftone, width 120 (x3)', path, {'width': 120, 'dither': True})
