// Package engine turns pictures into colored ASCII art. It is the Go
// counterpart of python/core: the same character mapping, color schemes,
// color rounding and HTML output, so the two produce the same art.
package engine

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
)

// Limits and defaults. The app's slider runs 20-300; the engine accepts a
// wider range so scripts can ask for more.
const (
	DefaultWidth = 120
	MinWidth     = 1
	MaxWidth     = 1000

	// MaxKeepOriginalWidth is the widest "keep original size" output.
	MaxKeepOriginalWidth = 400

	// CellAspect is how much shorter than wide a character cell looks: rows
	// are scaled by this so pictures keep their proportions.
	CellAspect = 0.55

	// HalftoneScale: halftone dots are single cells, so it renders at this
	// many times the width.
	HalftoneScale = 3
)

// Options is everything that decides what the art looks like.
type Options struct {
	Width        int
	Charset      string // "detailed", "blocks" or "custom"
	CustomChars  string // the ramp for Charset "custom", dark to light
	ColorScheme  string
	Brightness   int // -100..100
	Contrast     int // 0..200, 100 leaves it alone
	Invert       bool
	Dither       bool   // black and white halftone instead of a character ramp
	Ratio        string // "16:9" and so on; empty keeps the picture's own
	KeepOriginal bool   // native size, up to MaxKeepOriginalWidth
}

// DefaultOptions are what the app starts with.
func DefaultOptions() Options {
	return Options{
		Width:       DefaultWidth,
		Charset:     "detailed",
		CustomChars: "@%#*+=-:. ",
		ColorScheme: "original",
		Contrast:    100,
	}
}

// Valid names, in the order the app lists them.
var (
	Charsets     = []string{"detailed", "blocks", "custom"}
	ColorSchemes = []string{"original", "grayscale", "sepia", "blue", "green", "red", "purple", "cyan"}
	Ratios       = []string{"", "16:9", "4:3", "1:1", "9:16"}
)

// Validate reports the first thing wrong with the options, in words meant
// for the person who typed them.
func (o Options) Validate() error {
	if o.Width < MinWidth || o.Width > MaxWidth {
		return fmt.Errorf("width must be between %d and %d, not %d", MinWidth, MaxWidth, o.Width)
	}
	if o.Brightness < -100 || o.Brightness > 100 {
		return fmt.Errorf("brightness must be between -100 and 100, not %d", o.Brightness)
	}
	if o.Contrast < 0 || o.Contrast > 200 {
		return fmt.Errorf("contrast must be between 0 and 200, not %d", o.Contrast)
	}
	if !slices.Contains(Charsets, canonicalCharset(o.Charset)) {
		return fmt.Errorf("unknown character set %q (use %s)", o.Charset, strings.Join(Charsets, ", "))
	}
	if !slices.Contains(ColorSchemes, o.ColorScheme) {
		return fmt.Errorf("unknown color scheme %q (use %s)", o.ColorScheme, strings.Join(ColorSchemes, ", "))
	}
	if _, _, err := ParseRatio(o.Ratio); err != nil {
		return err
	}
	if canonicalCharset(o.Charset) == "custom" {
		if _, err := ParseCustomChars(o.CustomChars); err != nil {
			return err
		}
	}
	return nil
}

// ParseRatio reads "16:9" into its two numbers. An empty ratio (or the app's
// "--") means "the picture's own" and returns zeros.
func ParseRatio(ratio string) (w, h int, err error) {
	if ratio == "" || ratio == "--" {
		return 0, 0, nil
	}
	left, right, found := strings.Cut(ratio, ":")
	w, errW := strconv.Atoi(left)
	h, errH := strconv.Atoi(right)
	if !found || errW != nil || errH != nil || w <= 0 || h <= 0 {
		return 0, 0, fmt.Errorf("ratio must look like 16:9, not %q", ratio)
	}
	return w, h, nil
}
