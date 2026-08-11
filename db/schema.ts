import { relations } from "drizzle-orm";
import {
  boolean,
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
export const runStepKindEnum = pgEnum("run_step_kind", [
  "llm_call",
  "tool_call",
  "condition",
  "transform",
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

export const agentVersions = pgTable("agent_versions", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentRuns = pgTable("agent_runs", {
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
});

export const runSteps = pgTable("run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  runId: uuid("run_id")
    .notNull()
    .references(() => agentRuns.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  name: text("name").notNull(),
  kind: runStepKindEnum("kind").notNull(),
  status: runStepStatusEnum("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  input: jsonb("input"),
  output: jsonb("output"),
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
