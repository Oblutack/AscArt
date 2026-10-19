const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { stripTags, buildHtml } = require("./export");

// Chatty logging only while developing
const debug = (...args) => {
  if (!app.isPackaged) console.log(...args);
};

let mainWindow;
let widgetWindows = [];
let pythonProcess;

// History and saved files live in the per-user data folder, not next to the
// code (the install folder usually isn't writable).
const dataDir = path.join(app.getPath("userData"), "output");

// Older dev builds kept history in python/output; bring it along once.
function migrateLegacyHistory() {
  const legacy = path.join(__dirname, "../python/output/history.json");
  const target = path.join(dataDir, "history.json");
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (!app.isPackaged && fs.existsSync(legacy) && !fs.existsSync(target)) {
      fs.copyFileSync(legacy, target);
    }
  } catch (err) {
    console.error("Could not migrate old history:", err);
  }
}

// Which Python to run in development. ASCART_PYTHON wins, then the venv the
// README sets up in python/venv, then whatever is on PATH.
function resolveDevPython() {
  if (process.env.ASCART_PYTHON) return process.env.ASCART_PYTHON;

  const venvDir = path.join(__dirname, "../python/venv");
  const venvPython =
    process.platform === "win32"
      ? path.join(venvDir, "Scripts", "python.exe")
      : path.join(venvDir, "bin", "python");
  if (fs.existsSync(venvPython)) return venvPython;

  return process.platform === "win32" ? "python" : "python3";
}

// The main window can be gone while Python is still talking (shutdown)
function sendToRenderer(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("python-response", message);
  }
}

// How to launch the backend: the bundled engine when packaged, otherwise
// main.py through whatever resolveDevPython() finds.
function pythonLaunchInfo() {
  if (app.isPackaged) {
    return {
      command: path.join(process.resourcesPath, "python", "engine.exe"),
      args: [],
      cwd: process.resourcesPath,
    };
  }
  return {
    command: resolveDevPython(),
    args: [path.join(__dirname, "../python/main.py")],
    cwd: path.join(__dirname, "../python"),
  };
}

const MAX_BACKEND_RESTARTS = 3;
let backendRestarts = 0;
let quitting = false;
// Processes we killed on purpose (Stop button), so their exit isn't a crash
const killedOnPurpose = new WeakSet();

function startPython() {
  const { command, args, cwd } = pythonLaunchInfo();
  debug(`Starting Python: ${command} ${args.join(" ")} (cwd ${cwd})`);

  const proc = spawn(command, args, {
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      PYTHONIOENCODING: "utf-8",
      ASCART_DATA_DIR: dataDir,
    },
    cwd,
  });
  pythonProcess = proc;

  proc.on("error", (error) => {
    console.error("Failed to start Python process:", error);
    sendToRenderer({
      status: "error",
      error: `Could not start the Python backend (${command}). Set ASCART_PYTHON or create python/venv.`,
    });
  });

  proc.on("exit", (code, signal) => {
    debug(`Python process exited with code ${code} and signal ${signal}`);
    if (pythonProcess === proc) pythonProcess = null;
    if (quitting || killedOnPurpose.has(proc)) return;

    if (backendRestarts < MAX_BACKEND_RESTARTS) {
      backendRestarts++;
      sendToRenderer({
        status: "error",
        error: `The Python backend stopped unexpectedly (exit code ${code}). Restarting it...`,
      });
      startPython();
    } else {
      sendToRenderer({
        status: "error",
        error: "The Python backend keeps crashing. Restart the app to try again.",
      });
    }
  });

  // Python answers with one JSON object per line
  let outputBuffer = "";
  proc.stdout.on("data", (data) => {
    outputBuffer += data.toString();
    const lines = outputBuffer.split("\n");
    outputBuffer = lines.pop() || "";

    lines.forEach((line) => {
      if (!line.trim()) return;
      try {
        const message = JSON.parse(line);
        backendRestarts = 0; // it is talking, so it is healthy
        sendToRenderer(message);
      } catch (parseError) {
        console.warn("Failed to parse line:", line.substring(0, 100));
        console.warn("Parse error:", parseError.message);
      }
    });
  });

  proc.stderr.on("data", (data) => {
    console.error(`Python: ${data}`);
  });
}

// Python handles one command at a time, so the only way to cancel a running
// conversion is to restart it.
ipcMain.on("stop-python", () => {
  const old = pythonProcess;
  if (old) {
    killedOnPurpose.add(old);
    old.kill();
  }
  startPython();
  sendToRenderer({ status: "success", type: "stopped" });
});

function createWindow() {
  migrateLegacyHistory();

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

  // DevTools disabled - press Ctrl+Shift+I to open manually if needed

  startPython();

  mainWindow.on("closed", () => (mainWindow = null));
}

app.on("ready", createWindow);

app.on("before-quit", () => {
  quitting = true;
});

app.on("window-all-closed", () => {
  quitting = true;
  if (pythonProcess) pythonProcess.kill();
  app.quit();
});

// Communication Bridge
ipcMain.on("to-python", (event, args) => {
  if (!pythonProcess || !pythonProcess.stdin.writable) {
    sendToRenderer({
      status: "error",
      error: "The Python backend is not running.",
    });
    return;
  }
  pythonProcess.stdin.write(JSON.stringify(args) + "\n");
});

// Save As: colored HTML (animated for GIFs) or plain text
ipcMain.handle("save-ascii", async (event, art) => {
  if (!art || typeof art.ascii !== "string") {
    return { error: "Nothing to save" };
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Save ASCII art",
    defaultPath: path.join(app.getPath("documents"), `ascii_${stamp}.html`),
    filters: [
      { name: "HTML (colored)", extensions: ["html"] },
      { name: "Text (plain)", extensions: ["txt"] },
    ],
  });
  if (canceled || !filePath) return { canceled: true };

  try {
    const asText = path.extname(filePath).toLowerCase() === ".txt";
    const content = asText ? stripTags(art.ascii) : buildHtml(art);
    await fs.promises.writeFile(filePath, content, "utf8");
    return { filePath };
  } catch (error) {
    console.error("Failed to save file:", error);
    return { error: error.message };
  }
});

// Settings Management
const settingsPath = path.join(app.getPath("userData"), "settings.json");

ipcMain.on("save-settings", (event, settings) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    debug("✅ Settings saved:", settingsPath);
  } catch (error) {
    console.error("❌ Failed to save settings:", error);
  }
});

ipcMain.on("load-settings", (event) => {
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      debug("✅ Settings loaded:", settingsPath);
      event.reply("settings-loaded", settings);
    } else {
      debug("ℹ️ No saved settings found");
      event.reply("settings-loaded", null);
    }
  } catch (error) {
    console.error("❌ Failed to load settings:", error);
    event.reply("settings-loaded", null);
  }
});

// UI Window Controls
ipcMain.on("window-min", () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on("window-close", () => app.quit());

// Widget Window Management
function createWidgetWindow(widgetData) {
  const widget = new BrowserWindow({
    width: 400,
    height: 450,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "widget", "widget-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  widgetWindows.push(widget);

  // Keep the widget in the background once it is up
  widget.once("ready-to-show", () => {
    if (!widget.isDestroyed()) {
      widget.setAlwaysOnTop(false);
      widget.blur();
    }
  });

  widget.on("closed", () => {
    const index = widgetWindows.indexOf(widget);
    if (index > -1) widgetWindows.splice(index, 1);
  });

  // The page asks for its data once it has loaded
  widget.webContents.once("did-finish-load", () => {
    if (widget.isDestroyed()) return;
    widget.webContents.send("widget-data", {
      isGif: Boolean(widgetData.isGif),
      ascii: widgetData.ascii || "",
      frames: widgetData.frames || [],
      delays: widgetData.delays || [],
    });
  });

  widget.loadFile(path.join(__dirname, "widget", "widget.html"));
}

ipcMain.on("open-widget", (event, widgetData) => {
  if (!widgetData || typeof widgetData.ascii !== "string") return;
  createWidgetWindow(widgetData);
});

ipcMain.on("close-widget", (event) => {
  // Close the widget window that sent the event
  const sender = BrowserWindow.fromWebContents(event.sender);
  if (sender) sender.close();
});

ipcMain.on("move-widget-window", (event, { deltaX, deltaY }) => {
  const sender = BrowserWindow.fromWebContents(event.sender);
  if (sender && Number.isFinite(deltaX) && Number.isFinite(deltaY)) {
    const [currentX, currentY] = sender.getPosition();
    sender.setPosition(currentX + Math.round(deltaX), currentY + Math.round(deltaY));
  }
});
