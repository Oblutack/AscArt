package engine

// RGB is one cell's color.
type RGB struct{ R, G, B uint8 }

// colorStep: colors are rounded to multiples of this so neighbouring cells
// share one run of output. Eight is invisible at terminal sizes.
const colorStep = 8

// tintDivisors darken each channel of the luminance for the single-hue
// schemes: (r, g, b) are luminance / divisor.
var tintDivisors = map[string][3]int{
	"blue":   {3, 2, 1},
	"green":  {3, 1, 2},
	"red":    {1, 3, 3},
	"purple": {1, 3, 1},
	"cyan":   {3, 1, 1},
}

func clamp255(value int) uint8 {
	if value > 255 {
		return 255
	}
	if value < 0 {
		return 0
	}
	return uint8(value)
}

// ApplyScheme recolors one cell. The formulas (and the truncating integer
// conversion) are the same as the Python engine's.
func ApplyScheme(c RGB, scheme string) RGB {
	r, g, b := float64(c.R), float64(c.G), float64(c.B)

	switch scheme {
	case "sepia":
		return RGB{
			clamp255(int(0.393*r + 0.769*g + 0.189*b)),
			clamp255(int(0.349*r + 0.686*g + 0.168*b)),
			clamp255(int(0.272*r + 0.534*g + 0.131*b)),
		}
	case "grayscale":
		gray := clamp255(int(0.299*r + 0.587*g + 0.114*b))
		return RGB{gray, gray, gray}
	}

	if divisors, ok := tintDivisors[scheme]; ok {
		gray := int(0.299*r + 0.587*g + 0.114*b)
		return RGB{
			clamp255(gray / divisors[0]),
			clamp255(gray / divisors[1]),
			clamp255(gray / divisors[2]),
		}
	}
	return c // "original" and anything unknown
}

// Quantize rounds each channel to the nearest multiple of colorStep.
func Quantize(c RGB) RGB {
	round := func(v uint8) uint8 {
		stepped := (int(v) + colorStep/2) / colorStep * colorStep
		return clamp255(stepped)
	}
	return RGB{round(c.R), round(c.G), round(c.B)}
}

// luma is Pillow's integer RGB -> L conversion, so brightness (and with it
// the character chosen) matches the Python engine.
func luma(r, g, b uint8) uint8 {
	return uint8((int(r)*19595 + int(g)*38470 + int(b)*7471 + 0x8000) >> 16)
}
