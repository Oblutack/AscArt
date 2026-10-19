import re

import numpy as np
from PIL import Image

from core.image_processor import ImageProcessor


def strip_tags(markup):
    return re.sub(r'<[^>]*>', '', markup)


def loaded(path, width=20, **kwargs):
    processor = ImageProcessor()
    processor.load_image(path)
    processor.resize_image(width, **kwargs)
    return processor


class TestCharsets:
    def test_blocks_uses_block_characters(self, make_image):
        art = loaded(make_image()).convert_to_ascii('blocks', colored=False)
        assert set(art) <= set('█▓▒░ \n')

    def test_old_names_still_work(self, make_image):
        path = make_image(color=(90, 90, 90))
        assert loaded(path).convert_to_ascii('simple', colored=False) == \
            loaded(path).convert_to_ascii('blocks', colored=False)
        assert loaded(path).convert_to_ascii('standard', colored=False) == \
            loaded(path).convert_to_ascii('detailed', colored=False)

    def test_unknown_charset_falls_back_to_detailed(self, make_image):
        path = make_image(color=(90, 90, 90))
        assert loaded(path).convert_to_ascii('nope', colored=False) == \
            loaded(path).convert_to_ascii('detailed', colored=False)

    def test_dark_pixels_get_dense_characters(self, make_image):
        dark = loaded(make_image(color=(0, 0, 0))).convert_to_ascii('detailed', colored=False)
        light = loaded(make_image(color=(255, 255, 255))).convert_to_ascii('detailed', colored=False)
        assert set(dark) == {'@', '\n'}
        assert set(light) == {' ', '\n'}


class TestResize:
    def test_width_and_character_height_correction(self, make_image):
        # 100x50 image at width 20 -> 20 x (20 / 2 * 0.55) = 5 rows
        assert loaded(make_image(size=(100, 50)), width=20).image.size == (20, 5)

    def test_ratio_changes_height(self, make_image):
        processor = loaded(make_image(size=(100, 50)), width=20, ratio='1:1')
        assert processor.image.size == (20, 11)

    def test_bad_ratio_falls_back_to_image_ratio(self, make_image):
        processor = loaded(make_image(size=(100, 50)), width=20, ratio='x:y')
        assert processor.image.size == (20, 5)

    def test_very_wide_image_keeps_at_least_one_row(self, make_image):
        assert loaded(make_image(size=(4000, 10)), width=20).image.size == (20, 1)

    def test_keep_original_is_capped(self, make_image):
        processor = loaded(make_image(size=(2000, 1000)), width=50, keep_original=True)
        assert processor.image.size == (ImageProcessor.MAX_KEEP_ORIGINAL_WIDTH, 110)

    def test_keep_original_leaves_small_images_alone(self, make_image):
        processor = loaded(make_image(size=(100, 50)), width=50, keep_original=True)
        assert processor.image.size[0] == 100


class TestBackgroundMask:
    def test_mask_does_not_leak_into_next_image(self, make_image):
        path = make_image()
        processor = ImageProcessor()
        processor.load_image(path)
        processor.alpha_mask = Image.new('L', (40, 40), 0)  # "everything removed"

        processor.load_image(path)
        processor.resize_image(20)
        assert processor.convert_to_ascii(colored=False).strip()

    def test_transparent_cells_become_spaces(self, make_image):
        processor = loaded(make_image(color=(0, 0, 0)))
        mask = np.full((40, 40), 255, dtype=np.uint8)
        mask[:, :20] = 0  # left half removed
        processor.alpha_mask = Image.fromarray(mask)

        # The resize smears the mask edge by about a cell, so look away from it
        for line in processor.convert_to_ascii(colored=False).split('\n'):
            assert line[:8] == ' ' * 8
            assert line[12:] == '@' * 8


class TestColors:
    def test_grayscale(self):
        red = np.array([[[255, 0, 0]]], dtype=np.uint8)
        assert ImageProcessor._apply_color_scheme(red, 'grayscale').tolist() == [[[76, 76, 76]]]

    def test_sepia_is_clamped(self):
        white = np.array([[[255, 255, 255]]], dtype=np.uint8)
        r, g, b = ImageProcessor._apply_color_scheme(white, 'sepia')[0, 0].tolist()
        assert r == 255 and g <= 255 and b <= 255

    def test_tints(self):
        white = np.array([[[255, 255, 255]]], dtype=np.uint8)

        def tint(name):
            return ImageProcessor._apply_color_scheme(white, name)[0, 0].tolist()

        assert tint('blue') == [85, 127, 255]
        assert tint('green') == [85, 255, 127]
        assert tint('red') == [255, 85, 85]
        assert tint('purple') == [255, 85, 255]
        assert tint('cyan') == [85, 255, 255]

    def test_unknown_scheme_keeps_original_colors(self):
        pixel = np.array([[[10, 20, 30]]], dtype=np.uint8)
        assert ImageProcessor._apply_color_scheme(pixel, 'nope').tolist() == [[[10, 20, 30]]]

    def test_quantize_stays_in_range(self):
        values = np.array([[[0, 3, 4], [252, 254, 255]]])
        quantized = ImageProcessor._quantize(values)
        assert quantized.min() >= 0 and quantized.max() <= 255


class TestSpans:
    def test_uniform_image_is_one_span_per_row(self, make_image):
        art = loaded(make_image(color=(30, 30, 30))).convert_to_ascii('detailed', colored=True)
        for line in art.split('\n'):
            assert line.count('<span') == 1

    def test_text_survives_coloring(self, make_image):
        processor = loaded(make_image(color=(30, 30, 30)))
        plain = processor.convert_to_ascii('detailed', colored=False)
        assert strip_tags(processor.convert_to_ascii('detailed', colored=True)) == plain

    def test_gradient_produces_several_runs(self, tmp_path):
        row = np.linspace(0, 255, 40).astype(np.uint8)
        pixels = np.tile(row[None, :, None], (8, 1, 3))
        path = tmp_path / 'gradient.png'
        Image.fromarray(pixels).save(path)

        art = loaded(str(path), width=40).convert_to_ascii()
        assert art.split('\n')[0].count('<span') > 1


class TestHalftone:
    def test_only_blocks_and_spaces(self, tmp_path):
        row = np.linspace(0, 255, 60).astype(np.uint8)
        path = tmp_path / 'g.png'
        Image.fromarray(np.tile(row[None, :], (30, 1))).convert('RGB').save(path)

        art = loaded(str(path), width=60).convert_to_halftone()
        assert set(art) <= {'█', ' ', '\n'}
        assert '█' in art and ' ' in art

    def test_black_is_solid_and_white_is_empty(self, make_image):
        black = loaded(make_image(color=(0, 0, 0))).convert_to_halftone()
        white = loaded(make_image(color=(255, 255, 255))).convert_to_halftone()
        assert set(black) == {'█', '\n'}
        assert set(white) == {' ', '\n'}


class TestPipeline:
    def test_dither_option_switches_to_halftone(self, make_image):
        art = ImageProcessor().process_and_convert(
            make_image(color=(0, 0, 0)), {'width': 10, 'dither': True})
        assert set(art) == {'█', '\n'}

    def test_dither_uses_three_times_the_width(self, make_image):
        art = ImageProcessor().process_and_convert(
            make_image(), {'width': 10, 'dither': True})
        assert len(art.split('\n')[0]) == 30

    def test_invert_flips_brightness(self, make_image):
        art = ImageProcessor().process_and_convert(
            make_image(color=(255, 255, 255)),
            {'width': 10, 'invert': True, 'colorScheme': 'grayscale'})
        assert set(strip_tags(art)) == {'@', '\n'}
