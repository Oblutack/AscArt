package cli

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

const (
	fixture = "../../testdata/gradient.png"
	flat    = "../../testdata/flat_red.png"
)

type result struct {
	code           int
	stdout, stderr string
}

func run(t *testing.T, args ...string) result {
	t.Helper()
	return runWith(t, Env{}, args...)
}

func runWith(t *testing.T, env Env, args ...string) result {
	t.Helper()
	var out, errs bytes.Buffer
	env.Stdout, env.Stderr = &out, &errs
	if env.Context == nil {
		env.Context = t.Context()
	}
	if env.Version == "" {
		env.Version = "9.9.9"
	}
	code := Run(args, env)
	return result{code, out.String(), errs.String()}
}

func TestVersionAndHelp(t *testing.T) {
	if r := run(t, "version"); r.code != 0 || r.stdout != "ascart 9.9.9\n" {
		t.Errorf("version: %+v", r)
	}
	for _, arg := range []string{"help", "--help", "-h"} {
		r := run(t, arg)
		if r.code != 0 || !strings.Contains(r.stdout, "ascart convert <file>") {
			t.Errorf("%s: %+v", arg, r)
		}
	}
}

func TestUnknownCommandIsAUsageError(t *testing.T) {
	r := run(t, "frobnicate")
	if r.code != 2 || !strings.Contains(r.stderr, `unknown command "frobnicate"`) || !strings.Contains(r.stderr, "ascart help") {
		t.Errorf("%+v", r)
	}
}

func TestConvertPrintsPlainTextWithoutColors(t *testing.T) {
	r := run(t, "convert", fixture, "--width", "30", "--colors", "none")
	if r.code != 0 {
		t.Fatalf("%+v", r)
	}
	if strings.Contains(r.stdout, "\x1b") {
		t.Error("--colors none must not print escape codes")
	}
	lines := strings.Split(strings.TrimRight(r.stdout, "\n"), "\n")
	if len(lines[0]) != 30 || len(lines) < 3 {
		t.Errorf("expected 30 columns and a few rows, got %d columns, %d rows", len(lines[0]), len(lines))
	}
}

func TestConvertColorModes(t *testing.T) {
	tests := map[string]string{
		"truecolor": "\x1b[38;2;",
		"256":       "\x1b[38;5;",
		"16":        "\x1b[",
	}
	for mode, want := range tests {
		r := run(t, "convert", flat, "--width", "8", "--colors", mode)
		if r.code != 0 || !strings.Contains(r.stdout, want) {
			t.Errorf("--colors %s: %+v", mode, r)
		}
		if mode == "16" && strings.Contains(r.stdout, "38;") {
			t.Error("16 colors should use the short codes")
		}
	}
}

func TestConvertAutoColorsFollowTheEnvironment(t *testing.T) {
	// the output here is a buffer, not a terminal, so auto means no colors
	r := runWith(t, Env{Environ: []string{"COLORTERM=truecolor", "TERM=xterm-256color"}}, "convert", flat, "--width", "8")
	if r.code != 0 || strings.Contains(r.stdout, "\x1b") {
		t.Errorf("%+v", r)
	}
}

func TestFlagsMayComeBeforeOrAfterTheFile(t *testing.T) {
	a := run(t, "convert", fixture, "--width", "20", "--colors", "none")
	b := run(t, "convert", "--width", "20", "--colors", "none", fixture)
	if a.code != 0 || a.stdout != b.stdout {
		t.Errorf("order of flags changed the result:\n%s\n%s", a.stdout, b.stdout)
	}
}

func TestConvertToFilesPicksTheFormatFromTheExtension(t *testing.T) {
	dir := t.TempDir()
	tests := map[string]string{
		"art.txt":  "",
		"art.html": "<!DOCTYPE html>",
		"art.ans":  "\x1b[38;2;",
	}
	for name, want := range tests {
		path := filepath.Join(dir, name)
		r := run(t, "convert", flat, "--width", "8", "-o", path)
		if r.code != 0 || r.stdout != "" {
			t.Fatalf("%s: %+v", name, r)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		text := string(data)
		if want != "" && !strings.Contains(text, want) {
			t.Errorf("%s should contain %q: %.80q", name, want, text)
		}
		if name == "art.txt" && strings.Contains(text, "\x1b") {
			t.Errorf("a .txt file must be plain")
		}
		if !strings.HasSuffix(text, "\n") {
			t.Errorf("%s should end with a newline", name)
		}
	}
}

func TestFormatFlagBeatsTheExtension(t *testing.T) {
	path := filepath.Join(t.TempDir(), "art.txt")
	if r := run(t, "convert", flat, "--width", "8", "-o", path, "--format", "html"); r.code != 0 {
		t.Fatalf("%+v", r)
	}
	data, _ := os.ReadFile(path)
	if !strings.Contains(string(data), "<pre>") {
		t.Error("--format html should win")
	}
}

func TestCustomCharsImplyTheCustomSet(t *testing.T) {
	r := run(t, "convert", flat, "--width", "6", "--colors", "none", "--chars", "XY")
	if r.code != 0 {
		t.Fatalf("%+v", r)
	}
	if strings.Trim(r.stdout, "XY\n ") != "" {
		t.Errorf("only the custom characters may appear: %q", r.stdout)
	}
}

func TestOptionsReachTheEngine(t *testing.T) {
	plain := run(t, "convert", fixture, "--width", "20", "--colors", "none")
	blocks := run(t, "convert", fixture, "--width", "20", "--colors", "none", "--charset", "blocks")
	inverted := run(t, "convert", fixture, "--width", "20", "--colors", "none", "--invert")
	dither := run(t, "convert", fixture, "--width", "20", "--colors", "none", "--dither")

	if !strings.ContainsAny(blocks.stdout, "█▓▒░") || strings.ContainsAny(plain.stdout, "█▓▒░") {
		t.Error("--charset blocks should use block characters")
	}
	if inverted.stdout == plain.stdout {
		t.Error("--invert changed nothing")
	}
	if strings.Trim(dither.stdout, "█ \n") != "" {
		t.Errorf("--dither should only use blocks and spaces: %.60q", dither.stdout)
	}
}

func TestConvertMistakesAreUsageErrors(t *testing.T) {
	tests := map[string][]string{
		"no file":          {"convert"},
		"two files":        {"convert", fixture, flat},
		"bad width":        {"convert", fixture, "--width", "0"},
		"bad scheme":       {"convert", fixture, "--scheme", "neon"},
		"bad ratio":        {"convert", fixture, "--ratio", "wide"},
		"bad format":       {"convert", fixture, "--format", "pdf"},
		"bad colors":       {"convert", fixture, "--colors", "rainbow"},
		"unknown flag":     {"convert", fixture, "--sparkle"},
		"one char":         {"convert", fixture, "--chars", "x"},
		"frame too high":   {"convert", fixture, "--frame", "2"},
		"frame below one":  {"convert", fixture, "--frame", "0"},
		"not a number":     {"convert", fixture, "--width", "many"},
		"play without one": {"play"},
		"bad speed":        {"play", fixture, "--speed", "0"},
		"bad loops":        {"play", fixture, "--loops", "-1"},
		"tui two files":    {"tui", fixture, flat},
	}
	for name, args := range tests {
		r := run(t, args...)
		if r.code != 2 {
			t.Errorf("%s: exit %d, stderr %q", name, r.code, r.stderr)
		}
		if r.stderr == "" {
			t.Errorf("%s: should explain what went wrong", name)
		}
	}
}

func TestMissingAndBrokenFilesAreFailuresNotUsageErrors(t *testing.T) {
	broken := filepath.Join(t.TempDir(), "x.png")
	if err := os.WriteFile(broken, []byte("nope"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"does-not-exist.png", broken} {
		r := run(t, "convert", path)
		if r.code != 1 || !strings.HasPrefix(r.stderr, "ascart: ") {
			t.Errorf("%s: %+v", path, r)
		}
	}
}

func TestUnwritableOutputIsReported(t *testing.T) {
	r := run(t, "convert", flat, "--width", "8", "-o", filepath.Join(t.TempDir(), "no-such-dir", "a.txt"))
	if r.code != 1 || !strings.Contains(r.stderr, "can't write") {
		t.Errorf("%+v", r)
	}
}

func TestPlayPrintsAStillPictureOnce(t *testing.T) {
	r := run(t, "play", flat, "--width", "8", "--colors", "none")
	if r.code != 0 || strings.Contains(r.stdout, "\x1b[?25l") || len(strings.Split(strings.TrimSpace(r.stdout), "\n")) < 1 {
		t.Errorf("%+v", r)
	}
}

func TestPlayAnimationLoopsAndRestoresTheCursor(t *testing.T) {
	r := run(t, "play", "../../testdata/anim.gif", "--width", "8", "--colors", "none", "--loops", "2", "--speed", "100")
	if r.code != 0 {
		t.Fatalf("%+v", r)
	}
	if !strings.HasPrefix(r.stdout, hideCursor) || !strings.HasSuffix(r.stdout, showCursor) {
		t.Errorf("the cursor should be hidden while playing and come back: %.40q ... %.40q", r.stdout, r.stdout[max(0, len(r.stdout)-40):])
	}
	// 2 loops of 3 frames: five moves back to the top
	if got := strings.Count(r.stdout, "\x1b[") - 2; got != 5 {
		t.Errorf("expected 5 'back to the top' codes, got %d", got)
	}
}

func TestPlayStopsWhenInterrupted(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	time.AfterFunc(150*time.Millisecond, cancel)

	done := make(chan result, 1)
	go func() {
		done <- runWith(t, Env{Context: ctx}, "play", "../../testdata/anim.gif", "--width", "8", "--colors", "none")
	}()

	select {
	case r := <-done:
		if r.code != 1 || r.stderr != "" {
			t.Errorf("an interrupted play ends quietly with code 1: %+v", r)
		}
		if !strings.HasSuffix(r.stdout, showCursor) {
			t.Error("the cursor must come back")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("play did not stop when the context ended")
	}
}

func TestTUIGetsTheOptionsAndTheFile(t *testing.T) {
	var got engine.Options
	var gotFile string
	env := Env{TUI: func(_ context.Context, o engine.Options, file string) error {
		got, gotFile = o, file
		return nil
	}}

	if r := runWith(t, env, "tui", fixture, "--width", "55", "--scheme", "sepia"); r.code != 0 {
		t.Fatalf("%+v", r)
	}
	if got.Width != 55 || got.ColorScheme != "sepia" || gotFile != fixture {
		t.Errorf("got %+v, %q", got, gotFile)
	}

	// no arguments at all opens the app too
	gotFile = "unset"
	if r := runWith(t, env); r.code != 0 || gotFile != "" || got.Width != engine.DefaultOptions().Width {
		t.Errorf("%+v %q %d", r, gotFile, got.Width)
	}
}

func TestTUIWithoutATerminalSaysSo(t *testing.T) {
	r := run(t, "tui")
	if r.code != 1 || !strings.Contains(r.stderr, "needs a terminal") {
		t.Errorf("%+v", r)
	}
}

func TestFlagHelpIsNotAnError(t *testing.T) {
	r := run(t, "convert", "-h")
	if r.code != 0 || !strings.Contains(r.stdout, "ascart convert <file>") || r.stderr != "" {
		t.Errorf("%+v", r)
	}
}
