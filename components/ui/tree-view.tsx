"use client";

import * as React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface TreeNode {
  id: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  children?: TreeNode[];
}

interface FlatNode {
  node: TreeNode;
  level: number;
  parentId: string | null;
  hasChildren: boolean;
}

function flattenVisible(
  nodes: TreeNode[],
  expanded: Set<string>,
  level = 1,
  parentId: string | null = null,
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    result.push({ node, level, parentId, hasChildren });
    if (hasChildren && expanded.has(node.id)) {
      result.push(...flattenVisible(node.children as TreeNode[], expanded, level + 1, node.id));
    }
  }
  return result;
}

export interface TreeViewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Accessible name for the tree — there's no visible label otherwise. */
  label: string;
  nodes: TreeNode[];
  selectedId?: string;
  defaultSelectedId?: string;
  onSelect?: (id: string) => void;
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
}

const TYPEAHEAD_RESET_MS = 700;

/**
 * Hand-built (no Radix tree primitive exists, same reasoning as Combobox):
 * a WAI-ARIA `tree` with roving tabindex over a flattened list of visible
 * nodes. Arrow keys move/expand/collapse, Enter selects, typing jumps via
 * typeahead — the flattening keeps Up/Down a simple linear walk regardless
 * of depth, which is what makes roving tabindex tractable here.
 */
export const TreeView = React.forwardRef<HTMLDivElement, TreeViewProps>(
  (
    {
      label,
      nodes,
      selectedId: selectedProp,
      defaultSelectedId,
      onSelect,
      expandedIds: expandedProp,
      defaultExpandedIds,
      onExpandedChange,
      className,
      ...props
    },
    forwardedRef,
  ) => {
    const [selectedUncontrolled, setSelectedUncontrolled] = React.useState(defaultSelectedId);
    const selectedId = selectedProp ?? selectedUncontrolled;

    const [expandedUncontrolled, setExpandedUncontrolled] = React.useState<Set<string>>(
      () => new Set(defaultExpandedIds ?? []),
    );
    const expanded = expandedProp ? new Set(expandedProp) : expandedUncontrolled;

    const flat = React.useMemo(() => flattenVisible(nodes, expanded), [nodes, expanded]);

    const [activeId, setActiveId] = React.useState<string | undefined>(
      () => selectedId ?? flat[0]?.node.id,
    );

    React.useEffect(() => {
      if (activeId === undefined || !flat.some((entry) => entry.node.id === activeId)) {
        setActiveId(flat[0]?.node.id);
      }
    }, [flat, activeId]);

    const itemRefs = React.useRef(new Map<string, HTMLDivElement>());
    const containerRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(forwardedRef, () => containerRef.current as HTMLDivElement);

    const typeaheadRef = React.useRef<{
      query: string;
      timeout: ReturnType<typeof setTimeout> | undefined;
    }>({ query: "", timeout: undefined });

    function commitExpanded(next: Set<string>) {
      if (expandedProp === undefined) setExpandedUncontrolled(next);
      onExpandedChange?.(Array.from(next));
    }

    function toggleExpanded(id: string, value: boolean) {
      const next = new Set(expanded);
      if (value) next.add(id);
      else next.delete(id);
      commitExpanded(next);
    }

    function select(id: string) {
      if (selectedProp === undefined) setSelectedUncontrolled(id);
      onSelect?.(id);
    }

    function focusItem(id: string | undefined) {
      if (!id) return;
      setActiveId(id);
      itemRefs.current.get(id)?.focus();
    }

    function handleTypeahead(char: string) {
      const state = typeaheadRef.current;
      if (state.timeout) clearTimeout(state.timeout);
      state.query += char.toLowerCase();
      state.timeout = setTimeout(() => {
        state.query = "";
      }, TYPEAHEAD_RESET_MS);

      const activeIndex = flat.findIndex((entry) => entry.node.id === activeId);
      const ordered = [...flat.slice(activeIndex + 1), ...flat.slice(0, activeIndex + 1)];
      const match = ordered.find(
        (entry) => !entry.node.disabled && entry.node.label.toLowerCase().startsWith(state.query),
      );
      if (match) focusItem(match.node.id);
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      const index = flat.findIndex((entry) => entry.node.id === activeId);
      const current = flat[index];
      if (!current) return;

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          focusItem(flat[Math.min(index + 1, flat.length - 1)]?.node.id);
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          focusItem(flat[Math.max(index - 1, 0)]?.node.id);
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          if (current.hasChildren && !expanded.has(current.node.id)) {
            toggleExpanded(current.node.id, true);
          } else if (current.hasChildren) {
            focusItem(flat[index + 1]?.node.id);
          }
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          if (current.hasChildren && expanded.has(current.node.id)) {
            toggleExpanded(current.node.id, false);
          } else if (current.parentId) {
            focusItem(current.parentId);
          }
          break;
        }
        case "Home": {
          event.preventDefault();
          focusItem(flat[0]?.node.id);
          break;
        }
        case "End": {
          event.preventDefault();
          focusItem(flat[flat.length - 1]?.node.id);
          break;
        }
        case "Enter":
        case " ": {
          event.preventDefault();
          if (!current.node.disabled) select(current.node.id);
          break;
        }
        default: {
          if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            handleTypeahead(event.key);
          }
        }
      }
    }

    return (
      <div
        ref={containerRef}
        role="tree"
        aria-label={label}
        className={cn("flex flex-col outline-none", className)}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {flat.map(({ node, level, hasChildren }) => {
          const isActive = node.id === activeId;
          const isSelected = node.id === selectedId;
          const isExpanded = expanded.has(node.id);
          const Icon = node.icon;

          return (
            <div
              key={node.id}
              ref={(el) => {
                if (el) itemRefs.current.set(node.id, el);
                else itemRefs.current.delete(node.id);
              }}
              role="treeitem"
              aria-selected={isSelected}
              aria-expanded={hasChildren ? isExpanded : undefined}
              aria-disabled={node.disabled}
              aria-level={level}
              tabIndex={isActive ? 0 : -1}
              onFocus={() => setActiveId(node.id)}
              onClick={() => {
                if (node.disabled) return;
                setActiveId(node.id);
                select(node.id);
              }}
              style={{ paddingLeft: `${(level - 1) * 16 + 8}px` }}
              className={cn(
                "flex h-control-height cursor-default items-center gap-1.5 rounded-sm pr-2 text-body text-fg-000 select-none",
                "transition-instant transition-colors",
                "hover:bg-ink-200",
                isSelected && "bg-blue-bg text-blue-fg",
                node.disabled && "pointer-events-none text-fg-300 opacity-50",
                focusRing,
              )}
            >
              {hasChildren ? (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleExpanded(node.id, !isExpanded);
                  }}
                  className="flex size-4 shrink-0 items-center justify-center text-fg-200"
                >
                  <ChevronRight
                    className={cn("size-3.5 transition-instant transition-transform", isExpanded && "rotate-90")}
                  />
                </button>
              ) : (
                <span className="size-4 shrink-0" aria-hidden="true" />
              )}
              {Icon ? <Icon className="size-4 shrink-0 text-fg-200" aria-hidden="true" /> : null}
              <span className="truncate">{node.label}</span>
            </div>
          );
        })}
      </div>
    );
  },
);
TreeView.displayName = "TreeView";
