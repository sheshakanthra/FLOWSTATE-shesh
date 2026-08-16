import { expect, test, type Page } from "@playwright/test";

const WORKSPACE = "meridian-ops";
const AGENT_ID = "1cca2647-ff3e-4b2a-8c85-1e34aea8da40"; // Lumen Dental — Recall Scheduler
const RUNS_URL = `http://localhost:3000/w/${WORKSPACE}/agents/${AGENT_ID}/runs`;

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

async function readEnvelope(page: Page) {
  const raw = await page.locator("[data-copilot-envelope]").first().getAttribute("data-copilot-envelope");
  return JSON.parse(raw!) as {
    route: string;
    entity: { type: string | null; id: string | null };
    selection: { type: string; ids: string[] } | null;
    filters: Record<string, unknown>;
    dateRange: { from: string; to: string } | null;
    recentActions: unknown[];
  };
}

test.describe("gate item 2: selection reaches the envelope within one frame", () => {
  test("selecting 3 runs shows a '3 runs selected' chip and updates the envelope", async ({ page }) => {
    await login(page);
    await page.goto(RUNS_URL);
    await expect(page.getByRole("grid", { name: "Run history" })).toBeVisible();

    await page.keyboard.press("ControlOrMeta+j");
    const dock = dockOf(page);
    await expect(dock).toBeVisible();

    const rows = page.getByRole("row");
    await rows.nth(1).getByRole("checkbox").click();
    await rows.nth(2).getByRole("checkbox").click();

    // The third click and the assertion are separated by exactly one
    // animation frame -- `useCopilotContext` registers in a layout effect,
    // so the chip and the envelope are expected to be correct before the
    // browser has painted anything else, not merely "eventually".
    await rows.nth(3).getByRole("checkbox").click();
    const afterOneFrame = await page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const probe = document.querySelector("[data-copilot-envelope]");
      const envelope = JSON.parse(probe?.getAttribute("data-copilot-envelope") ?? "{}");
      const chipText = Array.from(document.querySelectorAll('[aria-label="Copilot context"] *'))
        .map((node) => node.textContent ?? "")
        .join(" | ");
      return { selection: envelope.selection, chipText };
    });

    expect(afterOneFrame.selection?.type).toBe("run");
    expect(afterOneFrame.selection?.ids).toHaveLength(3);
    expect(afterOneFrame.chipText).toContain("3 runs selected");

    await expect(dock.getByText("3 runs selected")).toBeVisible();
  });
});

test.describe("gate item 5: dropping a chip removes that field from the envelope", () => {
  test("removing the selection chip empties selection but leaves the rest of the context", async ({ page }) => {
    await login(page);
    await page.goto(RUNS_URL);
    await expect(page.getByRole("grid", { name: "Run history" })).toBeVisible();

    // Build up a context rich enough that "removes *that* field" is a real
    // claim: an agent entity, a run selection, a status filter, and a date
    // range all at once.
    await page.getByRole("button", { name: "Succeeded" }).click();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Last 30 days" }).click();

    const rows = page.getByRole("row");
    await rows.nth(1).getByRole("checkbox").click();
    await rows.nth(2).getByRole("checkbox").click();

    await page.keyboard.press("ControlOrMeta+j");
    const dock = dockOf(page);
    await expect(dock).toBeVisible();

    await expect(dock.getByText("2 runs selected")).toBeVisible();
    const before = await readEnvelope(page);
    expect(before.selection?.ids).toHaveLength(2);
    expect(before.entity.type).toBe("agent");
    expect(before.filters).toHaveProperty("status");
    expect(before.dateRange).not.toBeNull();

    await dock.getByRole("button", { name: "Remove 2 runs selected from context" }).click();

    await expect
      .poll(async () => (await readEnvelope(page)).selection)
      .toBeNull();
    const after = await readEnvelope(page);
    // Only the dropped field is gone.
    expect(after.entity.type).toBe("agent");
    expect(after.filters).toHaveProperty("status");
    expect(after.dateRange).not.toBeNull();
    // The rows are still selected in the table -- dropping a chip edits what
    // the copilot is told, not what the user is doing.
    await expect(rows.nth(1).getByRole("checkbox")).toBeChecked();

    // Dropped context stays visible as an "add back" affordance, and
    // restoring it puts the field back.
    const restore = dock.getByRole("button", { name: "Add 2 runs selected back to context" });
    await expect(restore).toBeVisible();
    await restore.click();
    await expect.poll(async () => (await readEnvelope(page)).selection?.ids.length).toBe(2);
  });

  test("an exclusion does not leak to the next screen", async ({ page }) => {
    await login(page);
    await page.goto(RUNS_URL);
    await expect(page.getByRole("grid", { name: "Run history" })).toBeVisible();

    await page.keyboard.press("ControlOrMeta+j");
    const dock = dockOf(page);
    await expect(dock).toBeVisible();
    await dock.getByRole("button", { name: /^Remove Agent: / }).click();
    await expect.poll(async () => (await readEnvelope(page)).entity.type).toBe(null);

    // Client-side navigation, so the registry survives and the exclusion has
    // a real chance to leak. A hard reload would clear it trivially and
    // prove nothing.
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Agents" }).click();
    await page.waitForURL(/\/agents$/);

    // Back to the workspace baseline rather than still-suppressed: the
    // exclusion was a statement about the previous screen's agent.
    await expect.poll(async () => (await readEnvelope(page)).entity.type, { timeout: 15_000 }).toBe("workspace");
    await expect(dock.getByText("Workspace: Meridian Ops")).toBeVisible();
  });
});

test.describe("session spec Notes: recentActions come from the undo stack", () => {
  test("editing the graph adds a human-readable recent action to the envelope", async ({ page }) => {
    await login(page);
    await page.goto(`http://localhost:3000/w/${WORKSPACE}/agents/${AGENT_ID}/build`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15_000 });

    expect((await readEnvelope(page)).recentActions).toEqual([]);

    // Adding a node from the library, rather than editing a field: B3's
    // property edits are coalesced behind a 300ms idle window *and* skip
    // registration entirely when the value didn't actually change, which
    // makes them a poor probe for "did an undo entry appear" across repeat
    // runs. An insert registers one entry immediately, every time.
    await page.locator("#node-library-option-transform").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(7, { timeout: 10_000 });

    await expect
      .poll(async () => (await readEnvelope(page)).recentActions.length, { timeout: 10_000 })
      .toBeGreaterThan(0);

    const envelope = await readEnvelope(page);
    const action = envelope.recentActions[0] as { action: string; entity: string; at: string };
    // Human-readable, straight off the undo stack's own label -- the spec's
    // own reasoning for sourcing them there.
    expect(action.action).toBe("Added node");
    // Stamped with the entity that was in context when it happened.
    expect(action.entity).toBe("Lumen Dental — Recall Scheduler");
    expect(Number.isNaN(Date.parse(action.at))).toBe(false);

    // Undo the insert so the shared seeded agent is left as it was found.
    // The action stays in `recentActions` afterwards, which is correct: it's
    // a log of what the user did, not a mirror of the undo stack's depth.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 10_000 });
    expect((await readEnvelope(page)).recentActions.length).toBeGreaterThan(0);
  });
});
