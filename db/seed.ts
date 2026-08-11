import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { withScope } from "@/lib/repos/db";
import { DEFAULT_GROQ_MODEL } from "@/lib/llm/models";
import { client, db } from "./client";
import {
  activityEvents,
  agentRuns,
  agentVersions,
  agents,
  members,
  priorityItems,
  runSteps,
  users,
  workspaces,
} from "./schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function randomFloat(min: number, max: number, decimals = 4): number {
  return Number((min + Math.random() * (max - min)).toFixed(decimals));
}
function pick<T>(items: T[]): T {
  const item = items[randomInt(0, items.length - 1)];
  if (item === undefined) throw new Error("pick() called on an empty array");
  return item;
}
/** A timestamp `daysAgo` days back, jittered within the day so runs don't
 *  all land on the same hour — 40 identical 09:00:00 rows is the fastest way
 *  to make seed data read as fake. */
function timeDaysAgo(daysAgo: number): Date {
  const jitterMs = randomInt(8, 20) * 60 * 60 * 1000 + randomInt(0, 59) * 60 * 1000;
  return new Date(now - daysAgo * DAY_MS - (DAY_MS - jitterMs));
}

/**
 * B4 gate item 1 needs a real, runnable, 6-node graph -- nothing seeded
 * one produces this by construction (`agentVersions.graph` is hardcoded
 * empty for every agent above), so this session adds one, hand-built
 * rather than routed through `features/agents/nodes/registry.ts`'s
 * `createNode` -- this script runs under plain `tsx` (no DOM), and every
 * other write in this file already constructs rows directly rather than
 * through feature code (see PROGRESS.md's A6 decisions).
 *
 * Every edge here respects the real port-type compatibility rule
 * (`features/agents/lib/port-types.ts`: exact match, or either side
 * `"any"`) -- a Trigger's only output is `signal`, which cannot connect
 * directly to Knowledge's `text`-typed `query` input, so Transform (whose
 * ports are both `"any"`) bridges the two, exactly the way a real user
 * building this graph in the Inspector would have to. This is a genuine
 * constraint of B2's port system, not a demo shortcut:
 * trigger.out(signal) -> transform.input(any) -> transform.output(any) ->
 * knowledge.query(text) -> knowledge.results(document) ->
 * llm.context(document), llm.response(text) -> condition.in(any) ->
 * condition.true(signal) -> output.in(any).
 */
function buildRecallSchedulerGraph() {
  const nodes = [
    {
      id: "seed-recall-trigger",
      type: "trigger",
      position: { x: 0, y: 120 },
      data: { label: "Nightly schedule", config: { triggerType: "schedule", schedule: "0 9 * * *" } },
    },
    {
      id: "seed-recall-transform",
      type: "transform",
      position: { x: 220, y: 120 },
      data: { label: "Prep query", config: { expression: "" } },
    },
    {
      id: "seed-recall-knowledge",
      type: "knowledge",
      position: { x: 440, y: 120 },
      data: { label: "Overdue patients", config: { sourceId: "overdue-patients", topK: 5 } },
    },
    {
      id: "seed-recall-llm",
      type: "llm",
      position: { x: 660, y: 120 },
      data: {
        label: "Draft reminder",
        config: {
          model: DEFAULT_GROQ_MODEL,
          systemPrompt:
            "Draft a warm, brief SMS reminding a dental patient it's time to book their recall cleaning. Keep it under 300 characters, friendly, and end with a call to action.",
          temperature: 0.7,
        },
      },
    },
    {
      id: "seed-recall-condition",
      type: "condition",
      position: { x: 880, y: 120 },
      data: { label: "Draft looks good?", config: { expression: "" } },
    },
    {
      id: "seed-recall-output",
      type: "output",
      position: { x: 1100, y: 120 },
      data: { label: "Send SMS", config: { destination: "twilio-sms" } },
    },
  ];

  const edges = [
    { id: "seed-recall-e1", source: "seed-recall-trigger", sourceHandle: "out", target: "seed-recall-transform", targetHandle: "input" },
    { id: "seed-recall-e2", source: "seed-recall-transform", sourceHandle: "output", target: "seed-recall-knowledge", targetHandle: "query" },
    { id: "seed-recall-e3", source: "seed-recall-knowledge", sourceHandle: "results", target: "seed-recall-llm", targetHandle: "context" },
    { id: "seed-recall-e4", source: "seed-recall-llm", sourceHandle: "response", target: "seed-recall-condition", targetHandle: "in" },
    { id: "seed-recall-e5", source: "seed-recall-condition", sourceHandle: "true", target: "seed-recall-output", targetHandle: "in" },
  ];

  return { nodes, edges };
}

async function main() {
  console.log("Seeding Meridian Ops...");

  const [insertedWorkspace] = await db
    .insert(workspaces)
    .values({ name: "Meridian Ops", slug: "meridian-ops" })
    .returning();
  if (!insertedWorkspace) throw new Error("workspace insert failed");
  const workspace = insertedWorkspace;

  const passwordHash = await hashPassword("demo-password-1234");

  const [priya, jordan, sam] = await db
    .insert(users)
    .values([
      { email: "priya@meridianops.com", name: "Priya Anand", passwordHash },
      { email: "jordan@meridianops.com", name: "Jordan Reyes", passwordHash },
      { email: "sam@meridianops.com", name: "Sam Okafor", passwordHash },
    ])
    .returning();
  if (!priya || !jordan || !sam) throw new Error("user insert failed");

  await withScope({ workspaceId: workspace.id }, (tx) =>
    tx.insert(members).values([
      { workspaceId: workspace.id, userId: priya.id, role: "owner" },
      { workspaceId: workspace.id, userId: jordan.id, role: "admin" },
      { workspaceId: workspace.id, userId: sam.id, role: "member" },
    ]),
  );

  // ---- agents ----
  // Three clients' worth of context (Lumen Dental Group, Harbor & Vine,
  // Crestpoint Realty) run through four agents in a believable mix of
  // states: two healthy and published, one still in draft, one published
  // but actively failing — exactly what "2 published, 1 draft, 1 failing"
  // looks like for a real agency, not four interchangeable demo rows.
  const agentDefs = [
    {
      key: "recall" as const,
      name: "Lumen Dental — Recall Scheduler",
      description:
        "Texts overdue patients a recall reminder and books the next cleaning slot from Lumen's PMS calendar.",
      status: "published" as const,
      createdBy: priya.id,
    },
    {
      key: "review" as const,
      name: "Harbor & Vine — Review Responder",
      description:
        "Drafts on-brand replies to new Google and Yelp reviews for owner approval before posting.",
      status: "published" as const,
      createdBy: jordan.id,
    },
    {
      key: "listing" as const,
      name: "Crestpoint — Listing Copy Generator",
      description: "Turns a property's spec sheet and photos into a first-draft MLS listing description.",
      status: "draft" as const,
      createdBy: sam.id,
    },
    {
      key: "insurance" as const,
      name: "Lumen Dental — Insurance Verification",
      description: "Checks patient insurance eligibility against Delta Dental and Cigna before each appointment.",
      status: "failing" as const,
      createdBy: priya.id,
    },
  ];

  const insertedAgents = await withScope({ workspaceId: workspace.id }, (tx) =>
    tx
      .insert(agents)
      .values(
        agentDefs.map((def) => ({
          workspaceId: workspace.id,
          name: def.name,
          description: def.description,
          status: def.status,
          createdBy: def.createdBy,
        })),
      )
      .returning(),
  );
  const agentByKey = Object.fromEntries(agentDefs.map((def, i) => [def.key, insertedAgents[i]!]));

  // Recall Scheduler gets a real, runnable graph in `agents.graph_jsonb`
  // (the live-editing draft B3's autosave writes to and B4's test console
  // runs from) -- the other three agents' graphs stay empty, matching
  // their own narrative ("Listing Copy Generator" is still a draft with no
  // work done on it yet, etc.).
  const recallGraph = buildRecallSchedulerGraph();
  await withScope({ workspaceId: workspace.id }, (tx) =>
    tx
      .update(agents)
      .set({ graphJsonb: recallGraph, viewportJsonb: { x: 0, y: 0, zoom: 1 } })
      .where(eq(agents.id, agentByKey.recall!.id)),
  );

  const insertedVersions = await withScope({ workspaceId: workspace.id }, (tx) =>
    tx
      .insert(agentVersions)
      .values(
        agentDefs.map((def) => ({
          workspaceId: workspace.id,
          agentId: agentByKey[def.key]!.id,
          version: 1,
          graph: { nodes: [], edges: [] },
          published: def.status !== "draft",
        })),
      )
      .returning(),
  );
  const versionByKey = Object.fromEntries(agentDefs.map((def, i) => [def.key, insertedVersions[i]!]));

  // ---- runs + steps ----
  interface RunPlan {
    agentKey: (typeof agentDefs)[number]["key"];
    trigger: string;
    status: "succeeded" | "failed" | "running" | "cancelled";
    daysAgo: number;
    durationMsRange: [number, number];
    inputTokensRange: [number, number];
    outputTokensRange: [number, number];
    costRange: [number, number];
    errorMessage?: string;
    steps: { name: string; kind: "llm_call" | "tool_call" | "condition" | "transform" }[];
    failStepIndex?: number;
  }

  const recallSteps: RunPlan["steps"] = [
    { name: "Find overdue patients", kind: "tool_call" },
    { name: "Draft reminder message", kind: "llm_call" },
    { name: "Send SMS", kind: "tool_call" },
    { name: "Book next slot", kind: "tool_call" },
  ];
  const reviewSteps: RunPlan["steps"] = [
    { name: "Fetch new review", kind: "tool_call" },
    { name: "Draft reply", kind: "llm_call" },
    { name: "Flag for approval", kind: "transform" },
  ];
  const listingSteps: RunPlan["steps"] = [
    { name: "Parse spec sheet", kind: "transform" },
    { name: "Draft listing copy", kind: "llm_call" },
    { name: "Format for MLS", kind: "transform" },
  ];
  const insuranceSteps: RunPlan["steps"] = [
    { name: "Fetch appointment queue", kind: "tool_call" },
    { name: "Check Delta Dental eligibility", kind: "tool_call" },
    { name: "Check Cigna eligibility", kind: "tool_call" },
    { name: "Update patient record", kind: "transform" },
  ];

  const smsErrors = ["Twilio API timed out after 10s.", "Twilio rejected the number as undeliverable."];
  const reviewErrors = ["Yelp Fusion API returned 429 (rate limited).", "Google Business Profile token expired mid-request."];
  const listingErrors = ["No photos attached — description generation needs at least one image.", "Spec sheet missing square footage; couldn't complete the draft."];
  const insuranceErrors = [
    "Delta Dental portal login rejected — session cookie expired.",
    "Cigna eligibility endpoint returned 503 after 3 retries.",
    "Patient record missing a policy number; verification skipped.",
    "Delta Dental portal login rejected — session cookie expired.",
  ];

  const plans: RunPlan[] = [];

  // Recall Scheduler — 14 runs over 14 days, healthy with one blip.
  for (let i = 0; i < 14; i++) {
    const isLast = i === 0;
    const isBlip = i === 6;
    plans.push({
      agentKey: "recall",
      trigger: "schedule",
      status: isLast ? "running" : isBlip ? "failed" : "succeeded",
      daysAgo: i,
      durationMsRange: [3000, 9000],
      inputTokensRange: [300, 900],
      outputTokensRange: [80, 200],
      costRange: [0.0009, 0.0041],
      errorMessage: isBlip ? pick(smsErrors) : undefined,
      steps: recallSteps,
      failStepIndex: isBlip ? 2 : undefined,
    });
  }

  // Review Responder — 12 runs, triggered per incoming review.
  for (let i = 0; i < 12; i++) {
    const isBlip = i === 4;
    plans.push({
      agentKey: "review",
      trigger: "webhook",
      status: isBlip ? "failed" : "succeeded",
      daysAgo: randomInt(0, 13),
      durationMsRange: [4000, 12000],
      inputTokensRange: [500, 1500],
      outputTokensRange: [150, 400],
      costRange: [0.0028, 0.0119],
      errorMessage: isBlip ? pick(reviewErrors) : undefined,
      steps: reviewSteps,
      failStepIndex: isBlip ? 0 : undefined,
    });
  }

  // Listing Copy Generator — still draft, only manual test runs so far.
  const listingStatuses: RunPlan["status"][] = ["succeeded", "succeeded", "failed"];
  for (let i = 0; i < 3; i++) {
    const status = listingStatuses[i]!;
    plans.push({
      agentKey: "listing",
      trigger: "manual",
      status,
      daysAgo: randomInt(1, 6),
      durationMsRange: [6000, 15000],
      inputTokensRange: [800, 2000],
      outputTokensRange: [300, 700],
      costRange: [0.011, 0.029],
      errorMessage: status === "failed" ? pick(listingErrors) : undefined,
      steps: listingSteps,
      failStepIndex: status === "failed" ? 0 : undefined,
    });
  }

  // Insurance Verification — published, now failing most of the time.
  const insurancePlan: { status: RunPlan["status"]; daysAgo: number }[] = [
    { status: "succeeded", daysAgo: 13 },
    { status: "succeeded", daysAgo: 11 },
    { status: "cancelled", daysAgo: 9 },
    { status: "failed", daysAgo: 7 },
    { status: "failed", daysAgo: 6 },
    { status: "failed", daysAgo: 5 },
    { status: "failed", daysAgo: 4 },
    { status: "failed", daysAgo: 3 },
    { status: "failed", daysAgo: 2 },
    { status: "failed", daysAgo: 1 },
    { status: "failed", daysAgo: 0 },
  ];
  for (const { status, daysAgo } of insurancePlan) {
    plans.push({
      agentKey: "insurance",
      trigger: "schedule",
      status,
      daysAgo,
      durationMsRange: status === "failed" ? [1800, 6000] : [4000, 11000],
      inputTokensRange: [250, 700],
      outputTokensRange: [40, 150],
      costRange: [0.0006, 0.0026],
      errorMessage: status === "failed" ? pick(insuranceErrors) : undefined,
      steps: insuranceSteps,
      failStepIndex: status === "failed" ? randomInt(1, 2) : undefined,
    });
  }

  const runRows = plans.map((plan) => {
    const startedAt = timeDaysAgo(plan.daysAgo);
    const durationMs = plan.status === "running" ? null : randomInt(...plan.durationMsRange);
    const finishedAt = durationMs === null ? null : new Date(startedAt.getTime() + durationMs);
    return {
      workspaceId: workspace.id,
      agentId: agentByKey[plan.agentKey]!.id,
      agentVersionId: versionByKey[plan.agentKey]!.id,
      status: plan.status,
      trigger: plan.trigger,
      startedAt,
      finishedAt,
      durationMs,
      costUsd: plan.status === "running" ? null : String(randomFloat(...plan.costRange)),
      inputTokens: randomInt(...plan.inputTokensRange),
      outputTokens: plan.status === "running" ? null : randomInt(...plan.outputTokensRange),
      errorMessage: plan.errorMessage ?? null,
    };
  });

  const insertedRuns = await withScope({ workspaceId: workspace.id }, (tx) =>
    tx.insert(agentRuns).values(runRows).returning(),
  );

  const stepRows: (typeof runSteps.$inferInsert)[] = [];
  plans.forEach((plan, index) => {
    const run = insertedRuns[index]!;
    const runStarted = run.startedAt.getTime();
    let cursor = runStarted;
    plan.steps.forEach((step, stepIndex) => {
      const failsHere = plan.failStepIndex === stepIndex;
      const skipped = plan.failStepIndex !== undefined && stepIndex > plan.failStepIndex;
      const stepDuration = skipped ? 0 : randomInt(400, 3200);
      const stepStarted = new Date(cursor);
      cursor += stepDuration;
      const stepFinished = skipped ? null : new Date(cursor);

      stepRows.push({
        workspaceId: workspace.id,
        runId: run.id,
        // These fixture runs aren't tied to any real graph (see the B4
        // decision below on why `agents.graph_jsonb` stayed empty for three
        // of the four seeded agents) -- a deterministic, clearly-synthetic
        // id per agent/step position, not a real "node-<uuid>".
        nodeId: `seed-${plan.agentKey}-${stepIndex}`,
        stepIndex,
        name: step.name,
        kind: step.kind,
        status: skipped ? "skipped" : failsHere ? "failed" : run.status === "running" && stepIndex === plan.steps.length - 1 ? "running" : "succeeded",
        startedAt: skipped ? null : stepStarted,
        finishedAt: skipped ? null : stepFinished,
        durationMs: skipped ? null : stepDuration,
        input: { step: step.name },
        output: failsHere || skipped ? null : { ok: true },
        errorMessage: failsHere ? (run.errorMessage ?? "Step failed.") : null,
      });
    });
  });

  await withScope({ workspaceId: workspace.id }, (tx) => tx.insert(runSteps).values(stepRows));

  // ---- priority items ----
  await withScope({ workspaceId: workspace.id }, (tx) =>
    tx.insert(priorityItems).values([
      {
        workspaceId: workspace.id,
        title: "Insurance Verification has failed 7 times this week",
        description: "Delta Dental's portal is rejecting the saved session — Priya needs to re-authenticate.",
        severity: "critical",
        sourceType: "agent_run",
        sourceId: agentByKey.insurance!.id,
        resolved: false,
      },
      {
        workspaceId: workspace.id,
        title: "Delta Dental portal credentials may be expired",
        description: "Session cookie has been rejected on every run since Tuesday.",
        severity: "critical",
        sourceType: "system",
        resolved: false,
      },
      {
        workspaceId: workspace.id,
        title: "Cigna eligibility endpoint intermittently returning 503",
        description: "Happening across roughly a third of Insurance Verification runs this week.",
        severity: "high",
        sourceType: "system",
        resolved: false,
      },
      {
        workspaceId: workspace.id,
        title: "Harbor & Vine: 1-star review needs a manual reply",
        description: "Review Responder flagged this one instead of auto-drafting — mentions a refund request.",
        severity: "high",
        sourceType: "agent_run",
        sourceId: agentByKey.review!.id,
        assigneeId: jordan.id,
        resolved: false,
      },
      {
        workspaceId: workspace.id,
        title: "Review Responder approval queue has 4 drafts waiting",
        description: "Oldest draft is 2 days old.",
        severity: "high",
        sourceType: "agent_run",
        sourceId: agentByKey.review!.id,
        assigneeId: jordan.id,
        resolved: false,
      },
      {
        workspaceId: workspace.id,
        title: "3 Lumen Dental patients missing phone numbers",
        description: "Recall Scheduler can't text a reminder without one — needs a PMS data cleanup.",
        severity: "medium",
        sourceType: "client",
        assigneeId: priya.id,
        resolved: false,
      },
      {
        workspaceId: workspace.id,
        title: "Crestpoint Listing Copy Generator still in draft",
        description: "2 listings are waiting on this before it can go live.",
        severity: "medium",
        sourceType: "client",
        assigneeId: sam.id,
        resolved: false,
      },
      {
        workspaceId: workspace.id,
        title: "Twilio SMS spend up 18% for Recall Scheduler this week",
        description: "Worth checking whether retry logic is double-sending on timeouts.",
        severity: "low",
        sourceType: "agent_run",
        sourceId: agentByKey.recall!.id,
        resolved: false,
      },
      {
        workspaceId: workspace.id,
        title: "Recall Scheduler SMS failed for 2 patients — bad phone numbers",
        description: "Numbers corrected in the PMS; next scheduled run will retry.",
        severity: "medium",
        sourceType: "agent_run",
        sourceId: agentByKey.recall!.id,
        assigneeId: priya.id,
        resolved: true,
      },
      {
        workspaceId: workspace.id,
        title: "New client onboarding: Crestpoint Realty contract signed",
        description: "Kickoff call scheduled; Sam is building the first agent.",
        severity: "low",
        sourceType: "client",
        assigneeId: sam.id,
        resolved: true,
      },
      {
        workspaceId: workspace.id,
        title: "Sam Okafor added as workspace member",
        description: "Onboarded for the Crestpoint engagement.",
        severity: "low",
        sourceType: "system",
        resolved: true,
      },
      {
        workspaceId: workspace.id,
        title: "Escalate Insurance Verification outage to Delta Dental support",
        description: "Support ticket #48213 opened; awaiting a response on the portal session policy change.",
        severity: "critical",
        sourceType: "agent_run",
        sourceId: agentByKey.insurance!.id,
        assigneeId: priya.id,
        resolved: false,
      },
    ]),
  );

  // ---- activity events ----
  // Narrative rows (agent lifecycle, membership) plus one event per run
  // above, so the feed matches the run history exactly the way a real one
  // would rather than being invented separately from it.
  const narrativeEvents: (typeof activityEvents.$inferInsert)[] = [
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "workspace.created",
      subjectType: "workspace",
      subjectId: workspace.id,
      summary: "Priya Anand created Meridian Ops",
      createdAt: timeDaysAgo(14),
    },
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "member.joined",
      subjectType: "member",
      summary: "Jordan Reyes joined the workspace",
      createdAt: timeDaysAgo(14),
    },
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "member.joined",
      subjectType: "member",
      summary: "Sam Okafor joined the workspace",
      createdAt: timeDaysAgo(13),
    },
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "agent.created",
      subjectType: "agent",
      subjectId: agentByKey.recall!.id,
      summary: "Priya Anand created Lumen Dental — Recall Scheduler",
      createdAt: timeDaysAgo(13),
    },
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "agent.published",
      subjectType: "agent",
      subjectId: agentByKey.recall!.id,
      summary: "Priya Anand published Lumen Dental — Recall Scheduler",
      createdAt: timeDaysAgo(12),
    },
    {
      workspaceId: workspace.id,
      actorId: jordan.id,
      verb: "agent.created",
      subjectType: "agent",
      subjectId: agentByKey.review!.id,
      summary: "Jordan Reyes created Harbor & Vine — Review Responder",
      createdAt: timeDaysAgo(11),
    },
    {
      workspaceId: workspace.id,
      actorId: jordan.id,
      verb: "agent.published",
      subjectType: "agent",
      subjectId: agentByKey.review!.id,
      summary: "Jordan Reyes published Harbor & Vine — Review Responder",
      createdAt: timeDaysAgo(10),
    },
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "agent.created",
      subjectType: "agent",
      subjectId: agentByKey.insurance!.id,
      summary: "Priya Anand created Lumen Dental — Insurance Verification",
      createdAt: timeDaysAgo(13),
    },
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "agent.published",
      subjectType: "agent",
      subjectId: agentByKey.insurance!.id,
      summary: "Priya Anand published Lumen Dental — Insurance Verification",
      createdAt: timeDaysAgo(13),
    },
    {
      workspaceId: workspace.id,
      actorId: sam.id,
      verb: "agent.created",
      subjectType: "agent",
      subjectId: agentByKey.listing!.id,
      summary: "Sam Okafor created Crestpoint — Listing Copy Generator",
      createdAt: timeDaysAgo(6),
    },
    {
      workspaceId: workspace.id,
      actorId: jordan.id,
      verb: "agent.updated",
      subjectType: "agent",
      subjectId: agentByKey.review!.id,
      summary: "Jordan Reyes updated Review Responder's tone guidelines",
      createdAt: timeDaysAgo(5),
    },
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "priority.flagged",
      subjectType: "agent",
      subjectId: agentByKey.insurance!.id,
      summary: "Insurance Verification flagged critical after its 3rd consecutive failure",
      createdAt: timeDaysAgo(4),
    },
    {
      workspaceId: workspace.id,
      actorId: sam.id,
      verb: "client.onboarded",
      subjectType: "client",
      summary: "Crestpoint Realty contract signed — kickoff scheduled",
      createdAt: timeDaysAgo(6),
    },
    {
      workspaceId: workspace.id,
      actorId: sam.id,
      verb: "client.updated",
      subjectType: "client",
      summary: "Sam Okafor scheduled the Crestpoint kickoff call",
      createdAt: timeDaysAgo(7),
    },
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "agent.updated",
      subjectType: "agent",
      subjectId: agentByKey.recall!.id,
      summary: "Priya Anand updated Recall Scheduler's SMS template",
      createdAt: timeDaysAgo(8),
    },
    {
      workspaceId: workspace.id,
      actorId: jordan.id,
      verb: "run.approved",
      subjectType: "agent",
      subjectId: agentByKey.review!.id,
      summary: "Jordan Reyes approved 3 draft replies for Harbor & Vine",
      createdAt: timeDaysAgo(9),
    },
    {
      workspaceId: workspace.id,
      actorId: sam.id,
      verb: "client.updated",
      subjectType: "client",
      summary: "Sam Okafor uploaded Crestpoint's brand style guide",
      createdAt: timeDaysAgo(5),
    },
    {
      workspaceId: workspace.id,
      actorId: jordan.id,
      verb: "run.replied",
      subjectType: "agent",
      subjectId: agentByKey.review!.id,
      summary: "Jordan Reyes replied to Harbor & Vine's flagged review manually",
      createdAt: timeDaysAgo(2),
    },
    {
      workspaceId: workspace.id,
      actorId: jordan.id,
      verb: "agent.updated",
      subjectType: "agent",
      subjectId: agentByKey.review!.id,
      summary: "Jordan Reyes archived an outdated Review Responder draft",
      createdAt: timeDaysAgo(3),
    },
    {
      workspaceId: workspace.id,
      actorId: priya.id,
      verb: "priority.reviewed",
      subjectType: "agent",
      subjectId: agentByKey.insurance!.id,
      summary: "Priya Anand reviewed this week's Insurance Verification failures",
      createdAt: timeDaysAgo(1),
    },
  ];

  const runEvents: (typeof activityEvents.$inferInsert)[] = insertedRuns.map((run, index) => {
    const plan = plans[index]!;
    const agentName = agentByKey[plan.agentKey]!.name;
    const verb = run.status === "failed" ? "run.failed" : run.status === "succeeded" ? "run.succeeded" : run.status === "cancelled" ? "run.cancelled" : "run.started";
    const summary =
      run.status === "failed"
        ? `${agentName} failed: ${run.errorMessage}`
        : run.status === "succeeded"
          ? `${agentName} completed in ${((run.durationMs ?? 0) / 1000).toFixed(1)}s`
          : run.status === "cancelled"
            ? `${agentName} run was cancelled`
            : `${agentName} started a run`;
    return {
      workspaceId: workspace.id,
      actorId: null,
      verb,
      subjectType: "agent_run",
      subjectId: run.id,
      summary,
      createdAt: run.startedAt,
    };
  });

  const allEvents = [...narrativeEvents, ...runEvents]
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
    .slice(0, 60);

  await withScope({ workspaceId: workspace.id }, (tx) => tx.insert(activityEvents).values(allEvents));

  console.log(`Seeded workspace "${workspace.name}" (/w/${workspace.slug}):`);
  console.log(`  3 users, 4 agents, ${insertedRuns.length} runs, ${stepRows.length} run steps`);
  console.log(`  12 priority items, ${allEvents.length} activity events`);
  console.log(`Sign in with priya@meridianops.com / demo-password-1234 (or jordan@/sam@ — same password).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
