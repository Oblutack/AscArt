const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let widgetWindow = null;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    frame: false, // Frameless for custom Figma design
    transparent: true, // Allows rounded corners / transparency
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Allowed for local desktop apps
      webSecurity: false,
    },
    icon: path.join(__dirname, "../public/icons/icon.ico"),
  });

  // DEV vs PROD Loading
  const devUrl = "http://localhost:3000";
  const prodUrl = `file://${path.join(__dirname, "../build/index.html")}`;

  // If not packaged (Development), use localhost. If packaged (Production), use the build file.
  const startUrl = app.isPackaged ? prodUrl : devUrl;

  mainWindow.loadURL(startUrl);

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // DEV vs PROD Python Path
  let pythonPath;
  let scriptArgs;

  if (app.isPackaged) {
    // PRODUCTION: Run the compiled .exe included in resources
    pythonPath = path.join(process.resourcesPath, "python", "engine.exe");
    scriptArgs = [];
  } else {
    // DEVELOPMENT: Use system Python
    pythonPath =
      "C:/Users/DT User3/AppData/Local/Programs/Python/Python312/python.exe";
    scriptArgs = [path.join(__dirname, "../python/main.py")];
  }

  // Spawn the Python Backend
  console.log(`Starting Python Logic: ${pythonPath}`);
  console.log(`Script Args: ${scriptArgs}`);

  pythonProcess = spawn(pythonPath, scriptArgs, {
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    cwd: path.join(__dirname, "../python"),
  });

  pythonProcess.on("error", (error) => {
    console.error("Failed to start Python process:", error);
  });

  pythonProcess.on("exit", (code, signal) => {
    console.log(`Python process exited with code ${code} and signal ${signal}`);
  });

  // Buffer for incomplete JSON lines
  let outputBuffer = "";

  // Listen for Python Output
  pythonProcess.stdout.on("data", (data) => {
    try {
      // Append new data to buffer
      outputBuffer += data.toString();

      // Split by newlines
      const lines = outputBuffer.split("\n");

      // Keep the last incomplete line in buffer
      outputBuffer = lines.pop() || "";

      // Process complete lines
      lines.forEach((line) => {
        if (line.trim()) {
          try {
            const jsonResponse = JSON.parse(line);
            console.log(
              "✅ Parsed JSON response:",
              jsonResponse.status || jsonResponse.type
            );
            if (jsonResponse.ascii) {
              console.log("📊 ASCII length:", jsonResponse.ascii.length);
            }
            mainWindow.webContents.send("python-response", jsonResponse);
            console.log("📤 Sent to React");
          } catch (parseError) {
            console.log("❌ Failed to parse line:", line.substring(0, 100));
            console.log("Parse error:", parseError.message);
          }
        }
      });
    } catch (e) {
      console.error("Error processing Python output:", e);
      console.log("Raw data:", data.toString().substring(0, 200));
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`Python Error: ${data}`);
  });

  mainWindow.on("closed", () => (mainWindow = null));
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (pythonProcess) pythonProcess.kill();
  app.quit();
});

// Communication Bridge
ipcMain.on("to-python", (event, args) => {
  if (pythonProcess) {
    pythonProcess.stdin.write(JSON.stringify(args) + "\n");
  }
});

// UI Window Controls
ipcMain.on("window-min", () => mainWindow.minimize());
ipcMain.on("window-close", () => app.quit());

// Widget Window Management
function createWidgetWindow(widgetData) {
  if (widgetWindow) {
    widgetWindow.close();
  }

  widgetWindow = new BrowserWindow({
    width: 400,
    height: 450,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Parse widget data
  const isGif = widgetData.isGif || false;
  const asciiArt = widgetData.ascii || "";
  const gifFrames = widgetData.frames || [];
  const gifDelays = widgetData.delays || [];

  // Create HTML content for widget
  const widgetHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          background: transparent;
          overflow: hidden;
          cursor: move;
          -webkit-app-region: drag;
        }
        #widget-container {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          transition: background 0.3s ease;
        }
        #widget-container.controls-visible {
          background: rgba(10, 10, 15, 0.95);
          border: 2px solid #8800b4;
          border-radius: 8px;
        }
        #ascii-display {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow: visible;
          cursor: move;
          -webkit-app-region: no-drag;
        }
        #ascii-display pre {
          font-family: 'Courier New', monospace;
          font-size: 6px;
          line-height: 1;
          white-space: pre;
          margin: 0;
          pointer-events: none;
        }
        #ascii-display pre span {
          text-shadow: 0 0 5px currentColor;
        }
        #widget-controls {
          display: none;
          padding: 15px;
          background: rgba(0, 0, 0, 0.8);
          border-top: 1px solid #8800b4;
          flex-direction: column;
          gap: 10px;
          -webkit-app-region: no-drag;
        }
        #widget-container.controls-visible #widget-controls {
          display: flex;
        }
        .widget-controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .widget-controls-left {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .widget-btn {
          background: rgba(136, 0, 180, 0.2);
          border: 2px solid #8800b4;
          color: #8800b4;
          padding: 8px 16px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .widget-btn:hover {
          background: rgba(136, 0, 180, 0.4);
          transform: translateY(-2px);
        }
        .widget-btn-small {
          padding: 6px 12px;
          font-size: 10px;
        }
        .widget-btn-close {
          border-color: #b40000;
          color: #ff4444;
        }
        .widget-btn-close:hover {
          background: rgba(180, 0, 0, 0.3);
        }
        #playback-controls {
          display: ${isGif ? "flex" : "none"};
          gap: 8px;
          align-items: center;
        }
        .frame-info {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: #8800b4;
          min-width: 80px;
          text-align: center;
        }
        #context-menu {
          display: none;
          position: fixed;
          background: rgba(10, 10, 15, 0.98);
          border: 2px solid #8800b4;
          border-radius: 6px;
          padding: 5px 0;
          min-width: 180px;
          z-index: 10000;
          box-shadow: 0 4px 20px rgba(136, 0, 180, 0.4);
        }
        #context-menu.visible {
          display: block;
        }
        .context-menu-item {
          padding: 10px 20px;
          color: #8800b4;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
        }
        .context-menu-item:hover {
          background: rgba(136, 0, 180, 0.3);
          color: #bf00ff;
        }
        .context-menu-item.danger {
          color: #ff4444;
        }
        .context-menu-item.danger:hover {
          background: rgba(180, 0, 0, 0.3);
          color: #ff6666;
        }
      </style>
    </head>
    <body>
      <div id="context-menu">
        <button class="context-menu-item" onclick="showControlsFromMenu()">Show Controls</button>
        <button class="context-menu-item danger" onclick="closeWidget()">Remove Widget</button>
      </div>
      <div id="widget-container">
        <div id="ascii-display">
          <pre id="ascii-content"></pre>
        </div>
        <div id="widget-controls">
          <div class="widget-controls-row">
            <div class="widget-controls-left">
              <button class="widget-btn" onclick="toggleControls()">Hide Controls</button>
            </div>
            <button class="widget-btn widget-btn-close" onclick="closeWidget()">Close Widget</button>
          </div>
          <div id="playback-controls" class="widget-controls-row">
            <div class="widget-controls-left">
              <button class="widget-btn widget-btn-small" onclick="togglePlayPause()">${
                isGif ? "⏸ Pause" : "▶ Play"
              }</button>
              <button class="widget-btn widget-btn-small" onclick="prevFrame()">◀ Prev</button>
              <button class="widget-btn widget-btn-small" onclick="nextFrame()">Next ▶</button>
            </div>
            <span class="frame-info" id="frame-info">Frame 1/${
              gifFrames.length
            }</span>
          </div>
        </div>
      </div>
      <script>
        const { ipcRenderer } = require('electron');
        
        // Widget data
        const isGif = ${isGif};
        const gifFrames = ${JSON.stringify(gifFrames)};
        const gifDelays = ${JSON.stringify(gifDelays)};
        let currentFrame = 0;
        let isPlaying = ${isGif};
        let animationTimer = null;
        
        // Set initial ASCII content (use innerHTML for colored HTML)
        if (isGif && gifFrames.length > 0) {
          document.getElementById('ascii-content').innerHTML = gifFrames[0];
          startAnimation();
        } else {
          document.getElementById('ascii-content').innerHTML = ${JSON.stringify(
            asciiArt
          )};
        }
        
        let controlsVisible = true;
        
        function toggleControls() {
          controlsVisible = !controlsVisible;
          const container = document.getElementById('widget-container');
          if (controlsVisible) {
            container.classList.add('controls-visible');
          } else {
            container.classList.remove('controls-visible');
          }
        }
        
        function closeWidget() {
          if (animationTimer) clearTimeout(animationTimer);
          ipcRenderer.send('close-widget');
        }
        
        // GIF Animation
        function startAnimation() {
          if (!isGif || gifFrames.length === 0) return;
          
          function showNextFrame() {
            if (!isPlaying) return;
            
            currentFrame = (currentFrame + 1) % gifFrames.length;
            document.getElementById('ascii-content').innerHTML = gifFrames[currentFrame];
            updateFrameInfo();
            
            const delay = gifDelays[currentFrame] || 100;
            animationTimer = setTimeout(showNextFrame, delay);
          }
          
          const delay = gifDelays[currentFrame] || 100;
          animationTimer = setTimeout(showNextFrame, delay);
        }
        
        function togglePlayPause() {
          isPlaying = !isPlaying;
          const btn = event.target;
          
          if (isPlaying) {
            btn.textContent = '⏸ Pause';
            startAnimation();
          } else {
            btn.textContent = '▶ Play';
            if (animationTimer) {
              clearTimeout(animationTimer);
              animationTimer = null;
            }
          }
        }
        
        function prevFrame() {
          if (!isGif || gifFrames.length === 0) return;
          
          if (animationTimer) {
            clearTimeout(animationTimer);
            animationTimer = null;
          }
          
          currentFrame = (currentFrame - 1 + gifFrames.length) % gifFrames.length;
          document.getElementById('ascii-content').innerHTML = gifFrames[currentFrame];
          updateFrameInfo();
          
          if (isPlaying) {
            startAnimation();
          }
        }
        
        function nextFrame() {
          if (!isGif || gifFrames.length === 0) return;
          
          if (animationTimer) {
            clearTimeout(animationTimer);
            animationTimer = null;
          }
          
          currentFrame = (currentFrame + 1) % gifFrames.length;
          document.getElementById('ascii-content').innerHTML = gifFrames[currentFrame];
          updateFrameInfo();
          
          if (isPlaying) {
            startAnimation();
          }
        }
        
        function updateFrameInfo() {
          const info = document.getElementById('frame-info');
          if (info) {
            info.textContent = \`Frame \${currentFrame + 1}/\${gifFrames.length}\`;
          }
        }
        
        // Context menu and window dragging
        const contextMenu = document.getElementById('context-menu');
        const asciiDisplay = document.getElementById('ascii-display');
        
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let hasMoved = false;
        
        // Mouse down - prepare for drag or click
        asciiDisplay.addEventListener('mousedown', (e) => {
          if (e.button === 0) { // Left click only
            isDragging = true;
            hasMoved = false;
            dragStartX = e.screenX;
            dragStartY = e.screenY;
            e.preventDefault();
          }
        });
        
        // Mouse move - drag window
        asciiDisplay.addEventListener('mousemove', (e) => {
          if (isDragging && e.button === 0) {
            const deltaX = e.screenX - dragStartX;
            const deltaY = e.screenY - dragStartY;
            
            // If moved more than 3 pixels, consider it a drag
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
              hasMoved = true;
              ipcRenderer.send('move-widget-window', { deltaX, deltaY });
              dragStartX = e.screenX;
              dragStartY = e.screenY;
            }
          }
        });
        
        // Mouse up - detect click vs drag
        asciiDisplay.addEventListener('mouseup', (e) => {
          if (e.button === 0) {
            isDragging = false;
            
            // If didn't move, it's a click
            if (!hasMoved) {
              // Hide context menu if visible
              if (contextMenu.classList.contains('visible')) {
                contextMenu.classList.remove('visible');
                return;
              }
              
              // Show controls if hidden
              if (!controlsVisible) {
                controlsVisible = true;
                document.getElementById('widget-container').classList.add('controls-visible');
              }
            }
            
            hasMoved = false;
          }
        });
        
        // Prevent default drag behavior
        asciiDisplay.addEventListener('dragstart', (e) => {
          e.preventDefault();
        });
        
        // Right-click to show context menu
        asciiDisplay.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Position menu at mouse location
          contextMenu.style.left = e.clientX + 'px';
          contextMenu.style.top = e.clientY + 'px';
          contextMenu.classList.add('visible');
        });
        
        // Click anywhere else to hide context menu
        document.addEventListener('mousedown', (e) => {
          if (!contextMenu.contains(e.target) && !asciiDisplay.contains(e.target)) {
            contextMenu.classList.remove('visible');
          }
        });
        
        // Show controls from context menu
        function showControlsFromMenu() {
          controlsVisible = true;
          document.getElementById('widget-container').classList.add('controls-visible');
          contextMenu.classList.remove('visible');
        }
        
        // Start with controls visible
        document.getElementById('widget-container').classList.add('controls-visible');
      </script>
    </body>
    </html>
  `;

  widgetWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(widgetHtml)}`
  );

  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });
}

ipcMain.on("open-widget", (event, widgetData) => {
  createWidgetWindow(widgetData);
});

ipcMain.on("close-widget", () => {
  if (widgetWindow) {
    widgetWindow.close();
    widgetWindow = null;
  }
});

ipcMain.on("move-widget-window", (event, { deltaX, deltaY }) => {
  if (widgetWindow) {
    const [currentX, currentY] = widgetWindow.getPosition();
    widgetWindow.setPosition(currentX + deltaX, currentY + deltaY);
  }
});
