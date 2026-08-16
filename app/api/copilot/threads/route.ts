import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getSessionFromRequest } from "@/lib/auth/session";
import { createThread, listThreads } from "@/lib/repos/copilot";

/**
 * Thread CRUD (session spec item 5). Not in the spec's own file list, which
 * names `lib/repos/copilot.ts` but no route — the repo has to be reachable
 * from a client component somehow, and a Route Handler is how every other
 * client-driven mutation in this app gets there (see B3's agent PATCH, B6's
 * agent POST). Same `requireRole` + `getSessionFromRequest` pairing those
 * use: the role guard proves workspace membership, the session read supplies
 * the user id threads are partitioned by.
 */
const createSchema = z.object({
  workspaceSlug: z.string().min(1),
  title: z.string().trim().min(1).max(200).nullable().optional(),
});

export async function GET(request: Request) {
  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug");
  if (!workspaceSlug) {
    return Response.json({ error: "Missing workspaceSlug." }, { status: 400 });
  }

  const context = await requireRole(request, workspaceSlug, "member");
  if (context instanceof Response) return context;

  const userId = getSessionFromRequest(request)?.userId;
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const threads = await listThreads(context.workspace.id, userId);
  return Response.json({ threads });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;

  const userId = getSessionFromRequest(request)?.userId;
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const thread = await createThread(context.workspace.id, userId, parsed.data.title ?? null);
  return Response.json({ thread }, { status: 201 });
}
