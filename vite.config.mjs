import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// style-src needs 'unsafe-inline' for the colored <span style="..."> art.
const CSP = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:"],
  "connect-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
};

// The dev server injects a small inline script (React Refresh) and talks to
// the browser over a websocket.
const DEV_CSP = {
  ...CSP,
  "script-src": ["'self'", "'unsafe-inline'"],
  "connect-src": ["'self'", "ws://localhost:3000", "http://localhost:3000"],
};

const toHeader = (policy) =>
  Object.entries(policy)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");

export default defineConfig(({ command }) => ({
  // Relative URLs, so the built app also works from file:// inside Electron
  base: "./",
  plugins: [
    react(),
    {
      name: "ascart-csp",
      transformIndexHtml: (html) =>
        html.replace("__CSP__", toHeader(command === "serve" ? DEV_CSP : CSP)),
    },
  ],
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  server: {
    // electron/main.js loads this address in development
    port: 3000,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
  },
}));
