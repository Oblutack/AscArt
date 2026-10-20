<div align="center">

# AscArt

**A Modern Desktop Application for Converting Images and GIFs to ASCII Art**

Transform your images into stunning colored ASCII art with real-time preview, advanced image processing, animated GIF support, and desktop widgets.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/electron-latest-cyan.svg)](https://www.electronjs.org/)

---

### Demo

**Image Conversion with Color Schemes**

![conversion](https://github.com/user-attachments/assets/8f243c0b-1704-4c9d-87ef-f2069371e814)

**GIF Animation Support**

![conversion2](https://github.com/user-attachments/assets/a1261756-572d-4d92-af92-72484cda6bfd)

**Desktop Widget**

![widget](https://github.com/user-attachments/assets/2a99a32e-7bff-4f5a-9a72-97e06801cd9c)

---

</div>

## Overview

AscArt is a powerful desktop application that converts images and animated GIFs into colored ASCII art with pixel-perfect precision. Built with a modern tech stack combining Electron, React, and Python, it offers real-time processing, customizable character sets, comprehensive image adjustments, and desktop widget functionality for displaying your ASCII art on your desktop.

## Features

### Core Functionality

- **Colored ASCII Art** - Converts images with full RGB color preservation in HTML format
- **Image to ASCII Conversion** - Convert JPG, PNG, and other image formats with high fidelity
- **Animated GIF Support** - Process and playback animated GIFs frame-by-frame with original timing
- **Manual Conversion Control** - Convert only when you're ready with the dedicated Convert button
- **Color Schemes** - Choose from 8 color palettes including original, grayscale, sepia, and tinted variations
- **Desktop Widgets** - Display ASCII art and animated GIFs as floating desktop widgets
- **History Gallery** - Access previously converted art with full settings restoration and multi-select management
- **Settings Persistence** - All preferences automatically saved and restored between sessions

### Image Processing

- **Background Removal** - Automatically remove backgrounds using advanced AI segmentation (transparent pixels render as spaces)
- **Brightness & Contrast** - Fine-tune image parameters with intuitive sliders (-100 to +100 brightness, 0 to 200% contrast)
- **Color Inversion** - Invert colors for different artistic effects
- **Halftone Dithering** - Switch the output to a black-and-white Floyd-Steinberg halftone drawn with block characters
- **Aspect Ratio Control** - Maintain original ratios or choose from preset dimensions
- **Width Adjustment** - Customize output width from 20 to 300 characters (or keep the native size, capped at 400)

### Output Options

- **Character Sets** - Detailed and blocks, or write your own ramp from darkest to lightest
- **Color Schemes** - 8 palettes: Original, Grayscale, Sepia, Blue, Green, Red, Purple, Cyan
- **Colored HTML Export** - Save with full RGB color information preserved as HTML with inline styles; GIFs export as a self-contained animated page
- **Plain Text Export** - Save as monochrome .txt files
- **Font Zoom Controls** - Adjust display size from 4px to 12px for optimal viewing
- **Playback Controls** - For GIFs: play/pause, stop, speed adjustment (0.5x to 2x)
- **Stop Processing** - Cancel a long-running conversion; the Python backend is restarted so nothing stale comes back

### Widget Features

- **Multiple Widgets** - Create and manage multiple desktop widgets simultaneously
- **Draggable Windows** - Move widgets freely across your desktop
- **Desktop-Level Positioning** - Widgets stay below other applications without covering your work
- **Playback Controls** - Full GIF animation controls (play/pause, previous/next frame)
- **Resizable Text** - Adjust font size from 2px to 20px with on-screen controls
- **Context Menu** - Right-click for quick access to controls and removal
- **Persistent State** - Widgets maintain settings and position until closed

## Technology Stack

### Frontend

- **React.js + Vite** - Component-based UI, built with Vite
- **Electron** - Cross-platform desktop application framework
- **CSS Grid & Flexbox** - Responsive, professional layout system

### Backend

- **Python 3.12** - High-performance image processing engine
- **Pillow (PIL)** - Image loading, LANCZOS resizing and Floyd-Steinberg dithering
- **NumPy** - Vectorised character mapping and color schemes
- **RemBG** - AI-powered background removal (lazy-loaded)

### Architecture

- **IPC Communication** - JSON-based stdin/stdout bridge between Electron and Python; the UI only sees a small `window.ascart` API exposed by a preload script (context isolation, sandbox and a Content-Security-Policy are on)
- **Asynchronous Processing** - Non-blocking UI with background Python subprocess and cancellable operations
- **State Management** - React hooks with manual conversion control for optimal performance
- **Settings Persistence** - JSON-based user preferences stored in Electron's userData directory
- **Modular Design** - Separated concerns with dedicated processor classes
- **Widget System** - Multiple BrowserWindow instances, each loading `electron/widget/widget.html`
- **Color Transformation** - RGB manipulation with 8 different color scheme algorithms
- **Compact Output** - Neighbouring characters with the same (rounded) color share one `<span>`, which keeps results and history small

## Prerequisites

Before installation, ensure you have the following installed:

- **Python 3.12 or higher** - [Download Python](https://www.python.org/downloads/)
- **Node.js 18+ and npm** - [Download Node.js](https://nodejs.org/)
- **Git** - For cloning the repository

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Oblutack/AscArt.git
cd AscArt
```

### 2. Install Node Dependencies

```bash
npm install
```

### 3. Setup Python Environment

```bash
cd python
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

## Running the Application

### Development Mode

In development the app starts the Python backend with the first of these it finds: the `ASCART_PYTHON` environment variable, `python/venv`, or `python` / `python3` on your PATH.

```bash
npm start
```

This will:

1. Start the Vite development server (port 3000, with hot reload)
2. Launch the Electron window
3. Initialize the Python subprocess for image processing

### Production Build

Build from the `python/venv` described above, not from a global Python: the engine bundles whatever versions are installed, and mismatched onnxruntime/scipy/opencv packages can leave background removal broken in the packaged app.

```bash
npm run build
```

This builds the React app, bundles the Python backend into `python/dist/engine` (`engine.exe` on Windows) with PyInstaller (`python/engine.spec`), and packages everything with electron-builder for the platform you run it on. The result is in the `dist` folder: an installer and a 7z on Windows, a dmg and zip on macOS, an AppImage on Linux. The steps are also available separately as `npm run react-build`, `npm run build:engine` and `npm run dist`.

### Releases

Push a tag such as `v1.2.0` and the **Release** workflow builds Windows, macOS (Apple Silicon) and Linux packages on GitHub's runners, checks that each bundled engine answers a ping, and attaches everything to a GitHub release. You can also start it by hand from the Actions tab to build without releasing. Builds are unsigned unless you add `CSC_LINK` and `CSC_KEY_PASSWORD` as repository secrets.

The app icon is generated by `python assets/make_icon.py`.

### Tests and checks

```bash
npm run lint        # ESLint (React, hooks, accessibility) and Prettier
npm run typecheck   # TypeScript checking of the JavaScript (JSDoc + src/types.d.ts)
npm test            # Electron export helpers + the UI tests (Vitest, Testing Library)
npm run test:e2e    # builds the UI, then Playwright drives the real app

pip install -r python/requirements-dev.txt
cd python
python -m pytest    # image / GIF processing, cancelling, history, backend commands
python -m ruff check
```

The end-to-end tests launch Electron with the real Python backend, so they need Python with Pillow and NumPy on your PATH (or `ASCART_PYTHON`). They stub the native Save As dialog, so saved files are checked too.

GitHub Actions runs all of this on every push and pull request.

## Usage

### Basic Workflow

1. **Load Image** - Click "LOAD" or drop an image/GIF anywhere in the window
2. **Adjust Settings** - Use the panels on the left to customize your output:
   - Width: Character width of the output (20-300 characters)
   - Style: Choose character set (detailed or blocks)
   - Colors: Select from 8 color schemes (original, grayscale, sepia, etc.)
   - Ratio: Maintain aspect ratio or choose preset dimensions
   - Adjustments: Brightness, contrast, color inversion
   - Options: Background removal, keep original size (up to 400 characters wide)
3. **Click Convert** - Press the "CONVERT" button to generate ASCII art with your settings
4. **View Output** - Colored ASCII art appears in the right panel with zoom controls
5. **Save or Export** - "SAVE" opens a Save As dialog: HTML keeps the colors (animated for GIFs), TXT is plain text (first frame for GIFs)
6. **Create Widget** - Click "Widget" to display the ASCII art on your desktop

**Note:** Settings are automatically saved and restored when you reopen the app

### GIF Animation

- Load a GIF file to see it converted with frame-by-frame colored ASCII animation
- Transparent backgrounds are preserved (render as spaces in ASCII)
- Use playback controls: play/pause, stop, previous/next frame
- Adjust playback speed from 0.5x to 2x
- Original frame timing and delays are preserved

### Desktop Widgets

- Click "Widget" button to spawn a desktop widget window
- Create multiple widgets simultaneously
- Drag widgets by clicking on the ASCII display area
- Right-click for context menu (show controls or remove widget)
- Use control panel for:
  - Hide/show controls
  - GIF playback controls (for animated content)
  - Font size adjustment (2px-20px)
  - Close widget
- Widgets stay at desktop level (behind other application windows)
- Widgets are frameless and transparent for clean appearance

### History Gallery

- Click "History" to view all previously converted images and GIFs
- Thumbnails show preview of ASCII art with 500-character preview
- Multi-select support: Ctrl+Click to select multiple items
- "Select All" button for batch operations
- Delete selected items with the delete button (X icon on selected items)
- Load any item to restore both the ASCII art and all original settings
- GIFs load with full animation data and frame information

## Project Structure

```
AscArt/
├── electron/
│   ├── main.js              # Main process: windows, Python subprocess, Save As, IPC
│   ├── preload.js           # The window.ascart API exposed to the React app
│   ├── export.js            # Plain-text / standalone-HTML export helpers (+ export.test.js)
│   └── widget/              # Desktop widget page, styles, script and preload
├── python/
│   ├── main.py              # Python entry point, command handlers, stdin reader thread
│   ├── engine.spec          # PyInstaller recipe for the bundled backend
│   ├── requirements.txt     # Python dependencies
│   ├── requirements-dev.txt # Just enough to run the tests and ruff
│   ├── core/
│   │   ├── art.py               # The Grid of cells: renders to HTML, ANSI or text
│   │   ├── image_processor.py   # Image to ASCII / halftone conversion
│   │   ├── gif_processor.py     # GIF frame processing
│   │   ├── cancel.py            # Cooperative cancellation of a running conversion
│   │   └── file_handler.py      # History storage (index + one file per entry)
│   ├── tests/               # pytest suite
│   └── benchmarks/          # Conversion timings
├── src/
│   ├── main.jsx, App.jsx    # Entry point and the app, composed from hooks
│   ├── ascart.js            # Access to window.ascart (fakeable in tests)
│   ├── types.d.ts           # Types for the backend messages and the ascart API
│   ├── hooks/               # useSettings, useConversion, useLivePreview, ...
│   ├── components/
│   │   ├── Generator/       # Input, output, and control panels
│   │   ├── Gallery/         # History gallery modal
│   │   └── Shared/          # Reusable UI components (buttons, toast, ...)
│   ├── layouts/
│   │   └── MainLayout.jsx   # Application layout wrapper
│   ├── styles/
│   │   └── main.css         # Global styling and theming
│   └── test/                # Test setup and a fake window.ascart
├── e2e/                     # Playwright end-to-end tests and fixtures
├── assets/                  # App icon (and the script that draws it)
├── scripts/                 # build-engine.js
├── index.html               # HTML entry point (the CSP is filled in by vite.config.mjs)
├── vite.config.mjs          # Build, dev server and Vitest settings
└── BACKEND_DOCS.md          # Electron <-> Python message reference
```

## Configuration

### Where your data lives

History is stored in Electron's per-user data folder (on Windows `%APPDATA%\asc-art\output\history\`), next to `settings.json`: a small `index.json` with a thumbnail of every entry, plus one file per entry that is read when you open it. A history from an older version (`history.json`) is converted automatically on first start and kept as `history.json.migrated`. Set `ASCART_DATA_DIR` to put the history somewhere else when running the backend by hand. The entry limit (50) is `MAX_HISTORY_ENTRIES` in `python/core/file_handler.py`.

### Electron Settings

Edit `electron/main.js` to customize:

- Window dimensions (default: 1200x700)
- Window behavior (frameless, transparent)
- DevTools availability

### Character Sets

Modify `python/core/image_processor.py` to add custom character sets:

```python
CHARSETS = {
    'detailed': '@%#*+=-:. ',
    'blocks': '█▓▒░ ',
}
```

Characters run from dark to light. Add the new name to the Style dropdown in `src/components/Generator/WidthPanel.js` as well. (`standard` and `simple` still work as aliases for `detailed` and `blocks`, so older history entries load.)

### Color Palette

The application uses a modern grayscale aesthetic. Modify `src/styles/main.css` to customize:

```css
/* Main color variables */
--bright-snow: #f8f9fa; /* Primary text */
--platinum: #e9ecef; /* Reserved for highlights */
--alabaster: #dee2e6; /* Secondary text */
--pale-slate: #ced4da; /* Action panel accent */
--pale-slate-2: #adb5bd; /* Primary UI accent */
--slate-grey: #6c757d; /* Width panel accent */
--iron-grey: #495057; /* Style/Output panel accent */
--gunmetal: #343a40; /* Panel backgrounds */
--shadow-grey: #212529; /* Main background */
--danger: #dc3545; /* Errors, destructive actions */
```

They live in the `:root` block at the top of `main.css`; the `-rgb` twins (for example `--pale-slate-2-rgb`) exist so translucent colors can use `rgba(var(--pale-slate-2-rgb), 0.3)`.

## Troubleshooting

### Python Path Issues

If the app can't find Python, point it at one with an environment variable before starting:

```bash
# Windows (PowerShell)
$env:ASCART_PYTHON = "C:\path\to\python.exe"; npm start

# macOS / Linux
ASCART_PYTHON=/path/to/python npm start
```

Otherwise create the `python/venv` described above, or make sure `python` is on your PATH.

### Port Already in Use

If port 3000 is occupied:

```bash
# Find and kill the process (Windows)
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

### Background Removal Not Working

RemBG downloads ML models on first use. Ensure:

- Stable internet connection
- Sufficient disk space (~200MB)
- Python has write permissions in the package directory

## Performance Optimization

- **Large Images**: Images are resized to the chosen width; "Keep Original" is capped at 400 characters wide
- **GIF Frame Count**: High frame count GIFs take longer to process; progress is shown per frame
- **Background Removal**: Disable for faster processing when not needed (adds AI segmentation overhead)
- **Width Setting**: Lower width values process faster (fewer pixels to process)
- **Widget Optimization**: Widgets receive their frames once over IPC instead of through a generated temp file
- **Color Processing**: Colors and character mapping are computed on whole arrays, so color schemes cost almost nothing

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Known Limitations

- Widget windows cannot be minimized to taskbar (by design - desktop overlay mode)
- Very large GIFs (500+ frames) may take time to load in widgets
- Background removal requires internet connection on first use (model download)
- Maximum recommended width: 300 characters for optimal performance

## Future Enhancements

- Custom color palette selection
- Video file support (.mp4, .avi)
- Batch conversion mode
- Export as animated GIF
- Additional character set presets
- Widget opacity controls
- Saved widget configurations

## Acknowledgments

- Character set mapping algorithm inspired by classic ASCII art converters
- RemBG for AI-powered background removal
- Pillow and NumPy for efficient image processing
- Electron and React communities for excellent documentation

---

<div align="center">

**Built with Python, React, and Electron**

[GitHub Repository](https://github.com/Oblutack/AscArt) | [Report Issues](https://github.com/Oblutack/AscArt/issues)

</div>
