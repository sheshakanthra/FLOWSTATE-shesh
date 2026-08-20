import { expect, test, type Locator, type Page } from "@playwright/test";

// Every test here drives at least one real tool-calling Groq turn against
// one seeded workspace -- same contention/latency reasoning
// copilot-streaming.spec.ts documents for running this file serially rather
// than in parallel.
test.describe.configure({ mode: "serial" });

const WORKSPACE = "meridian-ops";
const BASE = `http://localhost:3000/w/${WORKSPACE}`;

async function login(page: Page, email: string) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

function dockOf(page: Page) {
  return page.getByRole("complementary", { name: "Copilot" });
}

async function openFreshThread(page: Page): Promise<{ dock: Locator; threadId: string }> {
  await page.keyboard.press("ControlOrMeta+j");
  const dock = dockOf(page);
  await expect(dock).toBeVisible();
  await dock.getByRole("button", { name: "New", exact: true }).click();
  const threadView = dock.locator("[data-thread-id]");
  await expect(threadView).toBeVisible();
  const threadId = await threadView.getAttribute("data-thread-id");
  if (!threadId) throw new Error("New conversation didn't produce a thread id.");
  return { dock, threadId };
}

async function deleteThread(page: Page, threadId: string) {
  try {
    await page.request.delete(`http://localhost:3000/api/copilot/threads/${threadId}`, {
      data: { workspaceSlug: WORKSPACE },
      timeout: 10_000,
    });
  } catch {
    // Best-effort cleanup, matching copilot-streaming.spec.ts's own precedent.
  }
}

async function sendMessage(dock: Locator, text: string) {
  const composer = dock.getByRole("textbox", { name: "Ask the copilot" });
  await composer.fill(text);
  await composer.press("Enter");
}

/** The most recent tool card, in whatever state it's currently in --
 *  `data-tool-call-status` (approval-card.tsx) is the seam. */
function lastToolCard(dock: Locator): Locator {
  return dock.locator("[data-tool-call-status]").last();
}

test.describe("gate items 1, 3 (graph half), 6, 9: create_agent_from_description end to end", () => {
  test("produces a previewed canvas with an accessible Approve button, appears in the FiringBar while executing, and approving creates a real agent", async ({ page }) => {
    await login(page, "priya@meridianops.com");
    await page.goto(`${BASE}/today`);
    const { dock, threadId } = await openFreshThread(page);
    try {
      await sendMessage(dock, "Build me an agent that qualifies inbound leads");

      // Gate item 6: the FiringBar's sr-only announcement is visible on
      // focus/hover; checking it exists in the DOM (rather than forcing
      // focus, which would race the composer's own focus) is enough to
      // prove the operation registered -- the strip itself renders whether
      // or not anyone happens to be hovering it right now.
      await expect(page.getByText(/operation.*running/i)).toBeAttached({ timeout: 30_000 });

      const card = lastToolCard(dock);
      await expect(card).toHaveAttribute("data-tool-call-status", "pending", { timeout: 45_000 });

      // The graph half of gate item 3 -- a real rendered canvas, not JSON.
      await expect(card.locator(".react-flow")).toBeVisible();

      // Gate item 9: accessible name describes the consequence, not just "Approve".
      const approve = card.getByRole("button", { name: /^Approve: Create/ });
      const decline = card.getByRole("button", { name: /^Decline: Create/ });
      await expect(approve).toBeVisible();
      await expect(decline).toBeVisible();

      // Keyboard operable.
      await approve.focus();
      await expect(approve).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(card).toHaveAttribute("data-tool-call-status", "succeeded", { timeout: 20_000 });
      const viewLink = card.getByRole("link", { name: "View" });
      await expect(viewLink).toBeVisible();
      const href = await viewLink.getAttribute("href");
      expect(href).toMatch(/\/agents\/[0-9a-f-]+\/build$/);

      // Gate item 1's actual claim -- a real, runnable agent -- confirmed via
      // a real API read, not just the UI's own optimistic state.
      const agentId = href!.split("/agents/")[1]!.split("/")[0]!;
      const detail = await page.request.get(`http://localhost:3000/api/agents/${agentId}?workspaceSlug=${WORKSPACE}`);
      expect(detail.ok()).toBe(true);
      const detailBody = await detail.json();
      expect(detailBody.agent.status).toBe("draft");
      expect(detailBody.agent.graph.nodes.length).toBeGreaterThan(0);

      // Gate item 5: ⌘Z undoes the approved action.
      await page.keyboard.press("ControlOrMeta+z");
      await expect
        .poll(
          async () => {
            const res = await page.request.get(`http://localhost:3000/api/agents/${agentId}?workspaceSlug=${WORKSPACE}`);
            return (await res.json()).agent.status;
          },
          { timeout: 10_000 },
        )
        .toBe("archived");
    } finally {
      await deleteThread(page, threadId);
    }
  });
});

test.describe("gate item 3 (diff half): modify_agent previews a canvas diff", () => {
  test("proposing a change to an existing agent shows added/removed/modified highlighting, not JSON", async ({ page }) => {
    await login(page, "priya@meridianops.com");

    // A fresh, disposable target -- not a seeded fixture other tests
    // depend on -- created directly via the template endpoint (no LLM cost)
    // rather than through the copilot, since this test is about the
    // *modify* half.
    const created = await page.request.post("http://localhost:3000/api/agents", {
      data: { source: "template", workspaceSlug: WORKSPACE, templateId: "lead-qualifier" },
    });
    expect(created.ok()).toBe(true);
    const { agent } = await created.json();

    await page.goto(`${BASE}/agents/${agent.id}/build`);
    // The context envelope now carries entity.id = this agent -- the
    // copilot's own system prompt surfaces "Currently viewing: agent <id>",
    // which is what lets modify_agent's proposed agentId resolve to this
    // one without the message having to spell out an id.
    const { dock, threadId } = await openFreshThread(page);
    try {
      await sendMessage(dock, "Rename this agent's trigger node to \"Updated Trigger\".");

      const card = lastToolCard(dock);
      await expect(card).toHaveAttribute("data-tool-call-status", "pending", { timeout: 45_000 });
      await expect(card.locator(".react-flow")).toBeVisible();
      // The changes side-list (features/agents/versions/diff.tsx's own
      // VersionDiff) -- proves this is a real diff render, not a JSON blob.
      await expect(card.getByText("Changes")).toBeVisible();

      await card.getByRole("button", { name: /^Decline:/ }).click();
      await expect(card).toHaveAttribute("data-tool-call-status", "rejected", { timeout: 10_000 });

      // Gate item 2: declining never wrote the mutation.
      const detail = await page.request.get(`http://localhost:3000/api/agents/${agent.id}?workspaceSlug=${WORKSPACE}`);
      const detailBody = await detail.json();
      const triggerNode = detailBody.agent.graph.nodes.find((node: { type: string }) => node.type === "trigger");
      expect(triggerNode.data.label).not.toBe("Updated Trigger");
    } finally {
      await deleteThread(page, threadId);
    }
  });
});

test.describe("gate item 7: a failing tool shows a specific error and a working retry", () => {
  test("a failed read-only tool call shows a specific error, survives reload, and Retry re-invokes it", async ({ page }) => {
    await login(page, "priya@meridianops.com");
    await page.goto(`${BASE}/today`);
    // A real thread and a real, cheap user turn -- not through a message
    // phrased to *hope* the model reaches for explain_run (tool_choice is
    // "auto"; a live model's routing decision is inherently non-
    // deterministic, confirmed directly: the same nonexistent-run phrasing
    // sometimes answered in plain text instead of calling the tool). This
    // test's own claim is about failure/retry/reload rendering, not about
    // prompting the model into a specific tool choice, so the failing call
    // is proposed directly via the same `/api/copilot/execute` action a
    // live tool call would resolve to -- deterministic, and it exercises
    // the reload-hydration path (gate item 5's "survives reload") for free.
    const { dock, threadId } = await openFreshThread(page);
    await sendMessage(dock, "hello");
    await expect(dock.getByRole("button", { name: "Copy message" }).last()).toBeVisible({ timeout: 30_000 });

    try {
      const thread = await page.request.get(`http://localhost:3000/api/copilot/threads/${threadId}?workspaceSlug=${WORKSPACE}`);
      const { messages } = await thread.json();
      const userMessageId = messages.find((message: { role: string }) => message.role === "user").id;

      const proposed = await page.request.post("http://localhost:3000/api/copilot/execute", {
        data: {
          action: "propose",
          workspaceSlug: WORKSPACE,
          toolName: "explain_run",
          input: { runId: "00000000-0000-0000-0000-000000000000" },
          messageId: userMessageId,
        },
      });
      expect(proposed.ok()).toBe(true);
      const proposedBody = await proposed.json();
      expect(proposedBody.status).toBe("failed");
      expect(proposedBody.error).toMatch(/no run with that id/i);

      await page.reload();
      await page.keyboard.press("ControlOrMeta+j");
      const reopenedDock = dockOf(page);
      await expect(reopenedDock).toBeVisible();
      // Threads open on the list (activeThreadId doesn't survive reload --
      // it's client-only state). Untitled threads all show "New
      // conversation"; the list orders by recency and this one was just
      // touched by the "hello" turn above, so it's the first row.
      await reopenedDock.getByRole("list", { name: "Conversations" }).getByRole("button", { name: /New conversation/ }).first().click();
      const card = lastToolCard(reopenedDock);
      await expect(card).toHaveAttribute("data-tool-call-status", "failed", { timeout: 10_000 });
      await expect(card.getByRole("alert")).toContainText(/no run with that id/i);

      const retry = card.getByRole("button", { name: /^Retry:/ });
      await expect(retry).toBeVisible();
      await retry.click();

      // Re-runs the same (still-nonexistent) lookup -- fails again,
      // deterministically, proving the mechanism re-invoked the tool rather
      // than just re-displaying the old result.
      await expect(card).toHaveAttribute("data-tool-call-status", "failed", { timeout: 15_000 });
      await expect(card.getByRole("alert")).toContainText(/no run with that id/i);
    } finally {
      await deleteThread(page, threadId);
    }
  });
});

test.describe("gate item 4: permission enforcement", () => {
  test("a Member's copilot is denied an Owner-only tool, with the missing permission named in the UI", async ({ page }) => {
    await login(page, "sam@meridianops.com");
    await page.goto(`${BASE}/today`);
    const { dock, threadId } = await openFreshThread(page);
    try {
      await sendMessage(dock, 'Draft and send a client update to Lumen Dental with subject "Status" saying everything is on track.');

      const card = lastToolCard(dock);
      await expect(card).toHaveAttribute("data-tool-call-status", "failed", { timeout: 30_000 });
      await expect(card.getByRole("alert")).toContainText(/owner/i);
      // Nothing to retry -- no tool_calls row exists for a denied proposal.
      await expect(card.getByRole("button", { name: /^Retry:/ })).toHaveCount(0);
    } finally {
      await deleteThread(page, threadId);
    }
  });

  test("direct API call: a Member proposing draft_message is rejected with the missing role named, no approval UI involved", async ({ page }) => {
    await login(page, "sam@meridianops.com");

    // A throwaway thread + message purely to own the tool_calls row's
    // required messageId FK -- this test's own claim is about the
    // permission check, not about a real conversation.
    const thread = await page.request.post("http://localhost:3000/api/copilot/threads", { data: { workspaceSlug: WORKSPACE } });
    const { thread: threadBody } = await thread.json();

    const response = await page.request.post("http://localhost:3000/api/copilot/execute", {
      data: {
        action: "propose",
        workspaceSlug: WORKSPACE,
        toolName: "draft_message",
        input: { clientName: "Acme", subject: "Test", body: "Test body." },
        messageId: threadBody.id, // deliberately not a real message id -- see below
      },
    });
    // Permission is checked before the messageId is ever used, so an
    // invalid messageId doesn't mask the 403 this test is actually about.
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toMatch(/owner/i);

    await page.request.delete(`http://localhost:3000/api/copilot/threads/${threadBody.id}`, { data: { workspaceSlug: WORKSPACE } });
  });
});

test.describe("gate item 8: prompt library", () => {
  test("/ opens it, saving a new prompt persists workspace-wide, and selecting it inserts the prompt", async ({ page }) => {
    await login(page, "priya@meridianops.com");
    await page.goto(`${BASE}/today`);
    await page.keyboard.press("ControlOrMeta+j");
    const dock = dockOf(page);
    await expect(dock).toBeVisible();

    const composer = dock.getByRole("textbox", { name: "Ask the copilot" });
    await composer.fill("/");
    const menu = dock.getByRole("listbox", { name: "Saved prompts" });
    await expect(menu).toBeVisible();

    const uniqueTitle = `E2E test prompt ${Date.now()}`;
    const uniqueContent = `Summarize this week's activity, e2e marker ${Date.now()}.`;
    await menu.getByRole("button", { name: "Save a new prompt" }).click();

    const dialog = page.getByRole("dialog", { name: "Save a prompt" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Title").fill(uniqueTitle);
    await dialog.getByLabel("Prompt").fill(uniqueContent);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    // Persists workspace-wide -- reload and reopen the menu to confirm it's
    // a real, server-backed row, not local component state.
    await page.reload();
    await page.keyboard.press("ControlOrMeta+j");
    const reopenedDock = dockOf(page);
    await expect(reopenedDock).toBeVisible();
    const reopenedComposer = reopenedDock.getByRole("textbox", { name: "Ask the copilot" });
    await reopenedComposer.fill("/");
    const reopenedMenu = reopenedDock.getByRole("listbox", { name: "Saved prompts" });
    await expect(reopenedMenu.getByText(uniqueTitle)).toBeVisible();

    // Selection inserts the prompt into the composer.
    await reopenedMenu.getByRole("option", { name: new RegExp(uniqueTitle) }).click();
    await expect(reopenedComposer).toHaveValue(uniqueContent);
    await expect(reopenedMenu).toHaveCount(0);
  });
});
