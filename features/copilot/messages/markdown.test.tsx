import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";
import type { StreamCitation } from "../stream/client";

const citations: StreamCitation[] = [
  { id: "run-1", type: "run", label: "Lead Qualifier — failed run", href: "/w/acme/agents/a1/runs/run-1" },
];

describe("Markdown", () => {
  it("renders headings, bold, and inline code", () => {
    render(<Markdown content={"## Summary\n\nThree runs **failed**, use `retry()` to recover."} citations={[]} />);
    expect(screen.getByRole("heading", { level: 2, name: "Summary" })).toBeInTheDocument();
    expect(screen.getByText("failed")).toHaveClass("font-semibold");
    expect(screen.getByText("retry()").tagName).toBe("CODE");
  });

  it("renders a fenced code block via CodeBlock, with a copy control", () => {
    render(<Markdown content={"```js\nconst x = 1;\n```"} citations={[]} />);
    expect(screen.getByText("js")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy code/i })).toBeInTheDocument();
  });

  it("renders a CitationPill for a marker that resolves against the message's citations", () => {
    render(<Markdown content="Lead Qualifier failed twice this week [cite:run-1]." citations={citations} />);
    expect(screen.getByRole("link", { name: /lead qualifier/i })).toHaveAttribute("href", "/w/acme/agents/a1/runs/run-1");
  });

  it("marks an uncited, digit-bearing sentence as unverified", () => {
    render(<Markdown content="Lead Qualifier cost $42 last week." citations={[]} />);
    const marked = screen.getByTitle("No citation found for this claim about workspace data.");
    expect(marked).toHaveTextContent("Lead Qualifier cost $42 last week.");
  });

  it("does not mark a sentence that carries a resolved citation", () => {
    render(<Markdown content="Lead Qualifier failed 2 times this week [cite:run-1]." citations={citations} />);
    expect(screen.queryByTitle("No citation found for this claim about workspace data.")).not.toBeInTheDocument();
  });

  it("does not treat a citation-shaped string inside a code fence as a pill", () => {
    const { container } = render(<Markdown content={"```\nconst note = \"[cite:run-1]\";\n```"} citations={citations} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.textContent).toContain("[cite:run-1]");
  });
});
