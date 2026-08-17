"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
};

const KEYWORDS: Record<string, Set<string>> = {
  javascript: new Set(
    "const let var function return if else for while do switch case break continue class extends new import export default from async await try catch finally throw typeof instanceof in of this super null undefined true false void as yield delete".split(" "),
  ),
  typescript: new Set(
    "const let var function return if else for while do switch case break continue class extends new import export default from async await try catch finally throw typeof instanceof in of this super null undefined true false interface type enum implements public private protected readonly static void as yield delete satisfies".split(" "),
  ),
  python: new Set(
    "def return if elif else for while break continue class import from as try except finally raise with lambda yield pass None True False and or not in is global nonlocal async await self".split(" "),
  ),
  bash: new Set(
    "if then else elif fi for do done while case esac function return export local echo exit in".split(" "),
  ),
  sql: new Set(
    "select from where insert into values update set delete join inner left right on group by order having as and or not null create table alter drop limit distinct union case when then end".split(" "),
  ),
  json: new Set<string>(),
};

/**
 * A hand-rolled, monochrome tokenizer -- no `shiki`/`prismjs`/etc. in
 * CLAUDE.md's dependency table, and this codebase's own precedent (A2's
 * Combobox, B4's condition-expression parser) is to hand-build a small,
 * scoped version rather than add one. "Monochrome" is deliberate, not a
 * limitation to fix later: CLAUDE.md rule 4 gives each semantic hue exactly
 * one meaning, none of which is "this is a string literal" -- syntax
 * emphasis here comes from the same luminance-step vocabulary DESIGN.md uses
 * for depth (fg-000/100/200/300), never a new color.
 */
const TOKEN_PATTERN = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;

interface Token {
  text: string;
  className?: string;
}

function tokenizeLine(line: string, keywords: Set<string>): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ text: line.slice(lastIndex, index) });

    if (match[1] !== undefined) {
      tokens.push({ text: match[1], className: "text-fg-300 italic" });
    } else if (match[2] !== undefined) {
      tokens.push({ text: match[2], className: "text-fg-100" });
    } else if (match[3] !== undefined) {
      tokens.push({ text: match[3], className: "text-fg-100" });
    } else if (match[4] !== undefined) {
      const isKeyword = keywords.has(match[4]);
      tokens.push({ text: match[4], className: isKeyword ? "font-semibold text-fg-000" : undefined });
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < line.length) tokens.push({ text: line.slice(lastIndex) });
  return tokens;
}

export interface CodeBlockProps {
  code: string;
  language?: string;
}

/** Session spec item 2: syntax-highlighted code blocks with a copy button
 *  per block. No layout shift while streaming (gate item 2): width comes
 *  from `<pre>`'s own `overflow-x-auto`, never from content forcing the
 *  block wider -- new lines only ever grow it downward. */
export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const normalized = language ? (LANGUAGE_ALIASES[language.toLowerCase()] ?? language.toLowerCase()) : "";
  const keywords = KEYWORDS[normalized] ?? new Set<string>();
  const lines = code.split("\n");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Your browser blocked clipboard access. Select the code and copy it manually.",
        variant: "danger",
      });
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-md border border-ink-400 bg-ink-050">
      <div className="flex items-center justify-between border-b border-ink-400 px-3 py-1.5">
        <span className="text-meta text-fg-200">{language || "text"}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={copied ? "Copied" : "Copy code"}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-meta text-fg-200",
            "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
            focusRing,
          )}
        >
          {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-label leading-relaxed text-fg-000">
          {lines.map((line, index) => (
            <div key={index}>
              {tokenizeLine(line, keywords).map((token, tokenIndex) => (
                <span key={tokenIndex} className={token.className}>
                  {token.text}
                </span>
              ))}
              {line.length === 0 ? " " : null}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
