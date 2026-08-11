-- Fixes a real, reproducible crash in every RLS policy's
-- `current_setting('app.workspace_id', true)::uuid` cast (and the same
-- pattern for `app.user_id` on `members`).
--
-- Root cause: `current_setting(name, missing_ok)` only returns NULL when
-- Postgres has *never once* seen that custom GUC name on the current
-- backend connection. `lib/repos/db.ts`'s `withScope()` calls
-- `set_config('app.workspace_id', ..., true)` (a *transaction-local* set)
-- whenever a caller scopes by workspaceId but not userId (or vice versa)
-- -- once that has happened even once on a pooled connection, Postgres has
-- now registered the placeholder GUC, and every later transaction on that
-- *same reused connection* that never sets it again gets back `''` (empty
-- string), not NULL, once the local scope from the earlier transaction
-- expires at commit. `''::uuid` throws `invalid input syntax for type
-- uuid`, not "no rows" -- turning a routine, connection-pool-reused,
-- unscoped query into a hard 500.
--
-- This was never triggered before B4: no earlier session's code opened
-- several rapid, alternating single-key `withScope()` calls on a shared
-- pooled connection (B4's run route does eight `withScope({ workspaceId })`
-- calls in one request -- createRun, six recordStep, finishRun -- with no
-- userId; the very next request's `getWorkspaceContext()` does
-- `withScope({ userId })` with no workspaceId, on whichever connection the
-- pool hands back). Reproduced standalone, deterministically, in under 10
-- lines (see PROGRESS.md's B4 decisions) -- not sandbox flakiness.
--
-- Fix: `NULLIF(current_setting(...), '')::uuid` turns the empty-string case
-- back into a real NULL before the cast, restoring the original "unscoped
-- axis compares as NULL, so it can never match, so an unscoped query fails
-- closed" behavior the policies always intended -- this is a bug fix, not a
-- security loosening: an empty-string scope was never supposed to match
-- anything, and now it correctly doesn't, instead of crashing.
--> statement-breakpoint
ALTER POLICY "workspace_isolation" ON "members"
  USING (
    "workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid
    OR "user_id" = NULLIF(current_setting('app.user_id', true), '')::uuid
  )
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

ALTER POLICY "workspace_isolation" ON "agents"
  USING ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

ALTER POLICY "workspace_isolation" ON "agent_versions"
  USING ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

ALTER POLICY "workspace_isolation" ON "agent_runs"
  USING ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

ALTER POLICY "workspace_isolation" ON "run_steps"
  USING ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

ALTER POLICY "workspace_isolation" ON "copilot_threads"
  USING ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

ALTER POLICY "workspace_isolation" ON "copilot_messages"
  USING ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

ALTER POLICY "workspace_isolation" ON "tool_calls"
  USING ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

ALTER POLICY "workspace_isolation" ON "priority_items"
  USING ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

ALTER POLICY "workspace_isolation" ON "activity_events"
  USING ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
