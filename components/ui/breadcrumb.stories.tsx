import type { Meta, StoryObj } from "@storybook/react";
import { Breadcrumb } from "./breadcrumb";

const meta: Meta<typeof Breadcrumb> = {
  title: "Primitives/Breadcrumb",
  component: Breadcrumb,
  args: {
    items: [
      { label: "Agents", href: "#" },
      { label: "Support triage", href: "#" },
      { label: "Runs" },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const Default: Story = {};

export const TwoLevels: Story = {
  args: { items: [{ label: "Agents", href: "#" }, { label: "Support triage" }] },
};
