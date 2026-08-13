ALTER TABLE "agent_versions" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_version_unique" UNIQUE("agent_id","version");--> statement-breakpoint
-- Gate item 1: "a test that attempts to mutate a published version row
-- fails" -- enforced at the database layer, not just by application
-- discipline never issuing an UPDATE/DELETE against a published row. Mirrors
-- this codebase's own RLS philosophy (0001_row_level_security.sql: the
-- database itself hides an out-of-scope row, not the app choosing not to
-- query it) -- here the database itself refuses the write, not the app
-- choosing not to attempt it. Scoped to `published = true` rows specifically
-- (via OLD, available on both UPDATE and DELETE) rather than a blanket
-- REVOKE on the table, since the column already carries that exact meaning.
CREATE OR REPLACE FUNCTION prevent_published_agent_version_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.published THEN
    RAISE EXCEPTION 'agent_versions row % is published and immutable', OLD.id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER agent_versions_immutable
  BEFORE UPDATE OR DELETE ON "agent_versions"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_agent_version_mutation();