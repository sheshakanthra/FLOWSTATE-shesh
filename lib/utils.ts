type ClassValue = string | number | false | null | undefined | Record<string, boolean>;

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) continue;
    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      continue;
    }
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) classes.push(key);
    }
  }

  return classes.join(" ");
}

/**
 * Visible focus-visible outline shared by every interactive primitive, so the
 * ring reads on every surface tier (ink-000 through ink-300) without needing
 * a per-surface ring-offset color. Toggles color only (transparent -> blue),
 * never outline-style/width: Tailwind v4's `outline-none` sets the shared
 * `--tw-outline-style` custom property to "none", which `focus-visible:outline`
 * reads rather than overrides, permanently suppressing the ring regardless of
 * focus state. Keeping outline-style/width constant and toggling only the
 * color sidesteps that, and keeps the ring visible under forced-colors mode.
 */
export const focusRing =
  "outline outline-2 outline-offset-2 outline-transparent focus-visible:outline-blue-fg";
