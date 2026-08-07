import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta: Meta<typeof Dialog> = {
  title: "Primitives/Dialog",
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button>Delete workspace</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete workspace?</DialogTitle>
          <DialogDescription>
            This permanently removes the workspace and everything in it. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger">Delete</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Delete workspace" }));
    // Dialog's enter animation fades opacity over the `base` motion tier —
    // wait for it to settle rather than asserting mid-transition.
    await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          // Radix Dialog aria-hides everything outside its own subtree while
          // open, including the trigger, in a single-DOM-root shell
          // (Storybook's #storybook-root mirrors the real app's #__next) —
          // same known Radix + single-root interaction documented on
          // Select's Open story. FocusScope makes the trigger genuinely
          // unreachable, not a defect here.
          { id: "aria-hidden-focus", enabled: false },
        ],
      },
    },
  },
};

export const FocusReturn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Delete workspace" });
    await userEvent.click(trigger);
    // Dialog's enter animation fades opacity over the `base` motion tier —
    // wait for it to settle rather than asserting mid-transition.
    await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: "aria-hidden-focus", enabled: false },
        ],
      },
    },
  },
};
