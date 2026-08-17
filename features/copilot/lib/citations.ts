import type { CitationRecord } from "@/lib/repos/copilot";
import type { RetrievedRecord } from "./retrieve";

/**
 * Resolves every `[cite:ID]` marker in a model's raw output against the set
 * `retrieve.ts` actually found -- the enforcement half of the spec's own
 * Notes ("do not let the model invent citation targets; resolve against the
 * retrieved set and drop anything unmatched"). Extracted out of
 * app/api/copilot/stream/route.ts so it has one definition covering both a
 * completed answer and a partial one persisted after Stop (gate item 5) --
 * the route calls this in both places -- and so it can be unit-tested
 * without a live SSE stream.
 */
export function resolveCitations(
  content: string,
  retrieved: RetrievedRecord[],
): { content: string; citations: CitationRecord[] } {
  const byId = new Map(retrieved.map((record) => [record.id, record]));
  const citations: CitationRecord[] = [];
  const seen = new Set<string>();

  const cleaned = content.replace(/\[cite:([^\]]+)\]/g, (_full, rawId: string) => {
    const record = byId.get(rawId.trim());
    if (!record) return ""; // Unmatched id -- dropped, never rendered.
    if (!seen.has(record.id)) {
      seen.add(record.id);
      citations.push({ id: record.id, type: record.type, label: record.label, href: record.href });
    }
    return `[cite:${record.id}]`;
  });

  return { content: cleaned, citations };
}
