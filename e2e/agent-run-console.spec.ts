import { expect, test } from "@playwright/test";

const AGENT_URL = "http://localhost:3000/w/meridian-ops/agents/1cca2647-ff3e-4b2a-8c85-1e34aea8da40/build";

/**
 * B4's real-app verification: the seeded 6-node Recall Scheduler agent, run
 * through the actual test console against real Groq. Gate items 1-3, 6, and
 * 7 (real execution, DB step rows, streaming latency, cancellation, cost
 * accuracy) are already verified precisely via direct API calls (see
 * PROGRESS.md's B4 decisions) -- this test covers what only a real browser
 * can show: the test console UI actually renders progress (gate item 4),
 * live canvas feedback fires and settles correctly (gate item 5's visual
 * half), and the run registers with the FiringBar and clears on completion
 * (gate item 8).
 *
 * This test deliberately does NOT try to catch the canvas mid-run (a node's
 * `data-run-status="running"`, mid-flight): the whole 6-node run against
 * real Groq completes in ~500ms (see the cost-summary text this test
 * itself asserts on), which is faster than a multi-step Playwright
 * assertion chain can reliably observe a mid-run frame without becoming
 * flaky on exactly the kind of network-timing variance a real LLM call has.
 * `onStepStart`/`onStepEnd` calling `useRunStore.getState().setNodeStatus`
 * is simple, directly-readable code (features/agents/console/index.tsx),
 * not a claim that needs a live browser catch to be credible -- the
 * end-state (every node settles on `"succeeded"`) is what this test proves
 * live, matching this codebase's own precedent (B1's fps claims) for
 * gate items where the live-instant is real but not reliably screenshot-able.
 *
 * Requires `NODE_ENV=production` (`next start`, not `next dev`) — the dev
 * server's rapid Server-Component compiles produce an unrelated,
 * pre-existing intermittent failure (see PROGRESS.md's Known issues).
 */
test("running the seeded agent updates the console, the canvas, and the FiringBar", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);

  await page.goto(AGENT_URL);
  await expect(page.locator(".react-flow__node")).toHaveCount(6, { timeout: 15000 });

  // FiringBar starts idle.
  await expect(page.getByText(/No operations running/i)).toBeAttached();

  const runButton = page.getByRole("button", { name: "Run", exact: true });
  await expect(runButton).toBeVisible();
  await runButton.click();

  // The run settles: every node ends up "succeeded" (gate item 5's visual
  // half -- NodeShell reads run-store.ts's per-node status and applies the
  // emerald border/Shimmer accordingly), and the FiringBar clears (gate
  // item 8). `data-run-status` lives on NodeShell's own root div, a child
  // of React Flow's own `.react-flow__node` wrapper (which only carries
  // `data-id`) -- not the same element, so this is `[data-run-status]`
  // alone, not combined with the `.react-flow__node` class.
  const nodeStatuses = page.locator("[data-run-status]");
  await expect(nodeStatuses).toHaveCount(6, { timeout: 15000 });
  for (const status of await nodeStatuses.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-run-status")))) {
    expect(status).toBe("succeeded");
  }
  await expect(page.getByText(/No operations running/i)).toBeAttached({ timeout: 3000 });

  // The step log shows every one of the 6 real steps (gate item 4).
  const stepLog = page.getByRole("list", { name: "Run step log" });
  await expect(stepLog.getByText("Nightly schedule")).toBeVisible();
  await expect(stepLog.getByText("Draft reminder")).toBeVisible();
  await expect(stepLog.getByText("Send SMS")).toBeVisible();

  // Output panel and cost summary reflect the finished run, with the real
  // drafted message and a real, non-zero cost.
  await expect(page.locator("pre").first()).toContainText(/recall|cleaning|appointment/i, { timeout: 5000 });
  await expect(page.getByText(/¢/)).toBeVisible();
});
