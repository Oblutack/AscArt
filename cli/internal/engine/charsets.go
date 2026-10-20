package engine

import (
	"errors"
	"fmt"
	"unicode"

	"github.com/mattn/go-runewidth"
)

const (
	minCustomChars = 2
	maxCustomChars = 100
)

var builtinRamps = map[string]string{
	"detailed": "@%#*+=-:. ",
	"blocks":   "█▓▒░ ",
}

// canonicalCharset maps the old names the app used to save onto the current
// ones.
func canonicalCharset(name string) string {
	switch name {
	case "standard":
		return "detailed"
	case "simple":
		return "blocks"
	default:
		return name
	}
}

// Ramp returns the characters to draw with, darkest first.
func Ramp(o Options) ([]rune, error) {
	name := canonicalCharset(o.Charset)
	if name == "custom" {
		return ParseCustomChars(o.CustomChars)
	}
	if ramp, ok := builtinRamps[name]; ok {
		return []rune(ramp), nil
	}
	// Like the Python engine: an unknown name draws with the default set
	return []rune(builtinRamps["detailed"]), nil
}

// narrow measures width the same way everywhere, whatever the user's locale
// says about ambiguous-width characters (block drawing characters are one
// cell wide here).
var narrow = func() *runewidth.Condition {
	condition := runewidth.NewCondition()
	condition.EastAsianWidth = false
	return condition
}()

// ParseCustomChars checks a user-written ramp: 2 to 100 characters, each of
// which takes exactly one cell (no CJK, emoji, combining marks or control
// characters). The message names the character that is the problem.
func ParseCustomChars(text string) ([]rune, error) {
	chars := []rune(text)

	for _, char := range chars {
		if !unicode.IsPrint(char) || unicode.Is(unicode.M, char) || narrow.RuneWidth(char) != 1 {
			return nil, fmt.Errorf("can't use %q: custom characters must be single-width and printable", char)
		}
	}
	if len(chars) < minCustomChars {
		return nil, errors.New("custom characters need at least 2 characters")
	}
	if len(chars) > maxCustomChars {
		return nil, errors.New("custom characters can be at most 100 characters")
	}
	return chars, nil
}
