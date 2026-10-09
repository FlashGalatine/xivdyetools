/**
 * The non-ASCII characters the card code EMITS, discovered by scanning source.
 *
 * FONT-002: both Workers' `font-coverage.test.ts` asserted coverage of a
 * hand-maintained literal — discord-worker's was
 *
 *     const CODE_GLYPHS = 'Δα·—…→↓–↔≈°÷♂♀#%';
 *
 * — so a glyph added to a card was invisible to the gate until somebody
 * remembered to extend that string. Nobody did when `${voteCount}★` landed, and
 * U+2605 is in none of the ten faces either Worker bundles, so every preset card
 * with a vote count drew a tofu box. This closes the class for discord-worker:
 * its gate now asks the source what it draws, running this scanner over
 * `packages/svg/src` and `packages/bot-logic/src/commands`.
 *
 * og-worker's gate does NOT use this scanner yet. It still checks its own
 * hand-kept `CODE_GLYPHS` list, so a glyph added to an OG card stays invisible
 * to it until somebody extends that list — the FONT-002 class is still open
 * there.
 *
 * Only *string and template literals* count. Comments are skipped deliberately —
 * this package's JSDoc is full of examples like `IDEAL HUE / IDEALFARBTON /
 * 理想の色相`, which are documentation, not glyphs anything renders. A naive
 * regex over raw file text reports those as needed and sends you re-subsetting
 * fonts for characters no card draws.
 *
 * @public — consumed by discord-worker's font-coverage gate, which lives outside
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
   * The test is the character itself, never a range: a character is `emoji`
   * when a U+FE0F variation selector follows it (`⚔️`), or when it is astral
   * and Unicode gives it emoji presentation by default (Emoji_Presentation:
   * `🎨`). A bare BMP character is never emoji without the selector — a bare
   * `⭐` is `text`, fail-closed — and a bare `★` (U+2605) is neither. That distinction matters — `⚔` and `★` sit in the
   * *same* Unicode block, so excluding the block would have hidden exactly the
   * bug this scanner exists to catch. The astral planes are no different: CJK
   * Extension B and up (U+20000+, `𠮷`) is text a font must draw, and so are the
   * text-default symbols among the emoji blocks themselves (a bare U+1F000
   * mahjong tile, a Supplemental Arrows-C arrow).
   *
   * The property is read from the runtime's own Unicode data (V8's ICU), so a
   * Node upgrade that marks a new character Emoji_Presentation moves it here.
   */
  presentation: 'text' | 'emoji';
}

/**
 * Words after which a `/` starts a regex literal rather than dividing.
 *
 * BUG-143: `prev` used to be a single character, so the `n` of `return` read
 * as the tail of an operand and `return /'/.test(s)` as a division — the quote
 * then opened a string and the scanner desynced. Every other word (an
 * identifier, a number, `this`, `true`) ends an expression, so `/` after it
 * divides.
 *
 * `await` and `yield` are here unconditionally because they are reserved words
 * in module and strict code — this codebase is ES modules, so neither can be
 * an identifier. `of` is NOT here: it is contextual, so a word like any other
 * except directly inside a `for (…)` header (see `scanEmittedGlyphs`).
 */
const REGEX_AFTER_WORD = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
  'default',
  'extends',
]);

/**
 * What an open `(` in code is: the header of a `for` or of another statement
 * (`if` / `while` / `with`), or an ordinary group (a call, a condition, a
 * parameter list).
 */
type Paren = 'for' | 'header' | 'group';

/**
 * U+2028 / U+2029, built from codes: spelled raw or as an escape inside a
 * literal, the scanner would report this very file as drawing them.
 */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/** A character that continues an identifier, keyword or number in code. */
function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch) || (ch > '\x7f' && !/\s/.test(ch));
}

/** Unicode's Default_Ignorable_Code_Point property, one codepoint at a time. */
const DEFAULT_IGNORABLE = /^\p{Default_Ignorable_Code_Point}$/u;

/**
 * A codepoint that can never be a glyph a font must cover.
 *
 * - A surrogate (only ever half of an astral character, undrawable alone) or a
 *   Unicode noncharacter (U+FDD0–U+FDEF and the last two codepoints of every
 *   plane).
 * - A C0 / C1 control (U+0000–U+001F, U+007F–U+009F): it draws nothing, and in
 *   card code it only ever appears in a sanitizer's pattern.
 * - A Default_Ignorable_Code_Point: the soft hyphen, zero-width spaces and
 *   joiners, direction marks, embeddings and isolates, the word joiner,
 *   variation selectors (U+FE0F among them), the BOM, tag characters. A
 *   HarfBuzz-family shaper (rustybuzz, inside resvg) hides these by default, so
 *   even a font without them never draws a tofu box for one.
 * - U+20E3 COMBINING ENCLOSING KEYCAP, which only ever ends a keycap emoji
 *   sequence (a digit, U+FE0F, U+20E3) — Discord message text, not something
 *   resvg draws.
 *
 * Decoding escapes makes all of these reachable from strings nothing renders —
 * RegExp sources, sanitizer arguments, escaped emoji sequences. `base.ts`, for
 * instance, builds its XML-illegal-character pattern from
 * `'\uD800-\uDBFF'` / `'\uFFFE\uFFFF'` RegExp source.
 */
function isNeverAGlyph(cp: number): boolean {
  return (
    cp <= 0x1f ||
    (cp >= 0x7f && cp <= 0x9f) ||
    (cp >= 0xd800 && cp <= 0xdfff) ||
    (cp >= 0xfdd0 && cp <= 0xfdef) ||
    (cp & 0xfffe) === 0xfffe ||
    cp === 0x20e3 ||
    DEFAULT_IGNORABLE.test(String.fromCodePoint(cp))
  );
}

/** Unicode's Emoji_Presentation property, one codepoint at a time. */
const EMOJI_PRESENTATION = /^\p{Emoji_Presentation}$/u;

/**
 * Whether a character with NO U+FE0F after it presents as emoji by default.
 *
 * Not a range: the blocks from Mahjong Tiles (U+1F000) to Symbols and
 * Pictographs Extended-A (U+1FAFF) also hold symbols whose default
 * presentation is text — nearly every mahjong, domino and playing-card tile,
 * the enclosed alphanumerics, the geometric shapes and arrows supplements, the
 * chess symbols — and calling all of them emoji let them past the font gate to
 * draw tofu. Nor Extended_Pictographic, which also matches the bare ★ (U+2605) of
 * FONT-002. Emoji_Presentation is the property for "draws as emoji with no
 * selector": 🎨 has it, a bare 🗡 does not.
 *
 * Astral only. In the BMP a bare emoji-default character (⭐ ✅ ⚡) stays
 * `text`, as it was before BUG-143: the gate skips `emoji` on the premise that
 * it is message text resvg never draws, and a bare BMP pictograph is as likely
 * to be drawn on a card as sent in a message. Failing closed there costs one
 * U+FE0F on a message-only string; failing open costs a tofu box in a PNG.
 */
function isEmojiByDefault(cp: number): boolean {
  return cp > 0xffff && EMOJI_PRESENTATION.test(String.fromCodePoint(cp));
}

/** `count` hex digits at `at`, or `undefined` when they are not all hex. */
function readHex(source: string, at: number, count: number): number | undefined {
  const digits = source.slice(at, at + count);
  return digits.length === count && /^[0-9A-Fa-f]+$/.test(digits)
    ? parseInt(digits, 16)
    : undefined;
}

/**
 * Decode ONE `\u` escape whose backslash sits at `at` — four hex digits, or
 * braces holding any number of them (leading zeros included, as JS allows) up
 * to U+10FFFF. `undefined` when it is malformed. A surrogate comes back as the
 * lone UTF-16 unit it spells; pairing is the caller's job.
 */
function decodeUnicodeEscape(
  source: string,
  at: number,
): { cp: number; length: number } | undefined {
  if (source[at] !== '\\' || source[at + 1] !== 'u') return undefined;
  if (source[at + 2] === '{') {
    const close = source.indexOf('}', at + 3);
    const digits = close === -1 ? '' : source.slice(at + 3, close);
    if (!/^[0-9A-Fa-f]+$/.test(digits)) return undefined;
    const cp = parseInt(digits, 16);
    return cp <= 0x10ffff ? { cp, length: close + 1 - at } : undefined;
  }
  const unit = readHex(source, at + 2, 4);
  return unit === undefined ? undefined : { cp: unit, length: 6 };
}

/**
 * Decode the escape whose backslash sits at `at` inside a string or template.
 *
 * BUG-143: the scanner used to skip every backslash pair, so `'\u2605'` — a ★
 * the card draws — reported nothing, and the font gate passed it straight to a
 * tofu box. Returns the codepoint the escape spells (`undefined` for one that
 * spells nothing: a line continuation) and how many source characters it
 * used. A malformed `\u` / `\x` (legal only in a tagged template, where the
 * raw text is what renders) consumes just the backslash, so the characters
 * after it are still read as text.
 */
function decodeEscape(source: string, at: number): { cp: number | undefined; length: number } {
  const kind = source[at + 1];
  if (kind === 'u') {
    const first = decodeUnicodeEscape(source, at);
    if (first === undefined) return { cp: undefined, length: 1 };
    // A high surrogate escape followed by a low one is ONE astral character,
    // whichever of the two spellings each half uses: JS joins the UTF-16 units.
    if (first.cp >= 0xd800 && first.cp <= 0xdbff) {
      const low = decodeUnicodeEscape(source, at + first.length);
      if (low !== undefined && low.cp >= 0xdc00 && low.cp <= 0xdfff) {
        return {
          cp: 0x10000 + ((first.cp - 0xd800) << 10) + (low.cp - 0xdc00),
          length: first.length + low.length,
        };
      }
    }
    return first;
  }
  if (kind === 'x') {
    const byte = readHex(source, at + 2, 2);
    return byte === undefined ? { cp: undefined, length: 1 } : { cp: byte, length: 4 };
  }
  // Any other escape spells the character after the backslash: `\n`, `\'` and
  // `\0` are ASCII, and a non-ASCII identity escape (`'\★'`) is that glyph.
  const cp = source.codePointAt(at + 1);
  if (cp === undefined) return { cp: undefined, length: 1 };
  return { cp, length: 1 + (cp > 0xffff ? 2 : 1) };
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
 * Escapes inside literals are decoded (`'\u2605'` is a ★), except the
 * characters nothing draws (`isNeverAGlyph`: controls, surrogates,
 * noncharacters, default-ignorables). A template's `${…}` is read as code, so
 * a template nested in it is scanned as a template and a comment in it is
 * skipped.
 *
 * A RegExp range in card code belongs in a regex LITERAL
 * (`/[\u{4E00}-\u{9FFF}]/u`), which is never decoded. Written as a string
 * (`new RegExp('[\u{4E00}-\u{9FFF}]')`) its escapes are decoded like any
 * string's — a string might be drawn — so the range's two ends read as glyphs
 * the fonts must cover.
 *
 * Telling a regex from a division takes a token heuristic: a `/` opens a regex
 * unless the previous token ends an expression (an identifier, a number, a
 * private name, `]`, a closed literal, a `)` that did NOT close an `if` /
 * `while` / `for` / `with` header, or a `}` that closed a type or object
 * literal opened straight after `as`, `satisfies`, `&` or `|`). Where that
 * heuristic is wrong the scanner fails CLOSED as far as it can: a `'`/`"`
 * string or a regex literal that reaches a raw line break, or a file that ends
 * inside any literal, comment or substitution, throws instead of returning a
 * plausible-looking short list.
 *
 * Known limits, where it can still misread (each is valid strict TypeScript
 * unless it says otherwise):
 *
 * - Any other `}` reads as the end of a block. A `{` after `:` is left a block
 *   on purpose, because `case 1: {`, `default: {` and `label: {` open blocks
 *   and a regex may start the statement after one — so a type literal there
 *   that a division follows misreads
 *   (`x as string extends string ? number : {} / 2`). So does an object
 *   literal divided straight after its `}` (`{} / 2`), which TypeScript
 *   rejects (TS2362).
 * - A `>` that closes type arguments reads as greater-than, so a `/` after it
 *   opens a regex (`x as Readonly<number> / 2`).
 * - `of` is a keyword anywhere directly inside a `for (…)` header, so an
 *   identifier named `of` divided there (`for (let i = of / 2; …)`) misreads.
 *
 * A misread does NOT reliably throw. The fake regex it opens is closed by the
 * next `/` on the same line — a division, another regex, or the first slash of
 * a `//` comment — and a fake string by the next matching quote; only when the
 * rest of the line holds neither does the scan reach the line break and throw.
 * Otherwise it returns without error, and the literals between the misread and
 * whatever closed it are dropped (inside a fake string, code reads as text).
 *
 * @param source - TypeScript source text.
 * @param path - Path used to label results.
 * @returns One entry per non-ASCII codepoint occurrence.
 * @throws When the scan loses sync (see above).
 */
export function scanEmittedGlyphs(source: string, path: string): EmittedGlyph[] {
  const out: EmittedGlyph[] = [];
  let line = 1;
  let i = 0;
  /** What we are inside of right now. */
  let state: 'code' | 'line-comment' | 'block-comment' | 'regex' | "'" | '"' | '`' = 'code';
  /** Inside a regex character class, where `/` does not close the regex. */
  let inClass = false;
  /**
   * One entry per open `${…}` substitution: how many `{` inside it are still
   * unclosed. The substitution is CODE — a comment in it is skipped, a template
   * in it is a template — and the `}` that finds its counter at 0 resumes the
   * enclosing template.
   */
  const substitutions: number[] = [];
  /**
   * Whether the last significant token of code ENDS an expression — an
   * identifier, a number, a private name, `]`, a `)` that closed anything but a
   * statement header, or a closed string, template or regex — in which case `/`
   * divides; otherwise it opens a regex. Without this the scanner
   * walks into `.replace(/"/g, '&quot;')` (base.ts:35), reads that `"` as a
   * string opener and desyncs for the rest of the file, going BLIND to every
   * literal after it. That is a fail-open bug: missed glyphs ship as tofu.
   */
  let operand = false;
  /** The last token was a lone `.`, so a keyword now is a property name (`obj.return / 2`). */
  let afterDot = false;
  /**
   * One entry per open `(` in code. The `)` that closes an `if` / `while` /
   * `for` / `with` header is followed by a statement, so `/` there opens a
   * regex (`if (ok) /'/.test(s)`); any other `)` ends an expression
   * (`f(x) / 2`). Reading every `)` as the latter dropped glyphs silently once
   * two such regexes shared a line. A `for` header is told apart because `of`
   * is a keyword only directly inside one.
   */
  const parens: Paren[] = [];
  /**
   * The previous token was a header keyword, so the next `(` opens its header.
   * Only `await` may sit between them (`for await (`); any other token disarms it.
   */
  let pendingHeader: Paren | null = null;
  /**
   * One entry per open `{` in code (the `${` of a substitution is not one):
   * whether it opened a type or object LITERAL — an expression, so a `/` after
   * its `}` divides (`x satisfies {} / 2`) — rather than a block, after whose
   * `}` a `/` opens a regex (`if (a) {} /'/.test(s)`).
   */
  const braces: boolean[] = [];
  /**
   * The previous token was `as`, `satisfies`, `&` or `|`, so a `{` now opens a
   * type or object literal: none of them can be followed by a block. `:` is
   * deliberately not one of them — `case 1: {`, `default: {` and `label: {`
   * open blocks. Any other token disarms it, as with `pendingHeader`.
   */
  let literalBraceNext = false;
  /**
   * The glyph recorded for the character immediately before this one in the
   * current literal, so a following U+FE0F — raw or escaped — can mark it as
   * emoji presentation.
   */
  let lastGlyph: EmittedGlyph | null = null;

  const record = (cp: number): void => {
    if (cp === 0xfe0f && lastGlyph) lastGlyph.presentation = 'emoji';
    if (cp <= 0x7f || isNeverAGlyph(cp)) {
      lastGlyph = null;
      return;
    }
    const presentation: 'text' | 'emoji' = isEmojiByDefault(cp) ? 'emoji' : 'text';
    lastGlyph = { codepoint: cp, where: `${path}:${line}`, presentation };
    out.push(lastGlyph);
  };

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '\n' || ch === '\r') {
      if (state === "'" || state === '"' || state === 'regex') {
        // Neither a quoted string nor a regex can hold a raw line break, so the
        // scanner misjudged a `/` somewhere on this line. Carrying on would
        // misread every literal after it — fail closed instead.
        throw new Error(
          `scanEmittedGlyphs: ${path}:${line} hit a line break inside ${state === 'regex' ? 'a regex' : `a ${state}`} literal: ` +
            `the scanner lost sync (a '/' misread as division or as a regex?)`,
        );
      }
      if (ch === '\n') line++;
      if (state === 'line-comment') state = 'code';
      i++;
      continue;
    }

    switch (state) {
      case 'code': {
        if (ch === '/' && (next === '/' || next === '*')) {
          // A comment between two tokens changes nothing about either of them.
          state = next === '/' ? 'line-comment' : 'block-comment';
          i += 2;
          break;
        }
        if (/\s/.test(ch)) {
          i++;
          break;
        }
        // Every real token disarms a pending header and a pending literal
        // brace; the branches below re-arm them.
        const pending = pendingHeader;
        pendingHeader = null;
        const literalBrace = literalBraceNext;
        literalBraceNext = false;
        if (ch === '/') {
          // A regex literal unless the previous token ends an expression.
          if (operand) {
            operand = false;
          } else {
            state = 'regex';
            inClass = false;
          }
          afterDot = false;
          i++;
        } else if (ch === "'" || ch === '"' || ch === '`') {
          state = ch;
          lastGlyph = null;
          i++;
        } else if (isWordChar(ch)) {
          let end = i + 1;
          while (end < source.length && isWordChar(source[end])) end++;
          if (
            /[0-9]/.test(ch) &&
            !/^0[xob]/i.test(source.slice(i, end)) &&
            source[end] === '.' &&
            source[end + 1] !== '.'
          ) {
            // A decimal number's own `.` (`1.`, `1.5`, `1.e3`) belongs to it, so
            // `1. / 2` divides; read through the fraction. (`1..x` is the number
            // `1.` and then a member access — either reading is an operand.)
            end++;
            while (end < source.length && isWordChar(source[end])) end++;
          }
          const word = source.slice(i, end);
          const keyword = REGEX_AFTER_WORD.has(word) || (word === 'of' && parens.at(-1) === 'for');
          operand = afterDot || !keyword;
          if (!afterDot) {
            if (word === 'for' || (word === 'await' && pending === 'for')) pendingHeader = 'for';
            else if (word === 'if' || word === 'while' || word === 'with') pendingHeader = 'header';
            else if (word === 'as' || word === 'satisfies') literalBraceNext = true;
          }
          afterDot = false;
          i = end;
        } else if (ch === '#' && next !== undefined && isWordChar(next)) {
          // A private name (`this.#in`, `#x in obj`) is always an identifier,
          // never a keyword, whatever it is spelled.
          let end = i + 2;
          while (end < source.length && isWordChar(source[end])) end++;
          operand = true;
          afterDot = false;
          i = end;
        } else if (ch === '(') {
          parens.push(pending ?? 'group');
          operand = false;
          afterDot = false;
          i++;
        } else if (ch === ')') {
          // A header's `)` is followed by a statement, so `/` after it opens a
          // regex; every other `)` ends an expression. An unmatched `)` (only
          // in broken source) counts as the latter.
          operand = (parens.pop() ?? 'group') === 'group';
          afterDot = false;
          i++;
        } else if ((ch === '+' || ch === '-') && next === ch) {
          // `x++ / 2` divides and `++x` is followed by its operand either way,
          // so increment/decrement leaves `operand` as it found it.
          afterDot = false;
          i += 2;
        } else if (ch === '!') {
          // After an operand this is TypeScript's non-null assertion (`width! / 2`),
          // still an operand; a prefix `!` follows a non-operand already, and the
          // `=` of `!=` / `!==` clears `operand` on its own.
          afterDot = false;
          i++;
        } else if (ch === '.' && next === '.' && source[i + 2] === '.') {
          operand = false;
          afterDot = false;
          i += 3;
        } else if (ch === '}' && substitutions.at(-1) === 0) {
          // The end of a `${…}`: back into the template that opened it.
          substitutions.pop();
          state = '`';
          lastGlyph = null;
          i++;
        } else {
          if (substitutions.length > 0 && (ch === '{' || ch === '}')) {
            substitutions[substitutions.length - 1] += ch === '{' ? 1 : -1;
          }
          if (ch === '{') braces.push(literalBrace);
          // `]` ends an expression, and so does a `}` that closes a literal. A
          // block's `}` does not (nor an unmatched one, only in broken source),
          // and every other punctuator expects an operand — a type argument
          // list's `>` included (see the known limits above).
          operand = ch === ']' || (ch === '}' && (braces.pop() ?? false));
          if (ch === '&' || ch === '|') literalBraceNext = true;
          afterDot = ch === '.';
          i++;
        }
        break;
      }

      case 'regex':
        if (ch === '\\') {
          // An escaped line break is still a line break — let the check above see it.
          i += next === '\n' || next === '\r' ? 1 : 2;
        } else if (ch === '[') {
          // A character class can contain an unescaped `/`.
          inClass = true;
          i++;
        } else if (ch === ']') {
          inClass = false;
          i++;
        } else if (ch === '/' && !inClass) {
          state = 'code';
          operand = true;
          i++;
        } else {
          i++;
        }
        break;

      case 'line-comment':
        // U+2028 / U+2029 are line terminators too: in JS they end a `//`
        // comment, so the code after one is code (and its literals count).
        if (ch === LINE_SEPARATOR || ch === PARAGRAPH_SEPARATOR) state = 'code';
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

      // Inside a literal: record non-ASCII, decoding backslash escapes.
      default:
        if (ch === '\\') {
          if (next === '\n' || next === '\r') {
            // A line continuation spells nothing but still starts a new line.
            i += next === '\r' && source[i + 2] === '\n' ? 3 : 2;
            line++;
            lastGlyph = null;
          } else if (next === LINE_SEPARATOR || next === PARAGRAPH_SEPARATOR) {
            // Also a line continuation (LS / PS): it spells nothing.
            i += 2;
            lastGlyph = null;
          } else {
            const { cp, length } = decodeEscape(source, i);
            if (cp === undefined) lastGlyph = null;
            else record(cp);
            i += length;
          }
          break;
        }
        if (ch === state) {
          state = 'code';
          operand = true;
          afterDot = false;
          lastGlyph = null;
          i++;
          break;
        }
        if (state === '`' && ch === '$' && next === '{') {
          // A substitution: code until its own closing `}`.
          substitutions.push(0);
          state = 'code';
          operand = false;
          afterDot = false;
          lastGlyph = null;
          i += 2;
          break;
        }
        {
          // `i` is in range, so codePointAt always answers here.
          const cp = source.codePointAt(i) as number;
          record(cp);
          i += cp > 0xffff ? 2 : 1;
        }
        break;
    }
  }

  if ((state !== 'code' && state !== 'line-comment') || substitutions.length > 0) {
    // Reaching EOF mid-literal means the scanner lost sync, and a desynced
    // scanner silently under-reports — the failure mode that let `★` ship. Fail
    // loudly instead of returning a plausible-looking short list.
    const where =
      state === 'block-comment'
        ? 'a block comment'
        : state === 'code' || state === 'line-comment'
          ? 'a ${...} substitution'
          : `a ${state} literal`;
    throw new Error(`scanEmittedGlyphs: ${path} ended while still inside ${where}`);
  }

  return out;
}
