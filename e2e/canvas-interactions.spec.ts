import { expect, test } from "@playwright/test";

const EMPTY_STORY_URL = "http://localhost:6006/iframe.html?id=features-agents-canvas--empty&viewMode=story";
const INTERACTIVE_STORY_URL =
  "http://localhost:6006/iframe.html?id=features-agents-canvas--interactive&viewMode=story";

function withTheme(url: string, theme: "dark" | "light"): string {
  return `${url}&globals=theme:${theme}`;
}

/** B1 gate item 7: a designed prompt with a specific first action, not a
 *  blank grid -- and that action has to actually work. */
test("empty canvas shows a designed empty state whose action adds a node", async ({ page }) => {
  await page.goto(EMPTY_STORY_URL);

  await expect(page.getByRole("heading", { name: "Nothing runs yet" })).toBeVisible();
  const addTrigger = page.getByRole("button", { name: "Add a trigger" });
  await expect(addTrigger).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);

  await addTrigger.click();

  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Nothing runs yet" })).toBeHidden();
});

/** B1 gate item 4: ⌘=/⌘-/⌘0 all work, and ⌘0 specifically fits to view. */
test("keyboard shortcuts zoom in, zoom out, and fit view", async ({ page }) => {
  await page.goto(INTERACTIVE_STORY_URL);
  const pane = page.locator(".react-flow__pane");
  await expect(pane).toBeVisible();
  // Click empty canvas (not a node) to give the page focus.
  await pane.click({ position: { x: 10, y: 10 } });

  const zoomLevel = page.getByTestId("zoom-level");
  await expect(zoomLevel).toHaveText("100%");

  await page.keyboard.press("Control+=");
  await expect(zoomLevel).not.toHaveText("100%");
  const afterZoomIn = await zoomLevel.textContent();

  await page.keyboard.press("Control+-");
  await page.keyboard.press("Control+-");
  await expect(zoomLevel).not.toHaveText(afterZoomIn ?? "100%");

  // Fit view has to actually change the viewport to frame all 6 nodes,
  // which are spread from (0,0) to (600,250) -- far enough apart that
  // fitting them changes the zoom level from whatever zooming out left it at.
  const beforeFit = await zoomLevel.textContent();
  await page.keyboard.press("Control+0");
  await expect(zoomLevel).not.toHaveText(beforeFit ?? "");
});

/** B1 gate item 5: box-select only takes fully-enclosed nodes, and
 *  shift-drag adds to (rather than replaces) the existing selection --
 *  React Flow's own box-select always resets first (see
 *  features/agents/canvas/index.tsx's decision comment), so this proves
 *  the app-level override actually works, not just the library default. */
test("box-select takes only fully-enclosed nodes; shift-drag adds to the selection", async ({ page }) => {
  await page.goto(INTERACTIVE_STORY_URL);
  const pane = page.locator(".react-flow__pane");
  await expect(pane).toBeVisible();
  const paneBox = await pane.boundingBox();
  if (!paneBox) throw new Error("Canvas pane has no layout box");

  const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

  // Box-select is Shift+drag (selectionKeyCode's default) with panOnDrag
  // left at its default true -- an unmodified drag pans, per React Flow's
  // own precedence (see index.tsx's decision comment). Drag a box around
  // the left 2x2 block (int-0, int-1, int-3, int-4 at flow x<=400) without
  // enclosing the right column (int-2, int-5 at flow x=700) -- their left
  // edge sits well outside this box.
  //
  // Dragged bottom-right-to-top-left (not top-left-to-bottom-right) so the
  // drag *starts* on empty pane space: B2's NodeLibraryPanel now docks at
  // the pane's actual top-left corner, covering the point a top-left-first
  // drag would have started from. The resulting selection rectangle -- and
  // therefore which nodes end up enclosed -- is identical either way; only
  // the mousedown's starting corner changes. The drag's own move/up events
  // are tracked independent of whatever's visually underneath once it has
  // started, so ending over the panel is fine.
  await page.keyboard.down("Shift");
  await page.mouse.move(paneBox.x + 650, paneBox.y + 450);
  await page.mouse.down();
  await page.mouse.move(paneBox.x + 40, paneBox.y + 40, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  for (const id of ["int-0", "int-1", "int-3", "int-4"]) {
    await expect(node(id)).toHaveClass(/selected/);
  }
  for (const id of ["int-2", "int-5"]) {
    await expect(node(id)).not.toHaveClass(/selected/);
  }

  // Shift-drag a box around just the right column (int-2, int-5) -- an
  // additive drag should keep the previous four selected too.
  await page.keyboard.down("Shift");
  await page.mouse.move(paneBox.x + 660, paneBox.y + 40);
  await page.mouse.down();
  await page.mouse.move(paneBox.x + 950, paneBox.y + 450, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  for (const id of ["int-0", "int-1", "int-2", "int-3", "int-4", "int-5"]) {
    await expect(node(id)).toHaveClass(/selected/);
  }
});

/** B1 gate item 6: canvas renders without error in both themes -- catches
 *  the class of bug where a token resolves to empty/invalid under one
 *  theme (see PROGRESS.md's A1 decisions for precedent). */
for (const theme of ["dark", "light"] as const) {
  test(`renders and pans without error in ${theme} theme`, async ({ page }) => {
    // Excludes failed font-resource loads: Storybook's staticDirs serves
    // public/fonts at a path next/font/local's generated @font-face doesn't
    // match, a pre-existing gap in .storybook/preview.tsx unrelated to this
    // session (present on every story, not just the canvas's) -- see
    // PROGRESS.md's Known issues.
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
        errors.push(message.text());
      }
    });

    await page.goto(withTheme(INTERACTIVE_STORY_URL, theme));
    const pane = page.locator(".react-flow__pane");
    await expect(pane).toBeVisible();
    await expect(page.locator(".react-flow__node").first()).toBeVisible();

    const paneBox = await pane.boundingBox();
    if (!paneBox) throw new Error("Canvas pane has no layout box");
    const centerX = paneBox.x + paneBox.width / 2;
    const centerY = paneBox.y + paneBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 80, centerY + 40, { steps: 5 });
    await page.mouse.up();

    expect(errors, `console/page errors in ${theme} theme: ${errors.join("; ")}`).toEqual([]);
  });
}
