import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { RadioGroup, RadioGroupItem } from "./radio";

const meta: Meta<typeof RadioGroup> = {
  title: "Primitives/Radio",
  render: (args) => (
    <RadioGroup {...args} aria-label="Trigger">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="schedule" id="r-schedule" />
        <label htmlFor="r-schedule" className="text-body text-fg-000">
          On a schedule
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="webhook" id="r-webhook" />
        <label htmlFor="r-webhook" className="text-body text-fg-000">
          On a webhook
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="manual" id="r-manual" disabled />
        <label htmlFor="r-manual" className="text-body text-fg-300">
          Manually (unavailable)
        </label>
      </div>
    </RadioGroup>
  ),
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = { args: { defaultValue: "schedule" } };

export const FocusVisible: Story = {
  args: { defaultValue: "schedule" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getAllByRole("radio")[0]).toHaveFocus();
  },
};

export const Disabled: Story = { args: { defaultValue: "schedule", disabled: true } };
