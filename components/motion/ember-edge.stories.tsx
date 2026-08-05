import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { EmberEdge } from "./ember-edge";

const meta: Meta<typeof EmberEdge> = {
  title: "Motion/EmberEdge",
  component: EmberEdge,
};

export default meta;
type Story = StoryObj<typeof EmberEdge>;

function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-24 w-80 overflow-hidden rounded-md border border-ink-400 bg-ink-100">
      {children}
    </div>
  );
}

export const Indeterminate: Story = {
  render: () => (
    <Surface>
      <EmberEdge />
    </Surface>
  ),
};

export const Progress: Story = {
  render: function Render() {
    const [progress, setProgress] = React.useState(0.35);
    return (
      <div className="flex flex-col gap-3">
        <Surface>
          <EmberEdge progress={progress} />
        </Surface>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={progress}
          onChange={(event) => setProgress(Number(event.target.value))}
          aria-label="Progress"
        />
      </div>
    );
  },
};
