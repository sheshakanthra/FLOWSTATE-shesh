import { z } from "zod";
import { generateAgentFromDescription } from "@/features/agents/generation/generate-from-description";
import { consumeDemoAttempt, getClientIp } from "@/lib/rate-limit";

const requestSchema = z.object({
  description: z.string().trim().min(3).max(500),
});

// Long enough for a real Groq JSON-mode completion under normal load, short
// enough that a visitor never stares at the hero for more than a beat
// before the fallback graph (E1 gate item 5) takes over.
const GENERATION_TIMEOUT_MS = 12_000;

/**
 * The hero's "build a real agent from what you typed" step (E1 spec item
 * 2). Reuses `generateAgentFromDescription` verbatim -- the same function
 * `create_agent_from_description` (C3) calls -- but never persists
 * anything: there's no workspace, no session, no `createAgent` call here.
 * The client already owns the whole result (name/description/graph) after
 * this responds, and posts it straight back to `/api/demo/run` to execute
 * it; nothing about this demo needs a database row to exist anywhere.
 *
 * Rate limiting (gate item 4) is enforced here, not in `/api/demo/run` --
 * this is the one request every submission always makes first, so it's the
 * natural place to count an "attempt." Never throws past the rate-limit and
 * malformed-body checks: a generation failure or timeout is reported as a
 * normal `{ ok: false }` 200, not an error status, so the client's fallback
 * path (features/marketing/hero/fallback-graph.ts) is the expected
 * response to a slow or unreachable model, not an exceptional one.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Describe a task in a sentence or two." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rateLimit = consumeDemoAttempt(ip);
  if (!rateLimit.allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const generated = await generateAgentFromDescription(parsed.data.description, {
      signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    });
    return Response.json({
      ok: true,
      attempt: rateLimit.attempt,
      name: generated.name,
      description: generated.description,
      graph: generated.graph,
    });
  } catch {
    // Model timeout, malformed JSON, or any other generation failure --
    // the attempt still counts (it was a real, costed call), the visitor
    // just gets the fallback graph instead of a blank hero.
    return Response.json({ ok: false, attempt: rateLimit.attempt, reason: "generation_failed" });
  }
}
