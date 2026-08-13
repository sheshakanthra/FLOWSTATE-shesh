import { expect, test } from "@playwright/test";

const WORKSPACE_SLUG = "meridian-ops";

async function login(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("priya@meridianops.com");
  await page.getByLabel("Password").fill("demo-password-1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/today/);
}

interface TemplateCase {
  templateId: string;
  /** A lowercase substring the real drafted output should plausibly
   *  contain -- proof this is real, on-topic model output, not a stand-in. */
  expectedKeywordPattern: RegExp;
}

// Gate item 6: "All 6 templates instantiate into valid, runnable graphs.
// Run each one and confirm it produces sensible output." Each case here
// creates a real draft agent from the template (via the same
// POST /api/agents the gallery UI uses), runs it through the real engine
// against real Groq (the same POST /api/agents/[id]/run the test console
// uses), and checks the real output for topic-relevant content -- not just
// "the run succeeded," which a template producing generic, off-topic
// filler would also satisfy.
const CASES: TemplateCase[] = [
  { templateId: "lead-qualifier", expectedKeywordPattern: /qualified|score|lead/i },
  { templateId: "client-status-summarizer", expectedKeywordPattern: /harbor|onboarding|blocked|status|demo/i },
  { templateId: "meeting-notes-to-tasks", expectedKeywordPattern: /priya|jordan|proposal|crm|task|due/i },
  { templateId: "proposal-drafter", expectedKeywordPattern: /listing|mls|real estate|automat/i },
  { templateId: "support-triage", expectedKeywordPattern: /severity|critical|high|medium|low|review/i },
  { templateId: "weekly-report", expectedKeywordPattern: /run|success|spend|incident|insurance/i },
];

test.describe("gate item 6: every template produces sensible, on-topic output", () => {
  for (const { templateId, expectedKeywordPattern } of CASES) {
    test(`${templateId} runs successfully and produces relevant output`, async ({ page }) => {
      test.setTimeout(60_000);
      await login(page);

      const createResponse = await page.request.post("http://localhost:3000/api/agents", {
        data: { source: "template", workspaceSlug: WORKSPACE_SLUG, templateId },
      });
      expect(createResponse.ok()).toBe(true);
      const { agent } = (await createResponse.json()) as { agent: { id: string; name: string } };
      expect(agent.id).toBeTruthy();

      const runResponse = await page.request.post(`http://localhost:3000/api/agents/${agent.id}/run`, {
        data: { workspaceSlug: WORKSPACE_SLUG },
        timeout: 45_000,
      });
      expect(runResponse.ok()).toBe(true);

      const body = await runResponse.text();
      const events = body
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);

      const stepEnds = events.filter((event) => event.type === "step-end");
      const failedSteps = stepEnds.filter((event) => event.status === "failed");
      expect(failedSteps).toEqual([]);

      const runEnd = events.find((event) => event.type === "run-end") as
        | { status: string; finalOutputs: unknown[] }
        | undefined;
      expect(runEnd).toBeDefined();
      expect(runEnd!.status).toBe("succeeded");
      expect(runEnd!.finalOutputs.length).toBeGreaterThan(0);

      const outputText = JSON.stringify(runEnd!.finalOutputs);
      expect(outputText.length).toBeGreaterThan(20);
      expect(outputText).toMatch(expectedKeywordPattern);
    });
  }
});
