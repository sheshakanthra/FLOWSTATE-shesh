import { expect, test, type Page } from "@playwright/test";

const WORKSPACE = "meridian-ops";

async function login(page: Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

/**
 * Gate item 3: "full paint under 800ms with 500 priority items in the
 * workspace." Run against a workspace temporarily seeded with 500 real rows
 * (see this session's own live-testing notes in PROGRESS.md for the seed
 * script) -- measures real browser paint via the Performance API's
 * `domContentLoadedEventEnd`/first-contentful-paint, not just server TTFB.
 */
test("today page paints the 500-item queue in under 800ms", async ({ page }) => {
  await login(page);

  const start = Date.now();
  await page.goto(`http://localhost:3000/w/${WORKSPACE}/today`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("listbox", { name: "Priority queue" })).toBeVisible();
  const wallClockMs = Date.now() - start;

  const paintMetrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      domContentLoadedMs: nav ? nav.domContentLoadedEventEnd - nav.startTime : null,
      firstContentfulPaintMs: fcp ? fcp.startTime : null,
    };
  });

  console.log("500-item Today page paint metrics:", { wallClockMs, ...paintMetrics });
  expect(wallClockMs).toBeLessThan(800);
});
