import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { SplitPane } from "./split-pane";

const meta: Meta<typeof SplitPane> = {
  title: "Primitives/SplitPane",
  component: SplitPane,
};

export default meta;
type Story = StoryObj<typeof SplitPane>;

export const Horizontal: Story = {
  render: () => (
    <div className="h-72 border border-ink-400">
      <SplitPane
        id="story-split-horizontal"
        primary={<div className="flex h-full items-center justify-center bg-ink-100 text-body text-fg-100">Inspector</div>}
        secondary={<div className="flex h-full items-center justify-center bg-ink-050 text-body text-fg-100">Canvas</div>}
      />
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="h-72 border border-ink-400">
      <SplitPane
        id="story-split-vertical"
        orientation="vertical"
        defaultSize={160}
        min={100}
        max={240}
        primary={<div className="flex h-full items-center justify-center bg-ink-100 text-body text-fg-100">Trace</div>}
        secondary={<div className="flex h-full items-center justify-center bg-ink-050 text-body text-fg-100">Test console</div>}
      />
    </div>
  ),
};

export const PersistsAcrossRemount: Story = {
  render: () => (
    <div className="h-72 border border-ink-400">
      <SplitPane
        id="story-split-persist"
        defaultSize={320}
        min={200}
        max={720}
        primary={<div className="flex h-full items-center justify-center bg-ink-100 text-body text-fg-100">Inspector</div>}
        secondary={<div className="flex h-full items-center justify-center bg-ink-050 text-body text-fg-100">Canvas</div>}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole("separator", { name: "Resize split" });
    handle.focus();
    // Two separate userEvent calls (not two dispatchEvent calls back to back)
    // so React actually commits the first size update before the second
    // keydown's handler reads `size` — matching how two real, physically
    // separate key presses always land relative to renders.
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "328"));
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "336"));
    await waitFor(() =>
      expect(window.localStorage.getItem("kiln:resizable:story-split-persist")).toBe("336"),
    );
  },
};
