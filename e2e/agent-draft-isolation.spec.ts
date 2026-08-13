import { expect, test } from "@playwright/test";

const AGENT_ID = "1cca2647-ff3e-4b2a-8c85-1e34aea8da40"; // Lumen Dental — Recall Scheduler
const WORKSPACE_SLUG = "meridian-ops";
const BUILD_URL = `http://localhost:3000/w/${WORKSPACE_SLUG}/agents/${AGENT_ID}/build`;
const VERSIONS_URL = `http://localhost:3000/w/${WORKSPACE_SLUG}/agents/${AGENT_ID}/versions`;
const WARM_PROMPT =
  "Draft a warm, brief SMS reminding a dental patient it's time to book their recall cleaning. Keep it under 300 characters, friendly, and end with a call to action.";
const DISTINCTIVE_DRAFT_PROMPT =
  "Reply with the exact literal text BANANA-PROBE-9182 and nothing else. Do not mention dental care.";

async function login(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

async function setSystemPrompt(page: import("@playwright/test").Page, prompt: string) {
  await page.locator(".react-flow__node").filter({ hasText: "Draft reminder" }).click();
  const field = page.locator("#node-config-systemPrompt");
  await field.fill(prompt);
  await field.blur();
  await expect(page.getByText(/^Saved at/)).toBeVisible({ timeout: 5000 });
}

/**
 * Gate item 2: "Editing a draft while a published version is mid-run does
 * not affect that run — verify this, don't assume it." A real, currently-
 * published version's id (read from the version panel's own DOM, not
 * fabricated), a real run pinned to that version via `agentVersionId`
 * (B6's own extension of B4's run route), and a real, drastically
 * different draft edit made *while* that run is still in flight -- then
 * asserting the run's real Groq output reflects the version's original
 * prompt, not the edited draft, is a stronger proof than reading the code
 * and trusting that `runGraph`'s `nodes`/`edges` parameters are captured
 * once at request start: this is what a demo audience would actually see
 * if the bug existed.
 */
test("gate item 2: editing the draft while a published-version run is in flight does not change that run's output", async ({
  page,
}) => {
  await login(page);

  await page.goto(VERSIONS_URL);
  const latestVersionId = await page.locator("li[data-version-id]").first().getAttribute("data-version-id");
  expect(latestVersionId).toBeTruthy();

  // Start a run pinned to that immutable version. Not awaited yet -- the
  // draft edit below has to land while this is still in flight.
  const runPromise = page.request.post(`http://localhost:3000/api/agents/${AGENT_ID}/run`, {
    data: { workspaceSlug: WORKSPACE_SLUG, agentVersionId: latestVersionId },
    timeout: 30_000,
  });

  await page.goto(BUILD_URL);
  await setSystemPrompt(page, DISTINCTIVE_DRAFT_PROMPT);

  const runResponse = await runPromise;
  expect(runResponse.ok()).toBe(true);
  const body = await runResponse.text();
  const events = body
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { type: string; finalOutputs?: unknown[] });
  const runEnd = events.find((event) => event.type === "run-end");
  expect(runEnd).toBeDefined();
  const outputText = JSON.stringify(runEnd?.finalOutputs ?? []);

  // The run's real output must not contain the distinctive marker from the
  // draft edit made while the request was already in flight -- proving the
  // graph this run executed was the immutable version's own snapshot, not
  // re-read from the (by-then-edited) draft mid-flight.
  expect(outputText).not.toContain("BANANA-PROBE-9182");

  await setSystemPrompt(page, WARM_PROMPT);
});
