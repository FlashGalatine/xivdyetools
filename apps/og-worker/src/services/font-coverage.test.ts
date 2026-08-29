/**
 * Font coverage guard — the bundled TTFs must be able to draw every string the
 * cards can render.
 *
 * `scripts/subset-cjk-fonts.py` GENERATES the three CJK subsets from the core
 * locale data and this worker's own `og-strings.ts`; nothing VERIFIED them. A
 * dye rename, a new tool tag or a new deck line whose glyph the committed
 * subset had never seen rendered as tofu, and no test went red (2026-08-18
 * dead-code audit, DEAD-020 — the reverse case: 99 stale glyphs nobody needed).
 *
 * This test reads the bundled fonts' `cmap` tables directly (formats 0 /
 * 4 / 6 / 12 — ~50 lines, no font library) and asserts:
 *   1. every codepoint in any locale's runtime strings (`LocaleLoader`), in
 *      `og-strings.ts`'s ×6 tables, and in the glyphs the adapters emit from
 *      code (Δ · — … → – ↔ ≈ °) is covered by the UNION of the bundled fonts —
 *      the runtime guarantee, since every stack lists all three CJK subsets;
 *   2. every CJK-script codepoint in a `ja` string is in the JP subset — the
 *      whole reason NotoSansJP-Subset exists (Japanese letterforms, not SC's).
 * Surplus CJK glyphs (in a subset, needed by nothing) are reported as a
 * warning with the count: the cue to re-run the subset script.
 *
 * Compare fonts by cmap, never by md5 — fonttools rewrites `head.modified` on
 * every run, so bytes differ even when coverage is identical.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { LocaleLoader } from '@xivdyetools/core';
import type { LocaleCode } from '@xivdyetools/types';
import { OG_DECK, TOOL_TAG, OG_DECK_LINE, OG_ROLE } from './og-strings';

// ---------------------------------------------------------------------------
// Minimal TrueType/OpenType cmap reader
// ---------------------------------------------------------------------------

function readCmapCodepoints(ttf: Uint8Array): Set<number> {
  const dv = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const u16 = (o: number): number => dv.getUint16(o);
  const u32 = (o: number): number => dv.getUint32(o);
  const i16 = (o: number): number => dv.getInt16(o);

  // Offset table → table directory → 'cmap'
  const numTables = u16(4);
  let cmapOffset = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(ttf[rec], ttf[rec + 1], ttf[rec + 2], ttf[rec + 3]);
    if (tag === 'cmap') {
      cmapOffset = u32(rec + 8);
      break;
    }
  }
  if (cmapOffset < 0) throw new Error('no cmap table');

  const out = new Set<number>();
  const numSub = u16(cmapOffset + 2);
  for (let i = 0; i < numSub; i++) {
    const rec = cmapOffset + 4 + i * 8;
    const platformID = u16(rec);
    // Unicode (0) or Windows (3) platforms carry Unicode cmaps; skip Mac (1)
    if (platformID !== 0 && platformID !== 3) continue;
    const sub = cmapOffset + u32(rec + 4);
    const format = u16(sub);

    if (format === 0) {
      for (let c = 0; c < 256; c++) if (ttf[sub + 6 + c] !== 0) out.add(c);
    } else if (format === 4) {
      const segCount = u16(sub + 6) / 2;
      const endBase = sub + 14;
      const startBase = endBase + segCount * 2 + 2;
      const deltaBase = startBase + segCount * 2;
      const rangeBase = deltaBase + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const end = u16(endBase + s * 2);
        const start = u16(startBase + s * 2);
        const delta = i16(deltaBase + s * 2);
        const rangeOffset = u16(rangeBase + s * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g: number;
          if (rangeOffset === 0) {
            g = (c + delta) & 0xffff;
          } else {
            const addr = rangeBase + s * 2 + rangeOffset + (c - start) * 2;
            g = u16(addr);
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g !== 0) out.add(c);
        }
      }
    } else if (format === 6) {
      const first = u16(sub + 6);
      const count = u16(sub + 8);
      for (let k = 0; k < count; k++) if (u16(sub + 10 + k * 2) !== 0) out.add(first + k);
    } else if (format === 12) {
      const nGroups = u32(sub + 12);
      for (let g = 0; g < nGroups; g++) {
        const rec2 = sub + 16 + g * 12;
        const start = u32(rec2);
        const end = u32(rec2 + 4);
        for (let c = start; c <= end; c++) out.add(c);
      }
    }
    // other formats (2, 8, 10, 13, 14) are not produced by fonttools subsets
    // of these families; a font that only had one of them would fail the
    // assertions below loudly rather than silently pass.
  }
  return out;
}

// ---------------------------------------------------------------------------
// What the cards can render
// ---------------------------------------------------------------------------

const LOCALES: readonly LocaleCode[] = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];

/** The glyphs adapters emit from code, not from data (Δ tags, roles, decks). */
const CODE_GLYPHS = 'Δ·—…→–↔≈°#%';

/** CJK-script blocks (mirrors band.ts's CJK_RE): kana, CJK ideographs, compat, Hangul. */
function isCjkScript(cp: number): boolean {
  return (
    (cp >= 0x3000 && cp <= 0x30ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xac00 && cp <= 0xd7af)
  );
}

function collectStrings(value: unknown, into: string[]): void {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, into);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) collectStrings(v, into);
}

function codepointsOf(strings: string[]): Set<number> {
  const out = new Set<number>();
  for (const s of strings) for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x20) out.add(cp);
  }
  return out;
}

/** Runtime strings per locale: core locale data + this worker's own tables. */
function stringsFor(locale: LocaleCode): string[] {
  const out: string[] = [];
  const data = new LocaleLoader().loadLocale(locale) as unknown as Record<string, unknown>;
  const { meta: _meta, locale: _code, ...rest } = data;
  collectStrings(rest, out);
  collectStrings(OG_DECK[locale], out);
  collectStrings(TOOL_TAG[locale], out);
  collectStrings(OG_DECK_LINE[locale], out);
  collectStrings(OG_ROLE[locale], out);
  return out;
}

const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const font = (name: string): Set<number> => readCmapCodepoints(new Uint8Array(readFileSync(join(fontsDir, name))));

const cmaps = {
  // The brand faces ship as static Regular / SemiBold / Bold instances of one
  // variable source each (apps/discord-worker/scripts/instance-latin-fonts.py
  // --app og-worker), so the three files share a cmap — the Regular stands in.
  onest: font('Onest-Regular.ttf'),
  spaceGrotesk: font('SpaceGrotesk-Regular.ttf'),
  fragmentMono: font('FragmentMono-Regular.ttf'),
  jp: font('NotoSansJP-Subset.ttf'),
  sc: font('NotoSansSC-Subset.ttf'),
  kr: font('NotoSansKR-Subset.ttf'),
};
const union = new Set<number>();
for (const set of Object.values(cmaps)) for (const cp of set) union.add(cp);

const fmt = (cps: number[]): string =>
  cps
    .slice(0, 40)
    .map((cp) => `${String.fromCodePoint(cp)} (U+${cp.toString(16).toUpperCase().padStart(4, '0')})`)
    .join(' ') + (cps.length > 40 ? ` … +${cps.length - 40} more` : '');

// ---------------------------------------------------------------------------

describe('bundled fonts cover every string the cards can render', () => {
  it('parses every bundled family (sanity: Latin in the brand fonts, CJK in the subsets)', () => {
    expect(cmaps.onest.has('A'.codePointAt(0)!)).toBe(true);
    expect(cmaps.fragmentMono.has('#'.codePointAt(0)!)).toBe(true);
    expect(cmaps.jp.size).toBeGreaterThan(200);
    expect(cmaps.sc.size).toBeGreaterThan(400);
    expect(cmaps.kr.size).toBeGreaterThan(200);
  });

  for (const locale of LOCALES) {
    it(`${locale}: every runtime string codepoint is drawable (union of the bundled fonts) — no tofu`, () => {
      const needed = codepointsOf(stringsFor(locale));
      const missing = [...needed].filter((cp) => !union.has(cp)).sort((a, b) => a - b);
      expect(missing, `re-run scripts/subset-cjk-fonts.py — missing: ${fmt(missing)}`).toEqual([]);
    });
  }

  it('the glyphs adapters emit from code (Δ · — … → – ↔ ≈ ° # %) are drawable', () => {
    const missing = [...codepointsOf([CODE_GLYPHS])].filter((cp) => !union.has(cp));
    expect(missing, fmt(missing)).toEqual([]);
  });

  it('ja: every CJK-script codepoint is in the JP subset (Japanese letterforms, not SC fallback)', () => {
    const needed = [...codepointsOf(stringsFor('ja'))].filter(isCjkScript);
    const notInJp = needed.filter((cp) => !cmaps.jp.has(cp)).sort((a, b) => a - b);
    expect(notInJp, `re-run scripts/subset-cjk-fonts.py — ja glyphs missing from NotoSansJP-Subset: ${fmt(notInJp)}`).toEqual([]);
  });

  it('reports surplus CJK glyphs in the subsets (bloat, not breakage — a warning)', () => {
    const needed = new Set<number>();
    for (const locale of LOCALES) for (const cp of codepointsOf(stringsFor(locale))) needed.add(cp);
    for (const [name, set] of [['JP', cmaps.jp], ['SC', cmaps.sc], ['KR', cmaps.kr]] as const) {
      const surplus = [...set].filter((cp) => isCjkScript(cp) && !needed.has(cp));
      if (surplus.length > 0) {
        console.warn(
          `[font-coverage] NotoSans${name}-Subset carries ${surplus.length} CJK glyph(s) no string needs — ` +
            `re-run scripts/subset-cjk-fonts.py to shrink it. e.g. ${fmt(surplus.slice(0, 12))}`
        );
      }
      // Not a hard failure: core locale changes land in another package's PR;
      // the tofu case above is what fails the build.
      expect(surplus.length).toBeLessThan(500);
    }
  });
});
