import re

import numpy as np

from core.art import ANSI_RESET, Grid


def grid_from(rows, colors=None):
    glyphs = np.array([list(row) for row in rows])
    rgb = None
    if colors is not None:
        rgb = np.array(colors, dtype=np.uint8)
    return Grid(glyphs, rgb)


RED = (255, 0, 0)
BLUE = (0, 0, 255)


def test_to_text_has_one_line_per_row():
    assert grid_from(['ab', 'cd']).to_text() == 'ab\ncd'


def test_monochrome_html_is_plain_text():
    assert grid_from(['█ ', ' █']).to_html() == '█ \n █'


def test_html_merges_runs_of_equal_color():
    grid = grid_from(['@@##'], [[RED, RED, BLUE, BLUE]])
    assert grid.to_html() == (
        '<span style="color:rgb(255,0,0)">@@</span>'
        '<span style="color:rgb(0,0,255)">##</span>'
    )


def test_html_leaves_blank_runs_unwrapped():
    grid = grid_from(['@  @'], [[RED, RED, BLUE, BLUE]])
    html = grid.to_html()
    assert html.count('<span') == 2
    assert re.sub(r'<[^>]*>', '', html) == '@  @'


def test_html_escapes_markup_characters():
    grid = grid_from(['<&>'], [[RED, RED, RED]])
    assert '&lt;&amp;&gt;' in grid.to_html()
    assert '<&>' not in grid.to_html()


def test_ansi_has_truecolor_codes_and_resets_each_line():
    grid = grid_from(['@#', '@#'], [[RED, BLUE], [RED, BLUE]])
    lines = grid.to_ansi().split('\n')
    assert lines[0] == '\x1b[38;2;255;0;0m@\x1b[38;2;0;0;255m#' + ANSI_RESET
    assert all(line.endswith(ANSI_RESET) for line in lines)


def test_monochrome_ansi_is_plain_text():
    assert grid_from(['ab']).to_ansi() == 'ab'


def test_downscale_keeps_proportions_and_never_grows():
    grid = Grid(np.full((40, 100), '#'), np.zeros((40, 100, 3), dtype=np.uint8))
    small = grid.downscale(50, 50)
    assert (small.rows, small.cols) == (20, 50)  # both axes halved

    tiny = grid_from(['ab'])
    assert (tiny.downscale(50, 50).rows, tiny.downscale(50, 50).cols) == (1, 2)


def test_downscale_picks_cells_from_the_original():
    glyphs = np.array([list('abcdefgh')])
    small = Grid(glyphs).downscale(4, 4)
    assert set(small.glyphs.ravel().tolist()) <= set('abcdefgh')
    assert small.cols == 4
