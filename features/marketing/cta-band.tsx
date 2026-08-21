import Link from "next/link";
import { cn, focusRing } from "@/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

// Mirrors Button's own "primary" + "lg" classes (components/ui/button.tsx)
// -- a plain `<Link>` here rather than `<Button>` since Button has no
// `asChild`/Slot support to render as an anchor, and a `<Link>` nested
// inside a native `<button>` isn't valid HTML.
const CTA_LINK_CLASSES = cn(
  "inline-flex h-12 items-center justify-center gap-2 rounded-md border border-ink-500 bg-ink-400 px-6",
  "text-body font-medium text-fg-000 transition-instant hover:bg-ink-500",
  focusRing,
);

export function CtaBand() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
      <ScrollReveal className="flex flex-col items-center gap-5 rounded-lg border border-ink-400 bg-ink-100 px-8 py-14 text-center shadow-card">
        <h2 className="text-display-sm text-fg-000">Build the next one on your own agency.</h2>
        <p className="max-w-md text-body text-fg-100">
          Everything above was the real product. Sign up to build agents for your own clients.
        </p>
        <Link href="/signup" className={CTA_LINK_CLASSES}>
          Sign up
        </Link>
      </ScrollReveal>
    </section>
  );
}

export default CtaBand;
