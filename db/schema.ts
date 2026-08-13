import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ---- enums ----

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member"]);
export const agentStatusEnum = pgEnum("agent_status", ["draft", "published", "failing", "archived"]);
export const runStatusEnum = pgEnum("run_status", ["running", "succeeded", "failed", "cancelled"]);
export const runStepStatusEnum = pgEnum("run_step_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
]);
// One value per registered node type (features/agents/nodes/registry.ts) --
// B3's port-types.ts note ("resist adding a sixth port type") doesn't apply
// here; every node in a graph produces a run_steps row (B4 gate item 2), so
// this enum has to cover all ten, not just the four kinds that existed
// before any node actually executed.
export const runStepKindEnum = pgEnum("run_step_kind", [
  "trigger",
  "llm_call",
  "tool_call",
  "condition",
  "loop",
  "memory",
  "knowledge",
  "transform",
  "output",
  "human_in_loop",
]);
export const copilotRoleEnum = pgEnum("copilot_role", ["user", "assistant", "system"]);
export const toolCallStatusEnum = pgEnum("tool_call_status", [
  "pending",
  "approved",
  "rejected",
  "succeeded",
  "failed",
]);
export const prioritySeverityEnum = pgEnum("priority_severity", ["critical", "high", "medium", "low"]);

// ---- identity (not workspace-scoped) ----

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("members_workspace_user_unique").on(table.workspaceId, table.userId)],
);

// ---- workspace-scoped domain tables ----
// Every table below carries workspace_id directly (denormalized where the
// natural key is a child of another workspace-scoped row) so RLS policies
// never need a join to decide visibility — see db/migrations for the
// corresponding `CREATE POLICY` statements.

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: agentStatusEnum("status").notNull().default("draft"),
  // Independent of `status`: a published agent can be temporarily paused
  // (B6 gate item 8's "bulk enable/disable") without touching its
  // draft/published/failing/archived lifecycle -- pausing isn't the same
  // action as archiving (which reads as "put away, probably for good"), and
  // there's no real trigger infrastructure in this codebase for either flag
  // to actually gate (schedule/webhook triggers are seed-fixture labels, not
  // real cron/webhook receivers) -- this is a real, honestly-modeled column,
  // not a UI-only toggle with nothing behind it.
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  // The live-editing autosave target for B3's Agent Builder -- distinct from
  // agentVersions.graph below, which is an immutable, versioned snapshot
  // (bumped on publish, not on every debounced save). `viewportJsonb` rides
  // alongside it so gate item 6 ("reload restores the graph exactly,
  // including viewport position") has somewhere to live -- @xyflow/react's
  // Viewport shape ({x,y,zoom}) is small enough not to need its own columns.
  graphJsonb: jsonb("graph_jsonb"),
  viewportJsonb: jsonb("viewport_jsonb"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentVersions = pgTable(
  "agent_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    graph: jsonb("graph").notNull(),
    published: boolean("published").notNull().default(false),
    // B6: who published this snapshot and why -- the version history panel's
    // own gate item ("author, date, note, run count"). `set null` (not
    // `cascade`) so a version survives its author's account being removed;
    // the snapshot itself is the historical record, not the user row.
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("agent_versions_agent_version_unique").on(table.agentId, table.version)],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    agentVersionId: uuid("agent_version_id").references(() => agentVersions.id, {
      onDelete: "set null",
    }),
    status: runStatusEnum("status").notNull(),
    trigger: text("trigger").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // B6 gate item 8 ("stays responsive with 500 agents"): the agents index
  // page's per-agent last-run/success-rate/7-day-cost aggregates are each a
  // `WHERE agent_id = ... ORDER BY started_at DESC` correlated subquery
  // (lib/repos/agents.ts's `listAgentsForIndex`) -- Postgres does not
  // automatically index a foreign-key column, so without this, each of
  // those subqueries would be a full sequential scan of `agent_runs` per
  // agent row, exactly the kind of cost that stops being "responsive" once
  // there are hundreds of agents' worth of run history to scan through per
  // row rather than an index range lookup.
  (table) => [index("agent_runs_agent_id_started_at_idx").on(table.agentId, table.startedAt)],
);

export const runSteps = pgTable("run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  runId: uuid("run_id")
    .notNull()
    .references(() => agentRuns.id, { onDelete: "cascade" }),
  // The graph node this step executed, e.g. "node-<uuid>" -- not a real
  // Postgres uuid, since createNode()/cloneNodes() (registry.ts) mint ids
  // as a "node-" prefixed string, never a bare UUID.
  nodeId: text("node_id").notNull(),
  stepIndex: integer("step_index").notNull(),
  name: text("name").notNull(),
  kind: runStepKindEnum("kind").notNull(),
  status: runStepStatusEnum("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  // The node's *resolved* input -- {{token}} variables already interpolated
  // and port-wired values already substituted -- not the raw config. This
  // is the field B5's replay and this session's own gate item 5 ("shows the
  // error with the failing node's resolved input") both depend on; B4's
  // spec explicitly calls out recording more than looks necessary right now.
  input: jsonb("input"),
  output: jsonb("output"),
  // Only meaningful for an llm_call step; null for every other kind.
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  // Fractional, not whole-number, cents: a short test-console prompt costs
  // well under one cent at Groq's real per-token rates (lib/llm/models.ts),
  // and rounding to an integer would collapse gate item 7's "within 5% of
  // Groq's reported usage" check to a meaningless 0-vs-0 comparison for
  // exactly the size of run this console is built to run.
  costCents: numeric("cost_cents", { precision: 10, scale: 6 }),
  // 1 on a step's first (and typically only) execution; >1 if retry.ts
  // retried it after a transient failure. Recorded per B4's spec item 1
  // ("per-node retry policy") so a retried step is distinguishable from a
  // clean one, not just folded into a single opaque row.
  attempt: integer("attempt").notNull().default(1),
  errorMessage: text("error_message"),
});

export const copilotThreads = pgTable("copilot_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const copilotMessages = pgTable("copilot_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => copilotThreads.id, { onDelete: "cascade" }),
  role: copilotRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const toolCalls = pgTable("tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  messageId: uuid("message_id")
    .notNull()
    .references(() => copilotMessages.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  status: toolCallStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priorityItems = pgTable("priority_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  severity: prioritySeverityEnum("severity").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: uuid("source_id"),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  verb: text("verb").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id"),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- relations (query API ergonomics only — RLS/authorization never relies
// on these; every scoped query goes through lib/repos and passes workspaceId
// explicitly) ----

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(members),
  agents: many(agents),
}));

export const usersRelations = relations(users, ({ many }) => ({
  members: many(members),
}));

export const membersRelations = relations(members, ({ one }) => ({
  workspace: one(workspaces, { fields: [members.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [members.userId], references: [users.id] }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [agents.workspaceId], references: [workspaces.id] }),
  versions: many(agentVersions),
  runs: many(agentRuns),
}));

export const agentVersionsRelations = relations(agentVersions, ({ one }) => ({
  agent: one(agents, { fields: [agentVersions.agentId], references: [agents.id] }),
}));

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  agent: one(agents, { fields: [agentRuns.agentId], references: [agents.id] }),
  version: one(agentVersions, {
    fields: [agentRuns.agentVersionId],
    references: [agentVersions.id],
  }),
  steps: many(runSteps),
}));

export const runStepsRelations = relations(runSteps, ({ one }) => ({
  run: one(agentRuns, { fields: [runSteps.runId], references: [agentRuns.id] }),
}));

export const copilotThreadsRelations = relations(copilotThreads, ({ one, many }) => ({
  user: one(users, { fields: [copilotThreads.userId], references: [users.id] }),
  messages: many(copilotMessages),
}));

export const copilotMessagesRelations = relations(copilotMessages, ({ one, many }) => ({
  thread: one(copilotThreads, { fields: [copilotMessages.threadId], references: [copilotThreads.id] }),
  toolCalls: many(toolCalls),
}));

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  message: one(copilotMessages, { fields: [toolCalls.messageId], references: [copilotMessages.id] }),
}));

export const priorityItemsRelations = relations(priorityItems, ({ one }) => ({
  workspace: one(workspaces, { fields: [priorityItems.workspaceId], references: [workspaces.id] }),
  assignee: one(users, { fields: [priorityItems.assigneeId], references: [users.id] }),
}));

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  workspace: one(workspaces, { fields: [activityEvents.workspaceId], references: [workspaces.id] }),
  actor: one(users, { fields: [activityEvents.actorId], references: [users.id] }),
}));

/**
 * Column-name constant, not a magic string: every RLS policy (see
 * db/migrations) filters on this column via
 * `current_setting('app.workspace_id', true)`, and lib/repos/db.ts's
 * withWorkspace() sets that same session variable before running a scoped
 * query. Kept here so the policy/session-variable name and the schema stay
 * next to each other.
 */
export const RLS_SESSION_VAR = "app.workspace_id";
