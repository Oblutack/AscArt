package cli

import (
	"fmt"
	"os"

	"github.com/Oblutack/AscArt/cli/internal/engine"
)

func runConvert(args []string, env Env) error {
	fs := newFlagSet("convert", env.Stderr)
	var shared optionFlags
	shared.register(fs)
	output := fs.String("o", "", "write to this file")
	format := fs.String("format", "", "ansi, text or html")
	colors := fs.String("colors", "auto", "auto, truecolor, 256, 16 or none")
	frame := fs.Int("frame", 1, "which frame of a GIF or video")

	positional, seen, err := parse(fs, args)
	if err != nil {
		return err
	}
	if len(positional) != 1 {
		return usagef("convert needs exactly one file")
	}
	options, err := shared.finish(seen)
	if err != nil {
		return err
	}

	chosen, err := chooseFormat(*format, *output)
	if err != nil {
		return err
	}
	profile, err := chooseProfile(*colors, *output != "", env)
	if err != nil {
		return err
	}

	source, err := engine.LoadSource(env.Context, positional[0])
	if err != nil {
		return err
	}
	if *frame < 1 || *frame > len(source.Frames) {
		return usagef("%s has %d frame(s); --frame %d does not exist", source.Name, len(source.Frames), *frame)
	}

	grid, err := engine.Convert(source.Frames[*frame-1].Image, options)
	if err != nil {
		return err
	}

	art := grid.Export(chosen, profile)
	if *output == "" {
		_, err = fmt.Fprintln(env.Stdout, art)
		return err
	}
	if err := os.WriteFile(*output, []byte(art+"\n"), 0o644); err != nil {
		return fmt.Errorf("can't write %s: %w", *output, err)
	}
	return nil
}

func chooseFormat(flagValue, output string) (engine.Format, error) {
	if flagValue != "" {
		format, err := engine.ParseFormat(flagValue)
		if err != nil {
			return "", usagef("%v", err)
		}
		return format, nil
	}
	if format, ok := engine.FormatForFile(output); ok {
		return format, nil
	}
	return engine.FormatANSI, nil
}

// chooseProfile decides how many colors ANSI output uses: what was asked for,
// otherwise what the terminal can show, and always full color when writing
// to a file (the file is read somewhere else).
func chooseProfile(flagValue string, toFile bool, env Env) (engine.Profile, error) {
	if flagValue != "" && flagValue != "auto" {
		profile, err := engine.ParseProfile(flagValue)
		if err != nil {
			return engine.NoColor, usagef("%v", err)
		}
		return profile, nil
	}
	if toFile {
		return engine.TrueColor, nil
	}
	return engine.DetectProfile(env.Stdout, env.Environ), nil
}
