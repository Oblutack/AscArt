"""
Character sets: the built-in ramps and validation of a user-written one.

A ramp runs from the darkest character to the lightest, so a dark pixel gets
the first one and a bright pixel the last.
"""

import unicodedata

CHARSETS = {
    'detailed': '@%#*+=-:. ',
    'blocks': '█▓▒░ ',
}

# Old names that may still be stored in saved settings / history
CHARSET_ALIASES = {
    'standard': 'detailed',
    'simple': 'blocks',
}

MIN_CUSTOM_CHARS = 2
MAX_CUSTOM_CHARS = 100


def parse_custom_chars(text):
    """
    The characters of a user-written ramp, in order. Raises ValueError with a
    message fit for the user if it can't be used.
    """
    if not isinstance(text, str):
        raise ValueError("Custom characters must be text")

    chars = list(text)

    for char in chars:
        # Each character must take exactly one cell of the grid: no control
        # characters, no combining marks, nothing double-width (CJK, emoji)
        unsupported = (
            not char.isprintable()
            or unicodedata.category(char).startswith('M')
            or unicodedata.east_asian_width(char) in ('W', 'F')
        )
        if unsupported:
            raise ValueError(
                f"Can't use {char!r}: custom characters must be single-width and printable")

    if len(chars) < MIN_CUSTOM_CHARS:
        raise ValueError(f"Custom characters need at least {MIN_CUSTOM_CHARS} characters")
    if len(chars) > MAX_CUSTOM_CHARS:
        raise ValueError(f"Custom characters can be at most {MAX_CUSTOM_CHARS} characters")

    return chars


def resolve_charset(charset, custom_chars=None):
    """The ramp to use for a charset name (and the user's text if it is 'custom')"""
    charset = CHARSET_ALIASES.get(charset, charset)

    if charset == 'custom':
        return parse_custom_chars(custom_chars if custom_chars is not None else '')

    return list(CHARSETS.get(charset, CHARSETS['detailed']))
