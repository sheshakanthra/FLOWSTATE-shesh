import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "./page-header";

const meta: Meta<typeof PageHeader> = {
  title: "Patterns/PageHeader",
  component: PageHeader,
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: "Support triage",
    breadcrumb: [{ label: "Agents", href: "#" }, { label: "Support triage" }],
    description: "Routes incoming tickets to the right queue and drafts a first response.",
    actions: (
      <Button>
        <Plus className="size-4" aria-hidden="true" />
        New version
      </Button>
    ),
  },
};

export const WithTabs: Story = {
  // The tab strip lives in PageHeader's `tabs` slot, but TabsContent is real
  // page body below it — both need the same Tabs.Root, so it wraps both here
  // rather than being passed through the slot itself.
  render: () => (
    <Tabs defaultValue="canvas">
      <PageHeader
        title="Support triage"
        breadcrumb={[{ label: "Agents", href: "#" }, { label: "Support triage" }]}
        description="Routes incoming tickets to the right queue and drafts a first response."
        actions={<Button>Publish</Button>}
        tabs={
          <TabsList>
            <TabsTrigger value="canvas">Canvas</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
          </TabsList>
        }
      />
      <TabsContent value="canvas">Canvas content</TabsContent>
      <TabsContent value="runs">Runs content</TabsContent>
      <TabsContent value="versions">Versions content</TabsContent>
    </Tabs>
  ),
};

export const Minimal: Story = {
  args: { title: "Today" },
};
