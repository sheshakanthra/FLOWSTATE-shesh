import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end smoke test for A6's gate: seeded sign-in, populated shell
 * chrome, all six global shortcuts, sidebar-collapse persistence, and every
 * stub route's designed empty state. Requires `pnpm seed` to have run
 * against the same DATABASE_URL this dev server uses.
 */
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/w/meridian-ops/today");
}

test("sign-in lands on /today with a populated shell", async ({ page }) => {
  await login(page);

  // Sidebar nav + workspace switcher are real, DB-backed data, not stubs.
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Agents" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Meridian Ops/ })).toBeVisible();

  // /today itself is a designed stub: PageHeader + EmptyState with a real
  // next action, not placeholder copy.
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByText("Nothing needs you yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "View agents" })).toBeVisible();
});

test("every stub route renders a designed empty state with a next action", async ({ page }) => {
  // Each route is a distinct dynamic segment Next's dev server hasn't
  // compiled yet, so the first visit to each can take well past
  // Playwright's default 30s navigation timeout on a cold dev build —
  // that's dev-mode compile latency, not app slowness (the same routes
  // respond immediately once warm).
  test.setTimeout(150_000);
  await login(page);

  const routes: [string, string, string][] = [
    ["today", "Nothing needs you yet", "View agents"],
    ["agents", "No agents open yet", "Back to Today"],
    ["flows", "No automations yet", "Back to Today"],
    ["knowledge", "No knowledge sources yet", "Back to Today"],
    ["insights", "No insights yet", "Back to Today"],
    ["settings", "Workspace settings aren't built yet", "Back to Today"],
  ];

  for (const [segment, emptyTitle, actionLabel] of routes) {
    await page.goto(`/w/meridian-ops/${segment}`, { timeout: 60_000 });
    await expect(page.getByText(emptyTitle)).toBeVisible();
    await expect(page.getByRole("button", { name: actionLabel })).toBeVisible();
  }
});

test("g-then-a and g-then-t navigate; ⌘K, ⌘\\, ⌘J, and ? all fire", async ({ page }) => {
  await login(page);

  await page.keyboard.press("g");
  await page.keyboard.press("a");
  await page.waitForURL("**/w/meridian-ops/agents");

  await page.keyboard.press("g");
  await page.keyboard.press("t");
  await page.waitForURL("**/w/meridian-ops/today");

  // ⌘K / Ctrl+K — command palette.
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox")).toBeVisible();
  await page.keyboard.press("Escape");
  // Wait for the close animation to actually unmount the input before
  // pressing another shortcut — while it's still focused (forceMount keeps
  // it in the DOM through its exit transition), useGlobalShortcuts's
  // isTypingTarget check would treat "?" as ordinary typing, not a shortcut.
  await expect(page.getByRole("combobox")).toBeHidden();

  // ? — shortcut overlay, listing at least one real shortcut.
  await page.keyboard.press("?");
  await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  await expect(page.getByText("Go to Today")).toBeVisible();
  await page.keyboard.press("Escape");

  // ⌘\ — sidebar collapse. toHaveCSS retries until the CSS transition
  // settles, rather than racing a one-shot boundingBox() read.
  // The width-animated element is the <aside> wrapper, not the <nav> inside
  // it (which is inset by the aside's 1px border) — asserting on the actual
  // animated element avoids a border-width fudge factor.
  const sidebar = page.locator("aside");
  await expect(sidebar).toHaveCSS("width", "240px");
  await page.keyboard.press("Control+\\");
  await expect(sidebar).toHaveCSS("width", "64px");

  // ⌘J — copilot dock. Its container is aria-hidden while closed, so the
  // close button isn't reachable via role queries until it actually opens —
  // a stronger signal than checking text visibility, which CSS clipping
  // alone could satisfy without the panel being genuinely open.
  await expect(page.getByRole("button", { name: "Close copilot" })).toBeHidden();
  await page.keyboard.press("Control+j");
  await expect(page.getByRole("button", { name: "Close copilot" })).toBeVisible();

  // Expand the sidebar back so the next test starts from a known state.
  await page.keyboard.press("Control+\\");
});

test("sidebar collapse persists across reload", async ({ page }) => {
  await login(page);

  const sidebar = page.locator("aside");
  await expect(sidebar).toHaveCSS("width", "240px");

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(sidebar).toHaveCSS("width", "64px");

  // The collapsed width is read from localStorage in a mount effect (a
  // one-frame flash from the expanded default is an accepted tradeoff, same
  // class as ResizablePanel's — see PROGRESS.md's A5 decisions), so this
  // still has to wait out that effect rather than assert immediately.
  await page.reload();
  await expect(sidebar).toHaveCSS("width", "64px");

  // Restore the default (expanded) state for any test that runs after this one.
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(sidebar).toHaveCSS("width", "240px");
});
