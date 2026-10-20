package cli

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

const (
	hideCursor = "\x1b[?25l"
	showCursor = "\x1b[?25h"
)

func runPlay(args []string, env Env) error {
	fs := newFlagSet("play", env.Stderr)
	var shared optionFlags
	shared.register(fs)
	colors := fs.String("colors", "auto", "auto, truecolor, 256, 16 or none")
	speed := fs.Float64("speed", 1, "playback speed")
	loops := fs.Int("loops", 0, "times to play, 0 for until Ctrl+C")

	positional, seen, err := parse(fs, args)
	if err != nil {
		return err
	}
	if len(positional) != 1 {
		return usagef("play needs exactly one file")
	}
	if *speed <= 0 {
		return usagef("--speed must be above 0")
	}
	if *loops < 0 {
		return usagef("--loops can't be negative")
	}
	options, err := shared.finish(seen)
	if err != nil {
		return err
	}
	profile, err := chooseProfile(*colors, false, env)
	if err != nil {
		return err
	}

	source, err := engine.LoadSource(env.Context, positional[0])
	if err != nil {
		return err
	}

	showProgress := env.Progress && len(source.Frames) > 1
	grids, err := engine.ConvertFrames(env.Context, source.Frames, options, func(done, total int) {
		if showProgress {
			fmt.Fprintf(env.Stderr, "\rConverting frame %d/%d", done, total)
		}
	})
	if showProgress {
		fmt.Fprint(env.Stderr, "\r\x1b[K") // clear the progress line
	}
	if err != nil {
		return err
	}

	frames := make([]string, len(grids))
	for i, grid := range grids {
		frames[i] = grid.ToANSI(profile)
	}

	if !source.Animated {
		_, err = fmt.Fprintln(env.Stdout, frames[0])
		return err
	}
	return play(env.Context, env.Stdout, frames, source.Frames, *speed, *loops)
}

// play draws the frames one over the other, each after the delay of the
// previous one, until the loops are done or the context is cancelled.
func play(ctx context.Context, out io.Writer, frames []string, source []engine.Frame, speed float64, loops int) error {
	fmt.Fprint(out, hideCursor)
	defer fmt.Fprint(out, showCursor)

	rows := countLines(frames[0])
	for loop := 0; loops == 0 || loop < loops; loop++ {
		for i, frame := range frames {
			if loop > 0 || i > 0 {
				fmt.Fprintf(out, "\x1b[%dA\r", rows) // back to the top of the art
			}
			fmt.Fprintln(out, frame)

			delay := time.Duration(float64(source[i].Delay) / speed)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}
	}
	return nil
}

func countLines(text string) int {
	lines := 1
	for _, r := range text {
		if r == '\n' {
			lines++
		}
	}
	return lines
}

// runTUI hands over to the terminal app.
func runTUI(args []string, env Env) error {
	fs := newFlagSet("tui", env.Stderr)
	var shared optionFlags
	shared.register(fs)

	positional, seen, err := parse(fs, args)
	if err != nil {
		return err
	}
	if len(positional) > 1 {
		return usagef("tui takes at most one file")
	}
	options, err := shared.finish(seen)
	if err != nil {
		return err
	}

	if env.TUI == nil {
		return fmt.Errorf("the interactive app needs a terminal")
	}
	file := ""
	if len(positional) == 1 {
		file = positional[0]
	}
	return env.TUI(env.Context, options, file)
}
