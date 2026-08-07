import { Canvas } from "@/features/agents/canvas";

/**
 * No agent lookup this session -- B1 is in-memory only (see the session
 * spec's "no persistence beyond in-memory"), so `id` is unused for now.
 * Workspace membership is already enforced by the (app)/w/[workspace]
 * layout above this route.
 */
export default async function AgentBuildPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  await params;

  return (
    <div className="h-full w-full">
      <Canvas />
    </div>
  );
}
