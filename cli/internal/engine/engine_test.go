package engine

import (
	"context"
	"errors"
	"image"
	"image/color"
	"strings"
	"testing"
)

// solid makes a w x h picture of one color.
func solid(w, h int, c color.NRGBA) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for i := 0; i < len(img.Pix); i += 4 {
		img.Pix[i], img.Pix[i+1], img.Pix[i+2], img.Pix[i+3] = c.R, c.G, c.B, c.A
	}
	return img
}

func opaque(r, g, b uint8) color.NRGBA { return color.NRGBA{r, g, b, 255} }

func options(change func(*Options)) Options {
	o := DefaultOptions()
	if change != nil {
		change(&o)
	}
	return o
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name   string
		change func(*Options)
		want   string // empty: valid
	}{
		{"defaults", nil, ""},
		{"width too small", func(o *Options) { o.Width = 0 }, "width"},
		{"width too large", func(o *Options) { o.Width = MaxWidth + 1 }, "width"},
		{"brightness out of range", func(o *Options) { o.Brightness = 101 }, "brightness"},
		{"contrast out of range", func(o *Options) { o.Contrast = -1 }, "contrast"},
		{"unknown charset", func(o *Options) { o.Charset = "fancy" }, "character set"},
		{"old charset names still work", func(o *Options) { o.Charset = "simple" }, ""},
		{"unknown scheme", func(o *Options) { o.ColorScheme = "neon" }, "color scheme"},
		{"bad ratio", func(o *Options) { o.Ratio = "wide" }, "ratio"},
		{"zero ratio", func(o *Options) { o.Ratio = "0:9" }, "ratio"},
		{"good ratio", func(o *Options) { o.Ratio = "16:9" }, ""},
		{"the app's no-ratio", func(o *Options) { o.Ratio = "--" }, ""},
		{"custom ramp too short", func(o *Options) { o.Charset = "custom"; o.CustomChars = "x" }, "at least 2"},
		{"custom ramp fine", func(o *Options) { o.Charset = "custom"; o.CustomChars = "#." }, ""},
		{"a bad custom ramp is ignored for other sets", func(o *Options) { o.CustomChars = "x" }, ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := options(test.change).Validate()
			switch {
			case test.want == "" && err != nil:
				t.Errorf("unexpected error: %v", err)
			case test.want != "" && err == nil:
				t.Errorf("expected an error mentioning %q", test.want)
			case test.want != "" && !strings.Contains(err.Error(), test.want):
				t.Errorf("error %q should mention %q", err, test.want)
			}
		})
	}
}

func TestParseRatio(t *testing.T) {
	for ratio, want := range map[string][2]int{"": {0, 0}, "--": {0, 0}, "16:9": {16, 9}, "1:1": {1, 1}} {
		w, h, err := ParseRatio(ratio)
		if err != nil || w != want[0] || h != want[1] {
			t.Errorf("ParseRatio(%q) = %d, %d, %v; want %v", ratio, w, h, err, want)
		}
	}
	for _, bad := range []string{"16", "a:b", "16:", ":9", "-1:2", "1:2:3"} {
		if _, _, err := ParseRatio(bad); err == nil {
			t.Errorf("ParseRatio(%q) should fail", bad)
		}
	}
}

func TestCustomChars(t *testing.T) {
	good := []string{"#.", "@%#*+=-:. ", "█▓▒░ ", "ab", "o ", "·•", strings.Repeat("a", 100)}
	for _, text := range good {
		if _, err := ParseCustomChars(text); err != nil {
			t.Errorf("%q should be accepted: %v", text, err)
		}
	}

	bad := map[string]string{
		"":                       "at least 2",
		"x":                      "at least 2",
		strings.Repeat("a", 101): "at most 100",
		"ab漢":                    "single-width",
		"abＡ":                    "single-width",
		"ab😀":                    "single-width",
		"a\nb":                   "single-width",
		"a\tb":                   "single-width",
		"ab\x00":                 "single-width",
		"abé":                   "single-width",
	}
	for text, want := range bad {
		_, err := ParseCustomChars(text)
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("%q: got %v, want an error mentioning %q", text, err, want)
		}
	}

	if _, err := ParseCustomChars("ab漢"); err == nil || !strings.Contains(err.Error(), "漢") {
		t.Errorf("the message should name the character: %v", err)
	}
}

func TestRamp(t *testing.T) {
	cases := map[string]string{
		"detailed": "@%#*+=-:. ",
		"standard": "@%#*+=-:. ",
		"blocks":   "█▓▒░ ",
		"simple":   "█▓▒░ ",
		"unknown":  "@%#*+=-:. ", // falls back, like the Python engine
	}
	for name, want := range cases {
		ramp, err := Ramp(Options{Charset: name})
		if err != nil || string(ramp) != want {
			t.Errorf("Ramp(%q) = %q, %v; want %q", name, string(ramp), err, want)
		}
	}
	if ramp, _ := Ramp(Options{Charset: "custom", CustomChars: "XYZ"}); string(ramp) != "XYZ" {
		t.Errorf("custom ramp = %q", string(ramp))
	}
	if _, err := Ramp(Options{Charset: "custom"}); err == nil {
		t.Error("a custom set without characters should fail")
	}
}

func TestColorSchemes(t *testing.T) {
	white := RGB{255, 255, 255}
	red := RGB{255, 0, 0}

	tests := []struct {
		scheme string
		in     RGB
		want   RGB
	}{
		{"original", red, red},
		{"nonsense", red, red},
		{"grayscale", red, RGB{76, 76, 76}},
		{"grayscale", white, white},
		{"sepia", white, RGB{255, 255, 238}},
		{"blue", white, RGB{85, 127, 255}},
		{"green", white, RGB{85, 255, 127}},
		{"red", white, RGB{255, 85, 85}},
		{"purple", white, RGB{255, 85, 255}},
		{"cyan", white, RGB{85, 255, 255}},
	}
	for _, test := range tests {
		if got := ApplyScheme(test.in, test.scheme); got != test.want {
			t.Errorf("%s of %v = %v, want %v", test.scheme, test.in, got, test.want)
		}
	}
}

func TestQuantize(t *testing.T) {
	tests := []struct{ in, want RGB }{
		{RGB{0, 0, 0}, RGB{0, 0, 0}},
		{RGB{3, 4, 5}, RGB{0, 8, 8}},
		{RGB{255, 254, 252}, RGB{255, 255, 255}},
		{RGB{200, 60, 60}, RGB{200, 64, 64}},
	}
	for _, test := range tests {
		if got := Quantize(test.in); got != test.want {
			t.Errorf("Quantize(%v) = %v, want %v", test.in, got, test.want)
		}
	}
}

func TestLuma(t *testing.T) {
	// Pillow's integer RGB -> L
	cases := map[[3]uint8]uint8{{0, 0, 0}: 0, {255, 255, 255}: 255, {255, 0, 0}: 76, {0, 255, 0}: 150, {0, 0, 255}: 29}
	for in, want := range cases {
		if got := luma(in[0], in[1], in[2]); got != want {
			t.Errorf("luma%v = %d, want %d", in, got, want)
		}
	}
}

func TestOutputSize(t *testing.T) {
	tests := []struct {
		name         string
		w, h         int
		change       func(*Options)
		wantW, wantH int
	}{
		{"keeps the picture's proportions (character cells are taller)", 100, 50, func(o *Options) { o.Width = 20 }, 20, 5},
		{"a ratio replaces them", 100, 50, func(o *Options) { o.Width = 20; o.Ratio = "1:1" }, 20, 11},
		{"the app's no-ratio changes nothing", 100, 50, func(o *Options) { o.Width = 20; o.Ratio = "--" }, 20, 5},
		{"always at least one row", 4000, 10, func(o *Options) { o.Width = 20 }, 20, 1},
		{"halftone is three times wider", 100, 50, func(o *Options) { o.Width = 10; o.Dither = true }, 30, 8},
		{"keep original is capped", 2000, 1000, func(o *Options) { o.Width = 50; o.KeepOriginal = true }, 400, 110},
		{"keep original leaves small pictures alone", 100, 50, func(o *Options) { o.Width = 50; o.KeepOriginal = true }, 100, 27},
		{"keep original ignores the ratio", 100, 50, func(o *Options) { o.KeepOriginal = true; o.Ratio = "1:1" }, 100, 27},
	}
	for _, test := range tests {
		w, h := outputSize(test.w, test.h, options(test.change))
		if w != test.wantW || h != test.wantH {
			t.Errorf("%s: %dx%d, want %dx%d", test.name, w, h, test.wantW, test.wantH)
		}
	}
}

func TestConvertMapsBrightnessToCharacters(t *testing.T) {
	custom := options(func(o *Options) { o.Width = 10; o.Charset = "custom"; o.CustomChars = "XYZ" })

	for _, test := range []struct {
		pixel color.NRGBA
		want  string
	}{
		{opaque(0, 0, 0), "X"},
		{opaque(128, 128, 128), "Y"},
		{opaque(255, 255, 255), "Z"},
	} {
		grid, err := Convert(solid(40, 40, test.pixel), custom)
		if err != nil {
			t.Fatal(err)
		}
		if text := strings.ReplaceAll(grid.ToText(), "\n", ""); text != strings.Repeat(test.want, grid.Cols*grid.Rows) {
			t.Errorf("pixel %v: got %q, want all %q", test.pixel, text[:min(10, len(text))], test.want)
		}
	}
}

func TestConvertFlattensTransparencyOntoWhite(t *testing.T) {
	grid, err := Convert(solid(20, 20, color.NRGBA{0, 0, 0, 0}), options(func(o *Options) { o.Width = 10 }))
	if err != nil {
		t.Fatal(err)
	}
	// white is the lightest character, a space
	if text := strings.ReplaceAll(grid.ToText(), "\n", ""); strings.Trim(text, " ") != "" {
		t.Errorf("a transparent picture should be blank, got %q", text)
	}
}

func TestConvertAppliesAdjustmentsBeforeShrinking(t *testing.T) {
	base := options(func(o *Options) { o.Width = 10; o.Charset = "custom"; o.CustomChars = "XYZ" })

	invertedOpts := base
	invertedOpts.Invert = true
	inverted, _ := Convert(solid(40, 40, opaque(0, 0, 0)), invertedOpts)
	if !strings.Contains(inverted.ToText(), "Z") || strings.Contains(inverted.ToText(), "X") {
		t.Errorf("inverting black should give the lightest character: %q", inverted.ToText()[:10])
	}

	brighterOpts := base
	brighterOpts.Brightness = 100
	brighter, _ := Convert(solid(40, 40, opaque(128, 128, 128)), brighterOpts)
	if !strings.Contains(brighter.ToText(), "Z") {
		t.Errorf("full brightness on mid gray should give the lightest character: %q", brighter.ToText()[:10])
	}
}

func TestConvertRejectsBadOptionsAndEmptyPictures(t *testing.T) {
	if _, err := Convert(solid(10, 10, opaque(1, 1, 1)), options(func(o *Options) { o.Width = 0 })); err == nil {
		t.Error("bad options should fail")
	}
	if _, err := Convert(image.NewNRGBA(image.Rect(0, 0, 0, 0)), DefaultOptions()); err == nil {
		t.Error("an empty picture should fail")
	}
}

func TestSpacesTakeTheColorBeforeThem(t *testing.T) {
	// a picture of light then dark halves: the blank cells (light) are
	// colored like the last visible cell, so the row stays two runs
	img := solid(40, 20, opaque(255, 255, 255))
	for y := range 20 {
		for x := 20; x < 40; x++ {
			img.SetNRGBA(x, y, opaque(10, 10, 10))
		}
	}
	grid, err := Convert(img, options(func(o *Options) { o.Width = 20 }))
	if err != nil {
		t.Fatal(err)
	}
	first := strings.Split(grid.ToHTML(), "\n")[0]
	if strings.Count(first, "<span") != 1 {
		t.Errorf("expected one colored run in %q", first)
	}
}

func TestConvertFramesReportsProgressAndConvertsEveryFrame(t *testing.T) {
	frames := []Frame{
		{Image: solid(40, 20, opaque(0, 0, 0))},
		{Image: solid(40, 20, opaque(255, 255, 255))},
		{Image: solid(40, 20, opaque(128, 128, 128))},
	}
	o := options(func(o *Options) { o.Width = 10; o.Charset = "custom"; o.CustomChars = "XYZ" })

	var seen [][2]int
	grids, err := ConvertFrames(t.Context(), frames, o, func(done, total int) { seen = append(seen, [2]int{done, total}) })
	if err != nil {
		t.Fatal(err)
	}

	if len(grids) != 3 {
		t.Fatalf("got %d grids", len(grids))
	}
	for i, want := range []string{"X", "Z", "Y"} {
		if first := grids[i].ToText()[:1]; first != want {
			t.Errorf("frame %d starts with %q, want %q", i, first, want)
		}
	}
	if len(seen) != 3 || seen[0] != [2]int{1, 3} || seen[2] != [2]int{3, 3} {
		t.Errorf("progress was %v", seen)
	}
}

func TestConvertFramesStopsWhenCancelled(t *testing.T) {
	frames := make([]Frame, 5)
	for i := range frames {
		frames[i] = Frame{Image: solid(20, 20, opaque(1, 2, 3))}
	}
	ctx, cancel := context.WithCancel(t.Context())

	var done int
	_, err := ConvertFrames(ctx, frames, options(func(o *Options) { o.Width = 5 }), func(d, _ int) {
		done = d
		if d == 2 {
			cancel()
		}
	})

	if err == nil || !errors.Is(err, context.Canceled) {
		t.Errorf("got %v, want context.Canceled", err)
	}
	if done != 2 {
		t.Errorf("it should stop right after the cancel, but got to frame %d", done)
	}
}

func TestConvertFramesRejectsBadOptionsBeforeStarting(t *testing.T) {
	if _, err := ConvertFrames(t.Context(), []Frame{{Image: solid(2, 2, opaque(1, 1, 1))}}, Options{}, nil); err == nil {
		t.Error("zero options should be rejected")
	}
}
