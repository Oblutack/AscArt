package tui

import (
	"context"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/mattn/go-runewidth"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

// ---- opening and converting ------------------------------------------------

func TestStartsEmptyAndExplainsHowToBegin(t *testing.T) {
	h := newHarness(t)
	h.wantScreen("no file", "Press o to open a picture", "Width", "Characters", "Brightness")
}

func TestOpeningAFileConvertsAndShowsIt(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")

	h.wantScreen("red.png", "characters", "Opened red.png")
	if h.m.current() == nil || h.m.current().Cols != 120 {
		t.Fatalf("expected a 120 column grid, got %+v", h.m.current())
	}
	if strings.Contains(h.screen(), "frame") {
		t.Error("a still picture has no frame counter")
	}
}

func TestOpenFromTheCommandLineLoadsOnStart(t *testing.T) {
	h := newHarness(t)
	h.m.path = "start.png"
	if cmd := h.m.Init(); cmd == nil {
		t.Fatal("Init should load the file it was given")
	} else {
		h.exec(cmd)
	}
	if len(h.loads) != 1 || h.loads[0] != "start.png" {
		t.Errorf("loads: %v", h.loads)
	}
}

func TestTheTerminalMustBeBigEnough(t *testing.T) {
	h := newHarness(t)
	h.send(tea.WindowSizeMsg{Width: 40, Height: 10})
	h.wantScreen("Terminal too small", "40×10")
	h.send(tea.WindowSizeMsg{Width: 100, Height: 30})
	h.wantNoScreen("Terminal too small")
	h.wantScreen("Width")
}

func TestNothingIsDrawnBeforeTheSizeIsKnown(t *testing.T) {
	m := New(t.Context(), Deps{}, engine.DefaultOptions(), "")
	if got := m.View().Content; got != "" {
		t.Errorf("got %q", got)
	}
}

func TestTheViewAsksForTheAlternateScreenAndMouse(t *testing.T) {
	h := newHarness(t)
	view := h.m.View()
	if !view.AltScreen || view.MouseMode != tea.MouseModeCellMotion {
		t.Errorf("alt screen %v, mouse %v", view.AltScreen, view.MouseMode)
	}
}

func TestALoadErrorIsShownAndKeepsWhatWasOpen(t *testing.T) {
	h := newHarness(t)
	h.open("first.png")
	h.loadErr = errBoom

	h.press("o")
	h.typeText("x")
	h.press("enter")

	h.wantScreen("boom", "first.png")
	if h.m.source == nil || h.m.source.Name != "first.png" {
		t.Error("the picture that was open should stay open")
	}
}

func TestALateLoadFromAnEarlierOpenIsIgnored(t *testing.T) {
	h := newHarness(t)
	h.open("current.png")
	h.send(loadedMsg{id: h.m.loadID - 1, path: "old.png", source: &engine.Source{Name: "old.png", Frames: solidFrames(1, 0)}})
	if h.m.source.Name != "current.png" {
		t.Errorf("an old load replaced the current picture: %s", h.m.source.Name)
	}
}

// ---- settings --------------------------------------------------------------

func TestSettingsAreEditedWithTheArrowKeys(t *testing.T) {
	h := newHarness(t)

	// width is first: left/right is one, shift is ten
	h.press("right")
	if h.m.opts.Width != 121 {
		t.Errorf("width %d", h.m.opts.Width)
	}
	h.press("shift+left")
	if h.m.opts.Width != 111 {
		t.Errorf("width %d", h.m.opts.Width)
	}

	h.press("down", "right") // characters: detailed -> blocks
	if h.m.opts.Charset != "blocks" {
		t.Errorf("charset %q", h.m.opts.Charset)
	}
	h.press("left", "left") // back, then wraps to custom
	if h.m.opts.Charset != "custom" {
		t.Errorf("charset %q", h.m.opts.Charset)
	}

	h.press("down", "down", "right") // colors: original -> grayscale
	if h.m.opts.ColorScheme != "grayscale" {
		t.Errorf("scheme %q", h.m.opts.ColorScheme)
	}

	h.press("down", "right", "right") // brightness 0 -> 10
	if h.m.opts.Brightness != 10 {
		t.Errorf("brightness %d", h.m.opts.Brightness)
	}
	h.press("shift+right")
	if h.m.opts.Brightness != 35 {
		t.Errorf("brightness %d", h.m.opts.Brightness)
	}

	h.press("down", "shift+left") // contrast 100 -> 75
	if h.m.opts.Contrast != 75 {
		t.Errorf("contrast %d", h.m.opts.Contrast)
	}
}

func TestSettingsStayInRange(t *testing.T) {
	h := newHarness(t)

	h.m.opts.Width = engine.MaxWidth
	h.press("right", "shift+right")
	if h.m.opts.Width != engine.MaxWidth {
		t.Errorf("width went to %d", h.m.opts.Width)
	}
	h.m.opts.Width = 3
	h.press("shift+left")
	if h.m.opts.Width != engine.MinWidth {
		t.Errorf("width went to %d", h.m.opts.Width)
	}

	h.m.selected = setBrightness
	for range 30 {
		h.press("shift+right")
	}
	if h.m.opts.Brightness != 100 {
		t.Errorf("brightness %d", h.m.opts.Brightness)
	}
	h.m.selected = setContrast
	for range 30 {
		h.press("shift+left")
	}
	if h.m.opts.Contrast != 0 {
		t.Errorf("contrast %d", h.m.opts.Contrast)
	}
}

func TestSelectionWrapsAroundTheList(t *testing.T) {
	h := newHarness(t)
	h.press("up")
	if h.m.selected != numSettings-1 {
		t.Errorf("selected %d", h.m.selected)
	}
	h.press("down")
	if h.m.selected != 0 {
		t.Errorf("selected %d", h.m.selected)
	}
	h.press("j", "j", "k")
	if h.m.selected != 1 {
		t.Errorf("vim keys: selected %d", h.m.selected)
	}
}

func TestSpaceAndEnterToggleSwitches(t *testing.T) {
	h := newHarness(t)
	h.m.selected = setInvert
	h.press("space")
	if !h.m.opts.Invert {
		t.Error("space should turn invert on")
	}
	h.press("enter")
	if h.m.opts.Invert {
		t.Error("enter should turn it off again")
	}
	h.m.selected = setDither
	h.press("right")
	if !h.m.opts.Dither {
		t.Error("dither should be on")
	}
	h.m.selected = setKeep
	h.press("left")
	if !h.m.opts.KeepOriginal {
		t.Error("keep original should be on")
	}
}

func TestRatioCyclesThroughTheChoices(t *testing.T) {
	h := newHarness(t)
	h.m.selected = setRatio
	h.wantScreen("picture's own")
	h.press("right")
	if h.m.opts.Ratio != "1:1" {
		t.Errorf("ratio %q", h.m.opts.Ratio)
	}
	h.press("left", "left")
	if h.m.opts.Ratio != ratios[len(ratios)-1] {
		t.Errorf("ratio %q", h.m.opts.Ratio)
	}
	if err := h.m.opts.Validate(); err != nil {
		t.Errorf("every ratio on offer must be valid: %v", err)
	}
}

func TestEveryChoiceOnOfferIsValid(t *testing.T) {
	for _, charset := range charsets {
		for _, scheme := range schemes {
			for _, ratio := range ratios {
				o := engine.DefaultOptions()
				o.Charset, o.ColorScheme, o.Ratio, o.CustomChars = charset, scheme, ratio, "@#*+:. "
				if err := o.Validate(); err != nil {
					t.Errorf("%s/%s/%s: %v", charset, scheme, ratio, err)
				}
			}
		}
	}
}

func TestChangingSettingsConvertsOnceAfterAPause(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	before := h.convertCount()

	// five quick changes: only the debounce of the last one converts
	var cmds []tea.Cmd
	for range 5 {
		_, cmd := h.m.Update(keyMsg("right"))
		cmds = append(cmds, cmd)
	}
	for _, cmd := range cmds {
		h.exec(cmd)
	}

	if got := h.convertCount() - before; got != 1 {
		t.Errorf("expected 1 conversion for 5 quick changes, got %d", got)
	}
	if h.m.current().Cols != 125 {
		t.Errorf("the result should use the last width, got %d", h.m.current().Cols)
	}
}

func TestChangingSettingsWithNothingOpenConvertsNothing(t *testing.T) {
	h := newHarness(t)
	h.press("right", "down", "right")
	if h.convertCount() != 0 {
		t.Error("there is nothing to convert")
	}
}

func TestAnOutOfDateResultIsDropped(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	grid := h.m.current()

	h.send(convertedMsg{id: h.m.jobID - 1, grids: []*engine.Grid{engine.NewGrid(1, 1, false)}})

	if h.m.current() != grid {
		t.Error("a result from an older job replaced the current one")
	}
}

func TestConversionErrorsAreShownAndKeepThePreview(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	grid := h.m.current()

	h.m.opts.Charset = "custom"
	h.m.opts.CustomChars = "x" // too short
	h.send(debounceMsg{id: h.m.debounceID})

	h.wantScreen("Can't convert", "at least 2")
	if h.m.current() != grid {
		t.Error("the last good preview should stay")
	}
}

func TestEscStopsAConversionThatIsRunning(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")

	started := make(chan struct{})
	h.convertHook = func(ctx context.Context) error {
		close(started)
		<-ctx.Done()
		return ctx.Err()
	}

	cmd := h.m.startConvert()
	finished := make(chan tea.Msg, 1)
	go func() { finished <- cmd() }()
	<-started

	if h.m.busy == "" {
		t.Error("the app should say it is working")
	}
	h.press("esc")
	h.wantScreen("Stopped")

	select {
	case msg := <-finished:
		h.send(msg) // the cancelled job reports back
	case <-time.After(3 * time.Second):
		t.Fatal("the conversion did not stop")
	}
	if h.m.busy != "" || h.m.statusErr {
		t.Errorf("busy %q, error %v: a cancelled job is not an error", h.m.busy, h.m.statusErr)
	}
}

func TestOpeningAnotherFileCancelsTheConversionOfTheFirst(t *testing.T) {
	h := newHarness(t)
	h.open("first.png")

	var cancelled atomic.Bool
	started := make(chan struct{})
	h.convertHook = func(ctx context.Context) error {
		close(started)
		<-ctx.Done()
		cancelled.Store(true)
		return ctx.Err()
	}
	go h.m.startConvert()() // never mind the result
	<-started
	h.convertHook = nil

	h.open("second.png")

	deadline := time.Now().Add(3 * time.Second)
	for !cancelled.Load() && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if !cancelled.Load() {
		t.Error("the first conversion kept running")
	}
	h.wantScreen("second.png")
}

func TestResetBringsBackTheDefaults(t *testing.T) {
	h := newHarness(t)
	h.m.opts.Width, h.m.opts.Invert, h.m.opts.ColorScheme = 40, true, "sepia"
	h.m.opts.CustomChars = "XYZ"
	h.press("r")

	want := engine.DefaultOptions()
	got := h.m.opts
	if got.Width != want.Width || got.Invert || got.ColorScheme != want.ColorScheme {
		t.Errorf("%+v", got)
	}
	if got.CustomChars != "XYZ" {
		t.Error("the custom set is the user's own work and should survive a reset")
	}
	h.wantScreen("Settings reset")
}

// ---- typing values ---------------------------------------------------------

func TestTypingANumber(t *testing.T) {
	h := newHarness(t)
	h.press("enter") // width is selected
	h.wantScreen("Width: 120")
	h.press("ctrl+u")
	h.typeText("64")
	h.press("enter")

	if h.m.opts.Width != 64 {
		t.Errorf("width %d", h.m.opts.Width)
	}
}

func TestTypedNumbersAreChecked(t *testing.T) {
	cases := map[string]string{"abc": "not a number", "0": "between", "5000": "between"}
	for text, want := range cases {
		h := newHarness(t)
		h.press("enter", "ctrl+u")
		h.typeText(text)
		h.press("enter")
		if h.m.opts.Width != 120 {
			t.Errorf("%q: width became %d", text, h.m.opts.Width)
		}
		h.wantScreen(want)
	}

	h := newHarness(t)
	h.m.selected = setBrightness
	h.press("enter", "ctrl+u")
	h.typeText("-30")
	h.press("enter")
	if h.m.opts.Brightness != -30 {
		t.Errorf("brightness %d", h.m.opts.Brightness)
	}
	h.m.selected = setContrast
	h.press("enter", "ctrl+u")
	h.typeText("250")
	h.press("enter")
	if h.m.opts.Contrast != 100 {
		t.Errorf("contrast %d", h.m.opts.Contrast)
	}
}

func TestEscLeavesAPromptWithoutChanging(t *testing.T) {
	h := newHarness(t)
	h.press("enter", "ctrl+u")
	h.typeText("77")
	h.press("esc")
	if h.m.opts.Width != 120 || h.m.mode != modeNormal {
		t.Errorf("width %d, mode %d", h.m.opts.Width, h.m.mode)
	}
}

func TestBackspaceAndPaste(t *testing.T) {
	h := newHarness(t)
	h.press("o")
	h.typeText("ab")
	h.press("backspace", "backspace", "backspace") // one more than there is
	h.send(tea.PasteMsg{Content: "pasted\n.png"})
	h.wantScreen("Open: pasted.png")

	h.send(tea.PasteMsg{Content: "ignored"}) // still in the prompt: appended
	h.press("esc")
	h.send(tea.PasteMsg{Content: "no prompt open"})
	h.wantNoScreen("no prompt open")
}

func TestEditingTheCustomCharacterSet(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	h.m.selected = setChars

	h.press("enter")
	h.wantScreen("darkest to lightest", engine.DefaultOptions().CustomChars)
	if h.m.opts.Charset != "custom" {
		t.Error("editing the set should switch to it")
	}

	h.press("ctrl+u")
	h.typeText("AB")
	// the preview follows while typing
	if text := h.m.current().ToText(); strings.Trim(text, "AB\n ") != "" {
		t.Errorf("the preview should already use A and B: %.40q", text)
	}
	h.press("enter")
	if h.m.opts.CustomChars != "AB" {
		t.Errorf("chars %q", h.m.opts.CustomChars)
	}
}

func TestACustomSetThatIsNotValidYetIsExplainedOnEnter(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	h.m.selected = setChars
	h.press("enter", "ctrl+u")
	h.typeText("漢字")
	h.press("enter")

	h.wantScreen("single-width")
	if h.m.opts.CustomChars == "漢字" {
		t.Error("an invalid set must not be kept")
	}
}

// ---- keys that are not settings --------------------------------------------

func TestQuit(t *testing.T) {
	for _, key := range []string{"q", "ctrl+c"} {
		h := newHarness(t)
		h.press(key)
		if !h.quit {
			t.Errorf("%s should quit", key)
		}
	}
}

func TestQuitFromPromptsNeedsCtrlC(t *testing.T) {
	h := newHarness(t)
	h.press("o")
	h.press("q") // typed into the prompt
	if h.quit {
		t.Error("q in a prompt is just a letter")
	}
	h.press("ctrl+c")
	if !h.quit {
		t.Error("ctrl+c always quits")
	}
}

func TestHelpOpensAndCloses(t *testing.T) {
	h := newHarness(t)
	h.press("?")
	h.wantScreen("Keys", "Settings", "Preview", "ffmpeg")
	h.press("x") // other keys do nothing
	h.wantScreen("Keys")
	h.press("esc")
	h.wantNoScreen("Keys")

	h.press("?", "?")
	h.wantNoScreen("Keys")
	h.press("?", "ctrl+c")
	if !h.quit {
		t.Error("ctrl+c quits from help too")
	}
}

func TestTabMovesFocusAndTheArrowsFollow(t *testing.T) {
	h := newHarness(t)
	h.press("tab")
	h.press("down")
	if h.m.selected != 0 {
		t.Error("with the preview focused, down should scroll and not change the selection")
	}
	h.press("tab", "down")
	if h.m.selected != 1 {
		t.Error("back on the settings, down picks the next setting")
	}
}

func TestPreviewScrolls(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	h.m.opts.Width = 300
	h.m.opts.Ratio = "9:16"
	h.send(debounceMsg{id: h.m.debounceID})

	h.press("tab")
	h.press("right")
	if h.m.preview.XOffset() != 4 {
		t.Errorf("x offset %d", h.m.preview.XOffset())
	}
	h.press("left")
	if h.m.preview.XOffset() != 0 {
		t.Errorf("x offset %d", h.m.preview.XOffset())
	}
	h.press("down", "down", "j")
	if h.m.preview.YOffset() != 3 {
		t.Errorf("y offset %d", h.m.preview.YOffset())
	}
	h.press("pgdown")
	if h.m.preview.YOffset() <= 3 {
		t.Errorf("y offset %d", h.m.preview.YOffset())
	}
	h.press("end")
	if !h.m.preview.AtBottom() {
		t.Error("end should reach the bottom")
	}
	h.press("pgup", "home")
	if h.m.preview.YOffset() != 0 {
		t.Errorf("home: y offset %d", h.m.preview.YOffset())
	}
}

func TestMouseWheelScrolls(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	h.m.opts.Width = 300
	h.m.opts.Ratio = "9:16"
	h.send(debounceMsg{id: h.m.debounceID})

	h.send(tea.MouseWheelMsg{Button: tea.MouseWheelDown})
	if h.m.preview.YOffset() != 3 {
		t.Errorf("y offset %d", h.m.preview.YOffset())
	}
	h.send(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
	h.send(tea.MouseWheelMsg{Button: tea.MouseWheelRight})
	if h.m.preview.YOffset() != 0 || h.m.preview.XOffset() != 8 {
		t.Errorf("offsets %d, %d", h.m.preview.XOffset(), h.m.preview.YOffset())
	}
	h.send(tea.MouseWheelMsg{Button: tea.MouseWheelLeft})
	if h.m.preview.XOffset() != 0 {
		t.Errorf("x offset %d", h.m.preview.XOffset())
	}
}

func TestVSwitchesBetweenTheArtAndTheOriginal(t *testing.T) {
	h := newHarness(t)
	h.press("v")
	if h.m.showSource {
		t.Error("nothing to show yet")
	}

	h.open("red.png")
	h.press("v")
	h.wantScreen("showing the original", "▀")
	h.press("v")
	h.wantNoScreen("showing the original", "▀")
}

// ---- saving and copying ----------------------------------------------------

func TestSaveWritesTheFormatOfTheExtension(t *testing.T) {
	cases := map[string]string{
		"out.txt":  "",
		"out.html": "<!DOCTYPE html>",
		"out.ans":  "\x1b[",
		"out":      "\x1b[", // no extension: ansi
	}
	for name, marker := range cases {
		h := newHarness(t)
		h.open("red.png")
		h.press("s")
		h.wantScreen("Save as: red.ans")
		h.press("ctrl+u")
		h.typeText(name)
		h.press("enter")

		data, ok := h.saved[name]
		if !ok {
			t.Fatalf("%s was not saved: %v", name, h.saved)
		}
		if marker != "" && !strings.Contains(data, marker) {
			t.Errorf("%s should contain %q: %.60q", name, marker, data)
		}
		if marker == "" && strings.Contains(data, "\x1b") {
			t.Errorf("%s must be plain text", name)
		}
		h.wantScreen("Saved " + name)
	}
}

func TestSaveAsksBeforeOverwriting(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	h.existing["red.ans"] = true

	h.press("s", "enter")
	h.wantScreen("red.ans exists. Overwrite?")
	if len(h.saved) != 0 {
		t.Fatal("saved without asking")
	}

	h.press("n")
	if len(h.saved) != 0 {
		t.Error("n should not save")
	}
	h.wantScreen("Not saved")

	h.press("s", "enter", "y")
	if _, ok := h.saved["red.ans"]; !ok {
		t.Error("y should save")
	}
}

func TestOverwriteQuestionIgnoresOtherKeys(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	h.existing["red.ans"] = true
	h.press("s", "enter", "x", "tab", "o")
	h.wantScreen("Overwrite?")
	h.press("esc")
	h.wantNoScreen("Overwrite?")
	h.press("s", "enter", "ctrl+c")
	if !h.quit {
		t.Error("ctrl+c quits from the question too")
	}
}

func TestSaveErrorsAreShown(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	h.saveErr = errBoom
	h.press("s", "enter")
	h.wantScreen("Can't save: boom")
}

func TestSaveWithNothingOpen(t *testing.T) {
	h := newHarness(t)
	h.press("s")
	h.wantScreen("Nothing to save yet")
	if h.m.mode != modeNormal {
		t.Error("no prompt should open")
	}
}

func TestCopySendsThePlainTextToTheClipboard(t *testing.T) {
	h := newHarness(t)
	h.press("c")
	h.wantScreen("Nothing to copy yet")

	h.open("red.png")
	h.press("c")
	if len(h.clipboard) != 1 || h.clipboard[0] != h.m.current().ToText() {
		t.Errorf("clipboard: %q", h.clipboard)
	}
	h.wantScreen("Copied the art as text")
}

func TestPathsAreCleanedUp(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	cases := map[string]string{
		"  plain.png  ":             "plain.png",
		`"quoted file.png"`:         "quoted file.png",
		`'single quoted.png'`:       "single quoted.png",
		`"unbalanced.png`:           `"unbalanced.png`,
		"":                          "",
		"~":                         home,
		"~/pictures/cat.png":        filepath.Join(home, "pictures", "cat.png"),
		"relative/dir/pic.png":      "relative/dir/pic.png",
		`C:\Users\me\My Pics\a.png`: `C:\Users\me\My Pics\a.png`,
	}
	if runtime.GOOS != "windows" {
		// terminals paste dragged files with escaped spaces; on Windows the
		// backslash is a path separator
		cases[`escaped\ space.png`] = "escaped space.png"
	}
	for in, want := range cases {
		if got := cleanPath(in); got != want {
			t.Errorf("cleanPath(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestOpenCleansTheTypedPath(t *testing.T) {
	h := newHarness(t)
	h.press("o")
	h.typeText(`"my cat.png"`)
	h.press("enter")
	if len(h.loads) != 1 || h.loads[0] != "my cat.png" {
		t.Errorf("loads: %v", h.loads)
	}

	h.press("o", "ctrl+u", "enter")
	if len(h.loads) != 1 {
		t.Error("an empty path should not load anything")
	}
}

// ---- animation -------------------------------------------------------------

func TestAnimationsStartPlayingAndAdvance(t *testing.T) {
	h := newHarness(t)
	h.open("loop.gif")
	h.wantScreen("▶ frame 1/3")
	if len(h.frameTick) != 1 {
		t.Fatalf("a tick should be waiting, got %d", len(h.frameTick))
	}

	h.send(h.frameTick[len(h.frameTick)-1])
	h.wantScreen("▶ frame 2/3")
	h.send(h.frameTick[len(h.frameTick)-1])
	h.send(h.frameTick[len(h.frameTick)-1])
	h.wantScreen("▶ frame 1/3") // wrapped around
}

func TestEachFrameShowsItsOwnPicture(t *testing.T) {
	h := newHarness(t)
	h.open("loop.gif")
	first := h.m.current().ToANSI(engine.TrueColor)
	h.send(h.frameTick[len(h.frameTick)-1])
	if h.m.current().ToANSI(engine.TrueColor) == first {
		t.Error("frame 2 looks like frame 1")
	}
}

func TestPauseStopsTheAnimationAndIgnoresTicksOnTheWay(t *testing.T) {
	h := newHarness(t)
	h.open("loop.gif")
	waiting := h.frameTick[len(h.frameTick)-1]

	h.press("p")
	h.wantScreen("⏸ frame 1/3")
	h.send(waiting) // the tick that was already scheduled
	h.wantScreen("⏸ frame 1/3")

	h.press("p")
	h.wantScreen("▶ frame 1/3")
	h.send(waiting) // and the old one still must not count: a new generation runs
	h.wantScreen("▶ frame 1/3")
}

func TestStepFrameByFrame(t *testing.T) {
	h := newHarness(t)
	h.open("loop.gif")

	h.press(".")
	h.wantScreen("⏸ frame 2/3")
	h.press(".", ".")
	h.wantScreen("frame 1/3")
	h.press(",")
	h.wantScreen("frame 3/3")
}

func TestStillPicturesIgnoreAnimationKeys(t *testing.T) {
	h := newHarness(t)
	h.open("red.png")
	h.press(".", ",")
	h.press("p")
	h.wantScreen("isn't animated")
	if h.m.frame != 0 {
		t.Error("frame moved")
	}
}

func TestChangingSettingsMidAnimationKeepsTheFrame(t *testing.T) {
	h := newHarness(t)
	h.open("loop.gif")
	h.press(".", ".")
	h.press("right")
	h.wantScreen("frame 3/3")
}

func TestAReloadedAnimationStartsAtTheFirstFrame(t *testing.T) {
	h := newHarness(t)
	h.open("loop.gif")
	h.press(".", ".")
	h.open("other.gif")
	h.wantScreen("▶ frame 1/3")
}

func TestPlaybackSurvivesAConversionFinishingLate(t *testing.T) {
	h := newHarness(t)
	h.open("loop.gif")
	h.frameTick = nil

	h.press("right") // a new conversion while playing
	if len(h.frameTick) == 0 {
		t.Error("playback should keep going after the new frames arrive")
	}
}

// ---- footer ----------------------------------------------------------------

func TestFooterShowsKeysThenMessagesThenKeysAgain(t *testing.T) {
	h := newHarness(t)
	h.m.say("", false)
	h.m.status = ""
	h.wantScreen("o open · s save · c copy")

	cmd := h.m.say("something happened", false)
	h.wantScreen("something happened")
	h.exec(cmd)
	h.send(statusExpiredMsg{id: h.m.statusID})
	h.wantScreen("o open · s save")

	h.m.say("first", false)
	stale := h.m.statusID
	h.m.say("second", false)
	h.send(statusExpiredMsg{id: stale})
	h.wantScreen("second")
}

func TestBusyIsShownWithAHintToStop(t *testing.T) {
	h := newHarness(t)
	h.m.busy = "Converting"
	h.wantScreen("Converting…", "esc to stop")
}

func TestLayoutFollowsTheWindow(t *testing.T) {
	h := newHarness(t)
	h.send(tea.WindowSizeMsg{Width: 140, Height: 40})
	if h.m.preview.Width() != 140-settingsCols-2 || h.m.preview.Height() != 36 {
		t.Errorf("preview %dx%d", h.m.preview.Width(), h.m.preview.Height())
	}
	lines := strings.Split(h.screen(), "\n")
	if len(lines) != 40 {
		t.Errorf("the screen has %d lines for a 40 line terminal", len(lines))
	}
	// the two boxes fill the width and end on the same line
	for i, line := range lines[1 : len(lines)-1] {
		if w := runewidth.StringWidth(line); w != 140 {
			t.Errorf("body line %d is %d wide in a 140 column terminal", i, w)
		}
	}
	if last := lines[len(lines)-2]; !strings.HasPrefix(last, "╰") || strings.Count(last, "╯") != 2 {
		t.Errorf("both boxes should end on the same line: %q", last)
	}
}
