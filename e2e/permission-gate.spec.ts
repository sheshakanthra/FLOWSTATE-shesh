import { expect, test } from "@playwright/test";

/**
 * Gate item 3: a Member hitting an Owner-only route handler directly via
 * fetch gets rejected, not just hidden. workspace-switcher.tsx hides the
 * "Rename workspace" menu item from non-owners with <PermissionGate>; this
 * exercises the other half — PATCH /api/w/[workspace] (lib/auth/guard.ts's
 * requireRole) — over real HTTP, bypassing the UI entirely.
 *
 * Requires `pnpm seed` to have run against the same DATABASE_URL this dev
 * server (playwright.config.ts's webServer) uses, for the seeded
 * Meridian Ops workspace and its owner/member accounts.
 */
test.describe("Owner-only route handler", () => {
  test("rejects a Member and accepts the Owner", async ({ playwright }) => {
    const memberContext = await playwright.request.newContext();
    const memberLogin = await memberContext.post("/api/auth/login", {
      data: { email: "sam@meridianops.com", password: "demo-password-1234" },
    });
    expect(memberLogin.ok()).toBeTruthy();

    const memberAttempt = await memberContext.patch("/api/w/meridian-ops", {
      data: { name: "Renamed by a member (should never persist)" },
    });
    expect(memberAttempt.status()).toBe(403);
    await memberContext.dispose();

    const ownerContext = await playwright.request.newContext();
    const ownerLogin = await ownerContext.post("/api/auth/login", {
      data: { email: "priya@meridianops.com", password: "demo-password-1234" },
    });
    expect(ownerLogin.ok()).toBeTruthy();

    // Renames to its own current name — exercises the success path without
    // leaving a lasting mutation on the shared seed data.
    const ownerAttempt = await ownerContext.patch("/api/w/meridian-ops", {
      data: { name: "Meridian Ops" },
    });
    expect(ownerAttempt.ok()).toBeTruthy();
    await ownerContext.dispose();
  });

  test("rejects an unauthenticated request", async ({ playwright }) => {
    const anonContext = await playwright.request.newContext();
    const response = await anonContext.patch("/api/w/meridian-ops", {
      data: { name: "Renamed while signed out (should never persist)" },
    });
    expect(response.status()).toBe(401);
    await anonContext.dispose();
  });
});
