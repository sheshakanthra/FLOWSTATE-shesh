CREATE TABLE "prompt_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_library" ADD CONSTRAINT "prompt_library_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_library" ADD CONSTRAINT "prompt_library_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Same workspace-isolation RLS shape as every other table in
-- db/migrations/0001_row_level_security.sql -- no OR clause (unlike
-- `members`): a prompt is only ever looked up by a workspace_id that's
-- already known, never used to discover which workspaces a user belongs to.
ALTER TABLE "prompt_library" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prompt_library" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "prompt_library"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);