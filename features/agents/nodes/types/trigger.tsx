import { Zap } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

const configSchema = z.object({
  triggerType: z.enum(["manual", "webhook", "schedule", "event"]),
  schedule: z.string(),
});

export type TriggerConfig = z.infer<typeof configSchema>;

const TRIGGER_TYPE_LABEL: Record<TriggerConfig["triggerType"], string> = {
  manual: "Manual trigger",
  webhook: "Webhook trigger",
  schedule: "Scheduled trigger",
  event: "Event trigger",
};

export const triggerNodeType: NodeTypeDefinition<TriggerConfig> = {
  id: "trigger",
  label: "Trigger",
  description: "Starts a run — manually, on a schedule, from a webhook, or on an event.",
  icon: Zap,
  category: "trigger",
  inputs: [],
  outputs: [{ id: "out", label: "trigger", type: "signal" }],
  configSchema,
  defaultConfig: { triggerType: "manual", schedule: "" },
  summary: (config) =>
    config.triggerType === "schedule" && config.schedule
      ? `Schedule: ${config.schedule}`
      : TRIGGER_TYPE_LABEL[config.triggerType],
};
