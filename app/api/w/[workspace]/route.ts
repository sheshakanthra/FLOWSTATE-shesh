import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { renameWorkspace } from "@/lib/repos/workspaces";

const renameSchema = z.object({ name: z.string().trim().min(1).max(120) });

/**
 * Owner-only: renames the current workspace. The one concrete route this
 * session wires end-to-end to prove <PermissionGate>'s "hides AND the route
 * handler rejects" rule — components/shell/workspace-switcher.tsx hides the
 * "Rename workspace" action from non-owners; this handler rejects it
 * independently even if a request reaches it directly.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspace: string }> },
) {
  const { workspace: workspaceSlug } = await params;
  const context = await requireRole(request, workspaceSlug, "owner");
  if (context instanceof Response) return context;

  const parsed = renameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter a workspace name." }, { status: 400 });
  }

  await renameWorkspace(context.workspace.id, parsed.data.name);
  return Response.json({ id: context.workspace.id, name: parsed.data.name });
}
