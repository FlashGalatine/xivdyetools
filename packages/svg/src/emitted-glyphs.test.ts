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
    expect(() => scanEmittedGlyphs(`const a = 'unterminated Δ`, 'broken.ts')).toThrow(/ended while still inside/);
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
  });
});
