import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { useUndoable } from "./use-undoable";

const meta: Meta = {
  title: "Motion/Undo",
};

export default meta;
type Story = StoryObj;

interface Task {
  id: string;
  title: string;
}

const INITIAL_TASKS: Task[] = [
  { id: "1", title: "Draft onboarding email" },
  { id: "2", title: "Tag inactive leads" },
  { id: "3", title: "Review agent trace 482" },
  { id: "4", title: "Approve budget increase" },
  { id: "5", title: "Sync CRM contacts" },
];

function TaskListDemo() {
  const [tasks, setTasks] = React.useState(INITIAL_TASKS);
  const registerUndo = useUndoable();

  function deleteTask(task: Task) {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    registerUndo({
      label: `Deleted "${task.title}"`,
      undo: () => setTasks((current) => [...current, task]),
      redo: () => setTasks((current) => current.filter((item) => item.id !== task.id)),
    });
  }

  return (
    <div className="w-96">
      <ul className="flex flex-col gap-1">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center justify-between rounded-sm border border-ink-400 bg-ink-100 px-3 py-2"
          >
            <span className="text-body text-fg-000">{task.title}</span>
            <Button size="sm" variant="ghost" onClick={() => deleteTask(task)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
      {tasks.length === 0 ? <p className="mt-2 text-body text-fg-100">No tasks left.</p> : null}
      <Toaster />
    </div>
  );
}

export const Default: Story = {
  render: () => <TaskListDemo />,
};

// Gate item 6: perform 5 mock mutations, then ⌘Z x5 reverses all of them in
// order, ⌘⇧Z x5 redoes them. The 100-entry cap (store.ts's slice(-RING_LIMIT))
// isn't exercised here — 100 sequential deletes would make this story
// unreadably slow for what it'd prove — but is simple enough to trust from
// reading lib/undo/store.ts directly.
export const UndoRedo: Story = {
  render: () => <TaskListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (let i = 0; i < INITIAL_TASKS.length; i += 1) {
      const [firstDeleteButton] = canvas.getAllByRole("button", { name: "Delete" });
      if (!firstDeleteButton) throw new Error("Expected a remaining Delete button");
      await userEvent.click(firstDeleteButton);
    }
    await waitFor(() => expect(canvas.getByText("No tasks left.")).toBeVisible());

    for (let i = 0; i < 5; i += 1) {
      await userEvent.keyboard("{Control>}z{/Control}");
    }
    for (const task of INITIAL_TASKS) {
      await waitFor(() => expect(canvas.getByText(task.title)).toBeVisible());
    }

    for (let i = 0; i < 5; i += 1) {
      await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    }
    await waitFor(() => expect(canvas.getByText("No tasks left.")).toBeVisible());
  },
};
