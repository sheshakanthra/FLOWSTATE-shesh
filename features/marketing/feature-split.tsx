import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const POINTS = [
  "Scrub through any run frame by frame, exactly as it happened.",
  "See cost, tokens, and duration for every step, not just the total.",
  "Diff two runs of the same agent side by side.",
];

/**
 * E1 spec item 7's one feature-split section -- trace replay (B5), with a
 * real screenshot captured from the running app (public/screenshots/
 * trace-replay.png; see PROGRESS.md's decision for how it was taken), not a
 * mockup. The spec's own note: if effort has to be cut anywhere this
 * session, it's cut here first -- so this section is deliberately just a
 * heading, three bullet points, and the one screenshot, nothing more.
 */
export function FeatureSplit() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <ScrollReveal className="flex flex-col gap-4">
          <h2 className="text-display-sm text-fg-000">Every run, replayable.</h2>
          <p className="text-body text-fg-100">
            Every agent run is recorded step by step. Trace replay lets you scrub back through exactly what happened —
            what each node saw, what it produced, and what it cost.
          </p>
          <ul className="flex flex-col gap-2">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2 text-body text-fg-100">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-fg" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </ScrollReveal>

        <ScrollReveal delayMs={60}>
          <div className="overflow-hidden rounded-lg border border-ink-400 bg-ink-100 shadow-card">
            <Image
              src="/screenshots/trace-replay.png"
              alt="KILN's trace replay screen, scrubbing through a completed agent run with per-node cost and duration"
              width={1600}
              height={1000}
              className="h-auto w-full"
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default FeatureSplit;
