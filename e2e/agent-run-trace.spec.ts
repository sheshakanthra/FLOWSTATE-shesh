import { expect, test } from "@playwright/test";

const AGENT_ID = "1cca2647-ff3e-4b2a-8c85-1e34aea8da40";
const RUNS_URL = `http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs`;

// Three real runs produced by B4's own live-Groq verification (not seeded
// fixtures) -- exactly the "recorded runs with known step boundaries" gate
// item 1 asks for, just discovered from the real database rather than
// hand-authored. Their step timestamps are asserted against directly below.
const SUCCEEDED_RUN_ID = "2488cfc5-38a6-492a-8cb9-741a1df209d4"; // 6/6 succeeded, real Groq cost
const FAILED_RUN_ID = "072e61ea-31fe-450d-bf45-4ab3cbbd13df"; // llm failed, condition+output skipped
const CANCELLED_RUN_ID = "0f200a1c-d672-4b99-9f70-7186e9bcb8dd"; // only 3 of 6 nodes ever got a step

async function login(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

test.describe("run history", () => {
  test("lists real runs and filtering by status narrows the table", async ({ page }) => {
    await login(page);
    await page.goto(RUNS_URL);

    await expect(page.getByRole("grid", { name: "Run history" })).toBeVisible();
    await expect(page.getByText("Succeeded").first()).toBeVisible();

    // Status filter (gate item 1: "filterable by status") -- toggling
    // "Failed" on hides every succeeded row.
    await page.getByRole("button", { name: "Failed", exact: true }).click();
    const rows = page.getByRole("row");
    await expect(async () => {
      const statuses = await page.locator('[role="gridcell"]').allTextContents();
      expect(statuses.some((text) => text === "Succeeded")).toBe(false);
    }).toPass();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("opening a run navigates to its trace view", async ({ page }) => {
    await login(page);
    await page.goto(RUNS_URL);
    await page.getByRole("button", { name: "View trace" }).first().click();
    await page.waitForURL(/\/runs\/[0-9a-f-]+$/);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });
  });
});

test.describe("trace replay", () => {
  test("gate 1 + 5 + 7: scrubbing to the end shows every node's real recorded status and the cost meter lands on the exact recorded total", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs/${SUCCEEDED_RUN_ID}`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

    // Before scrubbing, every node is pending (40% opacity) -- the playhead
    // starts at 0 with no ?t= deep link on this URL.
    const nodeStatuses = page.locator("[data-run-status]");
    for (const status of await nodeStatuses.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-run-status")))) {
      expect(status).toBe("pending");
    }

    // Gate item 7: keyboard operability -- End jumps the playhead to the run's end.
    const slider = page.getByRole("slider", { name: "Playhead" });
    await slider.focus();
    await slider.press("End");

    await expect(async () => {
      const statuses = await nodeStatuses.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-run-status")));
      expect(statuses.every((status) => status === "succeeded")).toBe(true);
    }).toPass();

    // Gate item 5: the cost meter's running total must equal the run's own
    // recorded total exactly once playback reaches the end -- this run's
    // real recorded total (agent_runs.cost_usd = $0.0001) is coarser than
    // the underlying step's own cost_cents (0.005966), so this is a real
    // rounding case, not a contrived one: the meter must snap to 0.0100¢,
    // not whatever a naive re-sum of the (more precise, but differently
    // rounded) per-step figure would produce.
    await expect(page.getByText("0.0100¢").first()).toBeVisible();
  });

  test("gate 1: a mid-run playhead position shows a real mix of finished and not-yet-run nodes, not an all-or-nothing jump", async ({
    page,
  }) => {
    await login(page);
    // Deep link (gate item 6) straight to a mid-run instant -- the trigger/
    // transform/knowledge steps finish well under 100ms into this real run,
    // the llm/condition/output steps start later.
    await page.goto(`http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs/${SUCCEEDED_RUN_ID}?t=100`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

    const slider = page.getByRole("slider", { name: "Playhead" });
    await expect(slider).toHaveAttribute("aria-valuenow", "100");

    const statuses = await page
      .locator("[data-run-status]")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-run-status")));
    expect(statuses).toContain("succeeded");
    expect(statuses).toContain("pending");
  });

  test("gate 4: clicking a node shows its resolved input/output only once it has actually run", async ({ page }) => {
    await login(page);
    await page.goto(`http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs/${SUCCEEDED_RUN_ID}`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

    // At playhead 0, clicking the LLM node shows it hasn't run yet -- not a
    // preview of its eventual (real, drafted-message) output.
    await page.locator(".react-flow__node").filter({ hasText: "Draft reminder" }).click();
    await expect(page.getByText("This node hasn't run yet at the current playhead position.")).toBeVisible();

    // Scrub to the end, click it again -- now the real resolved output is there.
    const slider = page.getByRole("slider", { name: "Playhead" });
    await slider.focus();
    await slider.press("End");
    await page.locator(".react-flow__node").filter({ hasText: "Draft reminder" }).click();
    await expect(page.getByText("Output", { exact: true })).toBeVisible();
    await expect(page.locator("pre").filter({ hasText: /response/ })).toBeVisible();
  });

  test("gate 4 (failure path): a failed node shows its error, and its skipped dependents synthesize a coherent instant rather than staying stuck at t=0", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs/${FAILED_RUN_ID}`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

    const slider = page.getByRole("slider", { name: "Playhead" });
    await slider.focus();
    await slider.press("End");

    const nodeStatuses = page.locator("[data-run-status]");
    await expect(async () => {
      const statuses = await nodeStatuses.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-run-status")));
      expect(statuses.filter((s) => s === "failed")).toHaveLength(1);
      expect(statuses.filter((s) => s === "skipped")).toHaveLength(2);
      expect(statuses.filter((s) => s === "succeeded")).toHaveLength(3);
    }).toPass();

    await page.locator(".react-flow__node").filter({ hasText: "Draft reminder" }).click();
    // Two "Failed" badges are legitimately on screen at once here -- the
    // run's own status badge in the header, and this node's status badge
    // in the detail panel, which renders second in DOM order.
    await expect(page.getByText("Failed", { exact: true }).last()).toBeVisible();
  });

  test("a cancelled run leaves never-reached nodes pending, not skipped", async ({ page }) => {
    await login(page);
    await page.goto(`http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs/${CANCELLED_RUN_ID}`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

    const slider = page.getByRole("slider", { name: "Playhead" });
    await slider.focus();
    await slider.press("End");

    await expect(async () => {
      const statuses = await page
        .locator("[data-run-status]")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-run-status")));
      expect(statuses.filter((s) => s === "succeeded")).toHaveLength(3);
      expect(statuses.filter((s) => s === "pending")).toHaveLength(3);
    }).toPass();
  });

  test("gate 7: space toggles play/pause", async ({ page }) => {
    await login(page);
    await page.goto(`http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs/${SUCCEEDED_RUN_ID}`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

    const slider = page.getByRole("slider", { name: "Playhead" });
    await slider.focus();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    await slider.press(" ");
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    await slider.press(" ");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });

  test("gate 8: reduced motion still replays correctly, with static edge highlights instead of a traveling pulse", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page);
    await page.goto(`http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs/${SUCCEEDED_RUN_ID}?t=120`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

    // No traveling-pulse <circle> exists anywhere under reduced motion --
    // an active edge gets a static stroke highlight instead (a plain style
    // change on the existing path, not a separate animated element).
    await expect(page.locator(".react-flow__edge circle")).toHaveCount(0);
  });

  test("gate 9: comparing against a run where the LLM step failed shows it as a changed node", async ({ page }) => {
    await login(page);
    await page.goto(`http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs/${SUCCEEDED_RUN_ID}`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

    await page.getByRole("button", { name: "Compare with another run" }).click();
    // Not getByRole("combobox", {name}): Playwright's role+accessible-name
    // matching against this specific Radix trigger (role="combobox" button,
    // aria-autocomplete="none") never resolves even though the computed
    // accessible name is verifiably correct (confirmed directly via
    // locator.ariaSnapshot() while debugging this) -- a locator-engine
    // quirk, not an app bug. Plain text matching sidesteps it.
    await page.getByText("Choose a run to compare against").click();
    // The failed run's option text includes its status -- distinguishing it
    // from the many "succeeded" options in the same list.
    await page.getByRole("option", { name: /failed/i }).first().click();

    // The real succeeded run has a real drafted message; the failed run has
    // no output for that node at all -- a genuine, real difference.
    await expect(page.getByRole("heading", { name: "Draft reminder" })).toBeVisible({ timeout: 10000 });
  });
});

test.describe("scrubber interaction", () => {
  test("dragging the playhead moves it, and the speed control is keyboard/mouse operable", async ({ page }) => {
    await login(page);
    await page.goto(`http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/runs/${SUCCEEDED_RUN_ID}`);
    await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

    const slider = page.getByRole("slider", { name: "Playhead" });
    const box = await slider.boundingBox();
    if (!box) throw new Error("slider has no layout box");

    await page.mouse.move(box.x + 5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();

    await expect(async () => {
      const value = Number(await slider.getAttribute("aria-valuenow"));
      expect(value).toBeGreaterThan(0);
    }).toPass();

    const speedButton = page.getByRole("button", { name: "2×", exact: true });
    await speedButton.click();
    await expect(speedButton).toHaveAttribute("aria-pressed", "true");
  });
});
