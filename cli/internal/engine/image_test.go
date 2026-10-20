package engine

import (
	"context"
	"image"
	"image/color"
	"image/gif"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// ---- resizing --------------------------------------------------------------

func TestAxisWeightsAddUpToOne(t *testing.T) {
	for _, sizes := range [][2]int{{100, 20}, {7, 3}, {3, 7}, {64, 64}, {1000, 1}, {5, 5000}} {
		for i, parts := range axisWeights(sizes[0], sizes[1]) {
			var sum float32
			for _, part := range parts {
				if part.index < 0 || part.index >= sizes[0] {
					t.Fatalf("%v position %d uses source pixel %d", sizes, i, part.index)
				}
				sum += part.weight
			}
			if math.Abs(float64(sum)-1) > 1e-4 {
				t.Fatalf("%v position %d: weights add up to %v", sizes, i, sum)
			}
		}
	}
}

func TestResizeKeepsFlatColors(t *testing.T) {
	out := resizeArea(solid(97, 53, opaque(200, 60, 60)), 11, 5)
	for i := 0; i < len(out.Pix); i += 4 {
		if out.Pix[i] != 200 || out.Pix[i+1] != 60 || out.Pix[i+2] != 60 || out.Pix[i+3] != 255 {
			t.Fatalf("pixel %d changed: %v", i/4, out.Pix[i:i+4])
		}
	}
}

func TestResizeAveragesWhatItCovers(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 4, 1))
	for x, v := range []uint8{0, 100, 200, 100} {
		img.SetNRGBA(x, 0, opaque(v, v, v))
	}

	out := resizeArea(img, 2, 1)

	if got := out.NRGBAAt(0, 0).R; got != 50 {
		t.Errorf("average of 0 and 100 = %d", got)
	}
	if got := out.NRGBAAt(1, 0).R; got != 150 {
		t.Errorf("average of 200 and 100 = %d", got)
	}
}

func TestResizeHandlesFractionalOverlap(t *testing.T) {
	// 3 pixels to 2: the middle one is split between both results
	img := image.NewNRGBA(image.Rect(0, 0, 3, 1))
	for x, v := range []uint8{0, 90, 180} {
		img.SetNRGBA(x, 0, opaque(v, v, v))
	}
	out := resizeArea(img, 2, 1)
	// first: (0*1 + 90*0.5) / 1.5 = 30 ; second: (90*0.5 + 180*1) / 1.5 = 150
	if a, b := out.NRGBAAt(0, 0).R, out.NRGBAAt(1, 0).R; a != 30 || b != 150 {
		t.Errorf("got %d and %d, want 30 and 150", a, b)
	}
}

func TestResizeToTheSameSizeIsTheSameImage(t *testing.T) {
	img := solid(8, 8, opaque(1, 2, 3))
	if resizeArea(img, 8, 8) != img {
		t.Error("same size should not copy")
	}
}

func TestResizeCanEnlarge(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 2, 1))
	img.SetNRGBA(0, 0, opaque(0, 0, 0))
	img.SetNRGBA(1, 0, opaque(200, 200, 200))
	out := resizeArea(img, 4, 2)
	if out.NRGBAAt(0, 0).R != 0 || out.NRGBAAt(3, 1).R != 200 {
		t.Errorf("enlarging should keep the ends: %v %v", out.NRGBAAt(0, 0), out.NRGBAAt(3, 1))
	}
}

// ---- adjustments -----------------------------------------------------------

func TestBrightness(t *testing.T) {
	cases := []struct {
		value int
		in    uint8
		want  uint8
	}{
		{0, 100, 100},
		{50, 100, 150},
		{-50, 100, 50},
		{100, 200, 255}, // clipped
		{-100, 200, 0},
		{100, 100, 200},
	}
	for _, c := range cases {
		img := solid(1, 1, opaque(c.in, c.in, c.in))
		adjustBrightness(img, c.value)
		if got := img.NRGBAAt(0, 0).R; got != c.want {
			t.Errorf("brightness %d of %d = %d, want %d", c.value, c.in, got, c.want)
		}
	}
}

func TestContrastPivotsAroundTheAverage(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 2, 1))
	img.SetNRGBA(0, 0, opaque(100, 100, 100))
	img.SetNRGBA(1, 0, opaque(200, 200, 200)) // average 150

	adjustContrast(img, 200) // twice the distance from 150

	if a, b := img.NRGBAAt(0, 0).R, img.NRGBAAt(1, 0).R; a != 50 || b != 250 {
		t.Errorf("got %d and %d, want 50 and 250", a, b)
	}
}

func TestContrastZeroFlattensToTheAverage(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 2, 1))
	img.SetNRGBA(0, 0, opaque(0, 0, 0))
	img.SetNRGBA(1, 0, opaque(200, 200, 200))
	adjustContrast(img, 0)
	if a, b := img.NRGBAAt(0, 0).R, img.NRGBAAt(1, 0).R; a != 100 || b != 100 {
		t.Errorf("got %d and %d, want both 100", a, b)
	}
}

func TestContrastOfOneHundredLeavesThePictureAlone(t *testing.T) {
	img := solid(2, 2, opaque(10, 20, 30))
	adjustContrast(img, 100)
	if img.NRGBAAt(0, 0) != opaque(10, 20, 30) {
		t.Error("100 should not change anything")
	}
}

func TestInvert(t *testing.T) {
	img := solid(1, 1, opaque(10, 20, 30))
	invert(img)
	if got := img.NRGBAAt(0, 0); got != opaque(245, 235, 225) {
		t.Errorf("got %v", got)
	}
}

// ---- halftone --------------------------------------------------------------

func TestHalftoneOfBlackAndWhite(t *testing.T) {
	if got := halftone(solid(6, 3, opaque(0, 0, 0))).ToText(); got != strings.TrimSuffix(strings.Repeat("██████\n", 3), "\n") {
		t.Errorf("black should be solid, got %q", got)
	}
	if got := halftone(solid(6, 3, opaque(255, 255, 255))).ToText(); strings.Trim(got, " \n") != "" {
		t.Errorf("white should be empty, got %q", got)
	}
}

func TestHalftoneKeepsTheAverageBrightness(t *testing.T) {
	grid := halftone(solid(40, 40, opaque(128, 128, 128)))
	black := strings.Count(grid.ToText(), "█")
	if coverage := float64(black) / float64(grid.Cols*grid.Rows); coverage < 0.4 || coverage > 0.6 {
		t.Errorf("mid gray should be about half black, got %.0f%%", coverage*100)
	}
}

func TestHalftoneOnlyUsesBlocksAndSpaces(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 50, 10))
	for x := range 50 {
		v := uint8(x * 255 / 49)
		for y := range 10 {
			img.SetNRGBA(x, y, opaque(v, v, v))
		}
	}
	text := halftone(img).ToText()
	if strings.Trim(text, "█ \n") != "" {
		t.Errorf("unexpected characters in %q", text)
	}
	// darker on the left than on the right
	left, right := 0, 0
	for _, line := range strings.Split(text, "\n") {
		runes := []rune(line)
		left += strings.Count(string(runes[:25]), "█")
		right += strings.Count(string(runes[25:]), "█")
	}
	if left <= right {
		t.Errorf("the dark side should have more dots: %d vs %d", left, right)
	}
}

// ---- loading ---------------------------------------------------------------

func writeGIF(t *testing.T, path string, g *gif.GIF) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if err := gif.EncodeAll(file, g); err != nil {
		t.Fatal(err)
	}
}

var gifPalette = color.Palette{color.White, color.RGBA{255, 0, 0, 255}, color.RGBA{0, 0, 255, 255}, color.Transparent}

func paletted(bounds image.Rectangle, index uint8) *image.Paletted {
	img := image.NewPaletted(bounds, gifPalette)
	for i := range img.Pix {
		img.Pix[i] = index
	}
	return img
}

func TestLoadGIFComposesFramesAndMapsDelays(t *testing.T) {
	// frame 0 fills the canvas red; frame 1 draws a blue square on top, leaving
	// the rest as it was (GIFs store only what changed)
	path := filepath.Join(t.TempDir(), "anim.gif")
	writeGIF(t, path, &gif.GIF{
		Image:    []*image.Paletted{paletted(image.Rect(0, 0, 8, 8), 1), paletted(image.Rect(0, 0, 4, 4), 2)},
		Delay:    []int{5, 0},
		Disposal: []byte{gif.DisposalNone, gif.DisposalNone},
		Config:   image.Config{Width: 8, Height: 8, ColorModel: gifPalette},
	})

	source, err := LoadSource(t.Context(), path)
	if err != nil {
		t.Fatal(err)
	}

	if !source.Animated || len(source.Frames) != 2 || source.Name != "anim.gif" {
		t.Fatalf("unexpected source %+v", source)
	}
	if source.Frames[0].Delay != 50*time.Millisecond {
		t.Errorf("delay 5 -> %v", source.Frames[0].Delay)
	}
	if source.Frames[1].Delay != 100*time.Millisecond {
		t.Errorf("a delay of 0 shows for 100ms like in browsers, got %v", source.Frames[1].Delay)
	}

	second := source.Frames[1].Image
	if got := second.NRGBAAt(1, 1); got != opaque(0, 0, 255) {
		t.Errorf("the new square should be blue, got %v", got)
	}
	if got := second.NRGBAAt(6, 6); got != opaque(255, 0, 0) {
		t.Errorf("the rest keeps frame 0's red, got %v", got)
	}
}

func TestLoadGIFHonoursDisposal(t *testing.T) {
	// frame 0 draws a blue square with "restore background"; frame 1 draws
	// nothing new, so the square must be gone
	path := filepath.Join(t.TempDir(), "disposal.gif")
	empty := paletted(image.Rect(0, 0, 2, 2), 3) // all transparent
	writeGIF(t, path, &gif.GIF{
		Image:    []*image.Paletted{paletted(image.Rect(0, 0, 4, 4), 2), empty},
		Delay:    []int{10, 10},
		Disposal: []byte{gif.DisposalBackground, gif.DisposalNone},
		Config:   image.Config{Width: 8, Height: 8, ColorModel: gifPalette},
	})

	source, err := LoadSource(t.Context(), path)
	if err != nil {
		t.Fatal(err)
	}
	if got := source.Frames[0].Image.NRGBAAt(1, 1); got != opaque(0, 0, 255) {
		t.Errorf("frame 0 should show the square, got %v", got)
	}
	if got := source.Frames[1].Image.NRGBAAt(1, 1); got != opaque(255, 255, 255) {
		t.Errorf("frame 1: the square was disposed of, got %v", got)
	}
}

func TestLoadGIFRestoresThePreviousCanvas(t *testing.T) {
	path := filepath.Join(t.TempDir(), "previous.gif")
	writeGIF(t, path, &gif.GIF{
		Image: []*image.Paletted{
			paletted(image.Rect(0, 0, 8, 8), 1),
			paletted(image.Rect(0, 0, 4, 4), 2),
			paletted(image.Rect(4, 4, 8, 8), 2),
		},
		Delay:    []int{10, 10, 10},
		Disposal: []byte{gif.DisposalNone, gif.DisposalPrevious, gif.DisposalNone},
		Config:   image.Config{Width: 8, Height: 8, ColorModel: gifPalette},
	})

	source, err := LoadSource(t.Context(), path)
	if err != nil {
		t.Fatal(err)
	}
	third := source.Frames[2].Image
	if got := third.NRGBAAt(1, 1); got != opaque(255, 0, 0) {
		t.Errorf("frame 1's square should have been taken back, got %v", got)
	}
	if got := third.NRGBAAt(5, 5); got != opaque(0, 0, 255) {
		t.Errorf("frame 2's square should show, got %v", got)
	}
}

func TestLoadSourceReadsPictures(t *testing.T) {
	source, err := LoadSource(t.Context(), filepath.Join("..", "..", "testdata", "flat_red.png"))
	if err != nil {
		t.Fatal(err)
	}
	if source.Animated || len(source.Frames) != 1 || source.Name != "flat_red.png" {
		t.Errorf("unexpected source %+v", source)
	}
	if got := source.Frames[0].Image.NRGBAAt(0, 0); got != opaque(200, 60, 60) {
		t.Errorf("got %v", got)
	}
}

func TestLoadSourceExplainsFailures(t *testing.T) {
	dir := t.TempDir()
	text := filepath.Join(dir, "notes.png")
	if err := os.WriteFile(text, []byte("not a picture"), 0o644); err != nil {
		t.Fatal(err)
	}
	brokenGIF := filepath.Join(dir, "broken.gif")
	if err := os.WriteFile(brokenGIF, []byte("GIF89a nonsense"), 0o644); err != nil {
		t.Fatal(err)
	}

	for path, want := range map[string]string{
		filepath.Join(dir, "missing.png"): "can't open",
		text:                              "not a picture I can read",
		brokenGIF:                         "not a GIF I can read",
	} {
		_, err := LoadSource(t.Context(), path)
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("%s: got %v, want an error mentioning %q", filepath.Base(path), err, want)
		}
	}
}

func TestIsAnimated(t *testing.T) {
	for path, want := range map[string]bool{"a.gif": true, "A.GIF": true, "a.mp4": true, "a.MOV": true, "a.webm": true,
		"a.png": false, "a.jpg": false, "gif": false, "folder.gif/a.png": false} {
		if got := IsAnimated(path); got != want {
			t.Errorf("IsAnimated(%q) = %v", path, got)
		}
	}
	if IsVideo("a.gif") || !IsVideo("a.mkv") {
		t.Error("IsVideo is wrong")
	}
}

// ---- video -----------------------------------------------------------------

func TestVideoWithoutFFmpegSaysWhatToDo(t *testing.T) {
	t.Setenv("ASCART_FFMPEG", "")
	t.Setenv("PATH", t.TempDir())

	_, err := LoadSource(t.Context(), "clip.mp4")
	if err == nil || !strings.Contains(err.Error(), "needs ffmpeg") {
		t.Errorf("got %v", err)
	}
}

func TestVideoWithAnFFmpegThatCannotStart(t *testing.T) {
	t.Setenv("ASCART_FFMPEG", filepath.Join(t.TempDir(), "no-such-ffmpeg"))

	_, err := LoadSource(t.Context(), "clip.mp4")
	if err == nil || !strings.Contains(err.Error(), "could not start ffmpeg") {
		t.Errorf("got %v", err)
	}
}

func makeClip(t *testing.T) string {
	t.Helper()
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg is not installed")
	}
	path := filepath.Join(t.TempDir(), "clip.mp4")
	command := exec.Command(ffmpeg, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=160x120:rate=10", "-pix_fmt", "yuv420p", path)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("ffmpeg: %v\n%s", err, output)
	}
	return path
}

func TestLoadVideo(t *testing.T) {
	source, err := LoadSource(t.Context(), makeClip(t))
	if err != nil {
		t.Fatal(err)
	}
	if !source.Animated || len(source.Frames) != 10 {
		t.Fatalf("expected 10 frames, got %d (animated %v)", len(source.Frames), source.Animated)
	}
	if source.Frames[0].Delay != 100*time.Millisecond {
		t.Errorf("delay = %v", source.Frames[0].Delay)
	}
	if b := source.Frames[0].Image.Bounds(); b.Dx() != 160 || b.Dy() != 120 {
		t.Errorf("size %v", b)
	}
}

func TestVideoCanBeCancelled(t *testing.T) {
	path := makeClip(t)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	if _, err := LoadSource(ctx, path); err == nil {
		t.Error("a cancelled load should fail")
	}
}

func TestBrokenVideoIsExplained(t *testing.T) {
	makeClip(t) // skips without ffmpeg
	broken := filepath.Join(t.TempDir(), "broken.mp4")
	if err := os.WriteFile(broken, []byte("not a video at all"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err := LoadSource(t.Context(), broken)
	if err == nil || !strings.Contains(err.Error(), "could not read this video") {
		t.Errorf("got %v", err)
	}
}
