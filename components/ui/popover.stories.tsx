import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";

const meta: Meta<typeof Popover> = {
  title: "Primitives/Popover",
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="secondary">Share</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" aria-label="Share workspace">
        <p className="text-body text-fg-000">Invite people to this workspace by email.</p>
      </PopoverContent>
    </Popover>
  ),
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(within(document.body).getByText(/Invite people/)).toBeVisible());
  },
};

export const NestedInDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Workspace settings</DialogTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary">Share</Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <p className="text-body text-fg-000">Invite people to this workspace by email.</p>
          </PopoverContent>
        </Popover>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open dialog" }));
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("dialog")).toBeVisible());
    await userEvent.click(body.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(body.getByText(/Invite people/)).toBeVisible());

    // Nested overlays close innermost-first: one Escape closes the popover only.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByText(/Invite people/)).not.toBeInTheDocument());
    await expect(body.getByRole("dialog")).toBeVisible();

    // A second Escape closes the dialog.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  },
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
};
