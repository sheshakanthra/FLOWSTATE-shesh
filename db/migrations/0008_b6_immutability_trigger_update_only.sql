-- 0006's trigger blocked both UPDATE and DELETE on a published row. DELETE
-- turned out to be the wrong call: `agent_versions.agent_id`/`agents.workspace_id`
-- both cascade on delete, so removing an agent or workspace that has any
-- published version would issue a cascaded DELETE against that version
-- row too -- which the original trigger rejected, failing the *entire*
-- cascade (and the agent/workspace deletion along with it), not just the
-- version row. No delete-agent/delete-workspace route exists in this
-- codebase yet, so this was never hit by real application code, only by
-- this session's own test cleanup -- but it's a real latent trap for
-- whichever future session adds one. "Immutable" (gate item 1's own
-- wording is "mutate") is about preventing a published snapshot from being
-- silently rewritten to look like something it wasn't, not about
-- outliving the agent it belongs to once that agent itself is gone --
-- so this narrows the guard to UPDATE only.
CREATE OR REPLACE FUNCTION prevent_published_agent_version_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.published THEN
    RAISE EXCEPTION 'agent_versions row % is published and immutable', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS agent_versions_immutable ON "agent_versions";
--> statement-breakpoint
CREATE TRIGGER agent_versions_immutable
  BEFORE UPDATE ON "agent_versions"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_agent_version_mutation();
