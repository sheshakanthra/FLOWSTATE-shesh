import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { members, users, workspaces } from "@/db/schema";
import { withScope } from "./db";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
}

/**
 * Every workspace a user belongs to, across tenants. This is the one place
 * in the app that queries `members` before a workspace_id is known — RLS's
 * workspace_isolation policy on `members` also allows a row through when it
 * matches `app.user_id`, specifically so this "which workspaces am I in"
 * bootstrap query works without needing to already know the answer.
 */
export async function listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  return withScope({ userId }, (tx) =>
    tx
      .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
      .from(members)
      .innerJoin(workspaces, eq(members.workspaceId, workspaces.id))
      .where(eq(members.userId, userId))
      .orderBy(workspaces.name),
  );
}

export interface WorkspaceContext {
  workspace: WorkspaceSummary;
  role: "owner" | "admin" | "member";
}

/**
 * Resolves a `[workspace]` URL segment to a real workspace and confirms the
 * given user is a member of it, returning their role. `workspaces` itself
 * carries no RLS (slugs aren't secret, and every real KILN workspace name is
 * discoverable to anyone who's a member of it anyway) — access control lives
 * entirely in the membership check, which does go through RLS via
 * withScope({ userId }).
 */
export async function getWorkspaceContext(
  userId: string,
  slug: string,
): Promise<WorkspaceContext | null> {
  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  if (!workspace) return null;

  const [membership] = await withScope({ userId }, (tx) =>
    tx
      .select({ role: members.role })
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.workspaceId, workspace.id)))
      .limit(1),
  );
  if (!membership) return null;

  return { workspace, role: membership.role };
}

export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  await db.update(workspaces).set({ name }).where(eq(workspaces.id, workspaceId));
}

export interface WorkspaceMemberSummary {
  id: string;
  name: string;
  email: string;
}

/** D1's delegate picker (features/today/priority/actions.tsx) -- who a
 *  priority item can be handed to. Ordered by name for a stable,
 *  predictable picker list rather than membership recency. */
export async function listMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]> {
  return withScope({ workspaceId }, (tx) =>
    tx
      .select({ id: users.id, name: users.name, email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.workspaceId, workspaceId))
      .orderBy(users.name),
  );
}
