# ascart in the terminal

The same pictures-to-colored-ASCII conversion as the desktop app, as a single
program for the terminal: no Python, no Electron, one 4 MB file.

```
ascart                       open the interactive app
ascart convert cat.jpg       print the art
ascart play loop.gif         play an animation
```

## Install

Download the archive for your system from the
[releases page](https://github.com/Oblutack/AscArt/releases) (Windows, macOS and
Linux; Intel and ARM), unpack it and put `ascart` somewhere on your `PATH`.

Or build it. You need Go 1.26 or newer:

```bash
cd cli
go build -o ascart ./cmd/ascart
```

Videos need [ffmpeg](https://ffmpeg.org) on your `PATH` (or point `ASCART_FFMPEG`
at it). Pictures and GIFs need nothing.

## The interactive app

`ascart`, or `ascart tui picture.png`, opens a list of settings on the left and
the art on the right. Change a setting and the art follows a moment later.

| Key | |
| --- | --- |
| `↑` `↓` | pick a setting |
| `←` `→` or `space` | change it (hold `shift` for bigger steps) |
| `enter` | type a value, or edit your own character set |
| `o` | open a picture, GIF or video (you can drop a file onto the terminal to paste its path) |
| `s` | save as `.ans`, `.txt` or `.html`, by the extension you type |
| `c` | copy the art as text |
| `v` | switch between the art and the original picture |
| `p`, `,` `.` | play / pause, previous / next frame |
| `tab` | move between the settings and the preview, which then scrolls with the arrows, `pgup` `pgdn` `home` `end` or the mouse wheel |
| `r` | reset the settings |
| `esc` | stop a conversion that is running |
| `?` | help |
| `q` | quit |

The terminal needs to be at least 64 × 14. Colors are sent as full color and
your terminal's library reduces them if it can't show that many.

Copying uses the terminal's own clipboard escape sequence (OSC 52). Most modern
terminals allow it; some ask first or have it switched off.

## Commands

### `ascart convert <file>`

Prints the art, or writes it with `-o`. The format follows the extension:
`.html` (a page on a dark background), `.txt` (plain text) or `.ans` (colored
text for a terminal). `--format ansi|text|html` overrides it.

```bash
ascart convert cat.jpg --width 80
ascart convert cat.jpg --scheme sepia --dither -o cat.txt
ascart convert logo.png --chars " .oO@" --format html -o logo.html
ascart convert loop.gif --frame 5
```

When it prints to a terminal, the number of colors follows the terminal
(`COLORTERM`, `TERM`, `NO_COLOR`). In a pipe or a file there are no colors unless
you ask for them with `--colors`; a file written with `-o` gets full color.

### `ascart play <file>`

Plays a GIF or video in place. `--speed 2` is twice as fast, `--loops 3` plays
three times (the default is until `Ctrl+C`).

### Flags for all three

| Flag | |
| --- | --- |
| `--width N` | characters across, 1 to 1000 (default 120) |
| `--charset NAME` | `detailed`, `blocks` or `custom` |
| `--chars TEXT` | your own characters from darkest to lightest (2 to 100 single-width ones); implies `custom` |
| `--scheme NAME` | `original`, `grayscale`, `sepia`, `blue`, `green`, `red`, `purple`, `cyan` |
| `--brightness N` | -100 to 100 |
| `--contrast N` | 0 to 200 (100 changes nothing) |
| `--invert` | swap light and dark |
| `--dither` | black and white halftone |
| `--ratio W:H` | e.g. `16:9` (the default is the picture's own) |
| `--keep-original` | the picture's own size, up to 400 characters wide |
| `--colors MODE` | `auto`, `truecolor`, `256`, `16` or `none` (convert and play) |

Exit codes: 0 on success, 1 when something failed (a missing file, a broken
picture), 2 when the command was used wrongly.

## How it relates to the desktop app

`internal/engine` is a second implementation of the Python conversion
(`python/core`), checked against it: `testdata/make_golden.py` runs the Python
engine on a few small pictures and saves the results, and the Go tests compare
against them.

* Flat pictures match **exactly**, for every color scheme, character set,
  adjustment and ratio.
* Detailed pictures match almost everywhere: 99.5 to 100% of the characters on
  smooth gradients, 92.5% on hard stripe edges. The difference is the resize:
  Python uses Lanczos, which overshoots at hard edges, and Go averages the area.
* Halftone gives the same size and about the same amount of black; the dots are
  not in exactly the same places.

The desktop app also removes backgrounds (with rembg), which has no Go
equivalent, so that part stays in the desktop app.

## Developing

```bash
cd cli
go vet ./...
go test ./...                # the video tests skip themselves without ffmpeg
go test -race ./...          # needs a C compiler
```

```
cli/
├── cmd/ascart/          # main
├── internal/engine/     # conversion, rendering, loading (GIF, video)
├── internal/cli/        # convert, play, flags
├── internal/tui/        # the Bubble Tea app
└── testdata/            # test pictures and the Python results they are compared with
```

To refresh the reference results after changing the Python engine, run
`python ../cli/testdata/make_golden.py` from `python/` in an environment with
Pillow and NumPy.
