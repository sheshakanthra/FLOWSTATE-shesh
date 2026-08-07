import { getWorkspaceContext, type WorkspaceContext } from "@/lib/repos/workspaces";
import { roleAtLeast, type Role } from "./permissions";
import { getSessionFromRequest } from "./session";

/**
 * Server-side half of "hides AND rejects." Every route handler that mutates
 * workspace-scoped data calls this before touching the database — mirrors
 * whatever <PermissionGate requires={minRole}> is hiding in the UI for the
 * same action, so a request that bypasses the UI entirely (curl, a stale
 * tab, a malicious client) gets the same rejection a hidden button implies.
 * Returns the resolved context on success, or a ready-to-return 401/403
 * Response on failure — callers do
 * `const ctx = await requireRole(...); if (ctx instanceof Response) return ctx;`
 */
export async function requireRole(
  request: Request,
  workspaceSlug: string,
  minRole: Role,
): Promise<WorkspaceContext | Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const context = await getWorkspaceContext(session.userId, workspaceSlug);
  if (!context) {
    return Response.json({ error: "Workspace not found." }, { status: 404 });
  }

  if (!roleAtLeast(context.role, minRole)) {
    return Response.json(
      { error: `This action requires the ${minRole} role.` },
      { status: 403 },
    );
  }

  return context;
}
