import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "Primitives/Textarea",
  component: Textarea,
  args: { placeholder: "Describe the automation..." },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("textbox"));
  },
};

export const FocusVisible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole("textbox")).toHaveFocus();
  },
};

export const Filled: Story = {
  args: { defaultValue: "Every Monday at 9am, summarize the weekend's support tickets." },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Every Monday at 9am..." },
};

export const Error: Story = {
  args: { "aria-invalid": true, defaultValue: "" },
};
