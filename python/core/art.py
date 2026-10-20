"""
The result of a conversion, kept as a grid of cells so it can be written out
in different formats (HTML for the app, ANSI for terminals, plain text).
"""

import html as html_lib

import numpy as np

ANSI_RESET = '\x1b[0m'


class Grid:
    """
    glyphs: (rows, cols) array of single characters
    rgb:    (rows, cols, 3) uint8 array of colours, or None for monochrome art
    """

    def __init__(self, glyphs, rgb=None):
        self.glyphs = glyphs
        self.rgb = rgb

    @property
    def rows(self):
        return self.glyphs.shape[0]

    @property
    def cols(self):
        return self.glyphs.shape[1]

    def _runs(self, y):
        """Yield (start, end) of the stretches of equal colour in row y"""
        if self.cols == 0:
            return
        row_rgb = self.rgb[y]
        breaks = np.flatnonzero((row_rgb[1:] != row_rgb[:-1]).any(axis=1)) + 1
        starts = [0] + breaks.tolist()
        ends = breaks.tolist() + [self.cols]
        yield from zip(starts, ends, strict=True)

    def to_text(self):
        """Plain characters, one line per row"""
        return '\n'.join(''.join(row) for row in self.glyphs.tolist())

    def to_html(self):
        """One <span> per run of equal colour; monochrome art is plain text"""
        if self.rgb is None:
            return html_lib.escape(self.to_text(), quote=False)

        lines = []
        for y in range(self.rows):
            text = ''.join(self.glyphs[y].tolist())
            parts = []
            for start, end in self._runs(y):
                segment = html_lib.escape(text[start:end], quote=False)
                if segment.isspace():
                    parts.append(segment)
                else:
                    r, g, b = self.rgb[y, start].tolist()
                    parts.append(f'<span style="color:rgb({r},{g},{b})">{segment}</span>')
            lines.append(''.join(parts))
        return '\n'.join(lines)

    def to_ansi(self):
        """24-bit colour escape codes, one run per colour change"""
        if self.rgb is None:
            return self.to_text()

        lines = []
        for y in range(self.rows):
            text = ''.join(self.glyphs[y].tolist())
            parts = []
            for start, end in self._runs(y):
                segment = text[start:end]
                if segment.isspace():
                    parts.append(segment)
                else:
                    r, g, b = self.rgb[y, start].tolist()
                    parts.append(f'\x1b[38;2;{r};{g};{b}m{segment}')
            lines.append(''.join(parts) + ANSI_RESET)
        return '\n'.join(lines)

    def downscale(self, max_cols, max_rows):
        """
        A smaller grid sampled evenly from this one, for thumbnails. Both axes
        shrink by the same factor so the picture keeps its proportions.
        """
        factor = min(max_cols / max(self.cols, 1), max_rows / max(self.rows, 1), 1.0)
        row_idx = _sample_indices(self.rows, max(1, round(self.rows * factor)))
        col_idx = _sample_indices(self.cols, max(1, round(self.cols * factor)))
        glyphs = self.glyphs[np.ix_(row_idx, col_idx)]
        rgb = None if self.rgb is None else self.rgb[np.ix_(row_idx, col_idx)]
        return Grid(glyphs, rgb)


def _sample_indices(size, limit):
    if size <= limit:
        return np.arange(size)
    return np.linspace(0, size - 1, limit).astype(int)
