import type { ConditionConfig } from "../../nodes/types/condition";
import type { NodeExecutor } from "./types";

/**
 * A minimal, hand-rolled, side-effect-free boolean expression evaluator --
 * deliberately not `eval`/`new Function` (arbitrary code execution from a
 * text field a workspace member can edit, even a trusted one, isn't worth
 * the risk when the actual need is "compare two already-interpolated
 * literals") and no expression-parser dependency (none is in CLAUDE.md's
 * table). By the time a Condition node's `expression` reaches this
 * executor, the orchestrator has already replaced every `{{token}}` with
 * its real value's literal text (scope-resolver.ts's `interpolateConfig`),
 * so this only ever needs to parse literals, comparisons, and boolean
 * logic -- never variable lookups.
 *
 * Grammar (lowest to highest precedence): Or -> And -> Not -> Comparison ->
 * Primary. Primary is a number, a single/double-quoted string, true/false/
 * null, or a parenthesized expression.
 */
type Token = { type: "op" | "num" | "str" | "bool" | "null" | "lparen" | "rparen"; value: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === undefined) break;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: ch });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ch });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let value = "";
      while (j < source.length && source[j] !== quote) {
        value += source[j];
        j += 1;
      }
      tokens.push({ type: "str", value });
      i = j + 1;
      continue;
    }
    const twoChar = source.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(twoChar)) {
      tokens.push({ type: "op", value: twoChar });
      i += 2;
      continue;
    }
    if (["!", ">", "<"].includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i += 1;
      continue;
    }
    const numberMatch = /^-?\d+(\.\d+)?/.exec(source.slice(i));
    if (numberMatch) {
      tokens.push({ type: "num", value: numberMatch[0] });
      i += numberMatch[0].length;
      continue;
    }
    const wordMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(source.slice(i));
    if (wordMatch) {
      const word = wordMatch[0];
      if (word === "true" || word === "false") tokens.push({ type: "bool", value: word });
      else if (word === "null") tokens.push({ type: "null", value: word });
      else tokens.push({ type: "str", value: word }); // an unquoted bare word, e.g. a token that resolved to plain text
      i += word.length;
      continue;
    }
    // An unrecognized character (stray punctuation left over from a
    // malformed expression) -- skip it rather than throwing, so a slightly
    // odd expression still evaluates as best-effort instead of crashing
    // the whole run.
    i += 1;
  }
  return tokens;
}

class Parser {
  private position = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private next(): Token | undefined {
    return this.tokens[this.position++];
  }

  parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peek()?.type === "op" && this.peek()?.value === "||") {
      this.next();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseNot();
    while (this.peek()?.type === "op" && this.peek()?.value === "&&") {
      this.next();
      const right = this.parseNot();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseNot(): unknown {
    if (this.peek()?.type === "op" && this.peek()?.value === "!") {
      this.next();
      return !this.parseNot();
    }
    return this.parseComparison();
  }

  private parseComparison(): unknown {
    const left = this.parsePrimary();
    const operator = this.peek();
    if (operator?.type === "op" && ["==", "!=", ">", "<", ">=", "<="].includes(operator.value)) {
      this.next();
      const right = this.parsePrimary();
      switch (operator.value) {
        case "==":
          return left === right;
        case "!=":
          return left !== right;
        case ">":
          return Number(left) > Number(right);
        case "<":
          return Number(left) < Number(right);
        case ">=":
          return Number(left) >= Number(right);
        case "<=":
          return Number(left) <= Number(right);
      }
    }
    return left;
  }

  private parsePrimary(): unknown {
    const token = this.next();
    if (!token) return undefined;
    if (token.type === "lparen") {
      const value = this.parseOr();
      if (this.peek()?.type === "rparen") this.next();
      return value;
    }
    if (token.type === "num") return Number(token.value);
    if (token.type === "bool") return token.value === "true";
    if (token.type === "null") return null;
    return token.value; // "str"
  }
}

/** Parses and evaluates a boolean expression; returns `null` (rather than
 *  throwing) on anything unparseable, so the caller can fall back to a
 *  simpler default instead of failing the whole node. */
export function evaluateCondition(expression: string): boolean | null {
  const trimmed = expression.trim();
  if (!trimmed) return null;
  try {
    const result = new Parser(tokenize(trimmed)).parseOr();
    return Boolean(result);
  } catch {
    return null;
  }
}

export const conditionExecutor: NodeExecutor<ConditionConfig> = async ({ config, resolvedInput }) => {
  const evaluated = evaluateCondition(config.expression);
  const result = evaluated ?? Boolean(resolvedInput.in);
  return { output: result ? { true: resolvedInput.in ?? null } : { false: resolvedInput.in ?? null } };
};
