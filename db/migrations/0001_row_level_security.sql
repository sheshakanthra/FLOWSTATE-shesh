-- Row-level security, scoped on workspace_id, for every workspace-scoped
-- table in the schema (db/schema.ts's RLS_SESSION_VAR). `members` is
-- included because membership rows are themselves per-workspace data;
-- `workspaces` and `users` are the tenant-root/identity tables and are
-- authorized in application code (lib/repos/workspaces.ts, lib/auth)
-- instead, since neither carries a workspace_id column to filter on.
--
-- The app connects as `kiln_app`, a dedicated non-superuser role granted
-- privileges on these tables but that does NOT own them (db/migrate.ts runs
-- as the owner role instead, over a separate DATABASE_MIGRATION_URL) --
-- superusers bypass RLS unconditionally, and table owners are exempt by
-- default too, so neither connecting-as-owner nor connecting-as-superuser
-- would actually be gated by any of this. FORCE ROW LEVEL SECURITY is kept
-- on every table anyway as defense in depth, in case anything ever queries
-- as the owner role directly (a migration script, a one-off psql session).
--
-- current_setting(..., true) returns NULL rather than erroring when
-- lib/repos/db.ts's withScope() hasn't set the corresponding session
-- variable for this transaction; comparing a column to NULL is never true,
-- so an unscoped connection sees zero rows (fail closed) rather than every
-- workspace's data.
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- `members` gets an OR clause the other tables don't: lib/repos/workspaces.ts's
-- listWorkspacesForUser() has to discover which workspaces a user belongs to
-- *before* any single workspace_id is known, so a membership row must also be
-- visible when it's the querying user's own row (app.user_id), not only when
-- it matches the current app.workspace_id. WITH CHECK stays workspace_id-only
-- (no user_id branch) so a user still can't insert/update a membership row
-- for a workspace they're not currently scoped into just by knowing their
-- own id.
CREATE POLICY "workspace_isolation" ON "members"
  USING (
    "workspace_id" = current_setting('app.workspace_id', true)::uuid
    OR "user_id" = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "agents"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "agent_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "agent_versions"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "agent_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "agent_runs"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "run_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "run_steps" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "run_steps"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "copilot_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "copilot_threads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "copilot_threads"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "copilot_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "copilot_messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "copilot_messages"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "tool_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tool_calls" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "tool_calls"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "priority_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "priority_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "priority_items"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "activity_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "activity_events"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);
