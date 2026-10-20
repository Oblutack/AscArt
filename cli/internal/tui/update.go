package tui

import (
	"fmt"
	"path/filepath"
	"strings"

	tea "charm.land/bubbletea/v2"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

// Update handles everything that happens to the app.
func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		m.layout()
		return m, nil

	case tea.KeyPressMsg:
		return m.key(msg)

	case tea.PasteMsg:
		if m.mode == modeInput {
			m.input.value = append(m.input.value, []rune(strings.ReplaceAll(msg.Content, "\n", ""))...)
		}
		return m, nil

	case tea.MouseWheelMsg:
		switch msg.Mouse().Button {
		case tea.MouseWheelUp:
			m.preview.ScrollUp(3)
		case tea.MouseWheelDown:
			m.preview.ScrollDown(3)
		case tea.MouseWheelLeft:
			m.preview.ScrollLeft(8)
		case tea.MouseWheelRight:
			m.preview.ScrollRight(8)
		}
		return m, nil

	case loadedMsg:
		return m.loaded(msg)

	case convertedMsg:
		return m.converted(msg)

	case debounceMsg:
		if msg.id != m.debounceID {
			return m, nil // a newer change is waiting
		}
		return m, m.startConvert()

	case frameTickMsg:
		if msg.gen != m.playGen || !m.playing || !m.animated() {
			return m, nil
		}
		m.frame = (m.frame + 1) % len(m.source.Frames)
		m.refreshPreview()
		return m, m.tickPlayback()

	case statusExpiredMsg:
		if msg.id == m.statusID {
			m.status, m.statusErr = "", false
		}
		return m, nil
	}
	return m, nil
}

func (m *Model) loaded(msg loadedMsg) (tea.Model, tea.Cmd) {
	if msg.id != m.loadID {
		return m, nil // an older load that finished late
	}
	m.busy = ""
	if msg.err != nil {
		return m, m.say(msg.err.Error(), true)
	}

	if m.cancelJob != nil {
		m.cancelJob()
	}
	m.source, m.path = msg.source, msg.path
	m.grids, m.frame = nil, 0
	m.playing = m.source.Animated
	m.preview.GotoTop()
	m.preview.SetXOffset(0)
	m.refreshPreview()
	return m, tea.Batch(m.startConvert(), m.say("Opened "+m.source.Name, false))
}

func (m *Model) converted(msg convertedMsg) (tea.Model, tea.Cmd) {
	if msg.id != m.jobID {
		return m, nil // out of date: the settings changed since
	}
	m.busy, m.cancelJob = "", nil
	if msg.err != nil {
		if isCancel(msg.err) {
			return m, nil
		}
		return m, m.say("Can't convert: "+msg.err.Error(), true)
	}

	m.grids = msg.grids
	m.frame = min(m.frame, len(m.grids)-1)
	m.refreshPreview()
	if m.playing {
		return m, m.tickPlayback()
	}
	return m, nil
}

func (m *Model) key(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch m.mode {
	case modeInput:
		return m.inputKey(msg)
	case modeConfirm:
		return m.confirmKey(msg)
	case modeHelp:
		if k := msg.String(); k == "q" || k == "esc" || k == "?" || k == "enter" {
			m.mode = modeNormal
		}
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}
		return m, nil
	}

	switch k := msg.String(); k {
	case "ctrl+c", "q":
		if m.cancelJob != nil {
			m.cancelJob()
		}
		return m, tea.Quit
	case "esc":
		return m, m.cancel()
	case "?":
		m.mode = modeHelp
	case "tab":
		m.focus = 1 - m.focus
	case "o":
		return m, m.prompt(forOpen, "Open: ", m.path)
	case "s":
		if m.current() == nil {
			return m, m.say("Nothing to save yet", true)
		}
		return m, m.prompt(forSave, "Save as: ", m.savePathFor())
	case "c":
		return m, m.copyArt()
	case "v":
		if m.source != nil {
			m.showSource = !m.showSource
			m.refreshPreview()
			m.preview.GotoTop()
			m.preview.SetXOffset(0)
		}
	case "p":
		return m, m.togglePlay()
	case ",", ".":
		return m, m.step(map[string]int{",": -1, ".": 1}[k])
	case "r":
		return m, m.reset()
	default:
		if m.focus == focusSettings {
			return m, m.settingsKey(msg)
		}
		m.previewKey(k)
	}
	return m, nil
}

// cancel stops whatever is running, or hides what is shown.
func (m *Model) cancel() tea.Cmd {
	if m.cancelJob != nil {
		m.cancelJob()
		m.cancelJob = nil
		m.jobID++ // the cancelled result is out of date
		m.busy = ""
		return m.say("Stopped. The preview is out of date.", false)
	}
	return nil
}

func (m *Model) settingsKey(msg tea.KeyPressMsg) tea.Cmd {
	switch k := msg.String(); k {
	case "up", "k":
		m.selected = (m.selected + numSettings - 1) % numSettings
	case "down", "j":
		m.selected = (m.selected + 1) % numSettings
	case "left", "h", "shift+left", "H":
		if m.adjust(m.selected, -1, k == "shift+left" || k == "H") {
			return m.changed()
		}
	case "right", "l", "shift+right", "L", "space", " ":
		if m.adjust(m.selected, 1, k == "shift+right" || k == "L") {
			return m.changed()
		}
	case "enter":
		switch {
		case m.selected == setChars:
			m.opts.Charset = "custom"
			return tea.Batch(m.prompt(forChars, "Characters, darkest to lightest: ", m.opts.CustomChars), m.changed())
		case isNumeric(m.selected):
			m.input.setting = m.selected
			return m.prompt(forNumber, m.selected.label()+": ", m.value(m.selected))
		default:
			if m.adjust(m.selected, 1, false) {
				return m.changed()
			}
		}
	}
	return nil
}

func (m *Model) previewKey(k string) {
	switch k {
	case "up", "k":
		m.preview.ScrollUp(1)
	case "down", "j":
		m.preview.ScrollDown(1)
	case "left", "h":
		m.preview.ScrollLeft(4)
	case "right", "l":
		m.preview.ScrollRight(4)
	case "pgup", "b":
		m.preview.PageUp()
	case "pgdown", "f", "space":
		m.preview.PageDown()
	case "home", "g":
		m.preview.GotoTop()
		m.preview.SetXOffset(0)
	case "end", "G":
		m.preview.GotoBottom()
	}
}

func (m *Model) reset() tea.Cmd {
	custom := m.opts.CustomChars
	m.opts = engine.DefaultOptions()
	m.opts.CustomChars, m.opts.Ratio = custom, "--"
	return tea.Batch(m.changed(), m.say("Settings reset", false))
}

func (m *Model) togglePlay() tea.Cmd {
	if !m.animated() {
		return m.say("This picture isn't animated", false)
	}
	m.playing = !m.playing
	if m.playing {
		return m.tickPlayback()
	}
	m.playGen++ // a tick that is already on its way will be ignored
	return nil
}

// step moves one frame, pausing playback.
func (m *Model) step(direction int) tea.Cmd {
	if !m.animated() {
		return nil
	}
	m.playing = false
	m.playGen++
	n := len(m.source.Frames)
	m.frame = ((m.frame+direction)%n + n) % n
	m.refreshPreview()
	return nil
}

func (m *Model) copyArt() tea.Cmd {
	grid := m.current()
	if grid == nil {
		return m.say("Nothing to copy yet", true)
	}
	return tea.Batch(
		tea.SetClipboard(grid.ToText()),
		m.say(fmt.Sprintf("Copied the art as text (%d×%d). Terminals that block clipboard access won't take it.", grid.Cols, grid.Rows), false),
	)
}

// ---- prompts ---------------------------------------------------------------

func (m *Model) prompt(p purpose, text, initial string) tea.Cmd {
	m.mode = modeInput
	setting := m.input.setting
	m.input = input{purpose: p, prompt: text, value: []rune(initial), setting: setting, original: m.opts.CustomChars}
	return nil
}

func (m *Model) inputKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch k := msg.String(); k {
	case "ctrl+c":
		return m, tea.Quit
	case "esc":
		m.mode = modeNormal
		if m.input.purpose == forChars {
			m.opts.CustomChars = m.input.original
			return m, m.changed()
		}
		return m, nil
	case "enter":
		return m.submit()
	case "backspace":
		if n := len(m.input.value); n > 0 {
			m.input.value = m.input.value[:n-1]
		}
		return m, m.typedChars()
	case "ctrl+u":
		m.input.value = nil
	default:
		if msg.Text != "" {
			m.input.value = append(m.input.value, []rune(msg.Text)...)
			return m, m.typedChars()
		}
	}
	return m, nil
}

// typedChars makes the preview follow a custom set while it is typed. A set
// that isn't valid yet (one character so far) leaves the preview as it was.
func (m *Model) typedChars() tea.Cmd {
	if m.input.purpose != forChars {
		return nil
	}
	text := string(m.input.value)
	if _, err := engine.ParseCustomChars(text); err != nil || text == m.opts.CustomChars {
		return nil
	}
	m.opts.CustomChars = text
	return m.changed()
}

func (m *Model) submit() (tea.Model, tea.Cmd) {
	text := string(m.input.value)
	m.mode = modeNormal

	switch m.input.purpose {
	case forOpen:
		path := cleanPath(text)
		if path == "" {
			return m, nil
		}
		return m, m.load(path)

	case forSave:
		path := cleanPath(text)
		if path == "" {
			return m, nil
		}
		if m.deps.Exists(path) {
			m.pending = path
			m.mode = modeConfirm
			return m, nil
		}
		return m, m.save(path)

	case forChars:
		if _, err := engine.ParseCustomChars(text); err != nil {
			m.opts.CustomChars = m.input.original
			return m, tea.Batch(m.changed(), m.say(err.Error(), true))
		}
		m.opts.CustomChars = text
		return m, m.changed()

	case forNumber:
		if err := m.setNumber(m.input.setting, text); err != nil {
			return m, m.say(err.Error(), true)
		}
		return m, m.changed()
	}
	return m, nil
}

func (m *Model) confirmKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "y", "Y":
		path := m.pending
		m.mode, m.pending = modeNormal, ""
		return m, m.save(path)
	case "ctrl+c":
		return m, tea.Quit
	case "n", "N", "esc", "q":
		m.mode, m.pending = modeNormal, ""
		return m, m.say("Not saved", false)
	}
	return m, nil
}

func (m *Model) save(path string) tea.Cmd {
	grid := m.current()
	if grid == nil {
		return m.say("Nothing to save yet", true)
	}
	format, ok := engine.FormatForFile(path)
	if !ok {
		format = engine.FormatANSI
	}
	if err := m.deps.Save(path, grid.Export(format, engine.TrueColor)+"\n"); err != nil {
		return m.say("Can't save: "+err.Error(), true)
	}
	return m.say(fmt.Sprintf("Saved %s (%s)", filepath.Base(path), format), false)
}
