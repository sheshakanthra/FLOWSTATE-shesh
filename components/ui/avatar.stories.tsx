import type { Meta, StoryObj } from "@storybook/react";
import { Avatar, AvatarGroup } from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "Primitives/Avatar",
  component: Avatar,
  args: { fallback: "AL", alt: "Ada Lovelace" },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} size="sm" />
      <Avatar {...args} size="md" />
      <Avatar {...args} size="lg" />
    </div>
  ),
};

export const FallbackOnly: Story = {
  args: { fallback: "KL", src: undefined },
};

export const Group: Story = {
  render: () => (
    <AvatarGroup
      avatars={[
        { fallback: "AL", alt: "Ada Lovelace" },
        { fallback: "GH", alt: "Grace Hopper" },
        { fallback: "MH", alt: "Margaret Hamilton" },
        { fallback: "KJ", alt: "Katherine Johnson" },
        { fallback: "RF", alt: "Radia Perlman" },
      ]}
      max={4}
    />
  ),
};
