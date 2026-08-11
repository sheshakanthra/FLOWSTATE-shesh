ALTER TYPE "public"."run_step_kind" ADD VALUE 'trigger' BEFORE 'llm_call';--> statement-breakpoint
ALTER TYPE "public"."run_step_kind" ADD VALUE 'loop' BEFORE 'transform';--> statement-breakpoint
ALTER TYPE "public"."run_step_kind" ADD VALUE 'memory' BEFORE 'transform';--> statement-breakpoint
ALTER TYPE "public"."run_step_kind" ADD VALUE 'knowledge' BEFORE 'transform';--> statement-breakpoint
ALTER TYPE "public"."run_step_kind" ADD VALUE 'output';--> statement-breakpoint
ALTER TYPE "public"."run_step_kind" ADD VALUE 'human_in_loop';--> statement-breakpoint
-- Nullable first, then backfilled, then constrained -- db/seed.ts's existing
-- run_steps rows predate any real node-linked run (they're fabricated
-- dashboard fixture data with no graph behind them), so a bare "NOT NULL"
-- would fail this migration outright against seeded data. Every row this
-- session's own code writes always supplies a real node id.
ALTER TABLE "run_steps" ADD COLUMN "node_id" text;--> statement-breakpoint
UPDATE "run_steps" SET "node_id" = 'legacy-' || "id"::text WHERE "node_id" IS NULL;--> statement-breakpoint
ALTER TABLE "run_steps" ALTER COLUMN "node_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "cost_cents" integer;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;