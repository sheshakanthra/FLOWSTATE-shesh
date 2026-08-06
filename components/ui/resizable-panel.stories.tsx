import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "@storybook/test";
import { ResizablePanel } from "./resizable-panel";

const meta: Meta<typeof ResizablePanel> = {
  title: "Primitives/ResizablePanel",
  component: ResizablePanel,
};

export default meta;
type Story = StoryObj<typeof ResizablePanel>;

export const Sidebar: Story = {
  render: () => (
    <div className="flex h-64 border border-ink-400">
      <ResizablePanel id="story-sidebar" edge="right" defaultSize={220} min={160} max={360}>
        <div className="flex h-full items-center justify-center bg-ink-100 text-body text-fg-100">Sidebar</div>
      </ResizablePanel>
      <div className="flex flex-1 items-center justify-center bg-ink-050 text-body text-fg-100">Canvas</div>
    </div>
  ),
};

export const KeyboardResize: Story = {
  render: () => (
    <div className="flex h-64 border border-ink-400">
      <ResizablePanel id="story-keyboard-resize" edge="right" defaultSize={220} min={160} max={360}>
        <div className="flex h-full items-center justify-center bg-ink-100 text-body text-fg-100">Sidebar</div>
      </ResizablePanel>
      <div className="flex flex-1 items-center justify-center bg-ink-050 text-body text-fg-100">Canvas</div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole("separator", { name: "Resize panel" });
    expect(handle).toHaveAttribute("aria-valuenow", "220");

    handle.focus();
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "228"));

    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "220"));
  },
};
