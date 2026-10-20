package tui

import (
	"context"
	"errors"
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/mattn/go-runewidth"
)

const (
	minWidth     = 64
	minHeight    = 14
	settingsCols = 34
)

var (
	accent  = lipgloss.Color("#7aa2f7")
	dim     = lipgloss.Color("#8a8fa3")
	bad     = lipgloss.Color("#f7768e")
	good    = lipgloss.Color("#9ece6a")
	titleSt = lipgloss.NewStyle().Bold(true).Foreground(accent)
	dimSt   = lipgloss.NewStyle().Foreground(dim)
	badSt   = lipgloss.NewStyle().Foreground(bad)
	goodSt  = lipgloss.NewStyle().Foreground(good)
	selSt   = lipgloss.NewStyle().Bold(true).Foreground(accent)
)

func isCancel(err error) bool { return errors.Is(err, context.Canceled) }

// layout sizes the preview to what is left of the terminal.
func (m *Model) layout() {
	// the boxes take the screen minus the header and footer lines; a box's
	// size includes its border, which the preview inside doesn't get
	m.preview.SetWidth(max(1, m.width-settingsCols-2))
	m.preview.SetHeight(max(1, m.height-2-2))
	m.refreshPreview()
}

// View draws the whole screen.
func (m *Model) View() tea.View {
	view := tea.NewView(m.render())
	view.AltScreen = true
	view.MouseMode = tea.MouseModeCellMotion
	view.WindowTitle = "ascart"
	return view
}

func (m *Model) render() string {
	if m.width == 0 {
		return "" // no size yet
	}
	if m.width < minWidth || m.height < minHeight {
		return fmt.Sprintf("Terminal too small: ascart needs at least %d×%d, this one is %d×%d.", minWidth, minHeight, m.width, m.height)
	}
	if m.mode == modeHelp {
		return m.header() + "\n" + m.helpBox() + "\n" + m.footer()
	}

	settings := m.box(m.settingsView(), settingsCols, m.height-2, m.focus == focusSettings)
	preview := m.box(m.preview.View(), m.width-settingsCols, m.height-2, m.focus == focusPreview)
	return m.header() + "\n" + lipgloss.JoinHorizontal(lipgloss.Top, settings, preview) + "\n" + m.footer()
}

func (m *Model) box(content string, width, height int, focused bool) string {
	color := dim
	if focused {
		color = accent
	}
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(color).
		Width(width).
		Height(height).
		MaxHeight(height).
		Render(content)
}

func (m *Model) header() string {
	name := "no file"
	if m.source != nil {
		name = m.source.Name
	}
	parts := []string{titleSt.Render("ascart"), name}

	if grid := m.current(); grid != nil {
		parts = append(parts, fmt.Sprintf("%d×%d characters", grid.Cols, grid.Rows))
	}
	if m.animated() {
		icon := "⏸"
		if m.playing {
			icon = "▶"
		}
		parts = append(parts, fmt.Sprintf("%s frame %d/%d", icon, m.frame+1, len(m.source.Frames)))
	}
	if m.showSource {
		parts = append(parts, "showing the original")
	}
	return " " + strings.Join(parts, dimSt.Render("  ·  "))
}

func (m *Model) settingsView() string {
	var out strings.Builder
	for s := setting(0); s < numSettings; s++ {
		label, value := s.label(), m.value(s)
		value = truncate(value, settingsCols-len(label)-8)

		line := fmt.Sprintf("%-13s %s", label, value)
		if s == m.selected {
			if m.focus == focusSettings {
				line = selSt.Render("› " + line)
			} else {
				line = "› " + line
			}
		} else {
			line = "  " + line
		}
		out.WriteString(line + "\n")
	}
	out.WriteString("\n" + dimSt.Render("↑↓ pick   ←→ change"))
	out.WriteString("\n" + dimSt.Render("shift = bigger steps"))
	out.WriteString("\n" + dimSt.Render("enter = type a value"))
	return out.String()
}

func truncate(text string, width int) string {
	if width < 1 {
		return ""
	}
	return runewidth.Truncate(text, width, "…")
}

func (m *Model) footer() string {
	switch m.mode {
	case modeInput:
		return " " + m.input.prompt + string(m.input.value) + "█" + dimSt.Render("   enter ok · esc cancel")
	case modeConfirm:
		return " " + badSt.Render(m.pending+" exists. Overwrite?") + dimSt.Render("  y / n")
	case modeHelp:
		return " " + dimSt.Render("press any of esc, q, ? or enter to go back")
	}

	// an error comes first, then what is running, then the last message
	switch {
	case m.status != "" && m.statusErr:
		return " " + badSt.Render(truncate(m.status, m.width-2))
	case m.busy != "":
		return " " + m.busy + "…  " + dimSt.Render("esc to stop")
	case m.status != "":
		return " " + goodSt.Render(truncate(m.status, m.width-2))
	}
	return " " + dimSt.Render("o open · s save · c copy · v original · p play · tab switch · ? help · q quit")
}

func (m *Model) helpBox() string {
	text := strings.Join([]string{
		titleSt.Render("Keys"),
		"",
		"  o            open a picture, GIF or video (drag a file in to paste its path)",
		"  s            save as .ans, .txt or .html (by the extension you type)",
		"  c            copy the art as text",
		"  v            switch between the art and the original",
		"  p            play / pause an animation",
		"  , and .      previous / next frame",
		"  tab          move between the settings and the preview",
		"  r            reset the settings",
		"  esc          stop a conversion that is running",
		"  ?            this help",
		"  q            quit",
		"",
		titleSt.Render("Settings") + dimSt.Render("  (the left box)"),
		"",
		"  ↑ ↓          pick a setting",
		"  ← →          change it (shift for bigger steps; space also works)",
		"  enter        type a value, or edit your own character set",
		"",
		titleSt.Render("Preview") + dimSt.Render("  (the right box, after tab)"),
		"",
		"  arrows       scroll   pgup/pgdn  a page   home/end  jump   mouse wheel too",
		"",
		dimSt.Render("Videos need ffmpeg. Everything runs on your computer."),
	}, "\n")
	return m.box(text, m.width, m.height-2, true)
}
