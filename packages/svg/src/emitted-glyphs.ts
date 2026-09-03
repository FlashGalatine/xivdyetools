/**
 * The non-ASCII characters the card code EMITS, discovered by scanning source.
 *
 * FONT-002: both Workers' `font-coverage.test.ts` used to assert coverage of a
 * hand-maintained literal —
 *
 *     const CODE_GLYPHS = 'Δα·—…→↓–↔≈°÷♂♀#%';
 *
 * — so a glyph added to a card was invisible to the gate until somebody
 * remembered to extend that string. Nobody did when `${voteCount}★` landed, and
 * U+2605 is in none of the ten faces either Worker bundles, so every preset card
 * with a vote count drew a tofu box. This closes the class: the gate now asks
 * the source what it draws.
 *
 * Only *string and template literals* count. Comments are skipped deliberately —
 * this package's JSDoc is full of examples like `IDEAL HUE / IDEALFARBTON /
 * 理想の色相`, which are documentation, not glyphs anything renders. A naive
 * regex over raw file text reports those as needed and sends you re-subsetting
 * fonts for characters no card draws.
 *
 * @public — consumed by the two Workers' font-coverage gates, which live outside
 * this package.
 */

/** A character the code can draw, and where it came from. */
export interface EmittedGlyph {
  /** The Unicode codepoint. */
  codepoint: number;
  /** `path:line` of the literal that contains it. */
  where: string;
  /**
   * How the character is meant to be presented.
   *
   * `emoji` means it is Discord **message** text, not something resvg draws:
   * BUG-056 established that rule after a category icon rendered as a tofu box
   * in a PNG, and `preset-swatch.ts` keeps `CATEGORY_DISPLAY` for messages only.
   * A font-coverage gate must not demand glyphs for these.
   *
   * The test is the character's own spelling, not a range: `⚔️` is written with
   * a trailing U+FE0F variation selector and astral pictographs live above
   * U+1F000, whereas a bare `★` (U+2605) carries no selector. That distinction
   * matters — `⚔` and `★` sit in the *same* Unicode block, so excluding the
   * block would have hidden exactly the bug this scanner exists to catch.
   */
  presentation: 'text' | 'emoji';
}

/**
 * Extract non-ASCII codepoints from the string/template literals in TypeScript
 * source, ignoring comments.
 *
 * A small hand-rolled scanner rather than a regex, for the same reason the cmap
 * reader next door is hand-rolled: the states that matter (in a string, in a
 * template, in a comment) cannot be told apart by a regex, and getting it wrong
 * in either direction is expensive — a false positive sends you subsetting
 * glyphs nothing draws, a false negative ships tofu.
 *
 * @param source - TypeScript source text.
 * @param path - Path used to label results.
 * @returns One entry per non-ASCII codepoint occurrence.
 */
export function scanEmittedGlyphs(source: string, path: string): EmittedGlyph[] {
  const out: EmittedGlyph[] = [];
  let line = 1;
  let i = 0;
  /** What we are inside of right now. */
  let state: 'code' | 'line-comment' | 'block-comment' | 'regex' | "'" | '"' | '`' = 'code';
  /**
   * The last significant character of code, used only to tell a regex literal
   * from a division. `/` opens a regex unless the previous token could END an
   * expression — an identifier, a number, `)`, `]` or a quote. Without this the
   * scanner walks into `.replace(/"/g, '&quot;')` (base.ts:35), reads that `"`
   * as a string opener and desyncs for the rest of the file, going BLIND to
   * every literal after it. That is a fail-open bug: missed glyphs ship as tofu.
   */
  let prev = '';

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '\n') {
      line++;
      if (state === 'line-comment') state = 'code';
      i++;
      continue;
    }

    switch (state) {
      case 'code':
        if (ch === '/' && next === '/') {
          state = 'line-comment';
          i += 2;
        } else if (ch === '/' && next === '*') {
          state = 'block-comment';
          i += 2;
        } else if (ch === '/' && !/[A-Za-z0-9_$)\]'"`]/.test(prev)) {
          // A regex literal, not a division — see `prev` above.
          state = 'regex';
          i++;
        } else if (ch === "'" || ch === '"' || ch === '`') {
          state = ch;
          i++;
        } else {
          if (!/\s/.test(ch)) prev = ch;
          i++;
        }
        break;

      case 'regex':
        if (ch === '\\') {
          i += 2;
        } else if (ch === '[') {
          // A character class can contain an unescaped `/`; skip to its end.
          const close = source.indexOf(']', i + 1);
          i = close === -1 ? i + 1 : close + 1;
        } else if (ch === '/') {
          state = 'code';
          prev = '/';
          i++;
        } else {
          i++;
        }
        break;

      case 'line-comment':
        i++;
        break;

      case 'block-comment':
        if (ch === '*' && next === '/') {
          state = 'code';
          i += 2;
        } else {
          i++;
        }
        break;

      // Inside a literal: record non-ASCII, honour backslash escapes.
      default:
        if (ch === '\\') {
          i += 2;
          break;
        }
        if (ch === state) {
          state = 'code';
          i++;
          break;
        }
        {
          const cp = source.codePointAt(i);
          if (cp === undefined) {
            i++;
            break;
          }
          const width = cp > 0xffff ? 2 : 1;
          if (cp > 0x7f) {
            const followedBySelector = source.codePointAt(i + width) === 0xfe0f;
            const presentation: 'text' | 'emoji' =
              cp === 0xfe0f || cp >= 0x1f000 || followedBySelector ? 'emoji' : 'text';
            out.push({ codepoint: cp, where: `${path}:${line}`, presentation });
          }
          i += width;
        }
        break;
    }
  }

  if (state !== 'code' && state !== 'line-comment') {
    // Reaching EOF mid-literal means the scanner lost sync, and a desynced
    // scanner silently under-reports — the failure mode that let `★` ship. Fail
    // loudly instead of returning a plausible-looking short list.
    throw new Error(
      `scanEmittedGlyphs: ${path} ended while still inside ${state === 'block-comment' ? 'a block comment' : `a ${state} literal`}`,
    );
  }

  return out;
}
