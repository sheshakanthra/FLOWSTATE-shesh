"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { LayoutGrid } from "lucide-react";
import { useMotion, useReducedMotion } from "@/lib/motion";
import { EmberEdge } from "@/components/motion/ember-edge";
import { Badge } from "@/components/ui/badge";
import { HeroInput } from "./input";
import { OutputPanel, type DemoStep } from "./output-panel";
import { useDemoRunStore } from "./demo-run-store";
import type { AgentNode } from "@/features/agents/nodes/registry";
import type { StreamingGraphEdge } from "./streaming-graph";
import type { FallbackDemo } from "./fallback-graph";

/**
 * The hero (E1 spec, the whole session). Reads a plain-English task,
 * generates a real agent graph (`/api/demo/generate`, reusing C3's
 * `generateAgentFromDescription` verbatim), streams it onto a real
 * `@xyflow/react` canvas one node at a time, then runs it for real
 * (`/api/demo/run`) and streams the result -- all without a sign-up, a
 * mockup image, or a looping video.
 *
 * React Flow (`./streaming-graph`) is dynamically imported (spec item 8,
 * gate item 5) and only rendered once the canvas frame has entered the
 * viewport -- see `canvasVisible` below. Everything else on this page (the
 * headline, subhead, input) renders synchronously so LCP never waits on the
 * graph library.
 */
const StreamingGraph = dynamic(() => import("./streaming-graph"), { ssr: false });

type Phase = "idle" | "streaming-graph" | "running" | "done";

const NODE_KIND_LABEL: Record<string, string> = {
  trigger: "Trigger",
  llm: "LLM",
  tool: "Tool",
  condition: "Condition",
  loop: "Loop",
  memory: "Memory",
  knowledge: "Knowledge",
  transform: "Transform",
  output: "Output",
  humanInLoop: "Human approval",
};

interface GeneratedGraph {
  nodes: AgentNode[];
  edges: StreamingGraphEdge[];
}

interface GenerateSuccessResponse {
  ok: true;
  name: string;
  description: string;
  graph: GeneratedGraph;
}
interface GenerateFailureResponse {
  ok: false;
  reason: string;
}
type GenerateResponse = GenerateSuccessResponse | GenerateFailureResponse;

type RunEventFromServer =
  | { type: "step-start"; nodeId: string; name: string; kind: string }
  | { type: "token"; nodeId: string; delta: string }
  | {
      type: "step-end";
      nodeId: string;
      name: string;
      kind: string;
      status: "succeeded" | "failed" | "skipped";
      output: unknown;
      errorMessage?: string;
    }
  | { type: "run-end"; status: "succeeded" | "failed" | "cancelled"; finalOutputs: unknown[]; errorMessage?: string };

function formatOutput(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function Hero() {
  const { base } = useMotion();
  const prefersReducedMotion = useReducedMotion();

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [submitting, setSubmitting] = React.useState(false);
  const [rateLimited, setRateLimited] = React.useState(false);
  const [usingFallback, setUsingFallback] = React.useState(false);
  const [visibleNodes, setVisibleNodes] = React.useState<AgentNode[]>([]);
  const [visibleEdges, setVisibleEdges] = React.useState<StreamingGraphEdge[]>([]);
  const [steps, setSteps] = React.useState<DemoStep[]>([]);
  const [finalOutput, setFinalOutput] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const [canvasVisible, setCanvasVisible] = React.useState(false);

  const frameRef = React.useRef<HTMLDivElement>(null);
  const cancelledRef = React.useRef(false);

  React.useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  React.useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCanvasVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const revealGraph = React.useCallback(
    async (nodes: AgentNode[], edges: StreamingGraphEdge[]) => {
      if (prefersReducedMotion) {
        setVisibleNodes(nodes);
        setVisibleEdges(edges);
        setAnnouncement(
          `Built ${nodes.length} step${nodes.length === 1 ? "" : "s"}: ${nodes.map((node) => node.data.label).join(", ")}.`,
        );
        return;
      }
      setVisibleNodes([]);
      setVisibleEdges([]);
      for (const node of nodes) {
        await sleep(260);
        if (cancelledRef.current) return;
        setVisibleNodes((current) => [...current, node]);
        const kindLabel = NODE_KIND_LABEL[node.type ?? ""] ?? node.type ?? "node";
        setAnnouncement(`Added node: ${node.data.label} (${kindLabel}).`);

        const incoming = edges.filter((edge) => edge.target === node.id);
        if (incoming.length > 0) {
          await sleep(140);
          if (cancelledRef.current) return;
          setVisibleEdges((current) => [...current, ...incoming]);
        }
      }
    },
    [prefersReducedMotion],
  );

  const runFallback = React.useCallback(
    async (fallback: FallbackDemo) => {
      for (const step of fallback.steps) {
        useDemoRunStore.getState().setNodeStatus(step.nodeId, "running");
        setSteps((current) => [...current, { nodeId: step.nodeId, name: step.name, kind: step.kind, status: "running" }]);
        setAnnouncement(`Running: ${step.name}.`);
        await sleep(prefersReducedMotion ? 0 : 300);
        if (cancelledRef.current) return;
        useDemoRunStore.getState().setNodeStatus(step.nodeId, "succeeded");
        setSteps((current) =>
          current.map((entry) =>
            entry.nodeId === step.nodeId ? { ...entry, status: "succeeded", streamedText: step.output } : entry,
          ),
        );
        setAnnouncement(`${step.name} succeeded.`);
      }
      setFinalOutput(fallback.finalOutput);
      setAnnouncement("Run complete — showing a saved example.");
    },
    [prefersReducedMotion],
  );

  const runReal = React.useCallback(async (nodes: AgentNode[], edges: StreamingGraphEdge[], description: string) => {
    function handleEvent(event: RunEventFromServer) {
      if (event.type === "step-start") {
        useDemoRunStore.getState().setNodeStatus(event.nodeId, "running");
        setSteps((current) => [...current, { nodeId: event.nodeId, name: event.name, kind: event.kind, status: "running" }]);
        setAnnouncement(`Running: ${event.name}.`);
        return;
      }
      if (event.type === "token") {
        setSteps((current) =>
          current.map((entry) =>
            entry.nodeId === event.nodeId ? { ...entry, streamedText: (entry.streamedText ?? "") + event.delta } : entry,
          ),
        );
        return;
      }
      if (event.type === "step-end") {
        useDemoRunStore.getState().setNodeStatus(event.nodeId, event.status);
        setSteps((current) =>
          current.map((entry) =>
            entry.nodeId === event.nodeId
              ? {
                  ...entry,
                  status: event.status,
                  errorMessage: event.errorMessage,
                  streamedText: entry.streamedText ?? (typeof event.output === "string" ? event.output : undefined),
                }
              : entry,
          ),
        );
        setAnnouncement(`${event.name} ${event.status}.`);
        return;
      }
      if (event.type === "run-end") {
        const output =
          event.finalOutputs.length > 0
            ? event.finalOutputs.map(formatOutput).join("\n\n")
            : (event.errorMessage ?? "Run finished, but no output node was reached.");
        setFinalOutput(output);
        setAnnouncement(event.status === "succeeded" ? "Run complete." : `Run ${event.status}.`);
      }
    }

    try {
      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges, runInput: description }),
      });
      if (!response.ok || !response.body) throw new Error("Run request failed.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            handleEvent(JSON.parse(line) as RunEventFromServer);
          } catch {
            // A malformed NDJSON line shouldn't take down the whole reader loop.
          }
        }
      }
    } catch {
      setFinalOutput((current) => current ?? "The run couldn't complete just now — the graph above is still real.");
      setAnnouncement("The run couldn't complete.");
    }
  }, []);

  const handleSubmit = React.useCallback(
    async (description: string) => {
      if (phase === "streaming-graph" || phase === "running") return;
      setSubmitting(true);
      setRateLimited(false);

      try {
        let usingFallbackNow = false;
        let graph: GeneratedGraph | undefined;
        let name = "";

        try {
          const response = await fetch("/api/demo/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
          });

          if (response.status === 429) {
            setRateLimited(true);
            return;
          }

          const data = (await response.json()) as GenerateResponse;
          if (data.ok) {
            graph = data.graph;
            name = data.name;
          } else {
            usingFallbackNow = true;
          }
        } catch {
          usingFallbackNow = true;
        }

        let fallback: FallbackDemo | null = null;
        if (usingFallbackNow) {
          const module = await import("./fallback-graph");
          fallback = module.buildFallbackDemo();
          graph = fallback.graph;
          name = fallback.name;
        }
        if (cancelledRef.current || !graph) return;

        useDemoRunStore.getState().reset();
        setUsingFallback(usingFallbackNow);
        setSteps([]);
        setFinalOutput(null);
        setAnnouncement(usingFallbackNow ? `Showing a saved example: ${name}.` : `Building ${name}…`);
        setPhase("streaming-graph");

        await revealGraph(graph.nodes, graph.edges);
        if (cancelledRef.current) return;

        setPhase("running");
        if (usingFallbackNow && fallback) {
          await runFallback(fallback);
        } else {
          await runReal(graph.nodes, graph.edges, description);
        }
        if (cancelledRef.current) return;
        setPhase("done");
      } finally {
        setSubmitting(false);
      }
    },
    [phase, revealGraph, runFallback, runReal],
  );

  const busy = phase === "streaming-graph" || phase === "running";
  const anyStepFailed = steps.some((step) => step.status === "failed");
  const outputPhase = phase === "running" ? "running" : phase === "done" ? (anyStepFailed ? "failed" : "succeeded") : "idle";
  const shouldLoadCanvas = canvasVisible || phase !== "idle";

  return (
    <div className="flex min-h-svh flex-col">
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: base.duration, ease: base.ease }}
        className="flex items-center justify-between px-6 py-5 sm:px-10"
      >
        <span className="text-title-sm font-semibold text-fg-000">KILN</span>
        <Link href="/login" className="text-label text-fg-100 transition-instant hover:text-fg-000">
          Sign in
        </Link>
      </motion.header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:gap-16">
        <div className="flex flex-1 flex-col gap-5">
          {/* Rises only -- deliberately no opacity fade (spec item 6 says
              "headline rises 16px", not "fades in"). This is the page's LCP
              candidate; starting it at opacity:0 would gate the browser's
              largest-contentful-paint on JS hydration finishing under
              throttled conditions, which measured ~3.5s LCP instead of the
              gate's 1.2s budget. Staying at opacity:1 the whole time means
              the text is fully painted at first paint regardless of when
              React hydrates -- only its vertical offset animates in. */}
          <motion.h1
            initial={{ y: 16 }}
            animate={{ y: 0 }}
            transition={{ duration: base.duration, ease: base.ease, delay: 0.08 }}
            className="text-display-lg text-fg-000"
          >
            Describe a task your agency does over and over.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: base.duration, ease: base.ease, delay: 0.14 }}
            className="max-w-md text-body text-fg-100"
          >
            Watch a real agent build itself and run on your example — no sign-up, no mockup, no looping video.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: base.duration, ease: base.ease, delay: 0.2 }}
            className="flex flex-col gap-3"
          >
            <HeroInput disabled={busy || submitting} submitting={submitting} onSubmit={handleSubmit} />
            {rateLimited ? (
              <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-blue-line bg-blue-bg px-3 py-2 text-meta text-blue-fg">
                <span>You've used all 3 free demo runs.</span>
                <Link href="/signup" className="font-medium underline underline-offset-2">
                  Sign up to keep building
                </Link>
              </div>
            ) : null}
          </motion.div>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div
            ref={frameRef}
            className="relative h-80 overflow-hidden rounded-lg border border-ink-400 bg-ink-050 lg:h-96"
          >
            <EmberEdge progress={null} />
            {usingFallback ? (
              <Badge className="absolute top-3 left-3 z-10">Showing a saved example</Badge>
            ) : null}
            {shouldLoadCanvas ? (
              <StreamingGraph nodes={visibleNodes} edges={visibleEdges} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <LayoutGrid className="size-6 text-fg-200" aria-hidden="true" />
                <p className="text-body text-fg-100">Your agent's graph will build itself here.</p>
              </div>
            )}
          </div>

          <div className="h-72 overflow-hidden rounded-lg border border-ink-400 bg-ink-100">
            <OutputPanel steps={steps} finalOutput={finalOutput} phase={outputPhase} />
          </div>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

export default Hero;
