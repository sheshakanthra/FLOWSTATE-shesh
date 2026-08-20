import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getSessionFromRequest } from "@/lib/auth/session";
import { createPrompt, listPrompts } from "@/lib/repos/prompts";

/** Session spec item 8's prompt library: workspace-shared, so no per-user
 *  filtering the way copilot_threads gets (lib/repos/copilot.ts's own
 *  comment on that distinction) -- every member of the workspace reads and
 *  writes the same list. */
export async function GET(request: Request) {
  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug");
  if (!workspaceSlug) {
    return Response.json({ error: "workspaceSlug query parameter is required." }, { status: 400 });
  }

  const context = await requireRole(request, workspaceSlug, "member");
  if (context instanceof Response) return context;

  const prompts = await listPrompts(context.workspace.id);
  return Response.json({ prompts });
}

const createSchema = z.object({
  workspaceSlug: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Give the prompt a title and some content." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;
  const userId = getSessionFromRequest(request)?.userId ?? null;

  const prompt = await createPrompt(context.workspace.id, { title: parsed.data.title, content: parsed.data.content, createdBy: userId });
  return Response.json({ prompt }, { status: 201 });
}
