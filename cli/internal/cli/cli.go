// Package cli is the ascart command line: convert, play and tui. It is a
// plain function of its arguments and streams so it can be tested without
// starting processes.
package cli

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

// Env is everything the command line touches outside its arguments.
type Env struct {
	Context context.Context
	Stdin   io.Reader
	Stdout  io.Writer
	Stderr  io.Writer
	Environ []string
	Version string

	// Progress allows drawing progress on Stderr, which only makes sense when
	// it is a terminal and not a pipe or a log.
	Progress bool

	// TUI starts the terminal app (set by main; nil where there is no
	// terminal, as in tests).
	TUI func(ctx context.Context, options engine.Options, file string) error
}

// Exit codes.
const (
	exitOK    = 0
	exitError = 1
	exitUsage = 2
)

// usageError is a mistake in how the command was called, as opposed to a
// failure while doing what was asked.
type usageError struct{ message string }

func (e usageError) Error() string { return e.message }

func usagef(format string, args ...any) error {
	return usageError{fmt.Sprintf(format, args...)}
}

// Run executes the command line and returns the exit code.
func Run(args []string, env Env) int {
	if env.Context == nil {
		env.Context = context.Background()
	}

	var err error
	switch command, rest := split(args); command {
	case "", "tui":
		err = runTUI(rest, env)
	case "convert":
		err = runConvert(rest, env)
	case "play":
		err = runPlay(rest, env)
	case "version", "--version", "-version":
		fmt.Fprintf(env.Stdout, "ascart %s\n", env.Version)
	case "help", "--help", "-help", "-h":
		fmt.Fprint(env.Stdout, usageText)
	default:
		err = usagef("unknown command %q", command)
	}

	var usage usageError
	switch {
	case err == nil:
		return exitOK
	case errors.Is(err, flag.ErrHelp):
		fmt.Fprint(env.Stdout, usageText)
		return exitOK
	case errors.As(err, &usage):
		fmt.Fprintf(env.Stderr, "ascart: %s\nTry 'ascart help'.\n", usage.message)
		return exitUsage
	case errors.Is(err, context.Canceled):
		return exitError // interrupted: nothing more to say
	default:
		fmt.Fprintf(env.Stderr, "ascart: %s\n", err)
		return exitError
	}
}

func split(args []string) (command string, rest []string) {
	if len(args) == 0 {
		return "", nil
	}
	return args[0], args[1:]
}

const usageText = `ascart turns pictures, GIFs and short videos into colored ASCII art.

Usage:
  ascart                          open the interactive app
  ascart tui [file]               open the interactive app, optionally on a file
  ascart convert <file> [flags]   print the art (or save it with -o)
  ascart play <file> [flags]      play a GIF or video in the terminal
  ascart version

Flags for convert, play and tui:
  --width N          characters across (default 120)
  --charset NAME     detailed, blocks or custom
  --chars TEXT       your own characters from darkest to lightest (implies custom)
  --scheme NAME      original, grayscale, sepia, blue, green, red, purple, cyan
  --brightness N     -100 to 100
  --contrast N       0 to 200 (100 changes nothing)
  --invert           swap light and dark
  --dither           black and white halftone
  --ratio W:H        e.g. 16:9 (default: the picture's own)
  --keep-original    native size, up to 400 characters wide

Only for convert and play:
  --colors MODE      auto, truecolor, 256, 16 or none (default auto)

Only for convert:
  -o FILE            write to a file; .html, .txt and .ans pick the format
  --format NAME      ansi, text or html
  --frame N          which frame of a GIF or video (default 1)

Only for play:
  --speed X          playback speed (default 1)
  --loops N          how many times to play, 0 for until Ctrl+C (default 0)

Examples:
  ascart convert cat.jpg --width 80
  ascart convert cat.jpg --scheme sepia --dither -o cat.txt
  ascart convert logo.png --chars " .oO@" --format html -o logo.html
  ascart play loop.gif --width 60
  ascart            (then press ? inside the app)

Videos need ffmpeg on the PATH (or set ASCART_FFMPEG).
`
