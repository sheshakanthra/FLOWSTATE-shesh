import { expect, test } from "@playwright/test";

const WORKSPACE_SLUG = "meridian-ops";

async function login(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

/** Session spec item 6's UI half (the actual Groq-verified content is
 *  covered by agent-templates.spec.ts): the gallery shows all 6 real,
 *  named templates -- not "Example Agent 1-6" -- and selecting one creates
 *  a real agent and lands in its builder. */
test("the template gallery lists all 6 real templates and creates a real agent from one", async ({ page }) => {
  await login(page);
  await page.goto(`http://localhost:3000/w/${WORKSPACE_SLUG}/agents`);

  await page.getByRole("button", { name: "New agent" }).click();
  await expect(page.getByRole("heading", { name: "Start from a template" })).toBeVisible();

  for (const name of [
    "Inbound Lead Qualifier",
    "Client Status Summarizer",
    "Meeting Notes → Tasks",
    "Proposal Drafter",
    "Support Ticket Triage",
    "Weekly Report Generator",
  ]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }

  await page.getByRole("button", { name: "Use the Meeting Notes → Tasks template" }).click();

  await page.waitForURL(/\/agents\/[0-9a-f-]+\/build$/, { timeout: 10000 });
  await expect(page.locator(".react-flow__node")).toHaveCount(4, { timeout: 15000 });
});
