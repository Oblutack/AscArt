# Media

The pictures and recordings used in the main README.

| File | What it is |
| --- | --- |
| `banner.jpg` | The banner at the top. The globe is `ascart convert` output, set in HTML. |
| `desktop-hero.jpg`, `desktop-gallery.png`, `desktop-widget.png` | Screenshots of the desktop app. |
| `desktop-convert.gif`, `desktop-animation.gif` | The desktop app converting a picture and playing an animation. |
| `tui-settings.gif`, `tui-play.gif` | The interactive terminal app. |
| `cli-convert.gif`, `cli-play.gif` | The `ascart` command. |
| `samples/` | The pictures used in the recordings. Try them yourself. |

## How they were made

Nothing here is a mock-up.

* **Desktop:** Playwright drives the real Electron app with the real Python
  backend, taking screenshots as it goes. The mouse pointer is drawn on top
  because screenshots don't include one.
* **Terminal app:** the real interactive app runs against a pipe, a script
  presses the keys, and everything it draws is recorded with its timing. The
  recording is replayed in a terminal emulator (xterm.js) and captured.
* **Command line:** the real `ascart` binary runs and its output is shown after a
  typed prompt. The animation is the binary's own output with its own timing.

The sessions are scripted, so they show the same thing every time.

## Samples

* `earth.jpg`: *The Earth seen from Apollo 17* (the "Blue Marble"), a NASA photo
  in the public domain, from
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg),
  scaled down to 1000 pixels.
* `sunset.jpg` and `plasma.gif`: drawn with maths by `make_samples.py`, so they
  have no license at all. Run it again to get the same files back.
