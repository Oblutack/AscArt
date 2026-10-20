const { app, BrowserWindow, dialog, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
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
// ASCART_SKIP_LEGACY_IMPORT=1 turns that off (the end-to-end tests want an
// empty history).
function migrateLegacyHistory() {
  const legacy = path.join(__dirname, "../python/output/history.json");
  const target = path.join(dataDir, "history.json");
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const skip = process.env.ASCART_SKIP_LEGACY_IMPORT === "1";
    if (
      !skip &&
      !app.isPackaged &&
      fs.existsSync(legacy) &&
      !fs.existsSync(target)
    ) {
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
      command: path.join(
        process.resourcesPath,
        "python",
        process.platform === "win32" ? "engine.exe" : "engine",
      ),
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

// The bundled engine on Windows is a PyInstaller one-file exe: a small
// launcher that starts the real process as a child. Killing just the
// launcher leaves the child running (and still converting), so end the whole
// tree there.
function killProcessTree(proc) {
  if (process.platform === "win32" && proc.pid) {
    spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    proc.kill();
  }
}

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
        error:
          "The Python backend keeps crashing. Restart the app to try again.",
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

        // Any final answer for a request (cancelled, finished, failed) means
        // the backend is fine and the restart timer is not needed
        if (message.requestId !== undefined && message.type !== "progress") {
          clearTimeout(cancelTimers.get(message.requestId));
          cancelTimers.delete(message.requestId);
        }

        sendToRenderer(message);
      } catch (parseError) {
        console.warn("Failed to parse line:", line.substring(0, 100));
        console.warn(
          "Parse error:",
          parseError instanceof Error ? parseError.message : parseError,
        );
      }
    });
  });

  proc.stderr.on("data", (data) => {
    console.error(`Python: ${data}`);
  });
}

// How long Python gets to react to a cancel before we give up on it
const CANCEL_GRACE_MS = 5000;

// requestId -> timer that restarts the backend if it never answers
const cancelTimers = new Map();

function restartBackend() {
  const old = pythonProcess;
  if (old) {
    killedOnPurpose.add(old);
    killProcessTree(old);
  }
  startPython();
}

// Stop: ask Python to cancel that request. It notices between frames, so the
// loaded models stay in memory. Only a backend that doesn't react within a
// few seconds (stuck inside a single long step) is restarted.
ipcMain.on("stop-python", (event, requestId) => {
  sendToRenderer({ status: "success", type: "stopped" });

  if (!pythonProcess || !pythonProcess.stdin.writable) {
    startPython();
    return;
  }
  if (requestId === undefined || requestId === null) return;

  pythonProcess.stdin.write(
    JSON.stringify({ command: "cancel", requestId }) + "\n",
  );

  clearTimeout(cancelTimers.get(requestId));
  cancelTimers.set(
    requestId,
    setTimeout(() => {
      cancelTimers.delete(requestId);
      console.warn(
        `Backend ignored the cancel for request ${requestId}; restarting it`,
      );
      restartBackend();
    }, CANCEL_GRACE_MS),
  );
});

function createWindow() {
  migrateLegacyHistory();

  // Tall enough that the left panels fit without scrolling, but never taller
  // than the screen
  const { workAreaSize } = screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    width: Math.min(1280, workAreaSize.width),
    height: Math.min(900, workAreaSize.height),
    minWidth: Math.min(960, workAreaSize.width),
    minHeight: Math.min(640, workAreaSize.height),
    frame: false, // Frameless for custom Figma design
    transparent: true, // Allows rounded corners / transparency
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, "../assets/icon.png"),
  });

  // DEV vs PROD Loading
  const devUrl = "http://localhost:3000";
  const prodUrl = pathToFileURL(
    path.join(__dirname, "../build/index.html"),
  ).href;

  // Packaged: the built files. Development: the Vite dev server, unless
  // ASCART_USE_BUILD=1 asks for the built files (used by the end-to-end tests).
  const useBuild = app.isPackaged || process.env.ASCART_USE_BUILD === "1";
  const startUrl = useBuild ? prodUrl : devUrl;

  mainWindow.loadURL(startUrl);

  // The app never navigates away from itself. A stray file drop or a link in
  // the art must not turn the window into a browser.
  const appBase = new URL(".", startUrl).href;
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(appBase)) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

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
  if (pythonProcess) killProcessTree(pythonProcess);
  app.quit();
});

// Communication Bridge. The page may only send commands the backend offers.
const BACKEND_COMMANDS = new Set([
  "convert",
  "get_history",
  "get_history_entry",
  "delete_history",
  "ping",
]);

ipcMain.on("to-python", (event, args) => {
  if (!args || !BACKEND_COMMANDS.has(args.command)) {
    console.warn("Ignoring unknown backend command:", args && args.command);
    return;
  }
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
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

// Settings Management
const settingsPath = path.join(app.getPath("userData"), "settings.json");

ipcMain.on("save-settings", (event, settings) => {
  if (!settings || typeof settings !== "object") return;
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    debug("✅ Settings saved:", settingsPath);
  } catch (error) {
    console.error("❌ Failed to save settings:", error);
  }
});

ipcMain.handle("load-settings", () => {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
  return null;
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
      // Widgets live behind other windows; keep their animation at full speed
      backgroundThrottling: false,
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
    sender.setPosition(
      currentX + Math.round(deltaX),
      currentY + Math.round(deltaY),
    );
  }
});
