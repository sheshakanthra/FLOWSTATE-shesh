import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PermissionsProvider } from "@/lib/auth/permission-gate";
import { getWorkspaceContext, listWorkspacesForUser } from "@/lib/repos/workspaces";
import { getUserById } from "@/lib/repos/users";
import { Shell } from "@/components/shell/shell";
import { QueryProvider } from "@/components/providers/query-provider";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;

  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getWorkspaceContext(session.userId, workspaceSlug);
  if (!context) redirect("/login?no-workspace=1");

  const [user, workspaces] = await Promise.all([
    getUserById(session.userId),
    listWorkspacesForUser(session.userId),
  ]);
  if (!user) redirect("/login");

  return (
    <PermissionsProvider role={context.role}>
      <QueryProvider>
        <Shell
          currentWorkspace={context.workspace}
          workspaces={workspaces}
          user={{ name: user.name, email: user.email }}
        >
          {children}
        </Shell>
      </QueryProvider>
    </PermissionsProvider>
  );
}
