package tui

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

type setting int

const (
	setWidth setting = iota
	setCharset
	setChars
	setScheme
	setBrightness
	setContrast
	setInvert
	setDither
	setRatio
	setKeep
	numSettings
)

var (
	charsets = []string{"detailed", "blocks", "custom"}
	schemes  = []string{"original", "grayscale", "sepia", "blue", "green", "red", "purple", "cyan"}
	ratios   = []string{"--", "1:1", "4:3", "3:2", "16:9", "21:9", "3:4", "9:16"}
)

func (s setting) label() string {
	return [...]string{"Width", "Characters", "Custom set", "Colors", "Brightness", "Contrast", "Invert", "Halftone", "Ratio", "Original size"}[s]
}

// value is how a setting is shown.
func (m *Model) value(s setting) string {
	o := m.opts
	yes := func(b bool) string {
		if b {
			return "on"
		}
		return "off"
	}
	switch s {
	case setWidth:
		return strconv.Itoa(o.Width)
	case setCharset:
		return o.Charset
	case setChars:
		return o.CustomChars
	case setScheme:
		return o.ColorScheme
	case setBrightness:
		return fmt.Sprintf("%+d", o.Brightness)
	case setContrast:
		return strconv.Itoa(o.Contrast)
	case setInvert:
		return yes(o.Invert)
	case setDither:
		return yes(o.Dither)
	case setRatio:
		if o.Ratio == "--" {
			return "picture's own"
		}
		return o.Ratio
	case setKeep:
		return yes(o.KeepOriginal)
	}
	return ""
}

// cycle moves through a list, wrapping around. An unknown current value
// counts as the first entry.
func cycle(list []string, current string, delta int) string {
	i := max(0, slices.Index(list, current))
	return list[((i+delta)%len(list)+len(list))%len(list)]
}

func clamp(value, low, high int) int { return min(max(value, low), high) }

// adjust changes the selected setting by one step in a direction (-1 or +1);
// big steps move ten times as far. It reports whether anything changed.
func (m *Model) adjust(s setting, direction int, big bool) bool {
	before := m.opts
	step := direction
	if big {
		step *= 10
	}
	o := &m.opts

	// brightness and contrast move in fives, or twenty-fives for a big step
	unit := 5
	if big {
		unit = 25
	}

	switch s {
	case setWidth:
		o.Width = clamp(o.Width+step, engine.MinWidth, engine.MaxWidth)
	case setCharset:
		o.Charset = cycle(charsets, o.Charset, direction)
	case setScheme:
		o.ColorScheme = cycle(schemes, o.ColorScheme, direction)
	case setBrightness:
		o.Brightness = clamp(o.Brightness+direction*unit, -100, 100)
	case setContrast:
		o.Contrast = clamp(o.Contrast+direction*unit, 0, 200)
	case setInvert:
		o.Invert = !o.Invert
	case setDither:
		o.Dither = !o.Dither
	case setRatio:
		o.Ratio = cycle(ratios, o.Ratio, direction)
	case setKeep:
		o.KeepOriginal = !o.KeepOriginal
	}
	return m.opts != before
}

// setNumber applies a typed number to the settings that have one.
func (m *Model) setNumber(s setting, text string) error {
	n, err := strconv.Atoi(strings.TrimSpace(text))
	if err != nil {
		return fmt.Errorf("%q is not a number", strings.TrimSpace(text))
	}
	switch s {
	case setWidth:
		if n < engine.MinWidth || n > engine.MaxWidth {
			return fmt.Errorf("width must be between %d and %d", engine.MinWidth, engine.MaxWidth)
		}
		m.opts.Width = n
	case setBrightness:
		if n < -100 || n > 100 {
			return fmt.Errorf("brightness must be between -100 and 100")
		}
		m.opts.Brightness = n
	case setContrast:
		if n < 0 || n > 200 {
			return fmt.Errorf("contrast must be between 0 and 200")
		}
		m.opts.Contrast = n
	}
	return nil
}

func isNumeric(s setting) bool { return s == setWidth || s == setBrightness || s == setContrast }
