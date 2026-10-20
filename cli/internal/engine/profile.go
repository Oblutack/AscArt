package engine

import (
	"fmt"
	"io"

	"github.com/charmbracelet/colorprofile"
)

// Profile is how many colors the output can show.
type Profile int

const (
	NoColor   Profile = iota // plain characters
	ANSI16                   // the 16 standard terminal colors
	ANSI256                  // the 256-color palette
	TrueColor                // 24-bit color
)

const ansiReset = "\x1b[0m"

// DetectProfile looks at the output and the environment (COLORTERM, TERM,
// NO_COLOR, whether it is a terminal at all) to see what it can show.
func DetectProfile(output io.Writer, environ []string) Profile {
	return fromColorprofile(colorprofile.Detect(output, environ))
}

// ProfileFromEnv is the same decision from the environment alone, for when
// the output is known to be a terminal.
func ProfileFromEnv(environ []string) Profile {
	return fromColorprofile(colorprofile.Env(environ))
}

func fromColorprofile(profile colorprofile.Profile) Profile {
	switch profile {
	case colorprofile.TrueColor:
		return TrueColor
	case colorprofile.ANSI256:
		return ANSI256
	case colorprofile.ANSI:
		return ANSI16
	default:
		return NoColor
	}
}

// ParseProfile reads a --colors flag value.
func ParseProfile(name string) (Profile, error) {
	switch name {
	case "truecolor", "24bit", "true":
		return TrueColor, nil
	case "256":
		return ANSI256, nil
	case "16", "ansi":
		return ANSI16, nil
	case "none", "off", "mono":
		return NoColor, nil
	}
	return NoColor, fmt.Errorf("unknown color mode %q (use truecolor, 256, 16 or none)", name)
}

// The 16 standard terminal colors (xterm's values).
var ansi16 = [16]RGB{
	{0, 0, 0}, {205, 0, 0}, {0, 205, 0}, {205, 205, 0},
	{0, 0, 238}, {205, 0, 205}, {0, 205, 205}, {229, 229, 229},
	{127, 127, 127}, {255, 0, 0}, {0, 255, 0}, {255, 255, 0},
	{92, 92, 255}, {255, 0, 255}, {0, 255, 255}, {255, 255, 255},
}

// The six levels of each channel in the 256-color cube.
var cubeLevels = [6]int{0, 95, 135, 175, 215, 255}

func distance(a, b RGB) int {
	dr, dg, db := int(a.R)-int(b.R), int(a.G)-int(b.G), int(a.B)-int(b.B)
	return dr*dr + dg*dg + db*db
}

// nearest256 is the closest entry of the 256-color palette: the best match in
// the 6x6x6 cube or in the 24-step gray ramp, whichever is closer.
func nearest256(c RGB) int {
	level := func(v uint8) int {
		best, bestDistance := 0, 1<<30
		for i, l := range cubeLevels {
			d := (int(v) - l) * (int(v) - l)
			if d < bestDistance {
				best, bestDistance = i, d
			}
		}
		return best
	}
	ri, gi, bi := level(c.R), level(c.G), level(c.B)
	cube := RGB{uint8(cubeLevels[ri]), uint8(cubeLevels[gi]), uint8(cubeLevels[bi])}
	cubeIndex := 16 + 36*ri + 6*gi + bi

	average := (int(c.R) + int(c.G) + int(c.B)) / 3
	step := (average - 8 + 5) / 10 // nearest of 8, 18, 28, ... 238
	step = max(0, min(23, step))
	gray := uint8(8 + 10*step)
	grayColor := RGB{gray, gray, gray}

	if distance(c, grayColor) < distance(c, cube) {
		return 232 + step
	}
	return cubeIndex
}

func nearest16(c RGB) int {
	best, bestDistance := 0, 1<<30
	for i, candidate := range ansi16 {
		if d := distance(c, candidate); d < bestDistance {
			best, bestDistance = i, d
		}
	}
	return best
}

// foreground is the escape code that sets the text color.
func foreground(profile Profile, c RGB) string {
	switch profile {
	case TrueColor:
		return fmt.Sprintf("\x1b[38;2;%d;%d;%dm", c.R, c.G, c.B)
	case ANSI256:
		return fmt.Sprintf("\x1b[38;5;%dm", nearest256(c))
	case ANSI16:
		index := nearest16(c)
		if index < 8 {
			return fmt.Sprintf("\x1b[%dm", 30+index)
		}
		return fmt.Sprintf("\x1b[%dm", 90+index-8)
	}
	return ""
}
