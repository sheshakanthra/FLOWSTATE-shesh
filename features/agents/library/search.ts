import { NODE_CATEGORY_LABELS, type AnyNodeTypeDefinition } from "../nodes/registry";

/** Matches a node type by label, category, or description -- gate item 5.
 *  Plain case-insensitive substring match, no fuzzy scoring: the registry is
 *  ten entries, not thousands, so anything fancier is unearned complexity. */
export function searchNodeTypes(query: string, definitions: readonly AnyNodeTypeDefinition[]): AnyNodeTypeDefinition[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...definitions];

  return definitions.filter((definition) => {
    const haystack = [definition.label, NODE_CATEGORY_LABELS[definition.category], definition.description]
      .join(" ")
      .toLowerCase();
    return haystack.includes(trimmed);
  });
}
