/**
 * Which bundled CJK face draws a kanji is decided by the order the faces are
 * LOADED, not by the order a card's font-family list names them.
 *
 * Every card text stack is Latin-led (`Onest, Noto Sans JP, Noto Sans SC,
 * Noto Sans KR` and the Space Grotesk / Fragment Mono variants), so Onest is
 * the primary face. A glyph Onest lacks is filled, in resvg-wasm 2.6.2, from
 * the loaded faces in `getFontBuffers()` order; the JP / SC / KR names in the
 * stack do not steer it. Until 2026-10-06 the buffers always went SC, KR, JP,
 * so in Japanese text every kanji SC also carries drew from SC, in its Chinese
 * letterform wherever the two designs differ: item names on /glamour and the
 * bot's own ja strings alike.
 * `renderSvgToPng` now takes the user's locale and loads JP first for ja
 * only, which leaves every zh / ko / en render byte-identical.
 *
 * This renders through the REAL `renderSvgToPng` → `getFontBuffers` path:
 * every `.ttf` import and the resvg WASM are mocked with their real bytes
 * off disk. (Unmocked, a `.ttf` import resolves to a URL string under vitest
 * and yields a zero-length buffer, DEAD-005.) Only the reference renders, a
 * single CJK face each, are built by hand.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-wasm';
import { FONTS } from '@xivdyetools/svg';
import { initRenderer, renderSvgToPng } from './svg/renderer.js';
import { getFontBuffers } from './fonts.js';

const fontBytes = vi.hoisted(() => async (file: string): Promise<{ default: ArrayBuffer }> => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const b = fs.readFileSync(path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'fonts', file));
  return { default: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
});

vi.mock('../fonts/SpaceGrotesk-Regular.ttf', () => fontBytes('SpaceGrotesk-Regular.ttf'));
vi.mock('../fonts/SpaceGrotesk-SemiBold.ttf', () => fontBytes('SpaceGrotesk-SemiBold.ttf'));
vi.mock('../fonts/SpaceGrotesk-Bold.ttf', () => fontBytes('SpaceGrotesk-Bold.ttf'));
vi.mock('../fonts/Onest-Regular.ttf', () => fontBytes('Onest-Regular.ttf'));
vi.mock('../fonts/Onest-SemiBold.ttf', () => fontBytes('Onest-SemiBold.ttf'));
vi.mock('../fonts/Onest-Bold.ttf', () => fontBytes('Onest-Bold.ttf'));
vi.mock('../fonts/FragmentMono-Regular.ttf', () => fontBytes('FragmentMono-Regular.ttf'));
vi.mock('../fonts/NotoSansSC-Subset.ttf', () => fontBytes('NotoSansSC-Subset.ttf'));
vi.mock('../fonts/NotoSansKR-Subset.ttf', () => fontBytes('NotoSansKR-Subset.ttf'));
vi.mock('../fonts/NotoSansJP-Subset.ttf', () => fontBytes('NotoSansJP-Subset.ttf'));
vi.mock('@resvg/resvg-wasm/index_bg.wasm', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { createRequire } = await import('node:module');
  const resvgEntry = createRequire(import.meta.url).resolve('@resvg/resvg-wasm');
  return { default: fs.readFileSync(path.join(path.dirname(resvgEntry), 'index_bg.wasm')) };
});

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(HERE, '..', 'fonts');
const disk = (file: string): Uint8Array => new Uint8Array(readFileSync(join(FONTS_DIR, file)));
const LATIN_FILES = [
  'SpaceGrotesk-Regular.ttf',
  'SpaceGrotesk-SemiBold.ttf',
  'SpaceGrotesk-Bold.ttf',
  'Onest-Regular.ttf',
  'Onest-SemiBold.ttf',
  'Onest-Bold.ttf',
  'FragmentMono-Regular.ttf',
];
const LATIN = LATIN_FILES.map(disk);

/** The faces fonts.ts imports, read off its source (as font-faces.test.ts does). */
const IMPORTED = [...readFileSync(join(HERE, 'fonts.ts'), 'utf8').matchAll(/from '\.\.\/fonts\/([^']+\.ttf)'/g)].map(
  (m) => m[1],
);
const JP = disk('NotoSansJP-Subset.ttf');
const SC = disk('NotoSansSC-Subset.ttf');
const KR = disk('NotoSansKR-Subset.ttf');

/** The /glamour item-name style: 13 px at weight 600, rendered at 2x. */
function card(text: string, family: string = FONTS.primaryCjk, weight = 600): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="24">` +
    `<rect width="240" height="24" fill="#fff"/>` +
    `<text x="4" y="18" font-family="${family}" font-size="13" font-weight="${weight}" fill="#000">${text}</text>` +
    `</svg>`
  );
}

/** A render with exactly these faces loaded, otherwise as `renderSvgToPng` renders. */
function renderWith(svg: string, fontBuffers: Uint8Array[]): Uint8Array {
  return new Resvg(svg, {
    fitTo: { mode: 'zoom', value: 2 },
    font: { fontBuffers, defaultFontFamily: 'Onest' },
  })
    .render()
    .asPng();
}

const jpOnly = (svg: string): Uint8Array => renderWith(svg, [...LATIN, JP]);
const scOnly = (svg: string): Uint8Array => renderWith(svg, [...LATIN, SC]);
/** The order every locale loaded before 2026-10-06, and every locale but ja still does. */
const scFirst = (svg: string): Uint8Array => renderWith(svg, [...LATIN, SC, KR, JP]);

const same = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Kanji both subsets carry whose JP and SC letterforms differ at card size. */
const SHARED_KANJI = [...'骨直角写刃化'];

beforeAll(async () => {
  await initRenderer();
});

describe('the CJK face a kanji draws from follows the user locale', () => {
  // The vi.mock list above must mirror fonts.ts. A face fonts.ts gains but this
  // file does not mock arrives as a zero-length buffer (DEAD-005) that resvg
  // ignores, and the renders below would compare against a font set
  // production does not load.
  it('mocks every face fonts.ts imports with its real bytes', () => {
    expect(IMPORTED.length, 'no .ttf imports found in fonts.ts').toBeGreaterThan(0);
    const buffers = getFontBuffers();
    expect(buffers).toHaveLength(IMPORTED.length);
    for (const b of buffers) expect(b.byteLength).toBeGreaterThan(0);
    expect(LATIN_FILES).toEqual(IMPORTED.filter((f) => !f.startsWith('NotoSans')));
  });

  it('measures real letterforms: each kanji draws differently from JP alone and from SC alone', () => {
    for (const ch of SHARED_KANJI) {
      expect(same(jpOnly(card(ch)), scOnly(card(ch))), `${ch}: JP and SC draw it identically`).toBe(false);
    }
  });

  for (const [stack, family, weight] of [
    ['body', FONTS.primaryCjk, 600],
    ['display', FONTS.headerCjk, 700],
  ] as const) {
    it(`ja (${stack} stack): a kanji SC also carries draws from JP, in Japanese letterforms`, async () => {
      for (const ch of SHARED_KANJI) {
        const svg = card(ch, family, weight);
        const ja = await renderSvgToPng(svg, { scale: 2, locale: 'ja' });
        expect(same(ja, jpOnly(svg)), `${ch}: ja render is not the JP-only render`).toBe(true);
        expect(same(ja, scOnly(svg)), `${ch}: ja render is the SC-only render`).toBe(false);
      }
    });

    it(`zh (${stack} stack): the same kanji still draws from SC`, async () => {
      for (const ch of SHARED_KANJI) {
        const svg = card(ch, family, weight);
        const zh = await renderSvgToPng(svg, { scale: 2, locale: 'zh' });
        expect(same(zh, scOnly(svg)), `${ch}: zh render is not the SC-only render`).toBe(true);
      }
    });
  }

  it('ja: a whole item name (kana + kanji) draws exactly as with JP alone', async () => {
    // Two of the names the 2026-10-06 review found still drawing out of SC.
    for (const name of ['守りの指輪', '午形兜']) {
      const svg = card(name);
      expect(same(await renderSvgToPng(svg, { scale: 2, locale: 'ja' }), jpOnly(svg)), name).toBe(true);
    }
  });

  it.each([['zh'], ['ko'], ['en'], ['de'], ['fr']] as const)(
    '%s renders byte-identically to the SC, KR, JP order (Latin, Hangul and kanji)',
    async (locale) => {
      const svg = card('Pure White 骨 직각 角');
      expect(same(await renderSvgToPng(svg, { scale: 2, locale }), scFirst(svg))).toBe(true);
    },
  );
});
