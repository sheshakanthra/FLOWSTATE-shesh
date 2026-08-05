import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Ticket triage</CardTitle>
        <CardDescription>Routes new support tickets to the right queue.</CardDescription>
      </CardHeader>
      <CardBody>
        <p className="text-body text-fg-100">Last run 4 minutes ago · 212 runs today</p>
      </CardBody>
      <CardFooter>
        <Button size="sm" variant="secondary">
          View runs
        </Button>
        <Button size="sm">Open agent</Button>
      </CardFooter>
    </Card>
  ),
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {};

export const HeaderAndBodyOnly: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Call summarizer</CardTitle>
        <CardDescription>Summarizes recorded sales calls into CRM notes.</CardDescription>
      </CardHeader>
      <CardBody>
        <p className="text-body text-fg-100">Idle</p>
      </CardBody>
    </Card>
  ),
};
