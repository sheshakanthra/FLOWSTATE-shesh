import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface Scope {
  /** Sets `app.user_id` — required for any query that touches `members`
   *  before a workspace is known (e.g. "which workspaces do I belong to"). */
  userId?: string;
  /** Sets `app.workspace_id` — required for any query against a
   *  workspace-scoped table (db/schema.ts's RLS_SESSION_VAR). */
  workspaceId?: string;
}

/**
 * Every workspace-scoped (or user-scoped) query goes through this. It opens
 * a transaction, sets the Postgres session variable(s) the RLS policies in
 * db/migrations/0001_row_level_security.sql filter on via `set_config(...,
 * true)` (transaction-local, parameterized — never string-interpolated SQL),
 * then runs the callback inside that same transaction so the setting is
 * still in effect for every statement it issues.
 *
 * Deliberately the *only* export here that touches `db` directly — every
 * other repo file calls this instead of `db.transaction`/`db.select` itself,
 * so RLS scoping can never be forgotten at a call site.
 */
export async function withScope<T>(scope: Scope, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (scope.userId) {
      await tx.execute(sql`select set_config('app.user_id', ${scope.userId}, true)`);
    }
    if (scope.workspaceId) {
      await tx.execute(sql`select set_config('app.workspace_id', ${scope.workspaceId}, true)`);
    }
    return fn(tx);
  });
}
