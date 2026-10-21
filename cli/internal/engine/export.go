package engine

import (
	"fmt"
	"image"
	"path/filepath"
	"strings"
)

// Format is a way to write art out.
type Format string

const (
	FormatANSI Format = "ansi"
	FormatText Format = "text"
	FormatHTML Format = "html"
)

// ParseFormat reads a format name (ansi, text or html, plus the usual
// extensions).
func ParseFormat(name string) (Format, error) {
	switch strings.ToLower(name) {
	case "ansi", "ans":
		return FormatANSI, nil
	case "text", "txt", "plain":
		return FormatText, nil
	case "html":
		return FormatHTML, nil
	}
	return "", fmt.Errorf("unknown format %q (use ansi, text or html)", name)
}

// FormatForFile picks a format from a file name's extension.
func FormatForFile(path string) (Format, bool) {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".html", ".htm":
		return FormatHTML, true
	case ".txt":
		return FormatText, true
	case ".ans", ".ansi":
		return FormatANSI, true
	}
	return "", false
}

// Export writes the grid in a format. The profile only matters for ANSI.
func (g *Grid) Export(format Format, profile Profile) string {
	switch format {
	case FormatText:
		return g.ToText()
	case FormatHTML:
		return htmlPage(g.ToHTML())
	default:
		return g.ToANSI(profile)
	}
}

// htmlLineHeight makes each row as tall as the conversion assumed: Courier
// New is 0.6 of the font size wide, and a row is 1/CellAspect times a
// character's width, so 0.6/0.55 font sizes. At 1 the art looks squashed.
const htmlLineHeight = "1.09"

// htmlPage wraps the art in a page that shows it on a dark background.
func htmlPage(art string) string {
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ASCII Art</title>
<style>
  body { margin: 0; padding: 20px; background: #0b0c10; }
  pre { margin: 0; color: #d0d0d0; font-family: "Courier New", Consolas, monospace; font-size: 8px; line-height: ` + htmlLineHeight + `; white-space: pre; }
</style>
</head>
<body>
<pre>` + art + `</pre>
</body>
</html>`
}

// HalfBlocks draws a picture with half-block characters (two pixels per cell,
// the top one as the text color and the bottom one as the background), scaled
// to fit inside maxCols x maxRows without changing its proportions.
func HalfBlocks(img *image.NRGBA, maxCols, maxRows int) (art string, cols, rows int) {
	b := img.Bounds()
	if b.Dx() == 0 || b.Dy() == 0 || maxCols < 1 || maxRows < 1 {
		return "", 0, 0
	}

	// a cell is as wide as two half-blocks are high: pixel columns = cols,
	// pixel rows = 2 * rows
	cols, pixelRows := b.Dx(), b.Dy()
	if cols > maxCols {
		pixelRows = max(1, pixelRows*maxCols/cols)
		cols = maxCols
	}
	if pixelRows > 2*maxRows {
		cols = max(1, cols*2*maxRows/pixelRows)
		pixelRows = 2 * maxRows
	}
	pixelRows += pixelRows % 2 // an even number of rows of pixels
	rows = pixelRows / 2

	small := resizeArea(toOpaque(img), cols, pixelRows)

	var out strings.Builder
	for y := 0; y < pixelRows; y += 2 {
		if y > 0 {
			out.WriteByte('\n')
		}
		for x := range cols {
			top, bottom := small.NRGBAAt(x, y), small.NRGBAAt(x, y+1)
			fmt.Fprintf(&out, "\x1b[38;2;%d;%d;%d;48;2;%d;%d;%dm▀", top.R, top.G, top.B, bottom.R, bottom.G, bottom.B)
		}
		out.WriteString("\x1b[0m")
	}
	return out.String(), cols, rows
}
