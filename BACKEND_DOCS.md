# Backend reference

How the React app, Electron and the Python backend talk to each other.

## Overview

```
React UI  --window.ascart-->  preload.js  --IPC-->  electron/main.js
                                                        |  JSON, one object per line
                                                        v
                                           python/main.py  (stdin / stdout)
                                                        |
                                    core/image_processor, gif_processor, file_handler
```

- The page has no Node access. `electron/preload.js` exposes `window.ascart` and nothing else.
- `electron/main.js` only forwards the commands listed below to Python.
- Python reads one JSON object per line from stdin and answers with one or more JSON lines on stdout. Logs go to stderr.
- Saving files is handled by Electron (Save As dialog), not by Python.

## Commands

Every command may carry a `requestId`. Python copies it onto every message it sends back for that command, so the UI can ignore answers to requests it has stopped waiting for.

### `ping`

```json
{ "command": "ping" }
```

```json
{ "status": "success", "type": "pong", "message": "Pong from Python!" }
```

### `convert`

```json
{
  "command": "convert",
  "requestId": 3,
  "path": "C:/path/to/image.jpg",
  "options": {
    "width": 120,
    "charset": "detailed",
    "colorScheme": "original",
    "removeBackground": false,
    "brightness": 0,
    "contrast": 100,
    "invert": false,
    "dither": false,
    "ratio": null,
    "keepOriginal": false
  }
}
```

| option | meaning |
| --- | --- |
| `width` | Output width in characters. Halftone (`dither`) renders at 3x this width. |
| `charset` | `detailed` (`@%#*+=-:. `) or `blocks` (`█▓▒░ `). `standard` and `simple` are accepted as old names. |
| `colorScheme` | `original`, `grayscale`, `sepia`, `blue`, `green`, `red`, `purple`, `cyan` |
| `removeBackground` | Cut out the subject with rembg; removed cells become spaces. |
| `brightness` / `contrast` | -100..100 and 0..200 (100 = unchanged). |
| `invert` | Invert the colors before converting. |
| `dither` | Black-and-white Floyd-Steinberg halftone made of `█` and spaces instead of the character ramp. |
| `ratio` | `"16:9"`, `"4:3"`, `"1:1"`, `"9:16"` or `null` for the image's own ratio. |
| `keepOriginal` | Use the native size, capped at 400 characters wide. Ignores `ratio`. |

A `.gif` path is converted frame by frame. While it runs, Python sends progress messages:

```json
{ "status": "success", "type": "progress", "current": 4, "total": 24, "requestId": 3 }
```

Results:

```json
{ "status": "success", "type": "ascii-result", "ascii": "<span ...>@</span>...", "isGif": false, "requestId": 3 }
```

```json
{
  "status": "success",
  "type": "gif-result",
  "frames": ["...", "..."],
  "delays": [80, 80],
  "frameCount": 2,
  "requestId": 3
}
```

`ascii` and `frames` are HTML: one `<span style="color:rgb(r,g,b)">` per run of equal color, with `\n` between rows. Halftone output is plain text.

Every successful conversion is also written to the history.

### `get_history`

```json
{ "command": "get_history" }
```

```json
{ "status": "success", "type": "history", "history": [ { "id": "…", "timestamp": "…", "ascii": "…", "preview": "…", "options": {}, "isGif": false } ] }
```

GIF entries also carry `frames` and `delays`. Entries written by older versions get an `id` the first time the history is read.

### `delete_history`

```json
{ "command": "delete_history", "ids": ["…", "…"] }
```

```json
{ "status": "success", "type": "deleted", "removed": 2 }
```

### Errors

Any command can fail with:

```json
{ "status": "error", "error": "Conversion failed: …", "requestId": 3 }
```

## Messages Electron adds

| message | when |
| --- | --- |
| `{ "status": "success", "type": "stopped" }` | After `ascart.stop()`. |
| `{ "status": "error", "error": "…" }` (no `requestId`) | Python could not start, crashed, or is not running. |

**Stop** kills the Python process and starts a fresh one, because Python only reads its next command after finishing the current one. After an unexpected exit Electron restarts Python up to three times in a row.

## Data

| what | where |
| --- | --- |
| history | `<userData>/output/history.json` (last 50 entries) |
| settings | `<userData>/settings.json` |

`<userData>` is Electron's per-user folder (`%APPDATA%\asc-art` on Windows). When running the backend by hand, set `ASCART_DATA_DIR`, otherwise it uses `./output`.

## Trying the backend by hand

```bash
cd python
python main.py
```

Then type one JSON command per line, for example `{"command": "ping"}`.

Run the tests with `python -m pytest` from `python/` (install `requirements-dev.txt` first). `python benchmarks/bench_convert.py` prints conversion timings.
