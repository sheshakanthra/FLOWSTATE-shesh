const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A fixed, hand-built timestamp format -- deliberately not `toLocaleString()`
 * anywhere the result can be part of a Server Component's initial HTML.
 * `toLocaleString()`'s exact output depends on the runtime's ICU data, which
 * can differ between Node's server-side build and a browser's -- a real,
 * commonly-hit source of React hydration mismatches for any date rendered
 * during SSR, not a hypothetical one: it's what silently broke a Radix
 * Select interaction in this session's own e2e testing (a text-content
 * hydration mismatch elsewhere on the page triggered a client-side
 * re-render that unmounted an in-progress dialog interaction mid-click).
 * Built from `Date`'s local-timezone getters (consistent between Node and a
 * browser on the same machine) rather than through any `Intl`/locale
 * formatting path, so there's no ICU-version divergence left to hit.
 */
export function formatTimestamp(date: Date): string {
  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const rawHours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = rawHours >= 12 ? "PM" : "AM";
  const hours = rawHours % 12 || 12;
  return `${month} ${day}, ${year}, ${hours}:${minutes} ${period}`;
}
