import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Avatar } from "./avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

const meta: Meta<typeof HoverCard> = {
  title: "Primitives/HoverCard",
  render: (args) => (
    <HoverCard {...args} openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <button type="button" className="inline-flex items-center gap-2 text-body text-fg-000">
          <Avatar fallback="JK" />
          Jamie Kim
        </button>
      </HoverCardTrigger>
      <HoverCardContent>
        <p className="text-label font-medium text-fg-000">Jamie Kim</p>
        <p className="mt-1 text-body text-fg-100">Automation lead. 12 agents shipped this quarter.</p>
      </HoverCardContent>
    </HoverCard>
  ),
};

export default meta;
type Story = StoryObj<typeof HoverCard>;

export const Default: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("button", { name: /Jamie Kim/ }));
    await waitFor(() => expect(within(document.body).getByText(/Automation lead/)).toBeVisible());
  },
};
