"use client";

import * as React from "react";
import { type Role, roleAtLeast } from "./permissions";

const PermissionsContext = React.createContext<Role | null>(null);

/**
 * Populated once per navigation by the workspace layout (a Server Component)
 * from lib/repos/workspaces.ts's getWorkspaceContext — role is resolved
 * fresh from the DB on every request, never cached client-side across
 * navigations, so a role change or workspace switch is reflected on the very
 * next page load without a re-login.
 */
export function PermissionsProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  return <PermissionsContext.Provider value={role}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): { role: Role; can: (required: Role) => boolean } {
  const role = React.useContext(PermissionsContext);
  if (!role) throw new Error("usePermissions() must be used within a PermissionsProvider");
  return { role, can: (required: Role) => roleAtLeast(role, required) };
}

export interface PermissionGateProps {
  requires: Role;
  children: React.ReactNode;
  /** Rendered instead of nothing when the gate fails closed — omit for the
   *  common case (hide entirely). */
  fallback?: React.ReactNode;
}

/**
 * UI-side half of CLAUDE.md's "hides AND the route handler rejects — never
 * one without the other." This hides; lib/auth/guard.ts's requireRole is the
 * other half every mutating route handler this gates must also call — see
 * app/api/w/[workspace]/route.ts for the paired example.
 */
export function PermissionGate({ requires, children, fallback = null }: PermissionGateProps) {
  const { can } = usePermissions();
  return can(requires) ? <>{children}</> : <>{fallback}</>;
}
