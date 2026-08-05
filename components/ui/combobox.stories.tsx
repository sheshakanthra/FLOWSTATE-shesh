import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Combobox } from "./combobox";

const AGENTS = [
  { value: "triage", label: "Ticket triage" },
  { value: "summarizer", label: "Call summarizer" },
  { value: "outreach", label: "Outreach drafter" },
  { value: "researcher", label: "Lead researcher" },
  { value: "archived", label: "Deprecated router", disabled: true },
];

const meta: Meta<typeof Combobox> = {
  title: "Primitives/Combobox",
  component: Combobox,
  args: {
    items: AGENTS,
    placeholder: "Search agents...",
    "aria-label": "Agent",
  },
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Combobox>;

export const Default: Story = {
  render: (args) => (
    <div className="w-72">
      <Combobox {...args} />
    </div>
  ),
};

export const FocusVisible: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole("combobox")).toHaveFocus();
  },
};

export const Open: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox"));
  },
};

export const Selected: Story = {
  render: (args) => (
    <div className="w-72">
      <Combobox {...args} defaultValue="summarizer" />
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div className="w-72">
      <Combobox {...args} disabled />
    </div>
  ),
};

export const Error: Story = {
  render: (args) => (
    <div className="w-72">
      <Combobox {...args} aria-invalid />
    </div>
  ),
};
