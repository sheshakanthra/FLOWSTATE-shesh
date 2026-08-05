import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "@storybook/test";
import { FileText, Plus, Settings } from "lucide-react";
import { CommandPalette, useCommands, type Command } from "./index";

const meta: Meta<typeof CommandPalette> = {
  title: "Primitives/CommandPalette",
};

export default meta;
type Story = StoryObj<typeof CommandPalette>;

/**
 * A3 ships with zero commands registered — later feature tracks register
 * their own via useCommands/registerCommands. This is the true default
 * state of the palette as this session leaves it.
 */
export const Empty: Story = {
  render: () => <CommandPalette defaultOpen />,
  play: async () => {
    await waitFor(() =>
      expect(within(document.body).getByText("No commands available yet.")).toBeVisible(),
    );
  },
};

function WithCommandsDemo({ onSelect = fn() }: { onSelect?: (id: string) => void }) {
  const commands = React.useMemo<Command[]>(
    () => [
      { id: "new-agent", label: "New agent", group: "Create", icon: Plus, onSelect: () => onSelect("new-agent") },
      { id: "new-doc", label: "New document", group: "Create", icon: FileText, onSelect: () => onSelect("new-doc") },
      {
        id: "settings",
        label: "Open settings",
        group: "Navigate",
        icon: Settings,
        shortcut: ["⌘", ","],
        onSelect: () => onSelect("settings"),
      },
    ],
    [onSelect],
  );
  // Mock registration for story purposes only — not a real feature-track call.
  useCommands("story-demo", commands);

  return <CommandPalette defaultOpen />;
}

export const WithCommands: Story = {
  render: () => <WithCommandsDemo />,
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByText("New agent")).toBeVisible());
    await expect(body.getByText("Create")).toBeVisible();
    await expect(body.getByText("Navigate")).toBeVisible();
  },
};

export const KeyboardNav: Story = {
  render: () => <WithCommandsDemo />,
  play: async () => {
    const body = within(document.body);
    const input = body.getByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    // Three commands registered, arrowing down twice lands on "Open settings".
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const NoResults: Story = {
  render: () => <WithCommandsDemo />,
  play: async () => {
    const body = within(document.body);
    const input = body.getByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.type(input, "zzz-no-match");
    await waitFor(() =>
      expect(body.getByText('No commands match "zzz-no-match"')).toBeVisible(),
    );
  },
};
