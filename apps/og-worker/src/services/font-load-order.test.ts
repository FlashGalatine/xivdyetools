/**
 * FONT-001: resvg falls back through loaded faces, not the Latin-led SVG
 * font-family list. Exercise the real Worker renderer with real bundled bytes
 * so Chinese cards cannot silently draw shared ideographs in Japanese forms.
 * Binary imports alone are replaced: Vitest otherwise supplies URL strings.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-wasm';
import { getFontBuffers } from './fonts';
import { renderOGImage } from './renderer';
import { generateAccessibilityOG } from './svg/accessibility';
import { GROUND, STACKS } from './svg/tokens';
import app from '../index';

const fontBytes = vi.hoisted(() => async (file: string): Promise<{ default: ArrayBuffer }> => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const bytes = fs.readFileSync(path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'fonts', file));
  return { default: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
});
vi.mock('../fonts/SpaceGrotesk-Regular.ttf', () => fontBytes('SpaceGrotesk-Regular.ttf'));
vi.mock('../fonts/SpaceGrotesk-SemiBold.ttf', () => fontBytes('SpaceGrotesk-SemiBold.ttf'));
vi.mock('../fonts/SpaceGrotesk-Bold.ttf', () => fontBytes('SpaceGrotesk-Bold.ttf'));
vi.mock('../fonts/Onest-Regular.ttf', () => fontBytes('Onest-Regular.ttf'));
vi.mock('../fonts/Onest-SemiBold.ttf', () => fontBytes('Onest-SemiBold.ttf'));
vi.mock('../fonts/Onest-Bold.ttf', () => fontBytes('Onest-Bold.ttf'));
vi.mock('../fonts/FragmentMono-Regular.ttf', () => fontBytes('FragmentMono-Regular.ttf'));
vi.mock('../fonts/NotoSansJP-Subset.ttf', () => fontBytes('NotoSansJP-Subset.ttf'));
vi.mock('../fonts/NotoSansSC-Subset.ttf', () => fontBytes('NotoSansSC-Subset.ttf'));
vi.mock('../fonts/NotoSansKR-Subset.ttf', () => fontBytes('NotoSansKR-Subset.ttf'));
vi.mock('@resvg/resvg-wasm/index_bg.wasm', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { createRequire } = await import('node:module');
  const entry = createRequire(import.meta.url).resolve('@resvg/resvg-wasm');
  return { default: fs.readFileSync(path.join(path.dirname(entry), 'index_bg.wasm')) };
});

const HERE = dirname(fileURLToPath(import.meta.url));
const disk = (file: string): Uint8Array => new Uint8Array(readFileSync(join(HERE, '..', 'fonts', file)));
const IMPORTED = [...readFileSync(join(HERE, 'fonts.ts'), 'utf8').matchAll(/from '\.\.\/fonts\/([^']+\.ttf)'/g)].map((m) => m[1]);
const LATIN = IMPORTED.filter((file) => !file.startsWith('NotoSans')).map(disk);
const JP = disk('NotoSansJP-Subset.ttf');
const SC = disk('NotoSansSC-Subset.ttf');
const KR = disk('NotoSansKR-Subset.ttf');

function reference(svg: string, fontBuffers: Uint8Array[]): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: 3 },
    background: GROUND,
    font: { fontBuffers, defaultFontFamily: 'Onest' },
  });
  const image = resvg.render();
  try {
    return image.asPng();
  } finally {
    image.free();
    resvg.free();
  }
}

const same = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((value, i) => value === b[i]);
const bytes = async (response: Response): Promise<Uint8Array> => {
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('image/png');
  return new Uint8Array(await response.arrayBuffer());
};
const card = (text: string, family: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30">` +
  `<text x="4" y="23" font-family="${family}" font-size="20" fill="white">${text}</text></svg>`;

beforeAll(async () => {
  // Initialize through production, rather than initialize WASM twice.
  await bytes(await renderOGImage(card('Ready', STACKS.body), 'en'));
});

describe('FONT-001 regional CJK faces through the real OG renderer', () => {
  it('loads every imported font with real bytes and caches by effective order', () => {
    const scFirst = getFontBuffers('zh');
    const jpFirst = getFontBuffers('ja');
    expect(scFirst).toHaveLength(IMPORTED.length);
    for (const buffer of scFirst) expect(buffer.byteLength).toBeGreaterThan(0);
    expect(jpFirst).not.toBe(scFirst);
    expect(getFontBuffers('ja')).toBe(jpFirst);
    for (const locale of ['en', 'de', 'fr', 'ko', 'zh'] as const) {
      expect(getFontBuffers(locale)).toBe(scFirst);
    }
    expect(getFontBuffers()).toBe(scFirst);
    // Separate array orders share each face's bytes rather than duplicate them.
    for (const buffer of jpFirst) expect(scFirst).toContain(buffer);
  });

  for (const [stack, family] of Object.entries(STACKS)) {
    it(`${stack}: shared ideographs draw SC for zh and JP for ja`, async () => {
      // These are in BOTH small OG subsets, with visibly different forms.
      for (const glyph of '色天全盲') {
        const svg = card(glyph, family);
        const jp = reference(svg, [...LATIN, JP]);
        const sc = reference(svg, [...LATIN, SC]);
        expect(same(jp, sc), `${glyph}: regional reference faces must differ`).toBe(false);
        expect(same(await bytes(await renderOGImage(svg, 'zh')), sc), `${glyph}: zh must use SC`).toBe(true);
        expect(same(await bytes(await renderOGImage(svg, 'ja')), jp), `${glyph}: ja must use JP`).toBe(true);
      }
    });
  }

  // Compatibility sample only: this one generated card in both frames, not
  // every card/dye combination. Its localized text uses Latin or Hangul, so
  // switching the regional ideograph fallback must preserve the former PNG.
  for (const frame of ['discord', 'x'] as const) {
    it.each(['en', 'de', 'fr', 'ko'] as const)(
      `%s: the representative accessibility card (${frame}) matches the former JP-first render`,
      async (locale) => {
        const svg = generateAccessibilityOG({ dyeIds: [1], visionType: 'achromatopsia', locale, frame });
        expect(svg).not.toMatch(/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u);
        if (locale === 'ko') expect(svg).toMatch(/\p{Script=Hangul}/u);
        const former = reference(svg, [...LATIN, JP, SC, KR]);
        const actual = await bytes(await renderOGImage(svg, locale));
        expect(same(actual, former)).toBe(true);
      },
    );
  }

  it.each(['ja', 'zh'] as const)('%s: the actual accessibility route renders the locale-specific card', async (locale) => {
    const svg = generateAccessibilityOG({ dyeIds: [1], visionType: 'achromatopsia', locale });
    if (locale === 'zh') expect(svg).toContain('全色盲 · 1 种染剂');
    const scFirst = reference(svg, [...LATIN, SC, KR, JP]);
    const jpFirst = reference(svg, [...LATIN, JP, SC, KR]);
    expect(same(scFirst, jpFirst), 'the shipped card must distinguish regional order').toBe(false);
    const actual = await bytes(await app.request(`/og/accessibility/1/achromatopsia.png?lang=${locale}`, {}, {
      APP_BASE_URL: 'https://xivdyetools.app',
      OG_IMAGE_BASE_URL: 'https://og.xivdyetools.app/og',
    }));
    expect(same(actual, locale === 'ja' ? jpFirst : scFirst)).toBe(true);
  });
});
