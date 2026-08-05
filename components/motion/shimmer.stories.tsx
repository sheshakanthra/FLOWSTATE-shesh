import type { Meta, StoryObj } from "@storybook/react";
import { Shimmer } from "./shimmer";

const meta: Meta<typeof Shimmer> = {
  title: "Motion/Shimmer",
  component: Shimmer,
};

export default meta;
type Story = StoryObj<typeof Shimmer>;

export const OnACard: Story = {
  render: () => (
    <Shimmer className="w-80 rounded-md border border-ink-400 bg-ink-100 p-card-padding">
      <p className="text-title-sm text-fg-000">Onboarding agent</p>
      <p className="mt-1 text-body text-fg-100">Drafting the welcome sequence…</p>
    </Shimmer>
  ),
};

// Gate item 3: Shimmer must stay smooth with 40 child elements inside the
// wrapped surface — check the Performance panel's frame rate while this
// story is mounted, don't estimate from the code.
export const FortyChildren: Story = {
  render: () => (
    <Shimmer className="grid w-[480px] grid-cols-8 gap-1 rounded-md border border-ink-400 bg-ink-100 p-card-padding">
      {Array.from({ length: 40 }, (_, index) => (
        <div key={index} className="flex h-10 items-center justify-center rounded-sm bg-ink-200 text-meta text-fg-100">
          {index + 1}
        </div>
      ))}
    </Shimmer>
  ),
};
