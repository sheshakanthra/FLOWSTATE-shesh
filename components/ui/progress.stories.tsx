import type { Meta, StoryObj } from "@storybook/react";
import { Progress, ProgressRadial } from "./progress";

const meta: Meta = {
  title: "Primitives/Progress",
};

export default meta;
type Story = StoryObj;

export const Linear: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <Progress label="Embedding documents" value={64} showValue />
      <Progress variant="emerald" value={100} label="Deploy" showValue />
      <Progress variant="red" value={30} label="Sync" showValue />
      <Progress label="Working" />
    </div>
  ),
};

export const Radial: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <ProgressRadial label="Embedding" value={72} showValue />
      <ProgressRadial label="Deploy" value={100} variant="emerald" showValue />
      <ProgressRadial label="Sync" variant="amber" size={56} strokeWidth={5} value={40} showValue />
      <ProgressRadial label="Working" />
    </div>
  ),
};
