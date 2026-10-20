package tui

import (
	"bytes"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

// lockedBuffer is a bytes.Buffer the program can write to while a test reads.
type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// TestRealProgramOpensAFileConvertsItAndQuits runs the app for real, with the
// real engine and disk, against a terminal that is just a pipe and a buffer.
func TestRealProgramOpensAFileConvertsItAndQuits(t *testing.T) {
	model := New(t.Context(), DefaultDeps(), engine.DefaultOptions(), "../../testdata/gradient.png")

	keys, typed := io.Pipe()
	var screen lockedBuffer
	program := tea.NewProgram(model,
		tea.WithContext(t.Context()),
		tea.WithInput(keys),
		tea.WithOutput(&screen),
		tea.WithWindowSize(110, 32),
	)

	done := make(chan error, 1)
	go func() {
		_, err := program.Run()
		done <- err
	}()

	waitFor(t, &screen, "gradient.png")
	waitFor(t, &screen, "characters") // converted: the header shows the size

	typed.Write([]byte("?")) // open help
	waitFor(t, &screen, "Keys")
	typed.Write([]byte("q")) // closes help
	typed.Write([]byte("q")) // quits

	select {
	case err := <-done:
		if err != nil {
			t.Errorf("the program ended with %v", err)
		}
	case <-time.After(5 * time.Second):
		program.Kill()
		t.Fatal("the program did not quit on q")
	}
}

func waitFor(t *testing.T, screen *lockedBuffer, text string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if strings.Contains(ansi.Strip(screen.String()), text) {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("never saw %q on screen. What was drawn:\n%.2000s", text, ansi.Strip(screen.String()))
}
