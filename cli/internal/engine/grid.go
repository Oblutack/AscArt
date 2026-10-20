package engine

import (
	"fmt"
	"strings"
	"unicode"
)

// Grid is the result of a conversion: one character (and, for colored art,
// one color) per cell. It can be written out as plain text, as the HTML the
// app uses, or as ANSI escape codes for a terminal.
type Grid struct {
	Cols, Rows int
	Colored    bool

	glyphs []rune
	colors []RGB
}

// NewGrid makes a blank grid of spaces.
func NewGrid(cols, rows int, colored bool) *Grid {
	g := &Grid{Cols: cols, Rows: rows, Colored: colored, glyphs: make([]rune, cols*rows)}
	for i := range g.glyphs {
		g.glyphs[i] = ' '
	}
	if colored {
		g.colors = make([]RGB, cols*rows)
	}
	return g
}

// Set puts a character (and its color, for colored grids) in a cell.
func (g *Grid) Set(x, y int, glyph rune, color RGB) {
	g.glyphs[y*g.Cols+x] = glyph
	if g.Colored {
		g.colors[y*g.Cols+x] = color
	}
}

// Glyph is the character in a cell.
func (g *Grid) Glyph(x, y int) rune { return g.glyphs[y*g.Cols+x] }

// Color is the color of a cell; uncolored grids have none.
func (g *Grid) Color(x, y int) RGB {
	if !g.Colored {
		return RGB{}
	}
	return g.colors[y*g.Cols+x]
}

// run is a stretch of cells [start, end) in one row with the same color.
type run struct{ start, end int }

func (g *Grid) runs(y int) []run {
	if g.Cols == 0 {
		return nil
	}
	if !g.Colored {
		return []run{{0, g.Cols}}
	}

	var runs []run
	start := 0
	for x := 1; x < g.Cols; x++ {
		if g.Color(x, y) != g.Color(x-1, y) {
			runs = append(runs, run{start, x})
			start = x
		}
	}
	return append(runs, run{start, g.Cols})
}

func (g *Grid) rowText(y int, r run) string {
	return string(g.glyphs[y*g.Cols+r.start : y*g.Cols+r.end])
}

func allSpaces(text string) bool {
	for _, char := range text {
		if !unicode.IsSpace(char) {
			return false
		}
	}
	return true
}

// ToText is just the characters, one line per row.
func (g *Grid) ToText() string {
	lines := make([]string, g.Rows)
	for y := range lines {
		lines[y] = string(g.glyphs[y*g.Cols : (y+1)*g.Cols])
	}
	return strings.Join(lines, "\n")
}

var htmlEscaper = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")

// ToHTML is the format the app displays: one <span> per run of equal color,
// blank runs left bare. Uncolored art (halftone) is plain escaped text.
func (g *Grid) ToHTML() string {
	if !g.Colored {
		return htmlEscaper.Replace(g.ToText())
	}

	lines := make([]string, g.Rows)
	for y := range lines {
		var line strings.Builder
		for _, r := range g.runs(y) {
			text := g.rowText(y, r)
			if allSpaces(text) {
				line.WriteString(text)
				continue
			}
			c := g.Color(r.start, y)
			fmt.Fprintf(&line, `<span style="color:rgb(%d,%d,%d)">%s</span>`, c.R, c.G, c.B, htmlEscaper.Replace(text))
		}
		lines[y] = line.String()
	}
	return strings.Join(lines, "\n")
}

// ToANSI is the art for a terminal. Each color change becomes one escape
// code in the given profile; every line ends with a reset so color can't leak
// into whatever is printed next.
func (g *Grid) ToANSI(profile Profile) string {
	if !g.Colored || profile == NoColor {
		return g.ToText()
	}

	lines := make([]string, g.Rows)
	for y := range lines {
		var line strings.Builder
		previous := ""
		for _, r := range g.runs(y) {
			text := g.rowText(y, r)
			if allSpaces(text) {
				line.WriteString(text)
				continue
			}
			// Different colors can round to the same code in 256 or 16
			// colors; only write the code when it changes
			code := foreground(profile, g.Color(r.start, y))
			if code != previous {
				line.WriteString(code)
				previous = code
			}
			line.WriteString(text)
		}
		line.WriteString(ansiReset)
		lines[y] = line.String()
	}
	return strings.Join(lines, "\n")
}
