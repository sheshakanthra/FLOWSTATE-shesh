import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Plus } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const meta: Meta<typeof Tooltip> = {
  title: "Primitives/Tooltip",
  render: (args) => (
    <TooltipProvider delayDuration={0}>
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <Button size="icon" aria-label="Add node">
            <Plus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add node</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("button", { name: "Add node" }));
    await waitFor(() => expect(within(document.body).getByText("Add node")).toBeVisible());
  },
};

export const OpenOnFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Add node" })).toHaveFocus();
    await waitFor(() => expect(within(document.body).getByText("Add node")).toBeVisible());
  },
};
