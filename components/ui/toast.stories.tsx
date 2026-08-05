import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Button } from "./button";
import { toast, Toaster } from "./toast";

const meta: Meta = {
  title: "Primitives/Toast",
  render: () => (
    <div>
      <Button
        onClick={() =>
          toast({ title: "Agent published", description: "v3 is now live for all users." })
        }
      >
        Show toast
      </Button>
      <Toaster />
    </div>
  ),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};

export const WithAction: Story = {
  render: () => (
    <div>
      <Button
        onClick={() =>
          toast({
            title: "Run failed",
            description: "The last node threw an error.",
            variant: "danger",
            action: { label: "Retry", onClick: () => {} },
          })
        }
      >
        Show error toast
      </Button>
      <Toaster />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Show error toast" }));
    await waitFor(() => expect(within(document.body).getByText("Run failed")).toBeVisible());
  },
};

export const Stack: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Show toast" });
    for (let i = 0; i < 6; i += 1) {
      await userEvent.click(trigger);
    }
    // Gate item 7: 6 rapid toasts never overflow the viewport — the store
    // caps the mounted stack at 5 with FIFO eviction of the oldest. The
    // evicted toast still plays its exit animation (AnimatePresence keeps
    // it mounted for the `base` transition), so wait past that before
    // counting rather than asserting on the transient 6-node frame.
    await waitFor(
      () => {
        const items = within(document.body).getAllByText("Agent published");
        expect(items.length).toBeLessThanOrEqual(5);
      },
      { timeout: 1000 },
    );
  },
};
