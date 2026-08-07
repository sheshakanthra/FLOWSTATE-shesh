import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // `next dev`'s on-demand per-route compilation can take well past
  // Playwright's 30s default the first time several workers each hit a
  // different, not-yet-compiled route concurrently -- a dev-mode-only cold
  // start cost, not app latency. 60s gives that room without masking a
  // genuinely hung request.
  timeout: 60_000,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
