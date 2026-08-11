import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commitCoalescedEdit, flushCoalescedEdit } from "./graph-undo";
import { undo } from "@/lib/undo/store";

/**
 * Proves the property gate item 3 actually depends on: a burst of rapid
 * edits to the same field collapses into exactly one undo step (undo
 * restores the value from *before the burst started*, not just the
 * second-to-last keystroke), while `apply` still runs on every call so the
 * canvas summary updates live.
 *
 * Verified by draining the real undo stack via `undo()`'s return value
 * (null once empty) rather than the `useUndoStack()` hook -- that hook uses
 * `useSyncExternalStore`, which requires an actual React render to call;
 * `pushUndoEntry`/`undo` are plain functions operating on module state, so
 * driving them directly is both simpler and doesn't depend on React's act()
 * machinery synchronizing with commitCoalescedEdit's setTimeout calls.
 *
 * Real timers (not vi.useFakeTimers()) because `pending` inside
 * graph-undo.ts is module-level, shared with whichever test runs next --
 * every test flushes what it started before finishing, so nothing leaks a
 * scheduled timeout into a later file.
 */
describe("commitCoalescedEdit", () => {
  beforeEach(() => {
    flushCoalescedEdit();
    while (undo()) {
      /* drain any entry left by a previous test */
    }
  });

  afterEach(() => {
    flushCoalescedEdit();
  });

  it("applies every intermediate value live, but pushes only one undo entry after the idle window", async () => {
    const applied: string[] = [];
    const apply = (value: unknown) => applied.push(value as string);

    commitCoalescedEdit({ key: "node-1:prompt", label: "Edited prompt", before: "", after: "H", apply });
    commitCoalescedEdit({ key: "node-1:prompt", label: "Edited prompt", before: "H", after: "He", apply });
    commitCoalescedEdit({ key: "node-1:prompt", label: "Edited prompt", before: "He", after: "Hello", apply });

    expect(applied).toEqual(["H", "He", "Hello"]);
    // Still inside the idle window -- nothing pushed yet.
    expect(undo()).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 350));

    const entry = undo();
    expect(entry?.label).toBe("Edited prompt");
    // Undo restores the value from before the *whole burst*, not "Hello" minus one keystroke.
    expect(applied.at(-1)).toBe("");
    // Exactly one entry was pushed for the whole burst.
    expect(undo()).toBeNull();
  });

  it("a different field starting mid-burst flushes the first field's edit immediately", () => {
    const appliedA: string[] = [];
    const appliedB: string[] = [];

    commitCoalescedEdit({
      key: "node-1:a",
      label: "Edited A",
      before: "",
      after: "x",
      apply: (v) => appliedA.push(v as string),
    });
    commitCoalescedEdit({
      key: "node-1:b",
      label: "Edited B",
      before: "",
      after: "y",
      apply: (v) => appliedB.push(v as string),
    });

    // Field A's single-call burst flushed as soon as field B's edit started.
    const entry = undo();
    expect(entry?.label).toBe("Edited A");
    expect(appliedA.at(-1)).toBe("");
    // Field B is still mid-burst -- not pushed yet.
    expect(undo()).toBeNull();
  });

  it("flushCoalescedEdit forces an in-flight edit to resolve immediately", () => {
    commitCoalescedEdit({ key: "node-1:c", label: "Edited C", before: "old", after: "new", apply: () => {} });
    expect(undo()).toBeNull();

    flushCoalescedEdit();

    expect(undo()?.label).toBe("Edited C");
  });

  it("skips pushing an undo entry when the burst ends back at its starting value", () => {
    const apply = () => {};
    commitCoalescedEdit({ key: "node-1:d", label: "Edited D", before: "same", after: "different", apply });
    commitCoalescedEdit({ key: "node-1:d", label: "Edited D", before: "different", after: "same", apply });
    flushCoalescedEdit();
    expect(undo()).toBeNull();
  });
});
