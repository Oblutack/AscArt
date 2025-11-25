const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
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

// Widget Mode Toggle
let isWidgetMode = false;
ipcMain.on("window-widget-mode", () => {
  isWidgetMode = !isWidgetMode;

  if (isWidgetMode) {
    // Enter widget mode: transparent, click-through, always on top
    mainWindow.setAlwaysOnTop(true, "floating");
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    // Exit widget mode: normal window
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setIgnoreMouseEvents(false);
  }
});
