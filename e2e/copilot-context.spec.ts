import { expect, test, type Page } from "@playwright/test";
import { copilotContextSchema } from "../features/copilot/context/envelope";

const WORKSPACE = "meridian-ops";
const AGENT_ID = "1cca2647-ff3e-4b2a-8c85-1e34aea8da40"; // Lumen Dental — Recall Scheduler
const BASE = `http://localhost:3000/w/${WORKSPACE}`;

async function login(page: Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

/** Reads the live envelope out of the DOM probe the provider always renders
 *  (features/copilot/context/provider.tsx) — deliberately readable without
 *  opening the dock, since opening it is itself an interaction and half
 *  these routes have never had it open. */
async function readEnvelope(page: Page) {
  const raw = await page.locator("[data-copilot-envelope]").first().getAttribute("data-copilot-envelope");
  expect(raw, "the copilot envelope probe should be present on every app route").not.toBeNull();
  return JSON.parse(raw!) as unknown;
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Replaces uuids and timestamps so the snapshot captures structure rather
 *  than whichever ids this database happens to hold — it should survive a
 *  reseed, since what's being snapshotted is the envelope's shape per
 *  route, not the seed data behind it. */
function normalize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value)
      .replace(UUID_PATTERN, "<uuid>")
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<timestamp>"),
  );
}

test.describe("gate item 1: every route produces a valid envelope", () => {
  test("walks every app route, asserting the envelope's shape and snapshotting its contents", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);

    // Discovered rather than hardcoded: run ids are real recorded runs, not
    // fixed seed constants, so the trace route is reached the way a user
    // reaches it — by opening a run from the history table.
    await page.goto(`${BASE}/agents/${AGENT_ID}/runs`);
    await page.getByRole("row").nth(1).dblclick();
    await page.waitForURL(/\/runs\/[0-9a-f-]+/);
    const tracePath = new URL(page.url()).pathname;

    const routes = [
      `/w/${WORKSPACE}/today`,
      `/w/${WORKSPACE}/agents`,
      `/w/${WORKSPACE}/agents/${AGENT_ID}/build`,
      `/w/${WORKSPACE}/agents/${AGENT_ID}/runs`,
      tracePath,
      `/w/${WORKSPACE}/agents/${AGENT_ID}/versions`,
      `/w/${WORKSPACE}/flows`,
      `/w/${WORKSPACE}/insights`,
      `/w/${WORKSPACE}/knowledge`,
      `/w/${WORKSPACE}/settings`,
    ];

    const snapshot: Record<string, unknown> = {};

    for (const route of routes) {
      await page.goto(`http://localhost:3000${route}`);
      // The entity contribution lands in a layout effect, so wait for the
      // probe to actually reflect this route before reading it.
      await expect
        .poll(async () => {
          const envelope = (await readEnvelope(page)) as { route?: string };
          return envelope.route;
        }, { timeout: 15_000 })
        .toBe(route);

      const envelope = await readEnvelope(page);
      const parsed = copilotContextSchema.safeParse(envelope);
      expect(parsed.success, `${route} produced an invalid envelope: ${JSON.stringify(envelope)}`).toBe(true);

      snapshot[route.replace(UUID_PATTERN, "<uuid>")] = normalize(envelope);
    }

    expect(Object.keys(snapshot)).toHaveLength(routes.length);
    expect(JSON.stringify(snapshot, null, 2)).toMatchSnapshot("copilot-envelopes.json");
  });
});

test.describe("gate item 6: unmounting a feature removes its contribution", () => {
  test("navigating away from an agent clears the agent chip and the agent entity", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/agents/${AGENT_ID}/build`);

    await page.keyboard.press("ControlOrMeta+j");
    const dock = page.getByRole("complementary", { name: "Copilot" });
    await expect(dock).toBeVisible();

    await expect(dock.getByText("Agent: Lumen Dental — Recall Scheduler")).toBeVisible();
    await expect
      .poll(async () => ((await readEnvelope(page)) as { entity: { type: string | null } }).entity.type)
      .toBe("agent");

    // Client-side navigation via the sidebar, deliberately not `page.goto`.
    // A hard navigation tears down the whole app, which would prove nothing
    // about cleanup — every store resets either way. Clicking the sidebar
    // link keeps the shell, the provider, and the registry alive, so the
    // agent context can only disappear because the builder unmounted and
    // `useCopilotContext`'s own teardown ran.
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Today" }).click();
    await page.waitForURL(/\/today$/);
    await expect(dock).toBeVisible();

    await expect(dock.getByText(/^Agent: /)).toHaveCount(0);
    const envelope = (await readEnvelope(page)) as { entity: { type: string | null }; route: string };
    expect(envelope.route).toBe(`/w/${WORKSPACE}/today`);
    // Falls back to the workspace baseline rather than to nothing.
    expect(envelope.entity.type).toBe("workspace");
  });
});

test.describe("gate item 8: empty-state prompts are route-aware", () => {
  test("suggested prompts differ between /today and an agent build page", async ({ page }) => {
    await login(page);
    const dock = page.getByRole("complementary", { name: "Copilot" });

    await page.goto(`${BASE}/today`);
    await page.keyboard.press("ControlOrMeta+j");
    await expect(dock).toBeVisible();
    const todayPrompts = await dock.locator("[data-copilot-suggestion]").allInnerTexts();
    expect(todayPrompts).toHaveLength(3);

    await page.goto(`${BASE}/agents/${AGENT_ID}/build`);
    await page.keyboard.press("ControlOrMeta+j");
    await expect(dock).toBeVisible();
    await expect
      .poll(async () => ((await readEnvelope(page)) as { entity: { type: string | null } }).entity.type, {
        timeout: 15_000,
      })
      .toBe("agent");
    const buildPrompts = await dock.locator("[data-copilot-suggestion]").allInnerTexts();
    expect(buildPrompts).toHaveLength(3);

    expect(buildPrompts).not.toEqual(todayPrompts);
    // Not merely different — the builder's prompts name the agent in context.
    expect(buildPrompts.join(" ")).toContain("Lumen Dental — Recall Scheduler");
    expect(todayPrompts.join(" ")).not.toContain("Lumen Dental — Recall Scheduler");
  });
});
