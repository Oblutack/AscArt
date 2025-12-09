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
- **Dithering** - Apply Floyd-Steinberg dithering for enhanced detail and reduced color banding
- **Aspect Ratio Control** - Maintain original ratios or choose from preset dimensions
- **Width Adjustment** - Customize output width from 20 to 300 characters

### Output Options

- **Multiple Character Sets** - Detailed and blocks character sets for different styles
- **Color Schemes** - 8 palettes: Original, Grayscale, Sepia, Blue, Green, Red, Purple, Cyan
- **Colored HTML Export** - Save with full RGB color information preserved as HTML with inline styles
- **Plain Text Export** - Save as monochrome .txt files
- **Font Zoom Controls** - Adjust display size from 4px to 12px for optimal viewing
- **Playback Controls** - For GIFs: play/pause, stop, speed adjustment (0.5x to 2x)
- **Stop Processing** - Cancel long-running conversions with the stop button

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

- **React.js** - Modern component-based UI architecture
- **Electron** - Cross-platform desktop application framework
- **CSS Grid & Flexbox** - Responsive, professional layout system

### Backend

- **Python 3.12** - High-performance image processing engine
- **Pillow (PIL)** - Core image manipulation library
- **NumPy** - Efficient array operations for pixel data
- **RemBG** - AI-powered background removal (lazy-loaded)
- **OpenCV** - Advanced image processing capabilities
- **ImageIO** - GIF frame extraction and handling

### Architecture

- **IPC Communication** - JSON-based stdin/stdout bridge between Electron and Python
- **Asynchronous Processing** - Non-blocking UI with background Python subprocess and cancellable operations
- **State Management** - React hooks with manual conversion control for optimal performance
- **Settings Persistence** - JSON-based user preferences stored in Electron's userData directory
- **Modular Design** - Separated concerns with dedicated processor classes
- **Widget System** - Multiple BrowserWindow instances with temporary file loading
- **Color Transformation** - RGB manipulation with 8 different color scheme algorithms
- **Frame Optimization** - Sequential GIF processing with BILINEAR resampling for speed

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

```bash
npm start
```

This will:

1. Start the React development server (port 3000)
2. Launch the Electron window
3. Initialize the Python subprocess for image processing

### Production Build

```bash
npm run build
npm run electron-pack
```

The packaged application will be available in the `dist` folder.

## Usage

### Basic Workflow

1. **Load Image** - Click "Load Image" or drag & drop an image/GIF into the input panel
2. **Adjust Settings** - Use the panels on the left to customize your output:
   - Width: Character width of the output (20-300 characters)
   - Style: Choose character set (detailed or blocks)
   - Colors: Select from 8 color schemes (original, grayscale, sepia, etc.)
   - Ratio: Maintain aspect ratio or choose preset dimensions
   - Adjustments: Brightness, contrast, color inversion
   - Options: Background removal, keep original size
3. **Click Convert** - Press the "CONVERT" button to generate ASCII art with your settings
4. **View Output** - Colored ASCII art appears in the right panel with zoom controls
5. **Save or Export** - Use action buttons to save as HTML (colored) or TXT (plain)
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
│   └── main.js              # Electron main process, Python subprocess management
├── python/
│   ├── main.py              # Python entry point, IPC handler
│   ├── requirements.txt     # Python dependencies
│   └── core/
│       ├── image_processor.py   # Image to ASCII conversion engine
│       ├── gif_processor.py     # GIF frame processing
│       └── file_handler.py      # File I/O and history management
├── src/
│   ├── App.js               # Main React component
│   ├── components/
│   │   ├── Generator/       # Input, output, and control panels
│   │   ├── Gallery/         # History gallery modal
│   │   └── Shared/          # Reusable UI components
│   ├── layouts/
│   │   └── MainLayout.js    # Application layout wrapper
│   └── styles/
│       └── main.css         # Global styling and theming
└── public/
    └── index.html           # HTML entry point
```

## Configuration

### Python Settings

Edit `python/main.py` to adjust:

- Output directory for saved files
- History file location and entry limit
- Logging verbosity

### Electron Settings

Edit `electron/main.js` to customize:

- Window dimensions (default: 1200x700)
- Window behavior (frameless, transparent)
- DevTools availability

### Character Sets

Modify `python/core/image_processor.py` to add custom character sets:

```python
CHARSETS = {
    'detailed': '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ',
    'standard': '@%#*+=-:. ',
    'simple': '█▓▒░ ',
    'custom': 'your_characters_here'
}
```

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
```

## Troubleshooting

### Python Path Issues

If the app can't find Python, update the path in `electron/main.js`:

```javascript
const pythonPath = "C:/path/to/your/python.exe";
```

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

- **Large Images**: Images are automatically resized during processing to maintain performance
- **GIF Frame Count**: High frame count GIFs may take longer to process (optimized with frame caching)
- **Background Removal**: Disable for faster processing when not needed (adds AI segmentation overhead)
- **Width Setting**: Lower width values process faster (fewer pixels to process)
- **Widget Optimization**: Widgets use temporary file loading instead of data URLs to handle large GIFs (no size limit)
- **Color Processing**: Colored output adds minimal overhead due to efficient RGB extraction

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
