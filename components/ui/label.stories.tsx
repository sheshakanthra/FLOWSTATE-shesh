import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Input } from "./input";

const meta: Meta<typeof Label> = {
  title: "Primitives/Label",
  render: (args) => (
    <div className="flex flex-col gap-1.5">
      <Label {...args} htmlFor="label-demo-input">
        Workspace name
      </Label>
      <Input id="label-demo-input" defaultValue="Acme automations" />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {};

export const DisabledControl: Story = {
  render: (args) => (
    <div className="flex flex-col gap-1.5">
      <Label {...args} htmlFor="label-demo-disabled" className="peer-disabled:opacity-50">
        Workspace name
      </Label>
      <Input id="label-demo-disabled" defaultValue="Acme automations" disabled className="peer" />
    </div>
  ),
};
