# Security

## How the app is put together

- The window that shows the UI has **no Node.js access**. Context isolation and
  the sandbox are on, and the page only sees the small `window.ascart` API from
  `electron/preload.js`.
- The main process only forwards a fixed list of commands to the Python
  backend, and refuses navigation away from the app's own pages, new windows
  and `<webview>`s. Every permission request is denied except one: the main
  window may use the **camera (video only, never audio)** for the CAMERA
  button. Widgets and everything else get nothing.
- The page has a strict Content-Security-Policy: scripts only from the app
  itself. (`'unsafe-inline'` styles are needed for the colored `<span>` art.)
- Packaged builds turn off Electron features the app doesn't use through
  fuses: running as plain Node, the Node inspector flags and `NODE_OPTIONS`,
  and loading code from outside the app archive. The archive's integrity is
  checked at startup.
- Art files are written where you choose in the Save As dialog; history lives
  in the per-user data folder.

## Reporting a problem

Please open a private security advisory on the repository
(**Security → Report a vulnerability**) rather than a public issue.
