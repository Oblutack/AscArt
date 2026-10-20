const { contextBridge, ipcRenderer, webUtils } = require("electron");

// The only way the React app reaches Electron and the Python backend.
// Nothing else from Node or Electron is visible to the page.
contextBridge.exposeInMainWorld("ascart", {
  // Python backend
  convert: (requestId, path, options, saveHistory = true) =>
    ipcRenderer.send("to-python", {
      command: "convert",
      requestId,
      path,
      options,
      saveHistory,
    }),
  stop: (requestId) => ipcRenderer.send("stop-python", requestId),
  getHistory: () => ipcRenderer.send("to-python", { command: "get_history" }),
  getHistoryEntry: (id) =>
    ipcRenderer.send("to-python", { command: "get_history_entry", id }),
  deleteHistory: (ids) =>
    ipcRenderer.send("to-python", { command: "delete_history", ids }),

  // Subscribe to everything the backend sends. Returns an unsubscribe function.
  onResponse: (callback) => {
    const listener = (event, message) => callback(message);
    ipcRenderer.on("python-response", listener);
    return () => ipcRenderer.removeListener("python-response", listener);
  },

  // Files and settings
  saveAscii: (art) => ipcRenderer.invoke("save-ascii", art),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings) => ipcRenderer.send("save-settings", settings),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Windows
  openWidget: (data) => ipcRenderer.send("open-widget", data),
  minimize: () => ipcRenderer.send("window-min"),
  quit: () => ipcRenderer.send("window-close"),
});
