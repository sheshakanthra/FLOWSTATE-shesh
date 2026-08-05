import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Button } from "./button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta: Meta<typeof Sheet> = {
  title: "Primitives/Sheet",
  render: (args) => (
    <div>
      <p className="mb-4 max-w-sm text-body text-fg-100">
        The rest of the page (this paragraph, this button) stays interactive while the sheet is
        open — unlike Drawer, Sheet has no backdrop and does not trap focus.
      </p>
      <Button>Unrelated page button</Button>
      <Sheet {...args}>
        <SheetTrigger asChild>
          <Button variant="secondary" className="ml-3">
            Open inspector
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Inspector</SheetTitle>
            <SheetDescription>A non-modal auxiliary panel.</SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <Button variant="secondary">Close</Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const Default: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open inspector" }));
    await waitFor(() => expect(within(document.body).getByText("Inspector")).toBeVisible());
    // Sheet is non-modal: the unrelated page button must remain reachable/enabled.
    await expect(canvas.getByRole("button", { name: "Unrelated page button" })).toBeEnabled();
  },
};
