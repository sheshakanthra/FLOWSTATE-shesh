import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getSessionFromRequest } from "@/lib/auth/session";
import { bulkSetEnabled, createAgent, duplicateAgent, type AgentGraphPayload } from "@/lib/repos/agents";
import { parseAgentImport } from "@/features/agents/lib/import";
import { getTemplate } from "@/features/agents/templates/definitions";
import { instantiateTemplate } from "@/features/agents/templates/instantiate";

/**
 * The one "create a new agent" primitive -- necessary plumbing none of this
 * session's three agent-creation surfaces (the template gallery, importing
 * exported JSON, duplicating an existing agent) had anywhere to call before
 * this session, even though the spec names all three as real features
 * (items 6, 7). A single discriminated-union body rather than three
 * separate route files, since all three ultimately do the same thing --
 * build an `AgentGraphPayload` and hand it to `lib/repos/agents.ts`'s
 * `createAgent` -- and differ only in *where* that payload comes from.
 */
const bodySchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("template"), workspaceSlug: z.string().min(1), templateId: z.string().min(1) }),
  // `raw` is the untouched file content a user picked off their own
  // filesystem -- validated here via the same `parseAgentImport` the
  // import dialog already ran client-side for instant feedback, so the
  // authoritative check never trusts what the client claims it validated.
  z.object({ source: z.literal("import"), workspaceSlug: z.string().min(1), raw: z.string().min(1) }),
  z.object({ source: z.literal("duplicate"), workspaceSlug: z.string().min(1), agentId: z.string().min(1) }),
]);

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;
  const workspaceId = context.workspace.id;
  // requireRole's own return value doesn't carry the session's userId (it's
  // resolved and then discarded internally once role-checked) -- read it
  // again directly, the same way requireRole itself does, rather than
  // widening that shared type for every one of its callers just for this
  // route's own need.
  const createdBy = getSessionFromRequest(request)?.userId ?? null;

  if (parsed.data.source === "template") {
    const template = getTemplate(parsed.data.templateId);
    if (!template) return Response.json({ error: "Unknown template." }, { status: 404 });
    const graph = instantiateTemplate(template);
    const agent = await createAgent(workspaceId, {
      name: template.name,
      description: template.description,
      graph,
      createdBy,
    });
    return Response.json({ agent }, { status: 201 });
  }

  if (parsed.data.source === "import") {
    const result = parseAgentImport(parsed.data.raw);
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 422 });
    }
    const agent = await createAgent(workspaceId, {
      name: result.data.name,
      description: result.data.description ?? undefined,
      graph: result.data.graph as AgentGraphPayload,
      createdBy,
    });
    return Response.json({ agent }, { status: 201 });
  }

  const agent = await duplicateAgent(workspaceId, parsed.data.agentId, createdBy);
  if (!agent) return Response.json({ error: "Agent not found." }, { status: 404 });
  return Response.json({ agent }, { status: 201 });
}

const bulkEnableSchema = z.object({
  workspaceSlug: z.string().min(1),
  agentIds: z.array(z.string().min(1)).min(1),
  enabled: z.boolean(),
});

/** Session spec item 8's "bulk enable/disable" -- and the agents index
 *  table's own per-row enabled `Switch` reuses this same endpoint with a
 *  single-id array, rather than needing a second route for the one-at-a-
 *  time case. */
export async function PATCH(request: Request) {
  const parsed = bulkEnableSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;

  await bulkSetEnabled(context.workspace.id, parsed.data.agentIds, parsed.data.enabled);
  return Response.json({ ok: true });
}
