import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "Primitives/Tabs",
  render: (args) => (
    <Tabs {...args} className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="runs">Runs</TabsTrigger>
        <TabsTrigger value="settings" disabled>
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Agent overview and recent activity.</TabsContent>
      <TabsContent value="runs">A list of every run this agent has made.</TabsContent>
      <TabsContent value="settings">Settings unavailable in this view.</TabsContent>
    </Tabs>
  ),
  args: { defaultValue: "overview" },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {};

export const FocusVisible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole("tab", { name: "Overview" })).toHaveFocus();
  },
};

export const SecondTabActive: Story = {
  args: { defaultValue: "runs" },
};
