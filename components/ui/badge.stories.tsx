import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",
  component: Badge,
  args: { children: "Succeeded" },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutral">Draft</Badge>
      <Badge variant="emerald">Succeeded</Badge>
      <Badge variant="amber">Pending</Badge>
      <Badge variant="red">Failed</Badge>
      <Badge variant="blue">Selected</Badge>
      <Badge variant="violet">Marketplace</Badge>
    </div>
  ),
};
