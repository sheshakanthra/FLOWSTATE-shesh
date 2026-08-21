import type { Metadata } from "next";
import { Hero } from "@/features/marketing/hero";
import { LogoWall } from "@/features/marketing/logo-wall";
import { FeatureSplit } from "@/features/marketing/feature-split";
import { CtaBand } from "@/features/marketing/cta-band";
import { Footer } from "@/features/marketing/footer";

export const metadata: Metadata = {
  title: "KILN — describe a task, watch a real agent build itself",
  description:
    "The operating system for an AI automation agency. Describe a task your agency does over and over and watch a real agent build itself and run — no sign-up required.",
};

/**
 * The marketing hero (E1, the last session in this slice). Static/ISR per
 * CLAUDE.md's route layout -- everything below `<Hero />` is a plain Server
 * Component; `<Hero />` itself is the one client boundary the page needs
 * (it owns the demo's interactive state), and it lazy-loads React Flow only
 * once its own canvas frame enters the viewport (see
 * features/marketing/hero/index.tsx).
 */
export default function MarketingPage() {
  return (
    <main className="flex min-h-svh flex-col">
      <Hero />
      <LogoWall />
      <FeatureSplit />
      <CtaBand />
      <Footer />
    </main>
  );
}
