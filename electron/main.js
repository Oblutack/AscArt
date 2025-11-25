const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false, // Frameless for custom Figma design
    transparent: true, // Allows rounded corners / transparency
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Allowed for local desktop apps
      webSecurity: false
    },
    icon: path.join(__dirname, '../public/icons/icon.ico')
  });

  // DEV vs PROD Loading
  const devUrl = 'http://localhost:3000';
  const prodUrl = `file://${path.join(__dirname, '../build/index.html')}`;
  
  // If not packaged (Development), use localhost. If packaged (Production), use the build file.
  const startUrl = app.isPackaged ? prodUrl : devUrl;
  
  mainWindow.loadURL(startUrl);

  // DEV vs PROD Python Path
  let pythonPath;
  let scriptArgs;

  if (app.isPackaged) {
    // PRODUCTION: Run the compiled .exe included in resources
    pythonPath = path.join(process.resourcesPath, 'python', 'engine.exe');
    scriptArgs = [];
  } else {
    // DEVELOPMENT: Run python from the venv
    pythonPath = path.join(__dirname, '../python/venv/Scripts/python.exe');
    scriptArgs = [path.join(__dirname, '../python/main.py')];
  }

  // Spawn the Python Backend
  console.log(`Starting Python Logic: ${pythonPath}`);
  pythonProcess = spawn(pythonPath, scriptArgs);

  // Listen for Python Output
  pythonProcess.stdout.on('data', (data) => {
    try {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
            const jsonResponse = JSON.parse(line);
            mainWindow.webContents.send('python-response', jsonResponse);
        }
      });
    } catch (e) {
      console.log('Python Log:', data.toString());
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
  });
  
  mainWindow.on('closed', () => (mainWindow = null));
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  app.quit();
});

// Communication Bridge
ipcMain.on('to-python', (event, args) => {
  if (pythonProcess) {
    pythonProcess.stdin.write(JSON.stringify(args) + '\n');
  }
});

// UI Window Controls
ipcMain.on('window-min', () => mainWindow.minimize());
ipcMain.on('window-close', () => app.quit());