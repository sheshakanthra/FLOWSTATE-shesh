import { describe, expect, it } from "vitest";
import { EMPTY_ENVELOPE } from "../context/envelope";
import { buildCopilotPrompt } from "./prompt";
import type { RetrievedRecord } from "./retrieve";

const envelope = { ...EMPTY_ENVELOPE, route: "/w/acme/today" };
const retrieved: RetrievedRecord[] = [
  { id: "run-1", type: "run", label: "Lead Qualifier — failed run", href: "/w/acme/agents/a1/runs/run-1", summary: "status: failed" },
];

describe("buildCopilotPrompt", () => {
  it("prepends exactly one system message ahead of the thread history", () => {
    const messages = buildCopilotPrompt({
      workspaceName: "Acme",
      envelope,
      retrieved,
      history: [{ role: "user", content: "Which agents failed most this week?" }],
    });
    expect(messages[0]!.role).toBe("system");
    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({ role: "user", content: "Which agents failed most this week?" });
  });

  it("includes every retrieved record's id and label in the system prompt", () => {
    const [system] = buildCopilotPrompt({ workspaceName: "Acme", envelope, retrieved, history: [] });
    expect(system!.content).toContain('id="run-1"');
    expect(system!.content).toContain("Lead Qualifier — failed run");
  });

  it("says plainly when nothing was retrieved, rather than omitting the section", () => {
    const [system] = buildCopilotPrompt({ workspaceName: "Acme", envelope, retrieved: [], history: [] });
    expect(system!.content).toContain("no records retrieved");
  });

  it("strips [cite:ID] markers from prior assistant turns before replaying them", () => {
    const messages = buildCopilotPrompt({
      workspaceName: "Acme",
      envelope,
      retrieved,
      history: [
        { role: "user", content: "How's Lead Qualifier doing?" },
        { role: "assistant", content: "It failed twice this week [cite:run-1]." },
      ],
    });
    const assistantTurn = messages.find((message) => message.role === "assistant");
    expect(assistantTurn?.content).toBe("It failed twice this week .");
  });

  it("keeps only the most recent messages when history exceeds the cap", () => {
    const history = Array.from({ length: 30 }, (_, index) => ({
      role: "user" as const,
      content: `message ${index}`,
    }));
    const messages = buildCopilotPrompt({ workspaceName: "Acme", envelope, retrieved: [], history });
    // system message + the capped history window
    expect(messages.length).toBeLessThan(31);
    expect(messages.at(-1)?.content).toBe("message 29");
  });
});
