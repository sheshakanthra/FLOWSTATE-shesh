import type { TransformConfig } from "../../nodes/types/transform";
import type { NodeExecutor } from "./types";

/** A dot-path accessor (`"a.b.c"`), not a general expression language --
 *  `input`/`output` are typed `any` in the port system precisely because a
 *  Transform node's job is arbitrary reshaping, but "arbitrary" here means
 *  "pick a nested field out," which a safe path walk covers without
 *  `eval`/`new Function`. An empty expression (the default config) passes
 *  the input through unchanged. */
function resolvePath(value: unknown, path: string): unknown {
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  let current: unknown = value;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export const transformExecutor: NodeExecutor<TransformConfig> = async ({ config, resolvedInput }) => {
  const input = resolvedInput.input;
  const expression = config.expression.trim();
  const output = expression ? resolvePath(input, expression) : input;
  return { output: { output } };
};
