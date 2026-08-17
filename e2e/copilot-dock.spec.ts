import { expect, test, type Page } from "@playwright/test";

const WORKSPACE = "meridian-ops";
const BASE = `http://localhost:3000/w/${WORKSPACE}`;

async function login(page: Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

function dockOf(page: Page) {
  return page.getByRole("complementary", { name: "Copilot" });
}

test.describe("gate item 3: opening the dock causes zero layout shift", () => {
  test("CLS stays at 0 across an open, a resize-mode change, and a close", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/agents`);
    await expect(page.getByRole("grid", { name: "Agents" })).toBeVisible();

    // Start observing only after the page has settled, so font swaps and
    // first-paint work aren't attributed to opening the dock.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Deliberately *not* filtering `hadRecentInput`. The standard CLS
    // definition excludes shifts within 500ms of user input, which would
    // make "opening the dock causes zero layout shift" pass for free even
    // if opening it shoved the whole page across. Counting every shift is
    // the strict reading, and the dock is an overlay precisely so it can
    // pass the strict reading.
    await page.evaluate(() => {
      const state = { entries: [] as { value: number; hadRecentInput: boolean }[] };
      (window as unknown as { __cls: typeof state }).__cls = state;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          state.entries.push({ value: shift.value, hadRecentInput: shift.hadRecentInput });
        }
      }).observe({ type: "layout-shift", buffered: false });
    });

    const drainShifts = () =>
      page.evaluate(() => {
        const state = (window as unknown as { __cls: { entries: { value: number }[] } }).__cls;
        const drained = state.entries;
        state.entries = [];
        return drained;
      });

    const dock = dockOf(page);

    await page.keyboard.press("ControlOrMeta+j");
    await expect(dock).toBeVisible();
    await page.waitForTimeout(600); // past the 240ms open transition
    const openShifts = await drainShifts();
    expect(openShifts, `opening the dock shifted layout: ${JSON.stringify(openShifts)}`).toEqual([]);

    // Measured in its own window, and not asserted to be zero. Switching to
    // floating detaches the panel from the viewport edge, so the dock moves
    // itself by design -- that is the mode change, not the page reflowing
    // underneath it. The gate's claim is about *opening*, which is the
    // window above and the one below.
    await dock.getByRole("button", { name: "Float" }).click();
    await expect(dock).toHaveAttribute("data-copilot-mode", "floating");
    await page.waitForTimeout(400);
    await drainShifts();

    await page.keyboard.press("ControlOrMeta+j");
    await expect(dock).toHaveCount(0);
    await page.waitForTimeout(600);
    const closeShifts = await drainShifts();
    expect(closeShifts, `closing the dock shifted layout: ${JSON.stringify(closeShifts)}`).toEqual([]);
  });
});

test.describe("gate item 7: ⌘J toggles and moves focus", () => {
  test("focus enters the composer on open and returns to the prior element on close", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/agents`);

    // Give focus to a real, identifiable control first so "returns to the
    // prior element" is a specific claim, not "focus went somewhere".
    // Deliberately not the page's "Import" button: Chromium maps
    // `<input type="file">` to role `button` too, so that name matches two
    // elements and the wrong one wins.
    const priorControl = page.getByRole("button", { name: "Collapse sidebar" });
    await priorControl.focus();
    await expect(priorControl).toBeFocused();

    await page.keyboard.press("ControlOrMeta+j");
    const dock = dockOf(page);
    await expect(dock).toBeVisible();
    await expect(dock.getByRole("textbox", { name: "Ask the copilot" })).toBeFocused();

    // Pressing ⌘J again *from inside the composer* has to close it. This is
    // the case that caught a real bug: the global shortcut handler used to
    // ignore every keystroke aimed at an input, which made the dock
    // impossible to toggle shut without clicking away first.
    await page.keyboard.press("ControlOrMeta+j");
    await expect(dock).toHaveCount(0);
    await expect(priorControl).toBeFocused();
  });

  test("Escape closes the dock from inside it", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/today`);

    await page.keyboard.press("ControlOrMeta+j");
    const dock = dockOf(page);
    await expect(dock).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dock).toHaveCount(0);
  });
});

test.describe("gate item 4: dock mode and width persist across reload", () => {
  test("a floated, resized dock comes back floated and resized", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/today`);

    await page.keyboard.press("ControlOrMeta+j");
    const dock = dockOf(page);
    await expect(dock).toBeVisible();
    await expect(dock).toHaveAttribute("data-copilot-mode", "docked");

    await dock.getByRole("button", { name: "Float" }).click();
    await expect(dock).toHaveAttribute("data-copilot-mode", "floating");

    // Resize by keyboard rather than a drag: the handle is a real
    // `role="separator"` with arrow-key support (A5's useResizable), so this
    // is a supported interaction, and it's deterministic in a way a pointer
    // drag across a 2.5px hit area is not.
    const handle = dock.getByRole("separator", { name: "Resize copilot" });
    await handle.focus();
    for (let step = 0; step < 6; step++) await page.keyboard.press("ArrowLeft");

    const widened = (await dock.boundingBox())!.width;
    expect(widened).toBeGreaterThan(380);

    await page.reload();
    await page.keyboard.press("ControlOrMeta+j");
    const reopened = dockOf(page);
    await expect(reopened).toBeVisible();
    await expect(reopened).toHaveAttribute("data-copilot-mode", "floating");
    expect(Math.round((await reopened.boundingBox())!.width)).toBe(Math.round(widened));

    // Leave the dock docked so later tests start from the default.
    await reopened.getByRole("button", { name: "Dock right" }).click();
    await expect(reopened).toHaveAttribute("data-copilot-mode", "docked");
  });
});

test.describe("session spec item 5: threads", () => {
  test("creates, renames, and deletes a real conversation", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/today`);

    await page.keyboard.press("ControlOrMeta+j");
    const dock = dockOf(page);
    await expect(dock).toBeVisible();

    const threads = dock.getByRole("list", { name: "Conversations" });

    // C2: creating a thread now switches straight into it (the message
    // view), not just to a new row in the still-visible list -- there's
    // somewhere to switch *to* now that the message view exists. Back out
    // to the list to exercise rename/delete, which still live on the row.
    await dock.getByRole("button", { name: "New", exact: true }).click();
    await expect(dock.getByRole("button", { name: "Back to conversations" })).toBeVisible();
    await dock.getByRole("button", { name: "Back to conversations" }).click();
    await expect(threads.getByText("New conversation").first()).toBeVisible();

    const uniqueName = `Recall triage ${Date.now()}`;
    await dock.getByRole("button", { name: "Rename New conversation" }).first().click();
    const nameField = dock.getByRole("textbox", { name: /^Rename / });
    await nameField.fill(uniqueName);
    await nameField.press("Enter");
    await expect(threads.getByText(uniqueName)).toBeVisible();

    // Survives a reload, so it's a real row and not just client state.
    await page.reload();
    await page.keyboard.press("ControlOrMeta+j");
    const reopened = dockOf(page);
    await expect(reopened.getByText(uniqueName)).toBeVisible();

    await reopened.getByRole("button", { name: `Delete ${uniqueName}` }).click();
    await reopened.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(reopened.getByText(uniqueName)).toHaveCount(0);

    await page.reload();
    await page.keyboard.press("ControlOrMeta+j");
    await expect(dockOf(page).getByText(uniqueName)).toHaveCount(0);
  });
});
