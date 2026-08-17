import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig.json sets `jsx: "preserve"` (Next's own SWC compiler does the
  // real transform in dev/build). Vitest has no such compiler in front of
  // it -- esbuild does the transform here, and without this it falls back
  // to the classic runtime (`React.createElement`, requiring `React` in
  // scope in every file with JSX), which nothing in this codebase does,
  // since the real app never needed it. `jsx: "automatic"` is esbuild's own
  // built-in support for the same runtime Next already uses -- no
  // `@vitejs/plugin-react` dependency needed. This session is the first to
  // render a component (not just call a hook) under Vitest, which is what
  // surfaced the gap.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // e2e/ is Playwright's (playwright.config.ts's testDir) — Vitest's
    // default *.spec.ts glob would otherwise also try to collect those
    // files and fail on Playwright's test() outside its own runner.
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
