#!/usr/bin/env tsx
/**
 * Blank out the parts of a Markdown document that are text *about* Markdown
 * rather than Markdown: fenced code blocks, inline code spans and HTML
 * comments. Shared by the two documentation gates so a link or a version
 * table quoted inside a fence, a span or a parked `<!-- … -->` block is never
 * mistaken for a live one.
 *
 * Line count is preserved (every masked character becomes a space, newlines
 * stay), so callers can still report 1-based line numbers.
 *
 * Fences follow CommonMark closely enough for this repo: a fence opens with
 * three or more backticks or tildes at the start of a line (after up to three
 * spaces) and closes only on a line of the *same* character that is at least
 * as long — so a ```` ````markdown ```` wrapper around a ```` ```md ````
 * example is one block, not three toggles.
 *
 * @module scripts/markdown-mask
 */

/** Replace every non-newline character with a space. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ');
}

/**
 * Mask fenced code blocks and HTML comments only — inline spans survive. The
 * version gate reads table cells such as `` `@xivdyetools/core` ``, where the
 * backticks are formatting, not quotation.
 */
export function maskBlockCode(text: string): string {
  // 1. HTML comments (may span lines).
  let out = text.replace(/<!--[\s\S]*?-->/g, blank);

  // 2. Fenced blocks, tracking the opening fence's character and length.
  const lines = out.split('\n');
  let fenceChar: string | null = null;
  let fenceLen = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceChar === null) {
      if (m) {
        fenceChar = (m[1] ?? '')[0] ?? null;
        fenceLen = (m[1] ?? '').length;
        lines[i] = blank(line);
      }
      continue;
    }
    // Inside a fence: everything is masked; a matching closer ends it.
    lines[i] = blank(line);
    if (m && (m[1] ?? '')[0] === fenceChar && (m[1] ?? '').length >= fenceLen) {
      fenceChar = null;
      fenceLen = 0;
    }
  }
  return lines.join('\n');
}

/** Mask fenced code blocks, HTML comments and inline code spans. */
export function maskCode(text: string): string {
  // Inline code spans: one or more backticks, shortest match, same line.
  return maskBlockCode(text).replace(/(`+)[^`\n]*?\1/g, blank);
}
