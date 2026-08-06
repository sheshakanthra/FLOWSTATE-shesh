import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Bot, Folder, Workflow } from "lucide-react";
import { TreeView, type TreeNode } from "./tree-view";

const NODES: TreeNode[] = [
  {
    id: "support",
    label: "Support agents",
    icon: Folder,
    children: [
      { id: "triage", label: "Triage bot", icon: Bot },
      { id: "escalation", label: "Escalation bot", icon: Bot },
    ],
  },
  {
    id: "sales",
    label: "Sales agents",
    icon: Folder,
    children: [
      { id: "qualifier", label: "Lead qualifier", icon: Bot },
      { id: "followup", label: "Follow-up writer", icon: Bot, disabled: true },
    ],
  },
  { id: "automations", label: "Automations", icon: Workflow },
];

const meta: Meta<typeof TreeView> = {
  title: "Primitives/TreeView",
  component: TreeView,
  args: { label: "Agents", nodes: NODES, defaultExpandedIds: ["support"] },
};

export default meta;
type Story = StoryObj<typeof TreeView>;

export const Default: Story = {};

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = canvas.getByRole("tree", { name: "Agents" });
    const first = canvas.getByRole("treeitem", { name: "Support agents" });
    first.focus();

    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(canvas.getByRole("treeitem", { name: "Triage bot" })).toHaveFocus());

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(canvas.getByRole("treeitem", { name: "Sales agents" })).toHaveFocus());

    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(canvas.getByRole("treeitem", { name: "Sales agents" })).toHaveAttribute("aria-expanded", "true"),
    );

    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(canvas.getByRole("treeitem", { name: "Sales agents" })).toHaveAttribute("aria-selected", "true"),
    );

    // Typeahead jumps to the next node starting with "a" (Automations).
    await userEvent.keyboard("a");
    await waitFor(() => expect(canvas.getByRole("treeitem", { name: "Automations" })).toHaveFocus());

    expect(tree).toBeVisible();
  },
};
