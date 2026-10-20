package tui

import (
	"context"

	tea "charm.land/bubbletea/v2"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

// Run opens the app and blocks until it quits.
func Run(ctx context.Context, options engine.Options, file string) error {
	_, err := tea.NewProgram(New(ctx, DefaultDeps(), options, file), tea.WithContext(ctx)).Run()
	return err
}
