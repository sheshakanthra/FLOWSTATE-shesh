import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getSessionFromRequest } from "@/lib/auth/session";
import { approveToolCall, proposeToolCall, rejectToolCall, retryToolCall } from "@/features/copilot/actions/execute";
import type { ToolContext } from "@/features/copilot/tools/types";
import "@/features/copilot/tools/registry";

/**
 * The one HTTP surface for every tool-call lifecycle step past the initial
 * proposal that happens inline in the streaming turn
 * (app/api/copilot/stream/route.ts calls `proposeToolCall` directly, no
 * self-HTTP-call). This route exists for the steps that happen later, as
 * their own user action -- approve, reject, retry -- and, deliberately,
 * also exposes `propose` itself over HTTP: gate item 4's permission test
 * (a Member calling an Owner-only tool directly) needs a real endpoint to
 * hit that doesn't depend on the LLM actually choosing to call that tool.
 */
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("propose"),
    workspaceSlug: z.string().min(1),
    toolName: z.string().min(1),
    input: z.unknown(),
    messageId: z.string().min(1),
  }),
  z.object({ action: z.literal("approve"), workspaceSlug: z.string().min(1), toolCallId: z.string().min(1) }),
  z.object({ action: z.literal("reject"), workspaceSlug: z.string().min(1), toolCallId: z.string().min(1) }),
  z.object({ action: z.literal("retry"), workspaceSlug: z.string().min(1), toolCallId: z.string().min(1) }),
]);

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;
  const userId = getSessionFromRequest(request)?.userId;
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const ctx: ToolContext = {
    workspaceId: context.workspace.id,
    workspaceSlug: parsed.data.workspaceSlug,
    userId,
    role: context.role,
  };

  const outcome = await (async () => {
    switch (parsed.data.action) {
      case "propose":
        return proposeToolCall({ toolName: parsed.data.toolName, input: parsed.data.input, messageId: parsed.data.messageId, ctx });
      case "approve":
        return approveToolCall({ toolCallId: parsed.data.toolCallId, ctx });
      case "reject":
        return rejectToolCall({ toolCallId: parsed.data.toolCallId, ctx });
      case "retry":
        return retryToolCall({ toolCallId: parsed.data.toolCallId, ctx });
    }
  })();

  if (!outcome.ok) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json(outcome.result);
}
