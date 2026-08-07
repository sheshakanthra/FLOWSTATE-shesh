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
  webServer: [
    {
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
    // Only e2e/canvas-benchmark.spec.ts uses this one -- Storybook is where
    // the 300-node/400-edge synthetic dataset lives (see
    // features/agents/canvas/canvas.stories.tsx), since there's no in-app
    // way to seed that much data and shouldn't be one. Cold webpack builds
    // here run notably slower than `next dev`'s cold route compiles, hence
    // the longer timeout.
    {
      command: "pnpm storybook -p 6006 --ci",
      url: "http://localhost:6006",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
