import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Button } from "./button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  type DrawerSide,
} from "./drawer";

function DrawerDemo({ side }: { side: DrawerSide }) {
  return (
    <Drawer side={side}>
      <DrawerTrigger asChild>
        <Button>Open {side} drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filters</DrawerTitle>
          <DrawerDescription>Narrow down the list by status and owner.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const meta: Meta<typeof Drawer> = {
  title: "Primitives/Drawer",
};

export default meta;
type Story = StoryObj<typeof Drawer>;

export const Right: Story = {
  render: () => <DrawerDemo side="right" />,
};

export const Left: Story = {
  render: () => <DrawerDemo side="left" />,
};

export const Top: Story = {
  render: () => <DrawerDemo side="top" />,
};

export const Bottom: Story = {
  render: () => <DrawerDemo side="bottom" />,
};

export const Open: Story = {
  render: () => <DrawerDemo side="right" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open right drawer" }));
    await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
  },
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
};

export const FocusReturn: Story = {
  render: () => <DrawerDemo side="right" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open right drawer" });
    await userEvent.click(trigger);
    await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
