import { expect, test } from "@playwright/test";

const AGENT_ID = "1cca2647-ff3e-4b2a-8c85-1e34aea8da40"; // Lumen Dental — Recall Scheduler
const BUILD_URL = `http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/build`;
const VERSIONS_URL = `http://localhost:3000/w/meridian-ops/agents/${AGENT_ID}/versions`;

const PLAIN_PROMPT = "Remind the patient it's time for their dental cleaning. Keep it short.";
const WARM_PROMPT =
  "Draft a warm, brief SMS reminding a dental patient it's time to book their recall cleaning. Keep it under 300 characters, friendly, and end with a call to action.";

async function login(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

async function openBuildPage(page: import("@playwright/test").Page) {
  await page.goto(BUILD_URL);
  await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });
}

async function setSystemPrompt(page: import("@playwright/test").Page, prompt: string) {
  await page.locator(".react-flow__node").filter({ hasText: "Draft reminder" }).click();
  const field = page.locator("#node-config-systemPrompt");
  await expect(field).toBeVisible();
  await field.fill(prompt);
  await field.blur();
  // Debounced autosave (B3) -- give it time to settle before publishing,
  // since Publish reads the live draft from graph-store directly (no
  // separate "is autosave still pending" check of its own).
  await expect(page.getByText(/^Saved at/)).toBeVisible({ timeout: 5000 });
  // The Publish button lives in agent-settings.tsx, which the Inspector
  // only renders when nothing is selected on canvas (B3's own routing) --
  // a fresh reload is the reliable way back to that deselected state.
  // Clicking a supposedly-empty point on the pane was tried first and is
  // fragile: React Flow's docked Node Library panel (top-left) can leave
  // floating UI (its search combobox) covering more of the canvas than
  // its own collapsed footprint suggests, silently swallowing a click
  // aimed at what looks like open space.
  await openBuildPage(page);
}

async function publish(page: import("@playwright/test").Page, note: string) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Publish/ })).toBeVisible();
  await expect(page.getByText("Ready to publish.")).toBeVisible();
  await page.getByPlaceholder("What changed in this version?").fill(note);
  await page.getByRole("button", { name: "Publish", exact: true }).last().click();
  await expect(page.getByText(/^Published$/)).toBeVisible({ timeout: 10000 });
}

/**
 * This is also this session's real, non-destructive way of seeding a
 * genuine multi-version history for the shared dev database's Recall
 * Scheduler agent -- driving the actual Publish dialog end to end (not an
 * ad-hoc script writing rows directly) is both the real verification gate
 * items 1/3/4/5 want and the agreed way to get real version content into
 * this agent for the rest of this session's testing to build on.
 */
test.describe.serial("publish flow and version history", () => {
  test("publishing twice with different prompts creates two real, distinct versions", async ({ page }) => {
    await login(page);
    await openBuildPage(page);

    // Defensive: an earlier, since-fixed iteration of the "gate item 5"
    // test in this same file used to disable this agent's trigger node to
    // produce a validation failure, and a failure partway through that
    // test could leave the real live draft with the trigger still
    // disabled. That test no longer touches the trigger at all (it
    // targets a node-scoped `topK` issue instead), so nothing later in
    // this file re-enables it -- this makes the file self-healing against
    // that leftover state regardless.
    await page.locator(".react-flow__node").filter({ hasText: "Nightly schedule" }).click();
    const triggerDisabledSwitch = page.getByRole("switch", { name: /disabled/i });
    if (await triggerDisabledSwitch.isChecked()) {
      await triggerDisabledSwitch.click();
      await expect(page.getByText(/^Saved at/)).toBeVisible({ timeout: 5000 });
    }
    await openBuildPage(page);

    await setSystemPrompt(page, PLAIN_PROMPT);
    await publish(page, "Initial launch — nightly recall reminders.");

    await openBuildPage(page);
    await setSystemPrompt(page, WARM_PROMPT);
    await publish(page, "Warmer tone, added a clear call to action.");

    await page.goto(VERSIONS_URL);
    // `.first()` throughout this file: this agent's version history is
    // real and cumulative across every run of this test (this session's
    // own agreed way of seeding it), so a repeat run legitimately leaves
    // more than one version with the same note text behind -- the point
    // here is just that a version with this note exists, not that it's
    // the only one.
    await expect(page.getByText("Initial launch — nightly recall reminders.").first()).toBeVisible();
    await expect(page.getByText("Warmer tone, added a clear call to action.").first()).toBeVisible();
    await expect(page.getByText("Priya Anand").first()).toBeVisible();
  });

  test("gate item 5: publish is blocked while validation fails, and a failing node is clickable to focus it", async ({
    page,
  }) => {
    await login(page);
    await openBuildPage(page);

    // Break a real node's config: the knowledge node's `topK` is
    // `z.number().int().positive()`, and its Inspector field is a plain
    // number input with no HTML min/max -- setting it to 0 is both a
    // real, UI-reachable failure and (unlike "no enabled trigger", a
    // graph-wide issue with no owning node) produces a *node-scoped*
    // validation issue, which is what the publish dialog renders as a
    // clickable-to-focus button.
    await page.locator(".react-flow__node").filter({ hasText: "Overdue patients" }).click();
    const topKField = page.locator("#node-config-topK");
    await expect(topKField).toBeVisible();
    await topKField.fill("0");
    await topKField.blur();
    await expect(page.getByText(/^Saved at/)).toBeVisible({ timeout: 5000 });
    await openBuildPage(page);

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Fix these before publishing/)).toBeVisible();
    const publishButton = page.getByRole("button", { name: "Publish", exact: true }).last();
    await expect(publishButton).toBeDisabled();

    // Clicking the failing issue closes the dialog and focuses that node.
    await page.getByRole("button", { name: /invalid topK/i }).click();
    await expect(page.getByRole("heading", { name: /Publish/ })).not.toBeVisible();

    // Fix the config so later tests in this file see a valid graph.
    await page.locator(".react-flow__node").filter({ hasText: "Overdue patients" }).click();
    await expect(topKField).toBeVisible();
    await topKField.fill("5");
    await topKField.blur();
    await expect(page.getByText(/^Saved at/)).toBeVisible({ timeout: 5000 });
  });

  test("gate item 3 + 4: version diff marks the modified LLM node, and restore creates a new draft without destroying history", async ({
    page,
  }) => {
    await login(page);
    await page.goto(VERSIONS_URL);

    const rows = page.locator("li", { hasText: "run" });
    const versionCountBefore = await rows.count();
    expect(versionCountBefore).toBeGreaterThanOrEqual(2);

    // Diff the "Initial launch" version (an earlier, plainer prompt)
    // against the current draft (now the warm prompt) -- a real, visible
    // difference.
    // `.first()`: this agent's history is real and cumulative across
    // repeat runs of this suite, so more than one version can legitimately
    // carry this same note text -- any one of them has the plain prompt
    // and will show a real diff against the current (warm-prompt) draft.
    await page
      .locator("li")
      .filter({ hasText: "Initial launch — nightly recall reminders." })
      .first()
      .getByRole("button", { name: "Diff against current" })
      .click();
    // `.first()`: "Draft reminder" legitimately appears twice on the diff
    // view -- once as the canvas node's own label, once in the side list
    // of changed properties.
    await expect(page.getByText("Draft reminder").first()).toBeVisible();
    await expect(page.getByText("modified").first()).toBeVisible();
    await expect(page.getByText(/systemPrompt/)).toBeVisible();

    // Restore that same older version as a new draft.
    await page
      .locator("li")
      .filter({ hasText: "Initial launch — nightly recall reminders." })
      .first()
      .getByRole("button", { name: "Restore as new draft" })
      .click();
    await page.waitForURL(/\/build$/, { timeout: 10000 });

    await page.locator(".react-flow__node").filter({ hasText: "Draft reminder" }).click();
    await expect(page.locator("#node-config-systemPrompt")).toHaveValue(PLAIN_PROMPT);

    // History wasn't touched by the restore -- both versions are still there.
    await page.goto(VERSIONS_URL);
    await expect(page.getByText("Initial launch — nightly recall reminders.").first()).toBeVisible();
    await expect(page.getByText("Warmer tone, added a clear call to action.").first()).toBeVisible();

    // Leave the draft back on the warm prompt for later tests/demo state.
    await openBuildPage(page);
    await setSystemPrompt(page, WARM_PROMPT);
  });
});
