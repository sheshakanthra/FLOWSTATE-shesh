/**
 * A single, shared sentence splitter used two places: the message renderer's
 * unsourced-claim marking (features/copilot/messages/markdown.tsx, gate item
 * 5) and the streaming message's screen-reader buffering (features/copilot/
 * messages/message.tsx, gate item 9 -- "announces responses in complete
 * sentences, not per token"). One definition, so "what counts as a
 * sentence" can't quietly disagree between the two.
 *
 * Deliberately not a full NLP sentence tokenizer (none of the libraries that
 * would do that are in CLAUDE.md's dependency table) -- a lookbehind split
 * on `.`/`!`/`?` followed by whitespace and then a capital letter, digit, or
 * opening quote/bracket. This under-splits on a mid-sentence abbreviation
 * followed by a capitalized word ("Dr. Smith") and never splits inside a
 * decimal ("3.5", no whitespace after the dot) or inside a lowercase
 * continuation ("e.g. something"). Good enough for pacing an aria-live
 * region and for flagging claim-shaped sentences -- not a linguistics tool.
 */
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z0-9"'[])/;

export function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_BOUNDARY)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
