import { describe, expect, it } from "vitest";
import { splitSentences } from "./sentences";

describe("splitSentences", () => {
  it("splits on sentence-ending punctuation followed by a capitalized sentence", () => {
    expect(splitSentences("Three runs failed. Two agents are healthy. What's next?")).toEqual([
      "Three runs failed.",
      "Two agents are healthy.",
      "What's next?",
    ]);
  });

  it("does not split inside a decimal number", () => {
    expect(splitSentences("The run cost $3.50 to complete.")).toEqual(["The run cost $3.50 to complete."]);
  });

  it("does not split a lowercase continuation after an abbreviation", () => {
    expect(splitSentences("It failed once, e.g. a timeout, then recovered.")).toEqual([
      "It failed once, e.g. a timeout, then recovered.",
    ]);
  });

  it("returns an empty array for empty or whitespace-only input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });

  it("returns the whole string as one sentence when there is no boundary", () => {
    expect(splitSentences("no terminal punctuation here")).toEqual(["no terminal punctuation here"]);
  });
});
