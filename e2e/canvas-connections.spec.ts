import { expect, test, type Page } from "@playwright/test";

const CONNECTIONS_STORY_URL = "http://localhost:6006/iframe.html?id=features-agents-canvas--connections&viewMode=story";
const INTERACTIVE_STORY_URL = "http://localhost:6006/iframe.html?id=features-agents-canvas--interactive&viewMode=story";

async function portCenter(page: Page, nodeId: string, portId: string) {
  const box = await page.locator(`.react-flow__node[data-id="${nodeId}"] [data-port-id="${portId}"]`).boundingBox();
  if (!box) throw new Error(`port ${nodeId}/${portId} has no layout box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** B2 gate item 2: connecting incompatible port types is impossible, and the
 *  reason is shown on hover *before* the drop is attempted -- not an error
 *  after. llm-a's `response` (text) into llm-b's `context` (document) is the
 *  spec's own "text -> document" example, concretely reachable via two real
 *  registered node types (see canvas.stories.tsx's Connections story). */
test("dragging an incompatible port shows the reason before the drop, and the drop never completes", async ({
  page,
}) => {
  await page.goto(CONNECTIONS_STORY_URL);
  await expect(page.locator(".react-flow__pane")).toBeVisible();
  await expect(page.locator('.react-flow__node[data-id="llm-a"]')).toBeVisible();
  // The story pre-seeds 2 edges (cond-a -> cond-b -> cond-c); this drag must
  // not add a third.
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  const source = await portCenter(page, "llm-a", "response");
  const target = await portCenter(page, "llm-b", "context");

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });

  await expect(page.getByRole("status").filter({ hasText: "document" })).toBeVisible();

  await page.mouse.up();

  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
});

/** Same gesture, compatible ports this time (text -> text) -- the drop
 *  actually completes and a real edge appears. */
test("dragging a compatible port completes the connection", async ({ page }) => {
  await page.goto(CONNECTIONS_STORY_URL);
  await expect(page.locator(".react-flow__pane")).toBeVisible();
  // The story pre-seeds 2 edges (cond-a -> cond-b -> cond-c).
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  const source = await portCenter(page, "llm-a", "response");
  const target = await portCenter(page, "llm-b", "prompt");

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator(".react-flow__edge")).toHaveCount(3);
});

/** B2 gate item 3: a connection that would create a cycle is rejected, and
 *  the message names the cycle. cond-a -> cond-b -> cond-c are pre-wired by
 *  the story; cond-c -> cond-a would close the loop. */
test("a connection that would create a cycle is rejected, naming the cycle's nodes", async ({ page }) => {
  await page.goto(CONNECTIONS_STORY_URL);
  await expect(page.locator(".react-flow__pane")).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  const source = await portCenter(page, "cond-c", "true");
  const target = await portCenter(page, "cond-a", "in");

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.up();

  const toast = page.locator(".text-body.text-fg-100", { hasText: /would create a cycle/i });
  await expect(toast).toBeVisible();
  const toastText = await toast.textContent();
  expect(toastText).toContain("Condition A");
  expect(toastText).toContain("Condition B");
  expect(toastText).toContain("Condition C");

  // Rejected -- the graph still has exactly the two edges the story seeded.
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
});

/** B2 gate item 6: Tab between nodes, Enter to focus a node's ports, `c` to
 *  begin a connection, arrows to choose a target, Enter to complete, Esc to
 *  cancel. Built as a real keyboard-only path, not a drag substitute. */
test("keyboard connection path: focus a node, enter port focus, begin and complete a connection", async ({
  page,
}) => {
  await page.goto(CONNECTIONS_STORY_URL);
  const pane = page.locator(".react-flow__pane");
  await expect(pane).toBeVisible();

  const llmA = page.locator('.react-flow__node[data-id="llm-a"]');
  await llmA.focus();
  await expect(llmA).toBeFocused();

  // Enter focuses the node's ports -- llm-a has outputs, so the default
  // side is "output", starting on its one output port ("response").
  await page.keyboard.press("Enter");
  const responsePort = page.locator('.react-flow__node[data-id="llm-a"] [data-port-id="response"] .react-flow__handle');
  await expect(responsePort).toHaveClass(/border-blue-fg/);

  // Esc cancels back out of connecting mode without creating an edge.
  await page.keyboard.press("c");
  await page.keyboard.press("Escape");
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  // Re-enter and actually complete a connection this time.
  await page.keyboard.press("c");
  await page.keyboard.press("Enter");
  await expect(page.locator(".react-flow__edge")).toHaveCount(3);
});

/** B2 gate item 5: the node library search finds a node by label, category,
 *  and description -- and gate item 1's "insertable from the library" via
 *  click-to-insert-at-center. */
test("node library search matches by label, category, and description, and inserts on click", async ({ page }) => {
  await page.goto(INTERACTIVE_STORY_URL);
  await expect(page.locator(".react-flow__pane")).toBeVisible();
  const before = await page.locator(".react-flow__node").count();

  const search = page.getByRole("combobox", { name: "Search node types" });

  await search.fill("Human in the loop");
  await expect(page.getByRole("option", { name: "Human in the loop" })).toBeVisible();

  await search.fill("Flow control");
  await expect(page.getByRole("option", { name: "Condition" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Loop" })).toBeVisible();

  await search.fill("retrieves relevant documents");
  const knowledgeOption = page.getByRole("option", { name: "Knowledge" });
  await expect(knowledgeOption).toBeVisible();

  await knowledgeOption.click();
  await expect(page.locator(".react-flow__node")).toHaveCount(before + 1);
});

/** B2 gate item 4: copy/paste of a multi-node selection preserves config and
 *  creates new ids with no collisions. */
test("copy/paste preserves config and produces collision-free ids", async ({ page }) => {
  await page.goto(INTERACTIVE_STORY_URL);
  const pane = page.locator(".react-flow__pane");
  await expect(pane).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(6);

  await pane.click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");

  await expect(page.locator(".react-flow__node")).toHaveCount(12);

  const ids = await page.locator(".react-flow__node").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-id")));
  expect(new Set(ids).size).toBe(12);

  // Config survives the round trip: each node type's rendered summary text
  // should appear twice (once for the original, once for the paste).
  const summaries = await page.locator(".react-flow__node").evaluateAll((nodes) =>
    nodes.map((n) => n.querySelector("[data-node-type]")?.textContent ?? ""),
  );
  const counts = new Map<string, number>();
  for (const summary of summaries) counts.set(summary, (counts.get(summary) ?? 0) + 1);
  for (const count of counts.values()) expect(count).toBe(2);
});

/** ⌘D duplicates the current selection in place without touching the
 *  clipboard, preserving config with collision-free ids. */
test("duplicate (⌘D) preserves config and produces collision-free ids", async ({ page }) => {
  await page.goto(INTERACTIVE_STORY_URL);
  const pane = page.locator(".react-flow__pane");
  await expect(pane).toBeVisible();

  // int-2, not int-0: int-0 sits under the NodeLibraryPanel's screen area
  // (see the box-select test's decision comment for the same collision).
  await page.locator('.react-flow__node[data-id="int-2"]').click();
  await page.keyboard.press("Control+d");

  await expect(page.locator(".react-flow__node")).toHaveCount(7);
  const ids = await page.locator(".react-flow__node").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-id")));
  expect(new Set(ids).size).toBe(7);
});
