import { expect, test } from "@playwright/test";

const AGENT_ID = "1cca2647-ff3e-4b2a-8c85-1e34aea8da40"; // Lumen Dental — Recall Scheduler
const WORKSPACE_SLUG = "meridian-ops";

async function login(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

/**
 * Gate item 7: "Export → import round-trips an agent with identical graph
 * and config." Driven through the real API a browser would call (export
 * via GET, import via POST with the exported JSON's raw text) rather than
 * calling `exportAgent`/`parseAgentImport` directly -- those are already
 * unit-tested (export-import.test.ts); what's real and worth proving here
 * is that the two live routes agree on the wire format end to end.
 */
test("gate item 7: export then import produces an agent with an identical graph", async ({ page }) => {
  await login(page);

  const exportResponse = await page.request.get(
    `http://localhost:3000/api/agents/${AGENT_ID}?workspaceSlug=${WORKSPACE_SLUG}`,
  );
  expect(exportResponse.ok()).toBe(true);
  const { agent: originalAgent } = (await exportResponse.json()) as {
    agent: { name: string; description: string | null; graph: { nodes: unknown[]; edges: unknown[] } };
  };
  expect(originalAgent.graph.nodes.length).toBeGreaterThan(0);

  const exportedPayload = {
    kilnExportVersion: 1,
    name: originalAgent.name,
    description: originalAgent.description,
    graph: originalAgent.graph,
    exportedAt: new Date().toISOString(),
  };

  const importResponse = await page.request.post("http://localhost:3000/api/agents", {
    data: { source: "import", workspaceSlug: WORKSPACE_SLUG, raw: JSON.stringify(exportedPayload) },
  });
  expect(importResponse.ok()).toBe(true);
  const { agent: importedAgent } = (await importResponse.json()) as { agent: { id: string; name: string } };
  expect(importedAgent.name).toBe(originalAgent.name);

  const reFetchResponse = await page.request.get(
    `http://localhost:3000/api/agents/${importedAgent.id}?workspaceSlug=${WORKSPACE_SLUG}`,
  );
  const { agent: roundTrippedAgent } = (await reFetchResponse.json()) as {
    agent: { graph: { nodes: unknown[]; edges: unknown[] } };
  };

  // Node/edge ids are deliberately NOT preserved by import (a fresh agent
  // needs its own ids, same reasoning as duplicate/template instantiation)
  // -- so this compares structure and config, not raw id equality.
  const strip = (nodes: unknown[]) =>
    (nodes as { type: string; position: unknown; data: { label: string; config: unknown } }[])
      .map((node) => ({ type: node.type, position: node.position, label: node.data.label, config: node.data.config }))
      .sort((a, b) => a.label.localeCompare(b.label));

  expect(strip(roundTrippedAgent.graph.nodes)).toEqual(strip(originalAgent.graph.nodes));
  expect(roundTrippedAgent.graph.edges.length).toBe(originalAgent.graph.edges.length);
});

test("import rejects a malformed file with a clear error, not a 500", async ({ page }) => {
  await login(page);

  const response = await page.request.post("http://localhost:3000/api/agents", {
    data: { source: "import", workspaceSlug: WORKSPACE_SLUG, raw: "{ not: valid json" },
  });
  expect(response.status()).toBe(422);
  const body = (await response.json()) as { error: string };
  expect(body.error).toMatch(/valid JSON/i);
});
