import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { FormField } from "./form-field";
import { Input } from "./input";
import { Textarea } from "./textarea";

const meta: Meta<typeof FormField> = {
  title: "Primitives/FormField",
  component: FormField,
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const Default: Story = {
  args: {
    label: "Workspace name",
    children: <Input placeholder="Acme automations" />,
  },
};

export const WithDescription: Story = {
  args: {
    label: "Webhook URL",
    description: "We'll POST run results here as they finish.",
    children: <Input placeholder="https://" />,
  },
};

export const Required: Story = {
  args: {
    label: "Agent name",
    required: true,
    children: <Input placeholder="Ticket triage" />,
  },
};

export const Disabled: Story = {
  args: {
    label: "Workspace name",
    description: "Managed by your organization admin.",
    children: <Input defaultValue="Acme automations" disabled />,
  },
};

export const ErrorState: Story = {
  args: {
    label: "Prompt",
    error: "Prompt can't be empty.",
    children: <Textarea placeholder="You are a helpful assistant..." />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByPlaceholderText("You are a helpful assistant...");
    const errorMessage = canvas.getByRole("alert");

    await expect(control).toHaveAttribute("aria-invalid", "true");
    await expect(control).toHaveAttribute("aria-describedby", errorMessage.id);
    await expect(errorMessage).toHaveTextContent("Prompt can't be empty.");
  },
};

export const DescriptionAndError: Story = {
  args: {
    label: "Prompt",
    description: "Shown to the agent before every run.",
    error: "Prompt can't be empty.",
    children: <Textarea placeholder="You are a helpful assistant..." />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByPlaceholderText("You are a helpful assistant...");
    const errorMessage = canvas.getByRole("alert");
    const describedBy = control.getAttribute("aria-describedby") ?? "";

    await expect(control).toHaveAttribute("aria-invalid", "true");
    await expect(describedBy.split(" ")).toContain(errorMessage.id);
  },
};
