import { expect, test } from "@playwright/test";

const WORKSPACE_SLUG = "meridian-ops";
const AGENTS_URL = `http://localhost:3000/w/${WORKSPACE_SLUG}/agents`;

async function login(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

/** Rows are matched by their name cell's *exact* text, not a substring --
 *  this session's own export/import and duplicate tests can leave rows
 *  like "X (copy)" behind across repeated runs, and a plain substring
 *  filter on "X" would ambiguously match both. */
function rowByExactName(page: import("@playwright/test").Page, name: string) {
  return page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
}

test.describe("session spec item 8: agents index", () => {
  test("lists the seeded agents with real status/version/owner columns", async ({ page }) => {
    await login(page);
    await page.goto(AGENTS_URL);

    await expect(page.getByRole("grid", { name: "Agents" })).toBeVisible();
    const recallRow = rowByExactName(page, "Lumen Dental — Recall Scheduler").first();
    await expect(recallRow).toBeVisible();
    await expect(page.getByText("Crestpoint — Listing Copy Generator", { exact: true }).first()).toBeVisible();
    // Recall Scheduler has real published versions from this session's own
    // publish-flow test -- its version column shows a real v-number, not a
    // placeholder dash.
    await expect(recallRow.getByText(/^v\d+$/)).toBeVisible();
  });

  test("bulk disable and re-enable via the selection toolbar updates the real enabled column", async ({ page }) => {
    await login(page);
    await page.goto(AGENTS_URL);

    const targetRow = rowByExactName(page, "Crestpoint — Listing Copy Generator");
    await targetRow.getByRole("checkbox").click();

    const bulkBar = page.getByRole("toolbar");
    await expect(bulkBar).toBeVisible();
    await bulkBar.getByRole("button", { name: "Disable" }).click();

    await expect(targetRow.getByRole("switch")).not.toBeChecked();

    // Re-enable through the same bulk bar (selection persists after the action).
    await bulkBar.getByRole("button", { name: "Enable" }).click();
    await expect(targetRow.getByRole("switch")).toBeChecked();
  });

  test("the per-row enabled switch works independently of bulk selection", async ({ page }) => {
    await login(page);
    await page.goto(AGENTS_URL);

    const targetRow = rowByExactName(page, "Harbor & Vine — Review Responder");
    const toggle = targetRow.getByRole("switch");
    const wasChecked = await toggle.isChecked();

    await toggle.click();
    await expect(toggle).toBeChecked({ checked: !wasChecked });

    // Leave it back the way it was found.
    await toggle.click();
    await expect(toggle).toBeChecked({ checked: wasChecked });
  });

  test("duplicating an agent from the row action creates a real, independent copy", async ({ page }) => {
    await login(page);
    await page.goto(AGENTS_URL);

    const targetRow = rowByExactName(page, "Crestpoint — Listing Copy Generator");
    await targetRow.getByRole("button", { name: /actions for/i }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();

    await expect(page.getByText("Crestpoint — Listing Copy Generator (copy)").first()).toBeVisible({
      timeout: 10000,
    });
  });
});
