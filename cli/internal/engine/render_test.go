package engine

import (
	"image"
	"strings"
	"testing"
)

const esc = "\x1b"

// twoRows is a small colored grid used by several tests:
//
//	row 0: "@@#" red red blue
//	row 1: "% ." green, then two blanks, then a dot
func twoRows() *Grid {
	red, blue, green := RGB{255, 0, 0}, RGB{0, 0, 255}, RGB{0, 255, 0}
	g := NewGrid(3, 2, true)
	g.Set(0, 0, '@', red)
	g.Set(1, 0, '@', red)
	g.Set(2, 0, '#', blue)
	g.Set(0, 1, '%', green)
	g.Set(1, 1, ' ', green)
	g.Set(2, 1, '.', green)
	return g
}

func TestToText(t *testing.T) {
	if got := twoRows().ToText(); got != "@@#\n% ." {
		t.Errorf("got %q", got)
	}
}

func TestToHTMLMergesRunsAndLeavesBlanksBare(t *testing.T) {
	got := twoRows().ToHTML()
	want := `<span style="color:rgb(255,0,0)">@@</span><span style="color:rgb(0,0,255)">#</span>` + "\n" +
		`<span style="color:rgb(0,255,0)">% .</span>`
	if got != want {
		t.Errorf("got\n%s\nwant\n%s", got, want)
	}
}

func TestToHTMLLeavesAllBlankRunsWithoutASpan(t *testing.T) {
	g := NewGrid(4, 1, true)
	g.Set(0, 0, '@', RGB{1, 2, 3})
	g.Set(1, 0, ' ', RGB{9, 9, 9}) // a different color, but only blanks
	g.Set(2, 0, ' ', RGB{9, 9, 9})
	g.Set(3, 0, '@', RGB{1, 2, 3})

	want := `<span style="color:rgb(1,2,3)">@</span>  <span style="color:rgb(1,2,3)">@</span>`
	if got := g.ToHTML(); got != want {
		t.Errorf("got %s", got)
	}
}

func TestToHTMLEscapesMarkupCharacters(t *testing.T) {
	g := NewGrid(3, 1, true)
	for x, r := range "<&>" {
		g.Set(x, 0, r, RGB{1, 1, 1})
	}
	if got := g.ToHTML(); !strings.Contains(got, "&lt;&amp;&gt;") || strings.Contains(got, "<&>") {
		t.Errorf("got %s", got)
	}
}

func TestUncoloredArtIsPlainText(t *testing.T) {
	g := NewGrid(3, 1, false)
	g.Set(0, 0, '█', RGB{})
	g.Set(2, 0, '<', RGB{})

	if got := g.ToHTML(); got != "█ &lt;" {
		t.Errorf("html: %q", got)
	}
	if got := g.ToANSI(TrueColor); got != "█ <" {
		t.Errorf("ansi: %q (no colors, no escape codes)", got)
	}
}

func TestToANSITrueColorWritesACodePerRunAndResetsEveryLine(t *testing.T) {
	want := esc + "[38;2;255;0;0m@@" + esc + "[38;2;0;0;255m#" + esc + "[0m" + "\n" +
		esc + "[38;2;0;255;0m% ." + esc + "[0m"
	if got := twoRows().ToANSI(TrueColor); got != want {
		t.Errorf("got %q\nwant %q", got, want)
	}
}

func TestToANSIWithoutColorIsText(t *testing.T) {
	if got := twoRows().ToANSI(NoColor); got != "@@#\n% ." {
		t.Errorf("got %q", got)
	}
}

func TestToANSIDoesNotRepeatACodeThatRoundsToTheSameColor(t *testing.T) {
	// two nearly equal reds are different runs, but the same entry of the
	// 16-color palette
	g := NewGrid(2, 1, true)
	g.Set(0, 0, '@', RGB{250, 0, 0})
	g.Set(1, 0, '@', RGB{240, 10, 0})

	got := g.ToANSI(ANSI16)
	if strings.Count(got, esc+"[") != 2 { // one color code, one reset
		t.Errorf("expected a single color code, got %q", got)
	}
}

func TestANSI256AndANSI16Codes(t *testing.T) {
	tests := []struct {
		profile Profile
		color   RGB
		want    string
	}{
		{ANSI256, RGB{255, 0, 0}, esc + "[38;5;196m"},
		{ANSI256, RGB{0, 0, 0}, esc + "[38;5;16m"},
		{ANSI256, RGB{255, 255, 255}, esc + "[38;5;231m"},
		{ANSI256, RGB{128, 128, 128}, esc + "[38;5;244m"}, // a gray from the gray ramp
		{ANSI16, RGB{255, 0, 0}, esc + "[91m"},
		{ANSI16, RGB{205, 0, 0}, esc + "[31m"},
		{ANSI16, RGB{0, 0, 0}, esc + "[30m"},
		{ANSI16, RGB{255, 255, 255}, esc + "[97m"},
	}
	for _, test := range tests {
		if got := foreground(test.profile, test.color); got != test.want {
			t.Errorf("profile %d, %v: got %q, want %q", test.profile, test.color, got, test.want)
		}
	}
	if foreground(NoColor, RGB{1, 2, 3}) != "" {
		t.Error("no color means no code")
	}
}

func TestNearestColorsStayInRange(t *testing.T) {
	for r := 0; r < 256; r += 51 {
		for g := 0; g < 256; g += 51 {
			for b := 0; b < 256; b += 51 {
				c := RGB{uint8(r), uint8(g), uint8(b)}
				if n := nearest256(c); n < 16 || n > 255 {
					t.Errorf("nearest256(%v) = %d", c, n)
				}
				if n := nearest16(c); n < 0 || n > 15 {
					t.Errorf("nearest16(%v) = %d", c, n)
				}
			}
		}
	}
}

func TestParseProfile(t *testing.T) {
	good := map[string]Profile{"truecolor": TrueColor, "24bit": TrueColor, "256": ANSI256, "16": ANSI16, "none": NoColor, "off": NoColor}
	for name, want := range good {
		if got, err := ParseProfile(name); err != nil || got != want {
			t.Errorf("ParseProfile(%q) = %v, %v", name, got, err)
		}
	}
	if _, err := ParseProfile("rainbow"); err == nil || !strings.Contains(err.Error(), "truecolor") {
		t.Errorf("an unknown mode should list the choices: %v", err)
	}
}

func TestDetectProfile(t *testing.T) {
	var output strings.Builder // not a terminal
	if got := DetectProfile(&output, []string{"COLORTERM=truecolor", "TERM=xterm"}); got != NoColor {
		t.Errorf("output that isn't a terminal gets no color, got %v", got)
	}
}

func TestGridAccessors(t *testing.T) {
	g := NewGrid(2, 2, true)
	g.Set(1, 1, 'x', RGB{1, 2, 3})
	if g.Glyph(1, 1) != 'x' || g.Color(1, 1) != (RGB{1, 2, 3}) || g.Glyph(0, 0) != ' ' {
		t.Error("cells don't hold what was set")
	}
	if NewGrid(2, 2, false).Color(0, 0) != (RGB{}) {
		t.Error("uncolored grids have no color")
	}
	if got := NewGrid(0, 0, true).ToANSI(TrueColor); got != "" {
		t.Errorf("an empty grid is empty, got %q", got)
	}
}

func TestProfileFromEnv(t *testing.T) {
	tests := []struct {
		name string
		env  []string
		want Profile
	}{
		{"truecolor terminal", []string{"TERM=xterm-256color", "COLORTERM=truecolor"}, TrueColor},
		{"24bit terminal", []string{"TERM=xterm-256color", "COLORTERM=24bit"}, TrueColor},
		{"256 colors", []string{"TERM=xterm-256color"}, ANSI256},
		{"plain xterm", []string{"TERM=xterm"}, ANSI16},
		{"NO_COLOR wins", []string{"TERM=xterm-256color", "COLORTERM=truecolor", "NO_COLOR=1"}, NoColor},
		{"a dumb terminal has no color", []string{"TERM=dumb"}, NoColor},
	}
	for _, test := range tests {
		if got := ProfileFromEnv(test.env); got != test.want {
			t.Errorf("%s: got %v, want %v", test.name, got, test.want)
		}
	}

	// CLICOLOR_FORCE turns color on even for a dumb terminal (how much color
	// is up to the library, so only check that it is on)
	if got := ProfileFromEnv([]string{"TERM=dumb", "CLICOLOR_FORCE=1"}); got == NoColor {
		t.Error("forcing color should override TERM=dumb")
	}
}

func TestParseFormatAndFormatForFile(t *testing.T) {
	for name, want := range map[string]Format{"ansi": FormatANSI, "ANS": FormatANSI, "text": FormatText, "txt": FormatText, "plain": FormatText, "html": FormatHTML} {
		if got, err := ParseFormat(name); err != nil || got != want {
			t.Errorf("ParseFormat(%q) = %v, %v", name, got, err)
		}
	}
	if _, err := ParseFormat("pdf"); err == nil || !strings.Contains(err.Error(), "ansi, text or html") {
		t.Errorf("got %v", err)
	}

	for path, want := range map[string]Format{"a.html": FormatHTML, "A.HTM": FormatHTML, "a.txt": FormatText, "dir.x/a.ans": FormatANSI, "a.ansi": FormatANSI} {
		if got, ok := FormatForFile(path); !ok || got != want {
			t.Errorf("FormatForFile(%q) = %v, %v", path, got, ok)
		}
	}
	for _, path := range []string{"a", "a.png", "", "html"} {
		if _, ok := FormatForFile(path); ok {
			t.Errorf("FormatForFile(%q) should not recognise it", path)
		}
	}
}

func TestExport(t *testing.T) {
	g := twoRows()
	if got := g.Export(FormatText, TrueColor); got != g.ToText() {
		t.Error("text")
	}
	if got := g.Export(FormatANSI, ANSI16); got != g.ToANSI(ANSI16) {
		t.Error("ansi")
	}
	page := g.Export(FormatHTML, NoColor)
	for _, want := range []string{"<!DOCTYPE html>", "<pre>", g.ToHTML(), "</html>"} {
		if !strings.Contains(page, want) {
			t.Errorf("the page lacks %q", want)
		}
	}
}

func TestHalfBlocksFitTheBoxAndKeepProportions(t *testing.T) {
	tests := []struct {
		name             string
		w, h             int
		maxCols, maxRows int
		wantCols         int
		wantRows         int
	}{
		{"fits already", 10, 10, 40, 40, 10, 5},
		{"too wide (25 pixel rows is 13 cells)", 200, 100, 50, 40, 50, 13},
		{"too tall", 100, 200, 40, 10, 10, 10},
		{"odd heights round up to whole cells", 20, 5, 40, 40, 20, 3},
	}
	for _, test := range tests {
		art, cols, rows := HalfBlocks(solid(test.w, test.h, opaque(10, 20, 30)), test.maxCols, test.maxRows)
		if cols != test.wantCols || rows != test.wantRows {
			t.Errorf("%s: %dx%d, want %dx%d", test.name, cols, rows, test.wantCols, test.wantRows)
		}
		if cols > test.maxCols || rows > test.maxRows {
			t.Errorf("%s: %dx%d is outside %dx%d", test.name, cols, rows, test.maxCols, test.maxRows)
		}
		lines := strings.Split(art, "\n")
		if len(lines) != rows || strings.Count(lines[0], "▀") != cols {
			t.Errorf("%s: art has %d lines, %d cells in the first", test.name, len(lines), strings.Count(lines[0], "▀"))
		}
	}
}

func TestHalfBlocksPutTheTopPixelInTheTextColorAndTheBottomInTheBackground(t *testing.T) {
	img := solid(1, 2, opaque(0, 0, 0))
	img.SetNRGBA(0, 0, opaque(255, 0, 0))
	img.SetNRGBA(0, 1, opaque(0, 0, 255))

	art, cols, rows := HalfBlocks(img, 10, 10)
	want := esc + "[38;2;255;0;0;48;2;0;0;255m▀" + esc + "[0m"
	if art != want || cols != 1 || rows != 1 {
		t.Errorf("got %q (%dx%d), want %q", art, cols, rows, want)
	}
}

func TestHalfBlocksOfNothing(t *testing.T) {
	for _, args := range [][2]int{{0, 5}, {5, 0}, {-1, 5}} {
		if art, c, r := HalfBlocks(solid(4, 4, opaque(1, 1, 1)), args[0], args[1]); art != "" || c != 0 || r != 0 {
			t.Errorf("box %v: %q %d %d", args, art, c, r)
		}
	}
	if art, _, _ := HalfBlocks(image.NewNRGBA(image.Rect(0, 0, 0, 0)), 5, 5); art != "" {
		t.Error("an empty picture draws nothing")
	}
}
