CREATE TYPE "public"."priority_item_type" AS ENUM('failed_run', 'human_approval', 'declining_success_rate', 'stale_draft', 'cost_spike');--> statement-breakpoint
ALTER TABLE "priority_items" ADD COLUMN "item_type" "priority_item_type" DEFAULT 'failed_run' NOT NULL;--> statement-breakpoint
ALTER TABLE "priority_items" ADD COLUMN "magnitude" numeric(10, 4) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "priority_items" ADD COLUMN "entity_signal" numeric(10, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "priority_items" ADD COLUMN "snoozed_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "priority_items_workspace_id_resolved_idx" ON "priority_items" USING btree ("workspace_id","resolved");