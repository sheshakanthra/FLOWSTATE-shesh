import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton, SkeletonText, SkeletonRow, SkeletonCard } from "./skeleton";

const meta: Meta = {
  title: "Primitives/Skeleton",
  parameters: { a11y: { config: { rules: [{ id: "empty-table-header", enabled: false }] } } },
};

export default meta;
type Story = StoryObj;

export const Block: Story = {
  render: () => <Skeleton className="h-10 w-40" />,
};

export const Text: Story = {
  render: () => (
    <div className="w-80">
      <SkeletonText />
    </div>
  ),
};

export const Row: Story = {
  render: () => (
    <div className="w-full max-w-2xl rounded-md border border-ink-400">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  ),
};

export const CardShape: Story = {
  name: "Card",
  render: () => (
    <div className="w-80">
      <SkeletonCard />
    </div>
  ),
};
