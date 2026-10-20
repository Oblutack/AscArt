// Command ascart turns pictures, GIFs and short videos into colored ASCII art,
// in the terminal.
package main

import (
	"context"
	"os"
	"os/signal"

	"github.com/Oblutack/AscArt/cli/internal/cli"
	"github.com/Oblutack/AscArt/cli/internal/tui"
)

// version is set at build time: -ldflags "-X main.version=1.2.3"
var version = "dev"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	os.Exit(cli.Run(os.Args[1:], cli.Env{
		Context: ctx,
		Stdin:   os.Stdin,
		Stdout:  os.Stdout,
		Stderr:  os.Stderr,
		Environ: os.Environ(),
		Version: version,
		// progress is for people: only when stderr is a terminal
		Progress: isTerminal(os.Stderr),
		TUI:      tui.Run,
	}))
}

func isTerminal(f *os.File) bool {
	info, err := f.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}
