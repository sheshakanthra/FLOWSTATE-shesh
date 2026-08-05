import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Tag } from "./tag";

const meta: Meta<typeof Tag> = {
  title: "Primitives/Tag",
  component: Tag,
  args: { children: "billing" },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Default: Story = {};

export const Removable: Story = {
  args: { onRemove: () => {} },
};

export const Hover: Story = {
  args: { onRemove: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("button"));
  },
};

export const FocusVisible: Story = {
  args: { onRemove: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole("button")).toHaveFocus();
  },
};

export const Disabled: Story = {
  args: { onRemove: () => {}, disabled: true },
  parameters: {
    // WCAG 1.4.3 exempts text that's part of an inactive UI component from
    // contrast requirements. The tag is aria-disabled, but axe can't infer
    // that exemption from opacity styling on a non-form <span> the way it
    // does for native `disabled` form controls, so it's scoped off here.
    a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } },
  },
};
