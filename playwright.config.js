const { defineConfig } = require("@playwright/test");

// End-to-end tests drive the real Electron app (npm run test:e2e builds the UI
// first). One at a time: they share the Python backend's CPU and each starts
// its own app.
module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // "github" turns failures into annotations visible on the run page
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
});
