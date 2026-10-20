package cli

import (
	"errors"
	"flag"
	"io"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

// optionFlags are the flags that describe how the art looks, shared by
// convert, play and tui.
type optionFlags struct {
	options engine.Options
	// whether --charset was given, so --chars can imply "custom" without
	// overriding an explicit choice
	charsetGiven bool
}

func newFlagSet(name string, output io.Writer) *flag.FlagSet {
	fs := flag.NewFlagSet("ascart "+name, flag.ContinueOnError)
	// mistakes are reported once, by Run, and -h prints the full help there;
	// the flag package's own output would repeat both
	fs.SetOutput(io.Discard)
	fs.Usage = func() {}
	return fs
}

func (f *optionFlags) register(fs *flag.FlagSet) {
	f.options = engine.DefaultOptions()
	o := &f.options

	fs.IntVar(&o.Width, "width", o.Width, "characters across")
	fs.Func("charset", "detailed, blocks or custom", func(value string) error {
		o.Charset = value
		f.charsetGiven = true
		return nil
	})
	fs.Func("chars", "your own characters, darkest to lightest", func(value string) error {
		o.CustomChars = value
		return nil
	})
	fs.StringVar(&o.ColorScheme, "scheme", o.ColorScheme, "color scheme")
	fs.IntVar(&o.Brightness, "brightness", o.Brightness, "-100 to 100")
	fs.IntVar(&o.Contrast, "contrast", o.Contrast, "0 to 200")
	fs.BoolVar(&o.Invert, "invert", o.Invert, "swap light and dark")
	fs.BoolVar(&o.Dither, "dither", o.Dither, "black and white halftone")
	fs.StringVar(&o.Ratio, "ratio", o.Ratio, "W:H")
	fs.BoolVar(&o.KeepOriginal, "keep-original", o.KeepOriginal, "native size")
}

// finish applies the rules that depend on several flags together, then
// validates.
func (f *optionFlags) finish(seen map[string]bool) (engine.Options, error) {
	o := f.options
	if seen["chars"] && !f.charsetGiven {
		o.Charset = "custom"
	}
	if err := o.Validate(); err != nil {
		return o, usagef("%v", err)
	}
	return o, nil
}

// parse reads flags that may come before or after the file name
// (`convert cat.jpg --width 80` as well as `convert --width 80 cat.jpg`) and
// returns the arguments that are not flags.
func parse(fs *flag.FlagSet, args []string) (positional []string, seen map[string]bool, err error) {
	seen = map[string]bool{}
	for {
		if err = fs.Parse(args); err != nil {
			if errors.Is(err, flag.ErrHelp) {
				return nil, seen, err
			}
			return nil, seen, usagef("%v", err)
		}
		fs.Visit(func(f *flag.Flag) { seen[f.Name] = true })

		if fs.NArg() == 0 {
			return positional, seen, nil
		}
		positional = append(positional, fs.Arg(0))
		args = fs.Args()[1:]
	}
}
