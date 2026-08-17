"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { splitSentences } from "../lib/sentences";
import type { StreamCitation } from "../stream/client";
import { CitationPill } from "./citation-pill";
import { CodeBlock } from "./code-block";

/**
 * A hand-rolled block-level Markdown parser -- no `react-markdown`/`remark`
 * in CLAUDE.md's dependency table (see this session's own decision to
 * hand-build markdown+highlighting rather than add one, matching A2's
 * Combobox/A5's TreeView precedent for primitives Radix or the stack table
 * doesn't cover). Covers exactly what the spec names: headers, bold/italic,
 * inline code, fenced code blocks, tables, ordered/unordered lists,
 * blockquotes, links -- not the full CommonMark grammar (no nested
 * blockquotes, no nested lists, no reference-style links).
 *
 * Re-parses the full string on every render rather than diffing against the
 * previous content. At the sizes a chat message reaches (low thousands of
 * characters, per gate item 2's own "2000-token response") a handful of
 * linear regex passes is sub-millisecond work -- cheap enough that
 * re-parsing per streamed token is the simple, correct choice rather than an
 * optimization to reach for.
 */
type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "hr" };

const FENCE = /^```(\w*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const HR = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^>\s?/;
const UL_ITEM = /^\s*[-*+]\s+/;
const OL_ITEM = /^\s*\d+[.)]\s+/;
const TABLE_ROW = /^\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") {
      i++;
      continue;
    }

    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const language = fenceMatch[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing fence, if the stream hasn't produced one yet this just reaches the end
      blocks.push({ type: "code", language, code: codeLines.join("\n") });
      continue;
    }

    const headingMatch = line.match(HEADING);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1]!.length as 1 | 2 | 3 | 4 | 5 | 6, text: headingMatch[2]!.trim() });
      i++;
      continue;
    }

    if (HR.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) {
        quoteLines.push(lines[i]!.replace(QUOTE, ""));
        i++;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }

    if (TABLE_ROW.test(line) && lines[i + 1] && TABLE_SEPARATOR.test(lines[i + 1]!)) {
      const header = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i]!)) {
        rows.push(splitTableRow(lines[i]!));
        i++;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (UL_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_ITEM.test(lines[i]!)) {
        items.push(lines[i]!.replace(UL_ITEM, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (OL_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_ITEM.test(lines[i]!)) {
        items.push(lines[i]!.replace(OL_ITEM, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !FENCE.test(lines[i]!) &&
      !HEADING.test(lines[i]!) &&
      !QUOTE.test(lines[i]!) &&
      !UL_ITEM.test(lines[i]!) &&
      !OL_ITEM.test(lines[i]!) &&
      !HR.test(lines[i]!.trim())
    ) {
      paraLines.push(lines[i]!);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

const INLINE_PATTERN =
  /\[cite:([^\]]+)\]|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\)/g;

function renderInline(text: string, citations: Map<string, StreamCitation>, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));

    if (match[1] !== undefined) {
      const citation = citations.get(match[1].trim());
      if (citation) nodes.push(<CitationPill key={`${keyPrefix}-c${key++}`} citation={citation} />);
    } else if (match[2] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-code${key++}`} className="rounded-sm bg-ink-200 px-1 py-0.5 font-mono text-[0.9em] text-fg-000">
          {match[2]}
        </code>,
      );
    } else if (match[3] !== undefined || match[4] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b${key++}`} className="font-semibold text-fg-000">
          {match[3] ?? match[4]}
        </strong>,
      );
    } else if (match[5] !== undefined || match[6] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${key++}`}>{match[5] ?? match[6]}</em>);
    } else if (match[7] !== undefined && match[8] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-a${key++}`}
          href={match[8]}
          target="_blank"
          rel="noreferrer"
          className="text-blue-fg underline underline-offset-2 hover:text-blue-fg/80"
        >
          {match[7]}
        </a>,
      );
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/**
 * Session spec item 5 / gate item 5: a sentence that reads as a claim about
 * workspace data (it isn't already backed by a `[cite:ID]` marker, and it
 * contains a digit -- the cheapest available proxy for "specific,
 * checkable, quantitative") gets wrapped and visually marked rather than
 * rendered as if verified. Every `[cite:ID]` marker reaching this point has
 * already been resolved against the retrieved set server-side (unmatched
 * ones are stripped before persistence -- app/api/copilot/stream/route.ts),
 * so "contains a citation marker" and "is actually backed by a real record"
 * are the same fact here.
 *
 * This is a heuristic, not claim extraction -- a non-data sentence that
 * happens to contain a number (basic arithmetic, a step count) can still be
 * flagged. Accepted deliberately: the spec's own framing is "better a
 * visible gap than a confident fabrication," and a false-positive dashed
 * underline costs far less than a false-negative confident number with
 * nothing behind it.
 */
function renderProse(text: string, citations: Map<string, StreamCitation>, keyPrefix: string): React.ReactNode {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return renderInline(text, citations, keyPrefix);

  const nodes: React.ReactNode[] = [];
  sentences.forEach((sentence, index) => {
    const hasCitation = /\[cite:[^\]]+\]/.test(sentence);
    const looksLikeUncitedClaim = !hasCitation && /\d/.test(sentence);
    const rendered = renderInline(sentence, citations, `${keyPrefix}-s${index}`);

    nodes.push(
      looksLikeUncitedClaim ? (
        <span
          key={`${keyPrefix}-u${index}`}
          className="border-b border-dashed border-amber-fg/70"
          title="No citation found for this claim about workspace data."
        >
          {rendered}
        </span>
      ) : (
        <React.Fragment key={`${keyPrefix}-f${index}`}>{rendered}</React.Fragment>
      ),
    );
    if (index < sentences.length - 1) nodes.push(" ");
  });
  return nodes;
}

function renderBlock(block: Block, citations: Map<string, StreamCitation>, key: string): React.ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return (
        <Tag
          key={key}
          className={cn("mt-1 text-fg-000", block.level <= 2 ? "text-title-sm font-semibold" : "text-label font-semibold")}
        >
          {renderInline(block.text, citations, key)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="text-body text-fg-000">
          {renderProse(block.text, citations, key)}
        </p>
      );
    case "code":
      return <CodeBlock key={key} code={block.code} language={block.language} />;
    case "ul":
      return (
        <ul key={key} className="ml-5 list-disc text-body text-fg-000">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderProse(item, citations, `${key}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="ml-5 list-decimal text-body text-fg-000">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderProse(item, citations, `${key}-${itemIndex}`)}</li>
          ))}
        </ol>
      );
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-2 border-ink-400 pl-3 text-body text-fg-100 italic">
          {renderProse(block.text, citations, key)}
        </blockquote>
      );
    case "table":
      return (
        <div key={key} className="overflow-x-auto rounded-md border border-ink-400">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="border-b border-ink-400 bg-ink-100">
                {block.header.map((cell, cellIndex) => (
                  <th key={cellIndex} className="px-3 py-1.5 text-left text-label font-medium text-fg-000">
                    {renderInline(cell, citations, `${key}-h${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-ink-400 last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-1.5 text-fg-100">
                      {renderInline(cell, citations, `${key}-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "hr":
      return <hr key={key} className="border-ink-400" />;
  }
}

export interface MarkdownProps {
  content: string;
  citations: StreamCitation[];
}

export function Markdown({ content, citations }: MarkdownProps) {
  const citationMap = React.useMemo(() => new Map(citations.map((citation) => [citation.id, citation])), [citations]);
  const blocks = React.useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="flex flex-col gap-2">{blocks.map((block, index) => renderBlock(block, citationMap, `b${index}`))}</div>
  );
}
