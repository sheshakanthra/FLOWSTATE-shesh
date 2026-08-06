import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Stepper, type StepperStep } from "./stepper";

const STEPS: StepperStep[] = [
  { id: "trigger", title: "Trigger", description: "What starts this" },
  { id: "config", title: "Configure", description: "Set inputs" },
  { id: "review", title: "Review" },
  { id: "publish", title: "Publish" },
];

const meta: Meta<typeof Stepper> = {
  title: "Primitives/Stepper",
  component: Stepper,
  args: { steps: STEPS, currentStep: "config" },
};

export default meta;
type Story = StoryObj<typeof Stepper>;

export const Horizontal: Story = {};

export const Vertical: Story = {
  args: { orientation: "vertical" },
};

export const WithError: Story = {
  args: { currentStep: "review", errorStep: "review" },
};

export const Interactive: Story = {
  render: function Render() {
    const [current, setCurrent] = useState("review");
    return <Stepper steps={STEPS} currentStep={current} onStepClick={setCurrent} />;
  },
};
