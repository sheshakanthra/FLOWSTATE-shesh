import { expect, test, type Locator, type Page } from "@playwright/test";

// Every test shares one seeded workspace's priority queue and mutates real
// rows (resolve/snooze/delegate) -- serial, same reasoning
// copilot-streaming.spec.ts gives for its own real-backend suite: parallel
// workers racing PATCHes against the same small, known seed set would make
// "the third item is X" assertions unreliable.
test.describe.configure({ mode: "serial" });

const WORKSPACE = "meridian-ops";
const BASE = `http://localhost:3000/w/${WORKSPACE}`;

async function login(page: Page, email = "priya@meridianops.com") {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

function queueOf(page: Page): Locator {
  return page.getByRole("listbox", { name: "Priority queue" });
}

/** Navigates to Today and waits past the real hydration/virtualizer-mount
 *  race: the listbox container paints before React hydrates and the
 *  virtualizer computes its first visible range, so interacting
 *  immediately after `page.goto()` can hit a listbox with zero rows for a
 *  moment. Every test needs this, not just the ones that count rows. */
async function openQueue(page: Page): Promise<Locator> {
  await page.goto(`${BASE}/today`);
  const queue = queueOf(page);
  await expect(queue.getByRole("option").first()).toBeVisible();
  return queue;
}

test.describe("gate item 6: full keyboard operation, correct ARIA listbox", () => {
  test("the queue is a real listbox, j/k move aria-activedescendant, and 1-9 jump", async ({ page }) => {
    await login(page);
    const queue = await openQueue(page);
    await expect(queue).toHaveAttribute("role", "listbox");

    const options = queue.getByRole("option");
    const count = await options.count();
    expect(count).toBeGreaterThan(2);

    await queue.focus();
    const firstId = await queue.getAttribute("aria-activedescendant");
    expect(firstId).toBeTruthy();

    await queue.press("j");
    const secondId = await queue.getAttribute("aria-activedescendant");
    expect(secondId).not.toBe(firstId);

    await queue.press("k");
    const backToFirst = await queue.getAttribute("aria-activedescendant");
    expect(backToFirst).toBe(firstId);

    // 1-9 jump: "3" jumps to the third option directly.
    await queue.press("3");
    const thirdOptionId = await options.nth(2).getAttribute("id");
    const activeAfterJump = await queue.getAttribute("aria-activedescendant");
    expect(activeAfterJump).toBe(thirdOptionId);
  });

  test("Enter opens the active item's agent", async ({ page }) => {
    await login(page);
    const queue = await openQueue(page);
    await queue.focus();
    await queue.press("1");
    await queue.press("Enter");
    await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+\/build/, { timeout: 15_000 });
  });
});

test.describe("gate item 2: score explainer shows real, multipliable factor values", () => {
  test("hovering the score badge shows blast radius × time decay × entity value = the displayed score", async ({ page }) => {
    await login(page);
    const queue = await openQueue(page);
    const firstOption = queue.getByRole("option").first();
    const scoreButton = firstOption.getByRole("button", { name: /^Score/ });
    const shownScore = Number((await scoreButton.textContent())?.trim());
    expect(Number.isFinite(shownScore)).toBe(true);

    await scoreButton.focus(); // Radix HoverCard opens on focus too -- keyboard-reachable, not mouse-only.
    const card = page.getByText("How this score was calculated");
    await expect(card).toBeVisible();

    const arithmeticLine = page.locator("text=/^\\d+(\\.\\d+)? × \\d+(\\.\\d+)? × \\d+(\\.\\d+)?$/");
    await expect(arithmeticLine).toBeVisible();
    const parts = (await arithmeticLine.textContent())!.split("×").map((part) => Number(part.trim()));
    const computed = parts[0]! * parts[1]! * parts[2]!;
    // Each displayed factor is independently rounded for readability (2-3
    // decimal places), so multiplying the *displayed* numbers back together
    // compounds a small rounding gap against the *displayed*, separately-
    // rounded total -- expected, and still well within what "a reviewer can
    // check the arithmetic" (gate item 2) means by eye: a fraction of a
    // percent, not an exact bit-for-bit match.
    expect(Math.abs(computed - shownScore)).toBeLessThan(Math.abs(shownScore) * 0.01 + 0.5);
  });
});

test.describe("gate items 4 & 5: optimistic actions, rollback on failure, and ⌘Z undo", () => {
  test("resolving an item collapses it out immediately, and ⌘Z brings it back", async ({ page }) => {
    await login(page);
    const queue = await openQueue(page);
    const firstOption = queue.getByRole("option").first();
    const title = (await firstOption.locator(".text-label.font-medium").first().textContent())!.trim();

    await firstOption.getByRole("button", { name: `Resolve: ${title}` }).click();
    await expect(queue.getByText(title)).toHaveCount(0);
    // The row collapses out on the *optimistic* update, synchronously --
    // but the undo entry isn't registered until the PATCH round trip
    // resolves (store.ts's own applyAction). Waiting for the confirmation
    // toast (rendered right after `pushUndoEntry`) is the real
    // synchronization point; pressing ⌘Z any earlier can race a still-
    // in-flight request and find nothing on the undo stack yet.
    await expect(page.getByText("Resolved", { exact: true })).toBeVisible();

    await page.keyboard.press("ControlOrMeta+z");
    await expect(queue.getByText(title)).toBeVisible({ timeout: 5_000 });
  });

  test("a failed PATCH rolls the optimistic change back and shows a real error", async ({ page }) => {
    await login(page);
    const queue = await openQueue(page);
    const firstOption = queue.getByRole("option").first();
    const title = (await firstOption.locator(".text-label.font-medium").first().textContent())!.trim();

    await page.route("**/api/priorities", (route) => {
      if (route.request().method() === "PATCH") return route.abort("failed");
      return route.continue();
    });

    await firstOption.getByRole("button", { name: `Resolve: ${title}` }).click();
    // Rolled back: still visible, not collapsed out.
    await expect(queue.getByText(title)).toBeVisible();
    await expect(page.getByText("Couldn't save that change", { exact: true })).toBeVisible();

    await page.unroute("**/api/priorities");
  });

  test("⌘Z undoes a snooze back to not-snoozed", async ({ page }) => {
    await login(page);
    const queue = await openQueue(page);
    const firstOption = queue.getByRole("option").first();

    await firstOption.getByRole("button", { name: "Snooze" }).click();
    await page.getByRole("menuitem", { name: "1 hour" }).click();
    await expect(firstOption.getByText(/Snoozed — returns/)).toBeVisible();
    // Same synchronization reasoning as the resolve test above: wait for
    // the undo entry to actually be registered (the confirmation toast),
    // not just the optimistic visual change.
    await expect(page.getByText("Snoozed until 1 hour", { exact: true })).toBeVisible();

    await page.keyboard.press("ControlOrMeta+z");
    await expect(firstOption.getByText(/Snoozed — returns/)).toHaveCount(0, { timeout: 5_000 });
  });
});

test.describe("gate item 7: snoozed rows are visually distinct and show a real return time", () => {
  test("the seeded snoozed item is dimmed and shows its return time", async ({ page }) => {
    await login(page);
    const queue = await openQueue(page);
    const snoozedOption = queue.getByRole("option").filter({ hasText: "Snoozed — returns" });
    await expect(snoozedOption).toBeVisible();
    const opacity = await snoozedOption.evaluate((element) => window.getComputedStyle(element).opacity);
    expect(Number(opacity)).toBeLessThan(1);
  });
});

test.describe("gate item 8: empty state suggests a specific action", () => {
  test("resolving every item shows a real empty state, not a generic checkmark", async ({ page }) => {
    await login(page);
    const queue = await openQueue(page);

    // Resolve everything currently in the queue -- always click the first
    // option's Resolve button, since each resolve collapses that row out
    // and promotes the next one to first.
    for (let guard = 0; guard < 20; guard++) {
      const remaining = await queue.getByRole("option").count();
      if (remaining === 0) break;
      const first = queue.getByRole("option").first();
      const label = (await first.getAttribute("id"))!;
      await first.getByRole("button", { name: /^Resolve:/ }).click();
      await expect(page.locator(`#${label}`)).toHaveCount(0);
    }

    await expect(page.getByText("Nothing needs you right now")).toBeVisible();
    await expect(page.getByText(/Build a new agent/)).toBeVisible();
    await expect(page.getByRole("button", { name: "View agents" })).toBeVisible();
  });
});
