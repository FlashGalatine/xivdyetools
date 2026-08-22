/**
 * Text helpers shared by the embed builders.
 *
 * @module utils/text
 */

/**
 * Fit `text` into `budget` characters, cutting only at line boundaries and
 * appending `tail` (a "…" / "summary shown" line) when something was cut.
 *
 * The tail is budgeted INSIDE `budget`: the result is never longer than
 * `budget`, whatever the tail's length. Text that already fits is returned
 * untouched, without the tail. A single line longer than the whole budget is
 * hard-cut rather than dropped, so the result is never empty.
 *
 * Used by /changelog (4000-char embed description, "…" + link) and the
 * release announcement (summary line with the GitHub link).
 */
export function cutOnLineBoundary(text: string, budget: number, tail: string): string {
  if (text.length <= budget) return text;

  const room = Math.max(0, budget - tail.length);
  const cut = text.slice(0, room);
  const lastBreak = cut.lastIndexOf('\n');
  const kept = lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
  return `${kept.trimEnd()}${tail}`;
}
