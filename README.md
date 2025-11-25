<div align="center">

# AscArt

**A Modern Desktop Application for Converting Images and GIFs to ASCII Art**

Transform your images into stunning ASCII art with real-time preview, advanced image processing, and animated GIF support.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/electron-latest-cyan.svg)](https://www.electronjs.org/)

---

</div>

## Overview

AscArt is a powerful desktop application that converts images and animated GIFs into ASCII art with pixel-perfect precision. Built with a modern tech stack combining Electron, React, and Python, it offers real-time processing, customizable character sets, and comprehensive image adjustments.

## Features

### Core Functionality

- **Image to ASCII Conversion** - Convert JPG, PNG, and other image formats with high fidelity
- **Animated GIF Support** - Process and playback animated GIFs frame-by-frame with original timing
- **Real-time Preview** - See your ASCII art update instantly as you adjust settings
- **History Gallery** - Access previously converted art with full settings restoration

### Image Processing

- **Background Removal** - Automatically remove backgrounds using advanced AI segmentation
- **Brightness & Contrast** - Fine-tune image parameters with intuitive sliders
- **Color Inversion** - Invert colors for different artistic effects
- **Aspect Ratio Control** - Maintain original ratios or choose from preset dimensions
- **Width Adjustment** - Customize output width from 20 to 300 characters

### Output Options

- **Multiple Character Sets** - Detailed or block character sets for different styles
- **Export Formats** - Save as plain text (.txt) or styled HTML (.html)
- **Font Zoom Controls** - Adjust display size from 4px to 12px for optimal viewing
- **Playback Controls** - For GIFs: play/pause, stop, speed adjustment (0.5x to 2x)

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
- **Asynchronous Processing** - Non-blocking UI with background Python subprocess
- **State Management** - React hooks with debounced auto-regeneration
- **Modular Design** - Separated concerns with dedicated processor classes

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
   - Width: Character width of the output
   - Style: Choose character set (detailed or blocks)
   - Adjustments: Brightness, contrast, color inversion
   - Options: Background removal, aspect ratio controls
3. **View Output** - ASCII art generates automatically in the right panel
4. **Save or Export** - Use action buttons to save as text or HTML

### GIF Animation

- Load a GIF file to see it converted with frame-by-frame ASCII animation
- Use playback controls: play/pause, stop, and adjust speed
- Original frame timing is preserved and can be adjusted

### History Gallery

- Click "History" to view all previously converted images
- Click any item to see details
- Select and load to restore both the ASCII art and all settings used

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
    'detailed': '@%#*+=-:. ',
    'blocks': '█▓▒░ ',
    'custom': 'your_characters_here'
}
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

- **Large Images**: Images are automatically resized during processing
- **GIF Frame Count**: High frame count GIFs may take longer to process
- **Background Removal**: Disable for faster processing when not needed
- **Width Setting**: Lower width values process faster

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Character set mapping algorithm inspired by classic ASCII art converters
- RemBG for AI-powered background removal
- Electron and React communities for excellent documentation

---

<div align="center">

**Built with Python, React, and Electron**

</div>
