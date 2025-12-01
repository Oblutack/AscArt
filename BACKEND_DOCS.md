# AscArt - Backend Implementation Complete! 

## What Was Built

### Python Backend (Complete Processing Pipeline)

#### **Core Modules Created:**

1. **`core/image_processor.py`** - Main image processing engine

   - Loads images from file paths
   - Background removal using `rembg`
   - Brightness adjustment (-100 to +100)
   - Contrast adjustment (0 to 200)
   - Color inversion
   - Smart resizing with aspect ratio control
   - Pixel-to-ASCII conversion with 3 character sets:
     - **Detailed**: 70+ characters for high detail
     - **Standard**: 10 characters for moderate detail
     - **Simple**: 5 block characters for minimal style

2. **`core/gif_processor.py`** - Animated GIF support

   - Extracts all frames from GIF
   - Applies same processing as static images
   - Returns array of ASCII frames
   - Frame preview generation

3. **`core/file_handler.py`** - File management

   - Saves ASCII art as `.txt` files
   - Saves as `.html` with cyberpunk styling
   - History tracking (last 50 conversions)
   - Auto-creates `output/` directory

4. **`main.py`** - Communication bridge
   - Continuous `stdin/stdout` loop
   - JSON command parsing
   - Error handling and logging
   - Commands supported:
     - `ping` - Connection test
     - `convert` - Process image/GIF to ASCII
     - `save` - Save ASCII art to file
     - `get_history` - Retrieve conversion history

### Electron Integration

- **Widget Mode** - Click-through transparent window
- **Window Controls** - Minimize, close, always-on-top
- **Python Process Management** - Spawns and monitors backend
- **Dev/Prod Paths** - Handles both development and production environments

---

## How It Works

### Data Flow:

```
React UI → ipcRenderer.send('to-python', {...})
    ↓
Electron main.js → pythonProcess.stdin.write(JSON)
    ↓
Python main.py → Reads JSON from stdin
    ↓
Core Processors → image_processor / gif_processor / file_handler
    ↓
Python main.py → Prints JSON result to stdout
    ↓
Electron main.js → mainWindow.webContents.send('python-response', data)
    ↓
React UI → ipcRenderer.on('python-response', ...) → Updates state
```

### Command Format:

**Convert Image:**

```json
{
  "command": "convert",
  "path": "C:/path/to/image.jpg",
  "options": {
    "width": 120,
    "charset": "detailed",
    "removeBackground": false,
    "brightness": 0,
    "contrast": 100,
    "invert": false,
    "ratio": "16:9",
    "keepOriginal": false
  }
}
```

**Response:**

```json
{
  "status": "success",
  "type": "ascii-result",
  "ascii": "... ASCII art string ...",
  "isGif": false
}
```

---

## Testing the Backend

To test Python processing independently:

```powershell
cd python
"C:/Users/DT User3/AppData/Local/Programs/Python/Python312/python.exe" main.py
```

Then send JSON commands via stdin (followed by Enter):

```json
{ "command": "ping" }
```

Expected response:

```json
{ "status": "success", "message": "Pong from Python!" }
```

---

## Output Structure

Generated files are saved to:

```
python/output/
├── ascii_20250125_143022.txt    # Plain text ASCII art
├── ascii_20250125_143022.html   # Styled HTML version
└── history.json                  # Last 50 conversions
```

---

## Character Sets

**Detailed** (70 chars):

```
$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\|()1{}[]?-_+~<>i!lI;:,"^`'.
```

**Standard** (10 chars):

```
@%#*+=-:.
```

**Simple** (5 chars):

```
█▓▒░
```

---

## Next Steps

1. **Test the UI** - Load an image and watch it convert in real-time
2. **Try different settings** - Adjust brightness, contrast, width, charset
3. **Test GIF support** - Load an animated GIF (first frame shown for now)
4. **Save outputs** - Click SAVE to export as .txt or .html
5. **Widget Mode** - Click WIDGET to make the window transparent and click-through

---

## Troubleshooting

**Python errors in console?**

- Check that all packages from `requirements.txt` are installed
- Verify Python 3.12 is being used
- Check file paths are valid (use absolute paths)

**ASCII art looks wrong?**

- Try different character sets (Simple works well for testing)
- Adjust contrast/brightness
- Reduce width for clearer output

**Background removal not working?**

- First run may download AI model (500MB+)
- Check internet connection
- Verify `rembg` is properly installed

---

## Features Implemented

✅ Real-time image to ASCII conversion  
✅ Background removal (AI-powered)  
✅ Brightness/Contrast adjustments  
✅ Color inversion  
✅ Multiple character sets  
✅ Aspect ratio control  
✅ Width customization (20-300 chars)  
✅ GIF support (frame extraction)  
✅ File saving (.txt and .html)  
✅ Widget mode (transparent overlay)  
✅ Error handling and validation  
✅ Auto-debounced live preview (300ms)

---

**Ready to create some ASCII art!** 
