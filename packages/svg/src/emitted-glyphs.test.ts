/**
 * `scanEmittedGlyphs` is a hand-rolled lexer, and a lexer that loses sync
 * **under-reports** — which for a font gate means missed glyphs ship as tofu.
 * That is the failure mode this whole module exists to prevent, so the cases
 * below are the ones that can desync it, not a happy path.
 *
 * The regex cases are not hypothetical: `packages/svg/src/base.ts:35` contains
 * `.replace(/"/g, '&quot;')`, and an earlier version of this scanner read that
 * `"` as a string opener and went blind to every literal in the rest of the
 * file — 53 of them.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanEmittedGlyphs } from './emitted-glyphs.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * One backslash. Newer fixtures build their `\u` escapes from this rather than
 * spelling them in a raw string, so no editor or tool can silently turn the
 * escape into the raw character it names (which would make the test prove
 * nothing about escape decoding).
 */
const BS = '\\';

/** The codepoints a scan reports, as characters, for readable assertions. */
const chars = (src: string): string[] =>
  scanEmittedGlyphs(src, 'test.ts').map((g) => String.fromCodePoint(g.codepoint));

describe('scanEmittedGlyphs', () => {
  it('reports non-ASCII in single, double and template literals', () => {
    expect(chars(`const a = 'Δ'; const b = "α"; const c = \`·\`;`).sort()).toEqual(['·', 'Δ', 'α']);
  });

  it('ignores ASCII entirely', () => {
    expect(chars(`const a = 'plain ascii';`)).toEqual([]);
  });

  it('ignores line and block comments', () => {
    expect(chars(`// Δ\nconst a = 1;`)).toEqual([]);
    expect(chars(`/* Δ\n * α — 理想の色相\n */\nconst a = 1;`)).toEqual([]);
  });

  it('does not desync on a regex containing a quote (the base.ts case)', () => {
    // If the `"` inside the regex is read as a string opener, `Δ` below is
    // swallowed and the scan silently returns nothing.
    const src = `str.replace(/"/g, '&quot;').replace(/'/g, '&apos;');\nconst tag = 'ΔE';`;
    expect(chars(src)).toEqual(['Δ']);
  });

  it('does not treat division as a regex', () => {
    expect(chars(`const half = width / 2; const label = 'Δ';`)).toEqual(['Δ']);
  });

  it('handles a regex character class containing a slash', () => {
    expect(chars(`const re = /[/"]/g; const label = 'α';`)).toEqual(['α']);
  });

  it('handles escaped quotes inside a literal', () => {
    expect(chars(`const a = 'it\\'s Δ'; const b = "say \\"α\\"";`).sort()).toEqual(['Δ', 'α']);
  });

  it('reads astral characters as one codepoint, not two surrogates', () => {
    const hits = scanEmittedGlyphs(`const e = '🎨';`, 'test.ts');
    expect(hits).toHaveLength(1);
    expect(hits[0].codepoint).toBe(0x1f3a8);
  });

  it('classifies emoji presentation vs text presentation', () => {
    // ⚔ and ★ sit in the SAME Unicode block — the selector is what separates
    // them, which is why the gate cannot exclude emoji by range.
    const sword = scanEmittedGlyphs(`const i = '⚔️';`, 'test.ts');
    expect(sword[0].presentation).toBe('emoji');

    const star = scanEmittedGlyphs(`const s = '★';`, 'test.ts');
    expect(star).toHaveLength(1);
    expect(star[0].presentation).toBe('text');
  });

  it('records file and line for every hit', () => {
    const hits = scanEmittedGlyphs(`const a = 1;\nconst b = 'Δ';`, 'frame.ts');
    expect(hits[0].where).toBe('frame.ts:2');
  });

  it('throws rather than under-reporting when it ends mid-literal', () => {
    expect(() => scanEmittedGlyphs(`const a = 'unterminated Δ`, 'broken.ts')).toThrow(
      /ended while still inside/,
    );
  });

  it('scans the real base.ts without desyncing', () => {
    // The regression case, against the actual file rather than a fixture.
    const src = readFileSync(join(HERE, 'base.ts'), 'utf8');
    expect(() => scanEmittedGlyphs(src, 'base.ts')).not.toThrow();
    // base.ts's one non-ASCII literal is the narrow no-break space it uses as the
    // French thousands separator (line ~276) — and it sits AFTER the regex on
    // line 35, so it is exactly what the desynced scanner went blind to. Finding
    // it proves the scanner stayed in sync through the regex.
    const found = new Set(scanEmittedGlyphs(src, 'base.ts').map((g) => g.codepoint));
    expect(found.has(0x202f), 'U+202F not found — the scanner desynced again').toBe(true);
    // base.ts builds XML_ILLEGAL from escaped RegExp source — `\uFFFE\uFFFF`,
    // `\uD800-\uDBFF`, `\uDC00-\uDFFF`. Escapes are decoded now (BUG-143), so
    // those would read as "glyphs the card emits" and fail every Worker's gate
    // on characters no font has or ever will: none of them is drawable.
    const undrawable = [...found].filter(
      (cp) =>
        (cp >= 0xd800 && cp <= 0xdfff) ||
        (cp >= 0xfdd0 && cp <= 0xfdef) ||
        (cp & 0xfffe) === 0xfffe,
    );
    expect(undrawable, 'a surrogate or noncharacter escape was reported as a glyph').toEqual([]);
  });

  /**
   * BUG-143: a glyph spelled as an escape is still a glyph the card draws. The
   * old scanner skipped every backslash pair, so `'\u2605'` reported nothing —
   * the FONT-002 star, invisible to the gate again. Every fixture here goes
   * through `String.raw` so it holds a real backslash: a plain `'\u2605'` in
   * this file would already BE a ★ and prove nothing.
   */
  describe('escapes inside literals are decoded (BUG-143)', () => {
    it('decodes \\uXXXX, \\u{…} and \\xHH to the character they spell', () => {
      expect(chars(String.raw`const a = '\u2605';`)).toEqual(['★']);
      expect(chars(String.raw`const a = "\u{2605}";`)).toEqual(['★']);
      expect(chars(String.raw`const a = '\xB0';`)).toEqual(['°']);
      expect(chars(String.raw`const a = ${'`'}\u0394E ${'$'}{n}${'`'};`)).toEqual(['Δ']);
    });

    it('decodes in upper- or lower-case hex and keeps scanning after the escape', () => {
      expect(chars(String.raw`const a = '\u00e9t\u00C9 Δ';`)).toEqual(['é', 'É', 'Δ']);
    });

    it('joins an escaped surrogate pair into ONE astral codepoint', () => {
      const hits = scanEmittedGlyphs(String.raw`const e = '\uD83C\uDFA8';`, 'test.ts');
      expect(hits.map((g) => g.codepoint)).toEqual([0x1f3a8]);
      expect(hits[0].presentation).toBe('emoji');
    });

    it('joins a surrogate pair in all four spellings (BUG-143 review)', () => {
      // JS joins the two UTF-16 units whichever escape form spells each half.
      for (const literal of [
        `'${BS}uD835${BS}uDC00'`,
        `'${BS}u{D835}${BS}u{DC00}'`,
        `'${BS}uD835${BS}u{DC00}'`,
        `'${BS}u{D835}${BS}uDC00'`,
      ]) {
        const hits = scanEmittedGlyphs(`const a = ${literal};`, 'test.ts');
        expect(
          hits.map((g) => g.codepoint),
          literal,
        ).toEqual([0x1d400]);
        expect(hits[0].presentation, literal).toBe('text');
      }
      // A braced high surrogate with no low one after it is still dropped alone.
      expect(chars(String.raw`const a = '\u{D835}\u{2605}';`)).toEqual(['★']);
    });

    it('accepts \\u{…} with any number of leading zeros (BUG-143 review)', () => {
      expect(chars(String.raw`const a = '\u{0002605}';`)).toEqual(['★']);
      expect(chars(String.raw`const a = '\u{00000000001F3A8}';`)).toEqual(['🎨']);
      // …but nothing past U+10FFFF, and not an empty pair of braces: those
      // consume only the backslash, so what follows is still read.
      expect(chars(String.raw`const a = String.raw${'`'}\u{110000}Δ \u{}α${'`'};`)).toEqual([
        'Δ',
        'α',
      ]);
    });

    it('reads an escaped U+FE0F as the selector it is (emoji presentation)', () => {
      const sword = scanEmittedGlyphs(String.raw`const i = '\u2694\uFE0F';`, 'test.ts');
      expect(sword[0].codepoint).toBe(0x2694);
      expect(sword[0].presentation).toBe('emoji');
      // Mixed spellings: a raw ⚔ followed by an escaped selector, and back.
      expect(scanEmittedGlyphs(String.raw`const i = '⚔\uFE0F';`, 'test.ts')[0].presentation).toBe(
        'emoji',
      );
      expect(scanEmittedGlyphs(`const i = '\\u2694\uFE0F';`, 'test.ts')[0].presentation).toBe(
        'emoji',
      );
      // The selector must be the VERY next character: one with a space before
      // it does not reach back across the space.
      expect(scanEmittedGlyphs(String.raw`const s = '★ \uFE0F';`, 'test.ts')[0].presentation).toBe(
        'text',
      );
      // …while an escaped ★ with no selector stays text — the FONT-002 case.
      expect(scanEmittedGlyphs(String.raw`const s = '\u2605';`, 'test.ts')[0].presentation).toBe(
        'text',
      );
    });

    it('records a non-ASCII identity escape (\\★ is ★)', () => {
      expect(chars(String.raw`const a = '\★';`)).toEqual(['★']);
      expect(chars(String.raw`const a = '\🎨';`)).toEqual(['🎨']);
    });

    it('drops lone surrogates and noncharacters — they can never be a glyph', () => {
      expect(
        chars(String.raw`const a = '\uD800 \uDFFF \uFFFE \uFFFF \uFDD0 \u{1FFFF} \u{D800}';`),
      ).toEqual([]);
      // A high surrogate escape NOT followed by a low one is still dropped, and
      // whatever follows it is still read.
      expect(chars(String.raw`const a = '\uD83C-\u2605';`)).toEqual(['★']);
    });

    it('treats ASCII-valued escapes as ASCII (nothing to report)', () => {
      expect(chars(String.raw`const a = '\u0041\x41\n\t\0\'\"\\';`)).toEqual([]);
    });

    it('does not throw on a malformed escape, and still reads what follows', () => {
      // Legal in a tagged template (String.raw`C:\users`); a compile error
      // anywhere else. Either way the following characters are real text.
      expect(chars(String.raw`const p = String.raw${'`'}C:\users\x Δ${'`'};`)).toEqual(['Δ']);
      // Only the backslash is consumed: a glyph right behind a broken escape
      // is still read.
      expect(chars(String.raw`const p = String.raw${'`'}\uZ★ \xG☆ \u{Z}Δ${'`'};`)).toEqual([
        '★',
        '☆',
        'Δ',
      ]);
    });

    it('reads a backslash before U+2028 / U+2029 as a line continuation, not a glyph', () => {
      // Built from codes: a raw LS/PS in this file trips no-irregular-whitespace.
      const LS = String.fromCharCode(0x2028);
      const PS = String.fromCharCode(0x2029);
      expect(chars(`const a = 'one \\${LS}two \\${PS}three Δ';`)).toEqual(['Δ']);
    });

    it('counts a backslash-newline continuation as a line (LF and CRLF)', () => {
      const lf = scanEmittedGlyphs(`const a = 'one \\\ntwo';\nconst b = 'Δ';`, 'f.ts');
      expect(lf.map((g) => g.where)).toEqual(['f.ts:3']);
      const crlf = scanEmittedGlyphs(`const a = 'one \\\r\ntwo';\r\nconst b = 'Δ';`, 'f.ts');
      expect(crlf.map((g) => g.where)).toEqual(['f.ts:3']);
    });
  });

  /**
   * BUG-143: `prev` was one character, so the `n` of `return` read as the tail
   * of an identifier and `return /'/` as a division — the quote then opened a
   * string and the scanner desynced. With an even number of quote flips after
   * it, nothing threw at EOF and every literal in between went unscanned.
   */
  describe('regex vs division after a keyword (BUG-143)', () => {
    // `of` is not here: it is contextual, a keyword only inside a `for` header
    // (see its own test below). `await` and `yield` are reserved words in
    // module / strict code, so they are keywords unconditionally.
    const KEYWORDS = [
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
    ];
    for (const kw of KEYWORDS) {
      it(`reads \`${kw} /'/\` as a regex, not a division`, () => {
        const src = `x = ${kw} /'/;\nconst a = 'Δ';\nconst b = 'α';\n`;
        expect(chars(src)).toEqual(['Δ', 'α']);
      });
    }

    it('the BUG-143 reproduction: two regexes after return hid a literal with NO throw', () => {
      // Four quote flips — even — so the old scanner reached EOF in code state,
      // skipped its own desync check, and returned [] for a file that draws Δ.
      const src = [
        'function q(s: string): boolean {',
        "  return /'/.test(s);",
        '}',
        "const label = 'ΔE';",
        'function r(s: string): boolean {',
        "  return /'/.test(s);",
        '}',
      ].join('\n');
      expect(chars(src)).toEqual(['Δ']);
    });

    it('a keyword used as a property name is an operand — `obj.return / 2` divides', () => {
      expect(chars(`const r = obj.return / 2; const label = 'Δ';`)).toEqual(['Δ']);
      expect(chars(`const r = obj?.in / 2; const label = 'Δ';`)).toEqual(['Δ']);
    });

    it('an identifier that merely CONTAINS a keyword is an operand (`returned / 2`)', () => {
      expect(chars(`const r = returned / 2; const s = typeofs / 2; const label = 'Δ';`)).toEqual([
        'Δ',
      ]);
    });

    it('a closed string literal is an operand — `"10" / 2` divides', () => {
      expect(chars(`const n = '10' / 2; const label = 'Δ';`)).toEqual(['Δ']);
      expect(chars(`const n = ${'`'}10${'`'} / 2; const label = 'Δ';`)).toEqual(['Δ']);
    });

    it('a closed regex literal is an operand — the next `/` divides', () => {
      expect(chars(`const n = /a/ / 2; const label = 'Δ';`)).toEqual(['Δ']);
    });

    it('postfix ++/-- and a TypeScript non-null `!` leave an operand — the next `/` divides', () => {
      // One division per line: two on a line would pair up into a fake regex
      // and hide a misread.
      expect(chars(`const r = i++ / 2;\nconst label = 'Δ';`)).toEqual(['Δ']);
      expect(chars(`const r = j-- / 2;\nconst label = 'Δ';`)).toEqual(['Δ']);
      expect(chars(`const r = width! / 2;\nconst label = 'Δ';`)).toEqual(['Δ']);
      expect(chars(`const r = get()! / 2;\nconst label = 'Δ';`)).toEqual(['Δ']);
    });

    it('prefix `!` and `!=` do not — the next `/` opens a regex', () => {
      expect(chars(`const r = !/'/.test(s);\nconst label = 'Δ';`)).toEqual(['Δ']);
      expect(chars(`const r = a != /'/.test(s);\nconst label = 'Δ';`)).toEqual(['Δ']);
    });

    it('a keyword after a spread `...` is still a keyword, not a property name', () => {
      expect(chars(`const parts = [...await /'/.exec(s)];\nconst label = 'Δ';`)).toEqual(['Δ']);
    });

    it('a non-ASCII identifier is one operand — `café / 2` divides', () => {
      expect(chars(`const r = café / 2; const label = 'Δ';`)).toEqual(['Δ']);
    });

    it('honours an escaped `]` inside a regex character class', () => {
      // The class is `[\]/'"]`; ending it at the escaped bracket let the `/`
      // close the regex early and the `'` open a string.
      expect(
        chars(String.raw`const re = /[\]/'"]/g;` + `\nconst label = 'α';\nconst b = 'Δ';`),
      ).toEqual(['α', 'Δ']);
    });

    // The BUG-143 review's smaller token-heuristic gaps. Where a fixture puts
    // two `/` on one line, a misread pairs them into a fake regex that hides the
    // ★ between them with no throw — the silent shape, not the loud one.

    it('`of` is a keyword only directly inside a `for` header', () => {
      expect(chars(`for (const c of /'/.exec(s) ?? []) f('★');\nconst a = 'Δ';`)).toEqual([
        '★',
        'Δ',
      ]);
      // Anywhere else it is an identifier, so `/` after it divides.
      expect(chars(`const of = 4; const r = of / 2 + '★' + of / 2;`)).toEqual(['★']);
      // Including inside an ordinary paren nested in a `for` header.
      expect(chars(`for (const x of f(of / 2 + '★' + of / 2)) g(x);`)).toEqual(['★']);
    });

    it('a private name is an operand — `this.#in / 2` divides', () => {
      expect(chars(`const r = this.#in / 2;\nconst label = 'Δ';`)).toEqual(['Δ']);
      expect(chars(`const r = this.#delete / 2 + '★' + n / 2;`)).toEqual(['★']);
      expect(chars(`const r = #typeof / 2 + '★' + n / 2;`)).toEqual(['★']);
      // …and the `in` of a brand check (`#x in obj`) is still the keyword.
      expect(chars(`const r = #x in o ? /'/.test(s) : 0;\nconst label = 'Δ';`)).toEqual(['Δ']);
    });

    it('a `.` that ends a number keeps it an operand — `1. / 2` divides', () => {
      expect(chars(`const n = 1. / 2;\nconst label = 'Δ';`)).toEqual(['Δ']);
      expect(chars(`const n = 1. / 2 + '★' + 3 / 2;`)).toEqual(['★']);
      expect(chars(`const n = 1.e3 / 2 + '★' + 1.5.toFixed(1) / 2;`)).toEqual(['★']);
      // A member access on a number is still a member access.
      expect(chars(`const n = 1..toString() / 2 + '★' + n / 2;`)).toEqual(['★']);
    });

    it('a U+2028 / U+2029 ends a line comment, as it does in JS', () => {
      // Built from codes: a raw LS/PS in this file trips no-irregular-whitespace.
      const LS = String.fromCharCode(0x2028);
      const PS = String.fromCharCode(0x2029);
      expect(chars(`// note${LS}const a = 'Δ';`)).toEqual(['Δ']);
      expect(chars(`// note${PS}const a = 'α';`)).toEqual(['α']);
    });
  });

  /**
   * BUG-143 review: a `)` that closes an `if` / `while` / `for` / `with` header
   * does NOT end an expression — a `/` after it opens a regex. Reading every `)`
   * as an operand misread `if (ok) /'/` as a division, and two such misreads on
   * ONE line paired their quotes up, so nothing threw and the literal between
   * them was dropped. The first four cases are the reviewers' repros.
   */
  describe('a regex after an if/while/for/with header (BUG-143 review)', () => {
    it('two header regexes on one line no longer hide the literal between them', () => {
      expect(chars(`if (x) /'/.test(a) && '★' && /'/.test(b);\nconst z = 1;\n`)).toEqual(['★']);
      expect(chars(`while (m) /'/.exec(s) ? f('★') : /'/.exec(t);\n`)).toEqual(['★']);
      expect(chars(`if (isCjk) /'/.test(name) || out.push('★'), /'/.test(x);\n`)).toEqual(['★']);
    });

    it('an apostrophe in a trailing comment no longer masks the misread', () => {
      expect(chars(`if (ok) /'/.test(s) && f('Δ'); // it's fine\nconst b = 'α';`)).toEqual([
        'Δ',
        'α',
      ]);
    });

    it('covers for, for await and with, and parens nested inside the header', () => {
      expect(chars(`for (;;) /'/.test(a) && '★' && /'/.test(b);`)).toEqual(['★']);
      expect(chars(`for await (const x of y) /'/.test(x) && '★' && /'/.test(z);`)).toEqual(['★']);
      expect(chars(`with (o) /'/.test(a) && '★' && /'/.test(b);`)).toEqual(['★']);
      expect(chars(`if (f(a, (b))) /'/.test(s) && '★' && /'/.test(t);`)).toEqual(['★']);
      expect(chars(`if /* why */ (a) /'/.test(s) && '★' && /'/.test(t);`)).toEqual(['★']);
    });

    it('any other `)` still ends an expression — `f(x) / 2` divides', () => {
      expect(chars(`const r = f(x) / 2 + '★' + y / 2;`)).toEqual(['★']);
      // A method NAMED like a keyword is a call, not a header.
      expect(chars(`const r = obj.if(x) / 2 + '★' + y / 2;`)).toEqual(['★']);
      // The call after a header's own `)` is an ordinary call.
      expect(chars(`if (a) b(c) / 2 + '★' + d / 2;`)).toEqual(['★']);
    });
  });

  /**
   * A `}` that closes a TYPE or object literal ends an expression, so a `/`
   * after it divides; a `}` that closes a block does not. The scanner used to
   * read every `}` as a block's, on the claim that TypeScript rejects a
   * division after a literal (TS2362) — but a type literal after `satisfies`,
   * `as`, `&` or `|` is valid strict TypeScript right there
   * (`x satisfies {} / 2`), and the misread regex did not throw: the next `/`
   * on the line closed it (a division, or the first slash of a `//` comment)
   * and the literal between was dropped. Given declarations for their free
   * names, the fixtures below all pass `tsc --strict`, bar the lexical-only `|`
   * case.
   */
  describe('a `}` that closes a literal opened after as / satisfies / & / | is an operand', () => {
    const T = '`';
    const D = '$';

    it("the reviewers' repros: `satisfies {}` and `as number & {}` divide", () => {
      expect(chars(`const n = x satisfies {} / 2 + '★'; // ok`)).toEqual(['★']);
      expect(chars(`const n = x as number & {} / 2 + '★' + 1 / 2;`)).toEqual(['★']);
    });

    it('a nested literal, a substitution, and a `|` union member', () => {
      expect(chars(`const n = x as number & { a: { b: 1 } } / 2 + '★' + 1 / 2;`)).toEqual(['★']);
      expect(chars(`const t = ${T}${D}{x satisfies {} / 2} ★${T};`)).toEqual(['★']);
      // Lexical only: a `{` after `|` is a literal whatever the types say.
      expect(chars(`const n = x as number & {} | {} / 2 + '★' + 1 / 2;`)).toEqual(['★']);
    });

    it('a block still ends nothing: `/` after a case, if or labelled block opens a regex', () => {
      // `:` is deliberately NOT a literal opener — `case 1: {`, `default: {` and
      // `label: {` open blocks there, and a regex can start the next statement.
      const src = `switch (k) {\n  case 1: {\n    f();\n  } /'/.test(s) && f('★') && /'/.test(t);\n}\n`;
      expect(chars(src)).toEqual(['★']);
      expect(chars(`if (a) {} /'/.test(s) && '★' && /'/.test(t);`)).toEqual(['★']);
      expect(chars(`lbl: {} /'/.test(s) && '★' && /'/.test(t);`)).toEqual(['★']);
    });

    it('known limit: a `>` that closes type arguments reads as greater-than', () => {
      // Valid strict TypeScript (`Readonly<number>` is `number`), but telling a
      // type argument list's `>` from a comparison needs a parser: the `/`
      // after it opens a regex, the next `/` on the line closes it, and the ★
      // between is dropped with no throw. Pinned so the limit stays visible.
      expect(chars(`const n = x as Readonly<number> / 2 + '★' + 1 / 2;`)).toEqual([]);
    });
  });

  /**
   * A `${…}` substitution is CODE, and a template inside it is a template. The
   * old scanner read the whole outer template as one span, so the inner
   * backtick "closed" it and the inner template's text was read as code:
   * `${voted ? `★` : ''}` — the FONT-002 shape — reported nothing, and an SVG
   * fragment like `<tspan>…</tspan>` there read `</` as a regex opener.
   */
  describe('templates nested inside ${…} (BUG-143)', () => {
    const T = '`';
    const D = '$';

    it('records a glyph inside a template nested in a substitution', () => {
      expect(chars(`const s = ${T}${D}{n}${D}{voted ? ${T}★${T} : ''}${T};`)).toEqual(['★']);
    });

    it('does not read SVG markup inside a nested template as a regex', () => {
      const src = `const s = ${T}<text>${D}{cond ? ${T}<tspan>x</tspan>${T} : ''}</text>${T};\nconst a = 'Δ';\n`;
      expect(chars(src)).toEqual(['Δ']);
    });

    it('counts braces in the substitution — an arrow body does not end it', () => {
      const src = `const s = ${T}${D}{xs.map((x) => { return ${T}★${D}{x}${T}; })} Δ${T};`;
      expect(chars(src)).toEqual(['★', 'Δ']);
      // Code after the arrow body is still code: its comment is skipped and its
      // template is a template. Ending the substitution at the body's `}` would
      // read the comment as text and the template as code.
      expect(chars(`const s = ${T}${D}{f(() => { return 1; }) /* Δ */} α${T};`)).toEqual(['α']);
      expect(chars(`const s = ${T}${D}{f(() => { return 1; }, ${T}★${T})}${T};`)).toEqual(['★']);
    });

    it('nests three deep', () => {
      expect(
        chars(`const s = ${T}a ${D}{b ? ${T}c ${D}{d ? ${T}★${T} : ''} α${T} : ''} Δ${T};`),
      ).toEqual(['★', 'α', 'Δ']);
    });

    it('skips a comment inside a substitution (it is code, not text)', () => {
      expect(chars(`const s = ${T}${D}{/* Δ */ x} α${T};`)).toEqual(['α']);
    });

    it('reads a string inside a substitution as a string', () => {
      expect(chars(`const s = ${T}${D}{ok ? '★' : "☆"}${T};`)).toEqual(['★', '☆']);
    });

    it('leaves an escaped \\${ and a bare $ as template text', () => {
      expect(chars(String.raw`const s = ${T}\${'{'}x} Δ${T};`)).toEqual(['Δ']);
      expect(chars(`const s = ${T}${D}5 Δ ${D} {α}${T};`)).toEqual(['Δ', 'α']);
    });

    it('throws when the file ends inside an unclosed substitution', () => {
      expect(() => scanEmittedGlyphs(`const s = ${T}a ${D}{b`, 'open.ts')).toThrow(
        /open\.ts ended while still inside/,
      );
    });
  });

  /**
   * Fail closed: a `'`/`"` string and a regex literal cannot contain a raw line
   * break, so reaching one in those states means the scanner misjudged a `/` —
   * a case the token heuristic still cannot see (an object literal's `}` after
   * `=` reads as the end of a block, so `{} / 2` opens a regex). Throw there
   * instead of carrying the desync into later lines. It only fires when
   * nothing later on the line closes the fake literal, so each fixture is built
   * to reach its line break inside one.
   */
  describe('a raw line break inside a string or regex is a desync (BUG-143)', () => {
    it('throws when a misread regex opens a string that runs off the line', () => {
      // The misread regex `/ 2 + '/` ends at the quoted slash, so the closing
      // quote then opens a string that reaches the line break.
      const src = `const n = {} / 2 + '/';\nconst a = 'Δ';\nconst b = 'α';\n`;
      expect(() => scanEmittedGlyphs(src, 'desync.ts')).toThrow(
        /desync\.ts:1.*line break inside a ' literal/,
      );
    });

    it('throws when a misread division opens a regex that runs off the line', () => {
      const src = `const n = {} / 2;\nconst a = 'Δ';\n`;
      expect(() => scanEmittedGlyphs(src, 'desync.ts')).toThrow(
        /desync\.ts:1.*line break inside a regex literal/,
      );
    });

    it('an escaped line break inside a regex is still a line break', () => {
      // No trailing newline: skipping the escaped one would otherwise just
      // throw at the NEXT line break with the same message.
      const src = `const n = {} /\\\nconst a = 'Δ';`;
      expect(() => scanEmittedGlyphs(src, 'desync.ts')).toThrow(
        /desync\.ts:1.*line break inside a regex literal/,
      );
    });

    it('a lone CR ends a line too', () => {
      expect(() => scanEmittedGlyphs(`const a = 'x\ry';`, 'cr.ts')).toThrow(
        /line break inside a ' literal/,
      );
    });

    it('does NOT throw on a line break inside a template literal (those may span lines)', () => {
      expect(chars('const t = `one\ntwo Δ`;')).toEqual(['Δ']);
    });
  });

  /**
   * BUG-143 review: decoding escapes reaches strings nothing renders — RegExp
   * sources, sanitizer arguments, emoji sequences — so a control or format
   * character spelled there must not read as a glyph the fonts have to cover.
   * Each range is pinned at its ends, and its visible neighbours stay reported,
   * so dropping or widening any one range turns a test red.
   */
  describe('characters nothing draws are never reported (BUG-143 review)', () => {
    /** `\u{…}` source text for a codepoint (an escape, never the raw character). */
    const esc = (cp: number): string => `\\u{${cp.toString(16)}}`;

    const NEVER: Array<[string, number[]]> = [
      ['C1 controls', [0x80, 0x85, 0x9f]],
      ['the soft hyphen', [0xad]],
      ['zero-width spaces, joiners and direction marks', [0x200b, 0x200d, 0x200f]],
      ['bidi embeddings and overrides', [0x202a, 0x202e]],
      ['word joiner, invisible operators and bidi isolates', [0x2060, 0x2068, 0x206f]],
      ['variation selectors (incl. the U+FE0F emoji selector)', [0xfe00, 0xfe0e, 0xfe0f]],
      ['the byte-order mark', [0xfeff]],
      ['the combining enclosing keycap', [0x20e3]],
      ['tag characters (emoji flag sequences)', [0xe0001, 0xe0020, 0xe007f]],
      ['the variation selectors supplement', [0xe0100, 0xe01ef]],
    ];
    for (const [what, cps] of NEVER) {
      it(`drops ${what}`, () => {
        for (const cp of cps) {
          expect(chars(`const a = '${esc(cp)}';`), `U+${cp.toString(16)}`).toEqual([]);
        }
      });
    }

    it('still reports the visible neighbours of every dropped range', () => {
      const KEEP = [
        0xa0, 0xac, 0xae, 0x200a, 0x2010, 0x2027, 0x202f, 0x205f, 0x2070, 0x20e2, 0x20e4, 0xfdfc,
        0xfe10, 0xfefc, 0xff01,
      ];
      const src = `const a = '${KEEP.map(esc).join('')}';`;
      expect(scanEmittedGlyphs(src, 'test.ts').map((g) => g.codepoint)).toEqual(KEEP);
    });

    it('a selector still marks the glyph before it, though it is not one itself', () => {
      const hits = scanEmittedGlyphs(`const i = '${esc(0x2694)}${esc(0xfe0f)}';`, 'test.ts');
      expect(hits.map((g) => [g.codepoint, g.presentation])).toEqual([[0x2694, 'emoji']]);
      // A keycap sequence (digit, selector, keycap) reports nothing at all.
      expect(chars(`const k = '1${esc(0xfe0f)}${esc(0x20e3)}';`)).toEqual([]);
    });

    it('a RegExp range belongs in a regex literal: a string source reports its ends', () => {
      // The module docblock's advice, pinned: escapes in a STRING are decoded
      // (they might be drawn), escapes in a regex literal never are.
      const range = `[${BS}u4E00-${BS}u9FFF]`;
      expect(chars(`const re = new RegExp('${range}');`)).toEqual([
        String.fromCharCode(0x4e00),
        String.fromCharCode(0x9fff),
      ]);
      expect(chars(`const re = /${range}/u;`)).toEqual([]);
    });
  });

  /**
   * BUG-143 review: `codepoint >= U+1F000` used to mean "emoji", which also
   * swept up CJK Extension B and beyond (U+20000+). The font gate skips emoji,
   * so an ideograph like 𠮷 passed it and drew a tofu box.
   *
   * The range that replaced it (U+1F000–U+1FAFF, "the emoji blocks") repeated
   * the mistake one level down: those blocks also hold symbols whose DEFAULT
   * presentation is text — mahjong and domino tiles, enclosed alphanumerics,
   * the geometric shapes and arrows supplements, chess symbols. Labelled emoji,
   * they passed the gate and would have drawn tofu. A bare character is emoji
   * only when Unicode says it presents as one by default (Emoji_Presentation);
   * Extended_Pictographic would not do, because it matches the bare ★ too.
   */
  describe('emoji presentation is a default of the character, not of its block (BUG-143 review)', () => {
    const presentations = (src: string): Array<[number, string]> =>
      scanEmittedGlyphs(src, 'test.ts').map((g) => [g.codepoint, g.presentation]);
    /** `\u{…}` source text for a codepoint (an escape, never the raw character). */
    const esc = (cp: number): string => `${BS}u{${cp.toString(16)}}`;
    const YOSHI = String.fromCodePoint(0x20bb7);

    it('CJK Extension B and up is text the fonts must cover, raw or escaped', () => {
      expect(presentations(`const a = '${YOSHI}';`)).toEqual([[0x20bb7, 'text']]);
      expect(presentations(`const a = '${BS}uD842${BS}uDFB7';`)).toEqual([[0x20bb7, 'text']]);
      expect(presentations(`const a = '${esc(0x30000)}';`)).toEqual([[0x30000, 'text']]);
    });

    it('text-default symbols inside U+1F000–U+1FAFF are text the fonts must cover', () => {
      // A mahjong tile, a squared Latin letter, a geometric-shapes-extended
      // circle, a Supplemental Arrows-C arrow, a chess piece.
      const TEXT = [0x1f000, 0x1f130, 0x1f784, 0x1f812, 0x1fa00];
      expect(presentations(`const a = '${TEXT.map(esc).join('')}';`)).toEqual(
        TEXT.map((cp) => [cp, 'text']),
      );
    });

    it('an astral emoji-default character is emoji with no selector', () => {
      // The palette and the red-dragon mahjong tile (the one emoji tile beside
      // U+1F000).
      const EMOJI = [0x1f3a8, 0x1f004];
      expect(presentations(`const a = '${EMOJI.map(esc).join('')}';`)).toEqual(
        EMOJI.map((cp) => [cp, 'emoji']),
      );
    });

    it('a bare BMP emoji-default character stays text — the gate fails closed there', () => {
      // ⭐ ✅ ⚡ are Emoji_Presentation, but a bare BMP pictograph may be drawn
      // on a card; only a following U+FE0F declares it message text.
      const BMP = [0x2b50, 0x2705, 0x26a1];
      expect(presentations(`const a = '${BMP.map(esc).join('')}';`)).toEqual(
        BMP.map((cp) => [cp, 'text']),
      );
      expect(presentations(`const a = '${esc(0x2b50)}${esc(0xfe0f)}';`)).toEqual([[0x2b50, 'emoji']]);
    });

    it('a bare text-default pictograph is text — the FONT-002 star and the bare dagger', () => {
      // Both are Extended_Pictographic; neither presents as emoji by default.
      expect(presentations(`const a = '${esc(0x2605)}${esc(0x1f5e1)}';`)).toEqual([
        [0x2605, 'text'],
        [0x1f5e1, 'text'],
      ]);
    });

    it('a following U+FE0F still makes a text-default character emoji', () => {
      // preset-swatch.ts's CATEGORY_DISPLAY writes its dagger this way.
      expect(presentations(`const a = '${esc(0x1f5e1)}${esc(0xfe0f)}';`)).toEqual([
        [0x1f5e1, 'emoji'],
      ]);
    });

    it('the astral blocks around the old range are text', () => {
      const AROUND = [0x1eef0, 0x1fb00, 0x1d400];
      expect(presentations(`const a = '${AROUND.map(esc).join('')}';`)).toEqual(
        AROUND.map((cp) => [cp, 'text']),
      );
    });
  });
});
