import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { FiringBar, finish, start, update } from "./index";

const meta: Meta<typeof FiringBar> = {
  title: "Motion/FiringBar",
  component: FiringBar,
};

export default meta;
type Story = StoryObj<typeof FiringBar>;

const MOCK_OPERATIONS = Array.from({ length: 12 }, (_, index) => ({
  label: `Job ${index + 1}`,
  initiator: index % 3 === 0 ? "You" : index % 3 === 1 ? "Agent · Iris" : "Teammate · Sam",
  durationMs: 1800 + index * 350,
}));

function TwelveConcurrentDemo() {
  React.useEffect(() => {
    const entries = MOCK_OPERATIONS.map((op) => ({
      ...op,
      id: start({ label: op.label, initiator: op.initiator }),
      done: false,
    }));
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      let allDone = true;
      for (const entry of entries) {
        if (entry.done) continue;
        const progress = Math.min(1, elapsed / entry.durationMs);
        if (progress >= 1) {
          entry.done = true;
          finish(entry.id, "success");
        } else {
          update(entry.id, progress);
          allDone = false;
        }
      }
      if (allDone) window.clearInterval(interval);
    }, 100);
    return () => window.clearInterval(interval);
  }, []);

  return <FiringBar />;
}

// Gate item 1: 12 concurrent mock operations of varying duration. Frame
// rate must be confirmed at 60fps with the browser's Performance panel
// while this story runs — that measurement can't come from a play function.
export const TwelveConcurrent: Story = {
  render: () => <TwelveConcurrentDemo />,
};

function HoverPanelDemo() {
  React.useEffect(() => {
    const idA = start({ label: "Reindex knowledge base", initiator: "Agent · Iris" });
    const idB = start({ label: "Bulk update 40 contacts", initiator: "You" });
    const interval = window.setInterval(() => {
      update(idA, Math.random());
      update(idB, Math.random());
    }, 500);
    return () => {
      window.clearInterval(interval);
      finish(idA, "cancelled");
      finish(idB, "cancelled");
    };
  }, []);

  return <FiringBar />;
}

// Gate item 2: hovering (here, focusing the keyboard-accessible trigger)
// lists every live operation with elapsed time; cancel removes the segment.
export const HoverPanel: Story = {
  render: () => <HoverPanelDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /operations running/ });
    await userEvent.click(trigger);

    await waitFor(() =>
      expect(within(document.body).getByText("Reindex knowledge base")).toBeVisible(),
    );
    expect(within(document.body).getByText("Bulk update 40 contacts")).toBeVisible();

    const cancelButton = within(document.body).getByRole("button", {
      name: "Cancel Reindex knowledge base",
    });
    await userEvent.click(cancelButton);

    await waitFor(
      () =>
        expect(
          within(document.body).queryByText("Reindex knowledge base"),
        ).not.toBeInTheDocument(),
      { timeout: 2000 },
    );
  },
};

// Gate item 4: under reduced motion, segments should appear/disappear with
// no animation. Toggle the "Motion" toolbar item to "Reduce" while viewing
// this story to confirm — the mock operations still run identically.
export const ReducedMotion: Story = {
  render: () => <TwelveConcurrentDemo />,
  globals: { motion: "reduce" },
};
