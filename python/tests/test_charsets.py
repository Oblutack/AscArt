import re

import pytest

from core.charsets import (
    MAX_CUSTOM_CHARS,
    parse_custom_chars,
    resolve_charset,
)
from core.image_processor import ImageProcessor


class TestParse:
    def test_keeps_order_and_duplicates(self):
        assert parse_custom_chars('#.#o') == ['#', '.', '#', 'o']

    def test_a_space_is_fine(self):
        assert parse_custom_chars('@ ') == ['@', ' ']

    def test_unicode_blocks_and_symbols_are_fine(self):
        assert parse_custom_chars('█▒░·') == ['█', '▒', '░', '·']

    @pytest.mark.parametrize('text', ['', 'x'])
    def test_needs_at_least_two(self, text):
        with pytest.raises(ValueError, match='at least 2'):
            parse_custom_chars(text)

    def test_at_most_a_hundred(self):
        assert len(parse_custom_chars('a' * MAX_CUSTOM_CHARS)) == MAX_CUSTOM_CHARS
        with pytest.raises(ValueError, match='at most'):
            parse_custom_chars('a' * (MAX_CUSTOM_CHARS + 1))

    @pytest.mark.parametrize('bad', ['漢', 'Ａ', '😀', 'a\nb', 'a\tb', '\x00a', 'é'])
    def test_rejects_characters_that_would_break_the_grid(self, bad):
        with pytest.raises(ValueError, match='single-width and printable'):
            parse_custom_chars('ab' + bad)

    def test_the_message_names_the_offending_character(self):
        with pytest.raises(ValueError, match='漢'):
            parse_custom_chars('ab漢')

    def test_rejects_non_text(self):
        with pytest.raises(ValueError):
            parse_custom_chars(None)


class TestResolve:
    def test_built_in_sets(self):
        assert resolve_charset('detailed') == list('@%#*+=-:. ')
        assert resolve_charset('blocks') == list('█▓▒░ ')

    def test_old_names(self):
        assert resolve_charset('standard') == resolve_charset('detailed')
        assert resolve_charset('simple') == resolve_charset('blocks')

    def test_unknown_names_fall_back_to_detailed(self):
        assert resolve_charset('nope') == resolve_charset('detailed')

    def test_custom_uses_the_users_text(self):
        assert resolve_charset('custom', 'AB') == ['A', 'B']

    def test_custom_without_text_is_an_error(self):
        with pytest.raises(ValueError):
            resolve_charset('custom')

    def test_the_text_is_ignored_for_other_sets(self):
        assert resolve_charset('blocks', 'AB') == resolve_charset('blocks')


class TestInTheConverter:
    def processor(self, make_image, color):
        processor = ImageProcessor()
        processor.load_image(make_image(color=color))
        processor.resize_image(10)
        return processor

    def test_dark_pixels_get_the_first_character_and_light_the_last(self, make_image):
        dark = self.processor(make_image, (0, 0, 0))
        light = self.processor(make_image, (255, 255, 255))

        assert set(dark.convert_to_ascii('custom', colored=False, custom_chars='XYZ')) == {'X', '\n'}
        assert set(light.convert_to_ascii('custom', colored=False, custom_chars='XYZ')) == {'Z', '\n'}

    def test_midtones_use_the_middle(self, make_image):
        mid = self.processor(make_image, (128, 128, 128))
        art = mid.convert_to_ascii('custom', colored=False, custom_chars='ABC')
        assert set(art) == {'B', '\n'}

    def test_through_the_whole_pipeline(self, make_image):
        art = ImageProcessor().process_and_convert(
            make_image(color=(0, 0, 0)),
            {'width': 10, 'charset': 'custom', 'customChars': '#.'},
        )
        assert set(re.sub(r'<[^>]*>', '', art)) == {'#', '\n'}

    def test_html_special_characters_are_escaped(self, make_image):
        art = ImageProcessor().process_and_convert(
            make_image(color=(0, 0, 0)),
            {'width': 10, 'charset': 'custom', 'customChars': '<&'},
        )
        assert '&lt;' in art
        assert '<&' not in art

    def test_a_bad_custom_set_is_an_error_with_a_reason(self, make_image):
        with pytest.raises(Exception, match='at least 2'):
            ImageProcessor().process_and_convert(
                make_image(), {'width': 10, 'charset': 'custom', 'customChars': 'x'})

    def test_halftone_ignores_charsets(self, make_image):
        art = ImageProcessor().process_and_convert(
            make_image(color=(0, 0, 0)),
            {'width': 10, 'dither': True, 'charset': 'custom', 'customChars': 'ab'})
        assert set(art) == {'█', '\n'}
