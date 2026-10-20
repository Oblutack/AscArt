package engine

import (
	"encoding/json"
	"html"
	"image"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

// These tests check the Go engine against the Python one. The expected output
// in testdata/golden was produced by python/core (see testdata/make_golden.py).
// Flat-color pictures must match exactly; pictures with detail are resampled
// slightly differently (Python uses Lanczos, Go averages areas), so they only
// have to be very close.

type goldenCase struct {
	Case    string         `json:"case"`
	Fixture string         `json:"fixture"`
	Options map[string]any `json:"options"`
	Cols    int            `json:"cols"`
	Rows    int            `json:"rows"`
}

func loadGoldenCases(t *testing.T) []goldenCase {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "testdata", "golden.json"))
	if err != nil {
		t.Fatal(err)
	}
	var cases []goldenCase
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	return cases
}

// optionsFrom translates the app's option names (as Python receives them).
func optionsFrom(t *testing.T, python map[string]any) Options {
	t.Helper()
	o := DefaultOptions()
	for key, value := range python {
		switch key {
		case "width":
			o.Width = int(value.(float64))
		case "charset":
			o.Charset = value.(string)
		case "customChars":
			o.CustomChars = value.(string)
		case "colorScheme":
			o.ColorScheme = value.(string)
		case "brightness":
			o.Brightness = int(value.(float64))
		case "contrast":
			o.Contrast = int(value.(float64))
		case "invert":
			o.Invert = value.(bool)
		case "dither":
			o.Dither = value.(bool)
		case "ratio":
			o.Ratio = value.(string)
		case "keepOriginal":
			o.KeepOriginal = value.(bool)
		default:
			t.Fatalf("unknown option %q in golden.json", key)
		}
	}
	return o
}

func loadFixture(t *testing.T, name string) image.Image {
	t.Helper()
	file, err := os.Open(filepath.Join("..", "..", "testdata", name+".png"))
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	img, _, err := image.Decode(file)
	if err != nil {
		t.Fatal(err)
	}
	return img
}

type cell struct {
	glyph rune
	color RGB
}

var spanPattern = regexp.MustCompile(`<span style="color:rgb\((\d+),(\d+),(\d+)\)">([^<]*)</span>`)

// parseHTML reads the app's art markup back into rows of cells.
func parseHTML(markup string) [][]cell {
	var rows [][]cell
	for _, line := range strings.Split(markup, "\n") {
		var row []cell
		position := 0
		for _, match := range spanPattern.FindAllStringSubmatchIndex(line, -1) {
			for _, r := range html.UnescapeString(line[position:match[0]]) {
				row = append(row, cell{glyph: r})
			}
			channel := func(i int) uint8 {
				v, _ := strconv.Atoi(line[match[2*i]:match[2*i+1]])
				return uint8(v)
			}
			color := RGB{channel(1), channel(2), channel(3)}
			for _, r := range html.UnescapeString(line[match[8]:match[9]]) {
				row = append(row, cell{glyph: r, color: color})
			}
			position = match[1]
		}
		for _, r := range html.UnescapeString(line[position:]) {
			row = append(row, cell{glyph: r})
		}
		rows = append(rows, row)
	}
	return rows
}

func readGolden(t *testing.T, name, extension string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "testdata", "golden", name+extension))
	if err != nil {
		t.Fatal(err)
	}
	// belt and braces next to .gitattributes: tolerate a checkout that
	// converted line endings
	return strings.ReplaceAll(string(data), "\r\n", "\n")
}

// Halftone cases can't match bit for bit: Pillow and this engine both dither
// with Floyd-Steinberg but scan and round a little differently.
func isHalftone(c goldenCase) bool {
	dither, _ := c.Options["dither"].(bool)
	return dither
}

func TestParityExactForFlatPictures(t *testing.T) {
	for _, c := range loadGoldenCases(t) {
		if !strings.HasPrefix(c.Fixture, "flat_") || isHalftone(c) {
			continue
		}
		t.Run(c.Case, func(t *testing.T) {
			grid, err := Convert(loadFixture(t, c.Fixture), optionsFrom(t, c.Options))
			if err != nil {
				t.Fatal(err)
			}

			if grid.Cols != c.Cols || grid.Rows != c.Rows {
				t.Fatalf("size %dx%d, Python made %dx%d", grid.Cols, grid.Rows, c.Cols, c.Rows)
			}
			if got, want := grid.ToText(), readGolden(t, c.Case, ".txt"); got != want {
				t.Errorf("characters differ\n got: %q\nwant: %q", firstLine(got), firstLine(want))
			}
			if got, want := grid.ToHTML(), readGolden(t, c.Case, ".html"); got != want {
				t.Errorf("html differs\n got: %q\nwant: %q", firstLine(got), firstLine(want))
			}
		})
	}
}

func firstLine(s string) string {
	line, _, _ := strings.Cut(s, "\n")
	return line
}

func TestParityCloseForPicturesWithDetail(t *testing.T) {
	for _, c := range loadGoldenCases(t) {
		if strings.HasPrefix(c.Fixture, "flat_") || isHalftone(c) {
			continue
		}
		t.Run(c.Case, func(t *testing.T) {
			grid, err := Convert(loadFixture(t, c.Fixture), optionsFrom(t, c.Options))
			if err != nil {
				t.Fatal(err)
			}
			if grid.Cols != c.Cols || grid.Rows != c.Rows {
				t.Fatalf("size %dx%d, Python made %dx%d", grid.Cols, grid.Rows, c.Cols, c.Rows)
			}

			want := parseHTML(readGolden(t, c.Case, ".html"))
			var same, total, farColors int
			for y := range grid.Rows {
				for x := range grid.Cols {
					total++
					expected := want[y][x]
					if grid.Glyph(x, y) == expected.glyph {
						same++
					}
					if expected.glyph != ' ' && channelDistance(grid.Color(x, y), expected.color) > 40 {
						farColors++
					}
				}
			}

			// Measured: 99.5-100% on smooth pictures, 92.5% on hard stripe edges
			// (Lanczos rings there, area averaging doesn't)
			if agreement := float64(same) / float64(total); agreement < 0.90 {
				t.Errorf("only %.0f%% of the characters agree with Python (want at least 90%%)", agreement*100)
			}
			if far := float64(farColors) / float64(total); far > 0.05 {
				t.Errorf("%.0f%% of the colors are far from Python's (want under 5%%)", far*100)
			}
		})
	}
}

func TestParityHalftoneHasTheSameSizeAndAboutTheSameCoverage(t *testing.T) {
	checked := 0
	for _, c := range loadGoldenCases(t) {
		if !isHalftone(c) {
			continue
		}
		checked++
		t.Run(c.Case, func(t *testing.T) {
			grid, err := Convert(loadFixture(t, c.Fixture), optionsFrom(t, c.Options))
			if err != nil {
				t.Fatal(err)
			}
			if grid.Cols != c.Cols || grid.Rows != c.Rows {
				t.Fatalf("size %dx%d, Python made %dx%d", grid.Cols, grid.Rows, c.Cols, c.Rows)
			}

			coverage := func(text string) float64 {
				cells := strings.ReplaceAll(text, "\n", "")
				return float64(strings.Count(cells, "█")) / float64(len([]rune(cells)))
			}
			got := coverage(grid.ToText())
			want := coverage(readGolden(t, c.Case, ".txt"))
			if diff := got - want; diff > 0.10 || diff < -0.10 {
				t.Errorf("black coverage %.0f%%, Python's is %.0f%% (allowed difference 10 points)", got*100, want*100)
			}
		})
	}
	if checked == 0 {
		t.Fatal("no halftone case in golden.json")
	}
}

func channelDistance(a, b RGB) int {
	largest := 0
	for _, d := range []int{int(a.R) - int(b.R), int(a.G) - int(b.G), int(a.B) - int(b.B)} {
		if d < 0 {
			d = -d
		}
		largest = max(largest, d)
	}
	return largest
}

func TestEveryGoldenCaseIsCovered(t *testing.T) {
	// a new case in make_golden.py must be picked up by one of the tests above
	for _, c := range loadGoldenCases(t) {
		if c.Fixture == "" || c.Case == "" {
			t.Errorf("incomplete case %+v", c)
		}
	}
	if got := len(loadGoldenCases(t)); got < 20 {
		t.Errorf("only %d golden cases", got)
	}
}
