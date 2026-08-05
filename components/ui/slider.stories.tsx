import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Slider } from "./slider";

const meta: Meta<typeof Slider> = {
  title: "Primitives/Slider",
  render: (args) => (
    <div className="w-64">
      <Slider {...args} />
    </div>
  ),
  args: { label: "Temperature", defaultValue: [40], max: 100, step: 1 },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {};

export const FocusVisible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole("slider")).toHaveFocus();
  },
};

export const Range: Story = {
  args: { label: ["Minimum", "Maximum"], defaultValue: [20, 70] },
};

export const Disabled: Story = {
  args: { disabled: true },
};
