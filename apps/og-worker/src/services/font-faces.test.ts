/**
 * The brand faces must ship as STATIC instances (Regular / SemiBold / Bold).
 *
 * resvg's font database cannot move a variable font's axes: one variable
 * file exposes exactly its default instance, so every `font-weight` the band
 * cards ask for (600 on names) silently rendered at that single weight — and
 * Space Grotesk's default instance is Light (300). This renders the same word
 * at 400 / 600 / 700 through the real resvg-wasm, with precisely the faces
 * `fonts.ts` imports, and demands the three weights come out different.
 * Regenerate the faces with apps/discord-worker/scripts/instance-latin-fonts.py
 * --app og-worker.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** The faces the Worker bundles — read off fonts.ts so this cannot drift from it. */
const fontsTs = readFileSync(join(HERE, 'fonts.ts'), 'utf8');
const bundled = [...fontsTs.matchAll(/from '\.\.\/fonts\/([^']+\.ttf)'/g)].map((m) => m[1]);
const fontBuffers = bundled.map((f) => new Uint8Array(readFileSync(join(HERE, '..', 'fonts', f))));

function render(family: string, weight: number): Uint8Array {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="48">` +
    `<rect width="200" height="48" fill="#fff"/>` +
    `<text x="8" y="34" font-family="${family}" font-size="26" font-weight="${weight}" fill="#000">Pure White</text>` +
    `</svg>`;
  return new Resvg(svg, {
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: family },
  })
    .render()
    .asPng();
}

const same = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

beforeAll(async () => {
  const wasm = readFileSync(join(dirname(require.resolve('@resvg/resvg-wasm')), 'index_bg.wasm'));
  try {
    await initWasm(wasm);
  } catch (e) {
    // A second init in the same process throws "Already initialized" — fine.
    if (!/already/i.test(String(e))) throw e;
  }
});

describe('bundled brand faces carry real weights', () => {
  it('fonts.ts imports at least one face per brand family', () => {
    expect(bundled.some((f) => f.startsWith('SpaceGrotesk-'))).toBe(true);
    expect(bundled.some((f) => f.startsWith('Onest-'))).toBe(true);
  });

  it('ships no variable font — resvg would render only its default instance', () => {
    expect(bundled.filter((f) => /VariableFont/i.test(f))).toEqual([]);
  });

  for (const family of ['Space Grotesk', 'Onest']) {
    it(`${family}: 400, 600 and 700 render as three different faces`, () => {
      const regular = render(family, 400);
      const semibold = render(family, 600);
      const bold = render(family, 700);

      expect(regular.length).toBeGreaterThan(100);
      expect(same(regular, semibold), '400 and 600 rendered identically').toBe(false);
      expect(same(semibold, bold), '600 and 700 rendered identically').toBe(false);
      expect(same(regular, bold), '400 and 700 rendered identically').toBe(false);
    });
  }
});
