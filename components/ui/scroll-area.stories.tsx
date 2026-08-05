import type { Meta, StoryObj } from "@storybook/react";
import { ScrollArea } from "./scroll-area";

const meta: Meta<typeof ScrollArea> = {
  title: "Primitives/ScrollArea",
  render: (args) => (
    <ScrollArea {...args} className="h-48 w-64 rounded-md border border-ink-400">
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 30 }, (_, index) => (
          <p key={index} className="text-body text-fg-000">
            Log line {index + 1}
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};

export default meta;
type Story = StoryObj<typeof ScrollArea>;

export const Default: Story = {};
