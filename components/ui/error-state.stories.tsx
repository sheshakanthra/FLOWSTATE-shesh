import type { Meta, StoryObj } from "@storybook/react";
import { WifiOff } from "lucide-react";
import { ErrorState } from "./error-state";

const meta: Meta<typeof ErrorState> = {
  title: "Patterns/ErrorState",
  component: ErrorState,
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const RunFailed: Story = {
  args: {
    title: "The last node threw an error",
    description: "The HTTP request node returned a 500. Check the trace, then retry the run.",
    retryLabel: "Retry run",
    onRetry: () => {},
  },
};

export const LoadFailed: Story = {
  name: "Failed to load",
  args: {
    title: "Couldn't load this agent",
    description: "The request timed out after 10 seconds. Your connection may be unstable.",
    retryLabel: "Try again",
    onRetry: () => {},
  },
};

export const ConnectionLost: Story = {
  args: {
    icon: WifiOff,
    title: "Connection lost",
    description: "Changes stopped syncing 2 minutes ago. Reconnect to keep editing.",
    retryLabel: "Reconnect",
    onRetry: () => {},
  },
};
