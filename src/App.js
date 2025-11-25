import React, { useEffect, useState } from 'react';
const { ipcRenderer } = window.require('electron');

function App() {
  const [status, setStatus] = useState("Connecting to Python...");

  useEffect(() => {
    // 1. Listen for messages from Python
    ipcRenderer.on('python-response', (event, data) => {
      console.log("Received from Python:", data);
      if (data.message) setStatus(data.message);
    });

    // 2. Send a test "ping" to Python
    ipcRenderer.send('to-python', { command: 'ping' });
  }, []);

  return (
    <div className="app-container">
      <h1>AscArt System</h1>
      <p>Backend Status: <span style={{ color: '#00ff00' }}>{status}</span></p>
    </div>
  );
}

export default App;