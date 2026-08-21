ALTER TABLE "agent_runs" ADD COLUMN "current_node_name" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "current_step_index" integer;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "cancel_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "activity_events_workspace_id_created_at_idx" ON "activity_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runs_workspace_id_status_idx" ON "agent_runs" USING btree ("workspace_id","status");