import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "@storybook/test";
import { SpectralHairline } from "./spectral-hairline";

const meta: Meta<typeof SpectralHairline> = {
  title: "Motion/SpectralHairline",
  component: SpectralHairline,
};

export default meta;
type Story = StoryObj<typeof SpectralHairline>;

export const Default: Story = {
  render: () => (
    <div className="w-80 rounded-md border border-ink-400 bg-ink-100 p-card-padding">
      <p className="text-body text-fg-000">AI-drafted reply</p>
      <div className="mt-3">
        <SpectralHairline />
      </div>
    </div>
  ),
};

function DuplicatedDemo() {
  const [mounted, setMounted] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setMounted(true)}>
        Mount two
      </button>
      {mounted ? (
        <div className="mt-3 flex flex-col gap-2">
          <SpectralHairline />
          <SpectralHairline />
        </div>
      ) : null}
    </div>
  );
}

// Gate item 5: two instances mounted at once must warn in dev. Mounting is
// deferred behind a button (rather than mounted directly by render) so the
// console.warn spy can be installed in `play` before the effect that logs
// the warning actually fires.
export const Duplicated: Story = {
  render: () => <DuplicatedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const original = console.warn;
    const warnSpy = fn();
    console.warn = warnSpy as typeof console.warn;
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Mount two" }));
      await waitFor(() => expect(warnSpy).toHaveBeenCalled());
    } finally {
      console.warn = original;
    }
  },
};
