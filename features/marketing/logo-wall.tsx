import { ScrollReveal } from "./scroll-reveal";

/**
 * E1 spec item 7's logo wall. Deliberately generic agency-archetype
 * wordmarks, not real company names or logos -- KILN has no real customers
 * yet in this build, and presenting fabricated brand names as if they were
 * paying customers would be a false claim, not a placeholder. The heading
 * says what the row actually is ("built for agencies like these") rather
 * than implying an endorsement ("trusted by").
 */
const AGENCY_ARCHETYPES = [
  "NORTHWIND STUDIO",
  "CASCADE OPS",
  "REDLINE MEDIA",
  "ARCHWAY DIGITAL",
  "FERNBANK GROWTH",
  "TIDELINE PARTNERS",
];

export function LogoWall() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10">
      <ScrollReveal>
        <p className="text-center text-meta text-fg-200">Built for agencies like these</p>
      </ScrollReveal>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {AGENCY_ARCHETYPES.map((name, index) => (
          <ScrollReveal key={name} delayMs={index * 60}>
            <span className="text-title-sm font-semibold tracking-wide text-fg-300">{name}</span>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}

export default LogoWall;
