const { contextBridge, ipcRenderer } = require("electron");

// The widget page gets exactly these four things and nothing else.
contextBridge.exposeInMainWorld("widgetApi", {
  onData: (callback) =>
    ipcRenderer.once("widget-data", (event, data) => callback(data)),
  close: () => ipcRenderer.send("close-widget"),
  moveBy: (deltaX, deltaY) =>
    ipcRenderer.send("move-widget-window", { deltaX, deltaY }),
});
