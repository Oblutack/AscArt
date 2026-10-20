// Package tui is the interactive ascart app, built with Bubble Tea.
//
// The model never touches the disk or the converter directly: it asks the
// functions in Deps, so tests can drive Update and View with fakes.
package tui

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"charm.land/bubbles/v2/viewport"
	tea "charm.land/bubbletea/v2"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

// Deps are the things the app does outside the terminal.
type Deps struct {
	Load    func(ctx context.Context, path string) (*engine.Source, error)
	Convert func(ctx context.Context, frames []engine.Frame, o engine.Options) ([]*engine.Grid, error)
	Save    func(path, data string) error
	Exists  func(path string) bool

	// Debounce is how long to wait after the last change to a setting before
	// converting again.
	Debounce time.Duration

	// StatusTime is how long a message stays in the footer.
	StatusTime time.Duration
}

// DefaultDeps wires the app to the real engine and disk.
func DefaultDeps() Deps {
	return Deps{
		Load: engine.LoadSource,
		Convert: func(ctx context.Context, frames []engine.Frame, o engine.Options) ([]*engine.Grid, error) {
			return engine.ConvertFrames(ctx, frames, o, nil)
		},
		Save: func(path, data string) error { return os.WriteFile(path, []byte(data), 0o644) },
		Exists: func(path string) bool {
			_, err := os.Stat(path)
			return err == nil
		},
		Debounce:   150 * time.Millisecond,
		StatusTime: 6 * time.Second,
	}
}

// ---- messages --------------------------------------------------------------

type loadedMsg struct {
	id     int
	path   string
	source *engine.Source
	err    error
}

type convertedMsg struct {
	id    int
	grids []*engine.Grid
	err   error
}

type debounceMsg struct{ id int }

type frameTickMsg struct{ gen int }

type statusExpiredMsg struct{ id int }

// ---- state -----------------------------------------------------------------

type focus int

const (
	focusSettings focus = iota
	focusPreview
)

type mode int

const (
	modeNormal mode = iota
	modeInput
	modeConfirm
	modeHelp
)

// what a text prompt is for
type purpose int

const (
	forOpen purpose = iota
	forSave
	forChars
	forNumber
)

type input struct {
	purpose  purpose
	prompt   string
	value    []rune
	setting  setting // for forNumber
	original string  // for forChars: the set to go back to on esc
}

// Model is the whole app state.
type Model struct {
	deps Deps
	ctx  context.Context

	opts engine.Options

	source *engine.Source
	path   string
	grids  []*engine.Grid
	frame  int

	playing bool
	playGen int

	loadID     int
	jobID      int
	debounceID int
	cancelJob  func()
	busy       string // what is running right now, shown in the footer

	selected   setting
	focus      focus
	mode       mode
	input      input
	pending    string // file waiting for an overwrite answer
	showSource bool

	preview viewport.Model

	status    string
	statusErr bool
	statusID  int

	width, height int
}

// New makes the app. A file, if given, is loaded as soon as it starts.
func New(ctx context.Context, deps Deps, options engine.Options, file string) *Model {
	if options.CustomChars == "" {
		options.CustomChars = engine.DefaultOptions().CustomChars
	}
	if options.Ratio == "" {
		options.Ratio = "--"
	}
	m := &Model{
		deps:    deps,
		ctx:     ctx,
		opts:    options,
		preview: viewport.New(),
	}
	m.preview.SetHorizontalStep(4)
	if file != "" {
		m.path = file
	}
	return m
}

// Init loads the file given on the command line.
func (m *Model) Init() tea.Cmd {
	if m.path == "" {
		return m.say("Press o to open a picture, GIF or video   ? for help", false)
	}
	return m.load(m.path)
}

// ---- commands --------------------------------------------------------------

func (m *Model) load(path string) tea.Cmd {
	m.loadID++
	id := m.loadID
	m.busy = "Loading " + filepath.Base(path)
	deps, ctx := m.deps, m.ctx
	return func() tea.Msg {
		source, err := deps.Load(ctx, path)
		return loadedMsg{id: id, path: path, source: source, err: err}
	}
}

// startConvert converts every frame with the current settings, dropping
// whatever conversion was still running.
func (m *Model) startConvert() tea.Cmd {
	if m.source == nil {
		return nil
	}
	if m.cancelJob != nil {
		m.cancelJob()
	}
	m.jobID++
	id := m.jobID
	ctx, cancel := context.WithCancel(m.ctx)
	m.cancelJob = cancel
	m.busy = "Converting"
	frames, opts, deps := m.source.Frames, m.opts, m.deps

	return func() tea.Msg {
		grids, err := deps.Convert(ctx, frames, opts)
		return convertedMsg{id: id, grids: grids, err: err}
	}
}

func (m *Model) changed() tea.Cmd {
	if m.source == nil {
		return nil
	}
	m.debounceID++
	id := m.debounceID
	return tea.Tick(m.deps.Debounce, func(time.Time) tea.Msg { return debounceMsg{id} })
}

func (m *Model) tickPlayback() tea.Cmd {
	if !m.playing || m.source == nil || len(m.source.Frames) < 2 {
		return nil
	}
	m.playGen++
	gen := m.playGen
	delay := max(m.source.Frames[m.frame%len(m.source.Frames)].Delay, 20*time.Millisecond)
	return tea.Tick(delay, func(time.Time) tea.Msg { return frameTickMsg{gen} })
}

func (m *Model) say(text string, isErr bool) tea.Cmd {
	m.statusID++
	id := m.statusID
	m.status, m.statusErr = text, isErr
	return tea.Tick(m.deps.StatusTime, func(time.Time) tea.Msg { return statusExpiredMsg{id} })
}

// ---- helpers ---------------------------------------------------------------

func (m *Model) current() *engine.Grid {
	if len(m.grids) == 0 {
		return nil
	}
	return m.grids[m.frame%len(m.grids)]
}

func (m *Model) animated() bool {
	return m.source != nil && len(m.source.Frames) > 1
}

// refreshPreview puts the current frame (art or source) into the viewport.
func (m *Model) refreshPreview() {
	switch {
	case m.showSource && m.source != nil:
		art, _, _ := engine.HalfBlocks(m.source.Frames[m.frame%len(m.source.Frames)].Image, max(1, m.preview.Width()), max(1, m.preview.Height()))
		m.preview.SetContent(art)
	case m.current() != nil:
		m.preview.SetContent(m.current().ToANSI(engine.TrueColor))
	default:
		m.preview.SetContent("")
	}
}

// cleanPath makes what a user typed or dropped into a path: terminals paste
// dragged files in quotes or with escaped spaces.
func cleanPath(text string) string {
	text = strings.TrimSpace(text)
	if len(text) >= 2 && (text[0] == '"' || text[0] == '\'') && text[len(text)-1] == text[0] {
		text = text[1 : len(text)-1]
	}
	if runtime.GOOS != "windows" {
		text = strings.ReplaceAll(text, `\ `, " ") // a dragged file with spaces in its name
	}
	if strings.HasPrefix(text, "~/") || text == "~" {
		if home, err := os.UserHomeDir(); err == nil {
			text = filepath.Join(home, text[1:])
		}
	}
	return text
}

// savePathFor suggests where to save the current art.
func (m *Model) savePathFor() string {
	if m.source == nil {
		return "ascart.ans"
	}
	base := strings.TrimSuffix(m.source.Name, filepath.Ext(m.source.Name))
	return base + ".ans"
}
