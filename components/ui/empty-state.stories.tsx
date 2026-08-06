import type { Meta, StoryObj } from "@storybook/react";
import { Bot, Inbox, Search } from "lucide-react";
import { EmptyState } from "./empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "Patterns/EmptyState",
  component: EmptyState,
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const NoAgents: Story = {
  args: {
    icon: Bot,
    title: "No agents yet",
    description: "Build your first agent to start automating a workflow.",
    action: { label: "New agent", onClick: () => {} },
  },
};

export const NoSearchResults: Story = {
  name: "No search results",
  args: {
    icon: Search,
    title: "No results for “invoice sync”",
    description: "Check the spelling, or broaden the search to all workspaces.",
    action: { label: "Search all workspaces", onClick: () => {} },
    secondaryAction: { label: "Clear search", onClick: () => {}, variant: "ghost" },
  },
};

export const InboxZero: Story = {
  name: "Inbox zero",
  args: {
    icon: Inbox,
    title: "Nothing needs your attention",
    description: "New approvals and failed runs will show up here as they happen.",
    action: { label: "Go to Today", onClick: () => {} },
  },
};
