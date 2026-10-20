package tui

import (
	"context"
	"errors"
	"fmt"
	"image"
	"image/color"
	"strings"
	"sync"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

// harness drives a Model the way Bubble Tea would, but synchronously: the
// commands that Update returns are run right away and their messages fed
// back. Timers that tests want to control by hand (playback frames and the
// status expiring) are recorded instead of delivered.
type harness struct {
	t *testing.T
	m *Model

	mu        sync.Mutex
	converts  int
	loads     []string
	saved     map[string]string
	existing  map[string]bool
	clipboard []string
	frameTick []frameTickMsg
	quit      bool
	loadErr   error
	saveErr   error

	convertHook func(ctx context.Context) error // runs inside Convert
}

func solidFrames(n int, delay time.Duration) []engine.Frame {
	palette := []color.NRGBA{{220, 40, 40, 255}, {40, 200, 60, 255}, {50, 60, 230, 255}, {240, 240, 240, 255}}
	frames := make([]engine.Frame, n)
	for i := range frames {
		img := image.NewNRGBA(image.Rect(0, 0, 60, 30))
		c := palette[i%len(palette)]
		for p := 0; p < len(img.Pix); p += 4 {
			img.Pix[p], img.Pix[p+1], img.Pix[p+2], img.Pix[p+3] = c.R, c.G, c.B, c.A
		}
		frames[i] = engine.Frame{Image: img, Delay: delay}
	}
	return frames
}

// newHarness starts an app of 100x30 with no file open.
func newHarness(t *testing.T) *harness {
	t.Helper()
	h := &harness{t: t, saved: map[string]string{}, existing: map[string]bool{}}

	deps := Deps{
		Load: func(_ context.Context, path string) (*engine.Source, error) {
			h.mu.Lock()
			defer h.mu.Unlock()
			h.loads = append(h.loads, path)
			if h.loadErr != nil {
				return nil, h.loadErr
			}
			n := 1
			if strings.HasSuffix(path, ".gif") {
				n = 3
			}
			return &engine.Source{Name: path, Frames: solidFrames(n, 30*time.Millisecond), Animated: n > 1}, nil
		},
		Convert: func(ctx context.Context, frames []engine.Frame, o engine.Options) ([]*engine.Grid, error) {
			h.mu.Lock()
			h.converts++
			hook := h.convertHook
			h.mu.Unlock()
			if hook != nil {
				if err := hook(ctx); err != nil {
					return nil, err
				}
			}
			return engine.ConvertFrames(ctx, frames, o, nil)
		},
		Save: func(path, data string) error {
			h.mu.Lock()
			defer h.mu.Unlock()
			if h.saveErr != nil {
				return h.saveErr
			}
			h.saved[path] = data
			return nil
		},
		Exists: func(path string) bool {
			h.mu.Lock()
			defer h.mu.Unlock()
			return h.existing[path]
		},
		Debounce:   time.Millisecond,
		StatusTime: time.Millisecond,
	}

	h.m = New(t.Context(), deps, engine.DefaultOptions(), "")
	h.exec(h.m.Init())
	h.send(tea.WindowSizeMsg{Width: 100, Height: 30})
	return h
}

// open loads a file and waits for it to be converted.
func (h *harness) open(path string) {
	h.t.Helper()
	h.m.path = path
	h.exec(h.m.Init())
}

// send delivers a message and everything that follows from it.
func (h *harness) send(msg tea.Msg) {
	h.t.Helper()
	_, cmd := h.m.Update(msg)
	h.exec(cmd)
}

// exec runs a command and feeds its message to the model.
func (h *harness) exec(cmd tea.Cmd) {
	h.t.Helper()
	if cmd == nil {
		return
	}
	switch msg := cmd().(type) {
	case nil:
	case tea.BatchMsg:
		for _, c := range msg {
			h.exec(c)
		}
	case frameTickMsg:
		h.frameTick = append(h.frameTick, msg)
	case statusExpiredMsg:
		// kept, so the message stays readable
	case tea.QuitMsg:
		h.quit = true
	default:
		if isClipboard(msg) {
			h.clipboard = append(h.clipboard, fmt.Sprint(msg))
			return
		}
		h.send(msg)
	}
}

func isClipboard(msg tea.Msg) bool {
	return strings.Contains(strings.ToLower(fmt.Sprintf("%T", msg)), "clipboard")
}

// press sends keys by name: "down", "shift+left", "enter", or a single
// character.
func (h *harness) press(keys ...string) {
	h.t.Helper()
	for _, k := range keys {
		h.send(keyMsg(k))
	}
}

// typeText sends each character as a key.
func (h *harness) typeText(text string) {
	h.t.Helper()
	for _, r := range text {
		h.send(tea.KeyPressMsg{Code: r, Text: string(r)})
	}
}

func keyMsg(name string) tea.KeyPressMsg {
	codes := map[string]rune{
		"up": tea.KeyUp, "down": tea.KeyDown, "left": tea.KeyLeft, "right": tea.KeyRight,
		"enter": tea.KeyEnter, "esc": tea.KeyEscape, "tab": tea.KeyTab, "backspace": tea.KeyBackspace,
		"pgup": tea.KeyPgUp, "pgdown": tea.KeyPgDown, "home": tea.KeyHome, "end": tea.KeyEnd, "space": tea.KeySpace,
	}
	switch name {
	case "shift+left":
		return tea.KeyPressMsg{Code: tea.KeyLeft, Mod: tea.ModShift}
	case "shift+right":
		return tea.KeyPressMsg{Code: tea.KeyRight, Mod: tea.ModShift}
	case "ctrl+c":
		return tea.KeyPressMsg{Code: 'c', Mod: tea.ModCtrl}
	case "ctrl+u":
		return tea.KeyPressMsg{Code: 'u', Mod: tea.ModCtrl}
	case "space":
		return tea.KeyPressMsg{Code: tea.KeySpace, Text: " "}
	}
	if code, ok := codes[name]; ok {
		return tea.KeyPressMsg{Code: code}
	}
	r := []rune(name)
	if len(r) != 1 {
		panic("unknown key " + name)
	}
	return tea.KeyPressMsg{Code: r[0], Text: name}
}

// screen is what the user would see, without styling.
func (h *harness) screen() string {
	h.t.Helper()
	return ansi.Strip(h.m.View().Content)
}

func (h *harness) wantScreen(parts ...string) {
	h.t.Helper()
	screen := h.screen()
	for _, part := range parts {
		if !strings.Contains(screen, part) {
			h.t.Errorf("screen should show %q:\n%s", part, screen)
		}
	}
}

func (h *harness) wantNoScreen(parts ...string) {
	h.t.Helper()
	screen := h.screen()
	for _, part := range parts {
		if strings.Contains(screen, part) {
			h.t.Errorf("screen should not show %q:\n%s", part, screen)
		}
	}
}

func (h *harness) convertCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.converts
}

var errBoom = errors.New("boom")
