import { expect, test } from "@playwright/test";

const SINGLE_NODE_URL = "http://localhost:6006/iframe.html?id=features-agents-inspector--single-node-selected&viewMode=story";
const MULTI_SAME_TYPE_URL = "http://localhost:6006/iframe.html?id=features-agents-inspector--multi-select-same-type&viewMode=story";
const EMPTY_URL = "http://localhost:6006/iframe.html?id=features-agents-inspector--empty-selection&viewMode=story";

/** Gate item 1: editing a property updates the canvas summary immediately.
 *  Gate item 2: the save indicator moves unsaved -> saving -> saved-at. */
test("editing a field updates the canvas summary immediately and the save indicator reaches 'saved'", async ({ page }) => {
  await page.goto(SINGLE_NODE_URL);
  const node = page.locator('.react-flow__node[data-id="llm-1"]');
  await expect(node).toBeVisible();

  const promptField = page.getByLabel("System Prompt");
  await promptField.fill("Summarize in one sentence.");

  // Canvas summary reflects the live-applied value without waiting for the debounce/save.
  await expect(node.locator("[data-node-type]")).toContainText("Summarize in one sentence.");

  await expect(page.getByText(/^Saving…/)).toBeVisible();
  await expect(page.getByText(/^Saved at/)).toBeVisible({ timeout: 3000 });
});

/** Gate item 3/4: a node move is one undo step, and ⌘⇧Z redoes it. */
test("moving a node is one undo step, reversed by ⌘Z and reapplied by ⌘⇧Z", async ({ page }) => {
  await page.goto(SINGLE_NODE_URL);
  const node = page.locator('.react-flow__node[data-id="llm-1"]');
  await expect(node).toBeVisible();

  const before = await node.boundingBox();
  if (!before) throw new Error("node has no layout box");

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 150, before.y + before.height / 2 + 80, { steps: 10 });
  await page.mouse.up();

  const afterMove = await node.boundingBox();
  if (!afterMove) throw new Error("node has no layout box");
  expect(afterMove.x).not.toBeCloseTo(before.x, 0);

  await page.keyboard.press("Control+z");
  await expect(async () => {
    const restored = await node.boundingBox();
    expect(restored?.x).toBeCloseTo(before.x, 0);
  }).toPass();

  await page.keyboard.press("Control+Shift+z");
  await expect(async () => {
    const redone = await node.boundingBox();
    expect(redone?.x).toBeCloseTo(afterMove.x, 0);
  }).toPass();
});

/** Gate item 3: deleting a node is one undo step that restores it (and any
 *  edges it carried) exactly. */
test("deleting a node is undoable with ⌘Z", async ({ page }) => {
  await page.goto(SINGLE_NODE_URL);
  await expect(page.locator(".react-flow__node")).toHaveCount(4);

  await page.locator('.react-flow__node[data-id="llm-1"]').click();
  await page.keyboard.press("Delete");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  // Its incident edges went with it.
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  await page.keyboard.press("Control+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
});

/** Gate item 3: typing a multi-character value into a text field is a
 *  single undo step, not one per keystroke. */
test("typing a 12-character prompt is a single undo step", async ({ page }) => {
  await page.goto(SINGLE_NODE_URL);
  const promptField = page.getByLabel("System Prompt");
  await promptField.click();
  await promptField.fill("");
  await page.keyboard.type("Twelve char.", { delay: 30 });
  await expect(promptField).toHaveValue("Twelve char.");

  // Give the 300ms coalescing idle window time to flush into one undo entry.
  await page.waitForTimeout(500);

  await page.keyboard.press("Control+z");
  await expect(promptField).toHaveValue("");
});

/** Gate item 5: variable autocomplete offers only the selected node's
 *  upstream outputs, never downstream or unconnected nodes. */
test("variable autocomplete offers only in-scope upstream variables", async ({ page }) => {
  await page.goto(SINGLE_NODE_URL);
  const promptField = page.getByLabel("System Prompt");
  await promptField.click();
  await promptField.fill("Use {{");

  const listbox = page.getByRole("listbox", { name: "Variables in scope" });
  await expect(listbox).toBeVisible();
  const optionText = await listbox.textContent();

  // Upstream of llm-1: trigger-1 (via knowledge-1/tool-1's inputs) and the
  // two direct predecessors knowledge-1 and tool-1 -- their outputs must
  // all be offered.
  expect(optionText).toContain("results");
  expect(optionText).toContain("output");
  // Nothing from llm-1 itself, and nothing invented.
  expect(optionText).not.toContain("response");
});

/** Gate item 7: selecting several same-type nodes and changing a shared
 *  field updates all of them as one undoable action. */
test("multi-select: changing the shared Model field updates all selected nodes as one undo step", async ({ page }) => {
  await page.goto(MULTI_SAME_TYPE_URL);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);

  const modelTrigger = page.locator("#node-config-model");
  await expect(modelTrigger).toBeVisible();
  await modelTrigger.click();
  await page.getByRole("option", { name: "Gemma 2 9B" }).click();

  const summaries = page.locator(".react-flow__node [data-node-type]");
  await expect(summaries).toHaveCount(3);
  for (const summary of await summaries.all()) {
    await expect(summary).toContainText("Gemma 2 9B");
  }

  // Give the 300ms coalescing idle window time to flush into an undo entry.
  await page.waitForTimeout(500);

  // One ⌘Z reverses all three nodes at once, not just the last one.
  await page.keyboard.press("Control+z");
  for (const summary of await summaries.all()) {
    await expect(summary).not.toContainText("Gemma 2 9B");
  }
});

/** Gate item 1 (empty state) + item 8: nothing selected shows agent-level
 *  settings, and the resize handle responds to arrow keys. */
test("empty selection shows agent settings, and the panel is keyboard-resizable", async ({ page }) => {
  await page.goto(EMPTY_URL);
  await expect(page.getByText("Agent settings")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Insurance Verification");

  const handle = page.getByRole("separator", { name: "Resize inspector panel" });
  await handle.focus();
  const before = Number(await handle.getAttribute("aria-valuenow"));

  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");

  const after = Number(await handle.getAttribute("aria-valuenow"));
  expect(after).not.toBe(before);
});
