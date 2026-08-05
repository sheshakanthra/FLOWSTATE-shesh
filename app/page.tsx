"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";
type Density = "comfortable" | "compact";

const INK_SWATCHES = [
  { label: "ink-000", swatch: "bg-ink-000" },
  { label: "ink-050", swatch: "bg-ink-050" },
  { label: "ink-100", swatch: "bg-ink-100" },
  { label: "ink-200", swatch: "bg-ink-200" },
  { label: "ink-300", swatch: "bg-ink-300" },
  { label: "ink-400", swatch: "bg-ink-400" },
  { label: "ink-500", swatch: "bg-ink-500" },
] as const;

const FG_SWATCHES = [
  { label: "fg-000", text: "text-fg-000" },
  { label: "fg-100", text: "text-fg-100" },
  { label: "fg-200", text: "text-fg-200" },
  { label: "fg-300", text: "text-fg-300" },
] as const;

const SEMANTIC_SWATCHES = [
  { label: "emerald", fg: "text-emerald-fg", bg: "bg-emerald-bg", line: "border-emerald-line" },
  { label: "amber", fg: "text-amber-fg", bg: "bg-amber-bg", line: "border-amber-line" },
  { label: "red", fg: "text-red-fg", bg: "bg-red-bg", line: "border-red-line" },
  { label: "blue", fg: "text-blue-fg", bg: "bg-blue-bg", line: "border-blue-line" },
  { label: "violet", fg: "text-violet-fg", bg: "bg-violet-bg", line: "border-violet-line" },
] as const;

const RADIUS_SWATCHES = [
  { label: "radius-sm", radius: "rounded-sm" },
  { label: "radius-md", radius: "rounded-md" },
  { label: "radius-lg", radius: "rounded-lg" },
  { label: "radius-xl", radius: "rounded-xl" },
] as const;

const TYPE_SPECIMENS = [
  { label: "display-lg", text: "text-display-lg" },
  { label: "display-sm", text: "text-display-sm" },
  { label: "title-lg", text: "text-title-lg" },
  { label: "title-md", text: "text-title-md" },
  { label: "title-sm", text: "text-title-sm" },
  { label: "body", text: "text-body" },
  { label: "label", text: "text-label" },
  { label: "meta", text: "text-meta" },
  { label: "mono-sm", text: "text-mono-sm font-mono" },
] as const;

export default function TokenProofSheet() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [density, setDensity] = useState<Density>("comfortable");

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }

  function toggleDensity() {
    const next = density === "comfortable" ? "compact" : "comfortable";
    setDensity(next);
    document.documentElement.setAttribute("data-density", next);
  }

  return (
    <main className="min-h-screen bg-ink-000 p-section-gap text-fg-000">
      <header className="mb-section-gap flex items-center justify-between border-b border-ink-400 pb-4">
        <div>
          <h1 className="text-title-lg">KILN token proof sheet</h1>
          <p className="text-body text-fg-200">
            Temporary — verifies the token pipeline, not a real screen.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="h-control-height rounded-md border border-ink-400 bg-ink-100 px-4 text-label text-fg-000"
          >
            Theme: {theme}
          </button>
          <button
            type="button"
            onClick={toggleDensity}
            className="h-control-height rounded-md border border-ink-400 bg-ink-100 px-4 text-label text-fg-000"
          >
            Density: {density}
          </button>
        </div>
      </header>

      <section className="mb-section-gap">
        <h2 className="mb-4 text-title-md">Ink</h2>
        <div className="flex flex-wrap gap-4">
          {INK_SWATCHES.map(({ label, swatch }) => (
            <div key={label} className="flex flex-col gap-2">
              <div
                className={cn("h-16 w-16 rounded-md border border-ink-400", swatch)}
                aria-label={`${label} swatch`}
              />
              <span className="text-mono-sm text-fg-200">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-section-gap">
        <h2 className="mb-4 text-title-md">Foreground</h2>
        <div className="flex flex-wrap gap-6">
          {FG_SWATCHES.map(({ label, text }) => (
            <div key={label} className="flex flex-col gap-2">
              <span className={cn("text-title-md", text)}>Aa 123</span>
              <span className="text-mono-sm text-fg-200">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-section-gap">
        <h2 className="mb-4 text-title-md">Semantic triples</h2>
        <div className="flex flex-wrap gap-6">
          {SEMANTIC_SWATCHES.map(({ label, fg, bg, line }) => (
            <div key={label} className="flex flex-col gap-2">
              <div
                className={cn(
                  "flex h-20 w-40 flex-col items-start justify-between rounded-md border p-3",
                  bg,
                  line,
                )}
              >
                <span className={cn("text-label", fg)}>{label}</span>
                <span className="text-mono-sm text-fg-200">fg / bg / line</span>
              </div>
              <span className="text-mono-sm text-fg-200">
                {label}-fg · {label}-bg · {label}-line
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-section-gap">
        <h2 className="mb-4 text-title-md">Radius</h2>
        <div className="flex flex-wrap gap-4">
          {RADIUS_SWATCHES.map(({ label, radius }) => (
            <div key={label} className="flex flex-col gap-2">
              <div className={cn("h-16 w-16 border border-ink-400 bg-ink-100", radius)} />
              <span className="text-mono-sm text-fg-200">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-section-gap">
        <h2 className="mb-4 text-title-md">Type scale</h2>
        <div className="flex flex-col gap-3">
          {TYPE_SPECIMENS.map(({ label, text }) => (
            <div key={label} className="flex items-baseline gap-4">
              <span className="w-24 shrink-0 text-mono-sm text-fg-200">{label}</span>
              <span className={text}>The quick brown fox — 0123456789</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-title-md">Density specimen</h2>
        <div className="flex items-center gap-4">
          <div
            className="flex h-control-height items-center rounded-md border border-ink-400 bg-ink-100 px-4 text-body"
            aria-label="control height specimen"
          >
            control height
          </div>
          <span className="text-mono-sm text-fg-200">comfortable = 40px · compact = 32px</span>
        </div>
      </section>
    </main>
  );
}
