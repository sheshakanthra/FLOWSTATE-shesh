import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
  title: "Primitives/Separator",
  component: Separator,
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-64">
      <p className="text-body text-fg-000">Above</p>
      <Separator {...args} className="my-3" />
      <p className="text-body text-fg-000">Below</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: (args) => (
    <div className="flex h-8 items-center gap-3">
      <span className="text-body text-fg-000">Left</span>
      <Separator {...args} orientation="vertical" />
      <span className="text-body text-fg-000">Right</span>
    </div>
  ),
};
