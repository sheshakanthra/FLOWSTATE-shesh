import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  args: { placeholder: "you@company.com" },
};

export default meta;
type Story = StoryObj<typeof Input>;

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
  args: { defaultValue: "ada@kiln.dev" },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "ada@kiln.dev" },
};

export const Error: Story = {
  args: { "aria-invalid": true, defaultValue: "not-an-email" },
};
