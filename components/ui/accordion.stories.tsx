import type { Meta, StoryObj } from "@storybook/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";

const meta: Meta<typeof Accordion> = {
  title: "Primitives/Accordion",
  component: Accordion,
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Single: Story = {
  render: () => (
    <Accordion type="single" collapsible defaultValue="trigger" className="w-96">
      <AccordionItem value="trigger">
        <AccordionTrigger>Trigger</AccordionTrigger>
        <AccordionContent>
          Fires when a webhook is received, a schedule elapses, or another agent hands off.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="config">
        <AccordionTrigger>Configuration</AccordionTrigger>
        <AccordionContent>Set the inputs this agent expects on every run.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="retries">
        <AccordionTrigger>Retries</AccordionTrigger>
        <AccordionContent>Failed runs retry up to 3 times with exponential backoff.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Multiple: Story = {
  render: () => (
    <Accordion type="multiple" defaultValue={["trigger", "config"]} className="w-96">
      <AccordionItem value="trigger">
        <AccordionTrigger>Trigger</AccordionTrigger>
        <AccordionContent>Fires when a webhook is received.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="config">
        <AccordionTrigger>Configuration</AccordionTrigger>
        <AccordionContent>Set the inputs this agent expects on every run.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
