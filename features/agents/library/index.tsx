"use client";

import * as React from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, focusRing } from "@/lib/utils";
import {
  NODE_CATEGORY_LABELS,
  createNode,
  listNodeTypes,
  type AnyNodeTypeDefinition,
  type NodeCategory,
} from "../nodes/registry";
import { useGraphStore } from "../store/graph-store";
import { useCanvasStore } from "../store/canvas-store";
import { registerGraphUndo } from "../lib/graph-undo";
import { searchNodeTypes } from "./search";

/** Custom drag MIME type carrying the node type id being dragged from the
 *  library onto the canvas -- read back by canvas/index.tsx's onDrop. */
export const NODE_LIBRARY_DRAG_MIME = "application/x-kiln-node-type";

const CATEGORY_ORDER: NodeCategory[] = ["trigger", "ai", "action", "flow", "data", "output", "human"];

interface CategoryGroup {
  category: NodeCategory;
  items: AnyNodeTypeDefinition[];
}

function groupByCategory(definitions: AnyNodeTypeDefinition[]): CategoryGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: definitions.filter((definition) => definition.category === category),
  })).filter((group) => group.items.length > 0);
}

/**
 * Searchable, category-grouped panel of every registered node type --
 * drag-to-canvas (native HTML5 drag and drop, read back in
 * canvas/index.tsx's onDrop) and click/Enter-to-insert-at-center. Docked as
 * a <Panel> inside the canvas rather than a floating overlay layer (same
 * border/bg treatment as Controls/MiniMap, no shadow-floating -- it's part
 * of the canvas chrome, not a dialog/popover/command-palette-class surface).
 */
export function NodeLibraryPanel() {
  const reactFlow = useReactFlow();
  const addNode = useGraphStore((state) => state.addNode);
  const setSelection = useGraphStore((state) => state.setSelection);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const allDefinitions = React.useMemo(() => listNodeTypes(), []);
  const results = React.useMemo(() => searchNodeTypes(query, allDefinitions), [query, allDefinitions]);
  const groups = React.useMemo(() => groupByCategory(results), [results]);
  const flatIds = React.useMemo(() => results.map((definition) => definition.id), [results]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const insertAtCenter = React.useCallback(
    (typeId: string) => {
      const center = reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const node = createNode(typeId, center);
      addNode(node);
      setSelection([node.id], []);
      useCanvasStore.getState().setSelectedNodeIds([node.id]);
      registerGraphUndo(
        "Added node",
        () => useGraphStore.getState().removeNodesWithEdges([node.id]),
        () => useGraphStore.getState().restoreFragment([node], []),
      );
    },
    [reactFlow, addNode, setSelection],
  );

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (flatIds.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, flatIds.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const typeId = flatIds[activeIndex];
        if (typeId) insertAtCenter(typeId);
      }
    },
    [flatIds, activeIndex, insertAtCenter],
  );

  const handleDragStart = React.useCallback((event: React.DragEvent, typeId: string) => {
    event.dataTransfer.setData(NODE_LIBRARY_DRAG_MIME, typeId);
    event.dataTransfer.effectAllowed = "copy";
  }, []);

  return (
    <Panel
      position="top-left"
      className="!m-4 flex max-h-[calc(100%-2rem)] w-64 flex-col overflow-hidden rounded-md border border-ink-400 bg-ink-200"
    >
      <div className="flex items-center gap-2 border-b border-ink-400/60 px-2.5 py-2">
        <Search className="size-4 shrink-0 text-fg-200" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search nodes…"
          aria-label="Search node types"
          role="combobox"
          aria-expanded="true"
          aria-controls="node-library-listbox"
          aria-activedescendant={flatIds[activeIndex] ? `node-library-option-${flatIds[activeIndex]}` : undefined}
          className={cn(
            "h-6 w-full rounded-sm bg-transparent text-body text-fg-000 placeholder:text-fg-300 outline-none",
            focusRing,
          )}
        />
      </div>
      <ScrollArea className="max-h-96">
        <div id="node-library-listbox" role="listbox" aria-label="Node types" className="flex flex-col gap-1 p-2">
          {groups.length === 0 ? (
            <p className="px-2 py-4 text-center text-meta text-fg-200">No nodes found.</p>
          ) : (
            groups.map((group) => (
              <div key={group.category}>
                <div className="px-2 py-1 text-meta text-fg-200" role="presentation">
                  {NODE_CATEGORY_LABELS[group.category]}
                </div>
                {group.items.map((definition) => {
                  const index = flatIds.indexOf(definition.id);
                  const isActive = index === activeIndex;
                  const Icon = definition.icon;
                  return (
                    <div
                      key={definition.id}
                      id={`node-library-option-${definition.id}`}
                      role="option"
                      aria-selected={isActive}
                      draggable
                      onDragStart={(event) => handleDragStart(event, definition.id)}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => insertAtCenter(definition.id)}
                      title={definition.description}
                      className={cn(
                        "flex cursor-grab items-center gap-2 rounded-sm px-2 py-1.5 text-body text-fg-000 select-none",
                        "transition-instant transition-colors",
                        isActive && "bg-ink-300",
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-fg-200" aria-hidden="true" />
                      <span className="truncate">{definition.label}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Panel>
  );
}
