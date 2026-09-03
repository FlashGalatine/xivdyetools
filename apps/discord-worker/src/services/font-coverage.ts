/**
 * What the bundled fonts can actually draw, and how to keep user text inside
 * that set.
 *
 * BUG-030: the CJK subsets are cut from **locale data** —
 * `scripts/subset-cjk-fonts.py` walks the dye names, the bot-UI strings and a
 * fixed list of code glyphs. `font-coverage.test.ts` then gates exactly that
 * set, so it is green by construction. But `/preset` renders **user-authored**
 * text into a card: a preset's name, its description and its author's Discord
 * display name go into `generatePresetSwatch` raw and straight to resvg. A
 * Japanese preset called 桜の夢 draws 桜 and 夢 as tofu boxes, because no dye is
 * named with those characters and nothing else put them in the subset.
 *
 * Shipping the full faces is not available — the Worker has a 3,072 KiB gzip
 * cap and the ten TTFs are already ~2.14 MiB raw. So the card renders what it
 * can and drops what it cannot, and the Discord **embed** beside it carries
 * the untouched original: Discord renders that with the reader's own system
 * fonts, which have the glyphs. Nothing is lost, and nothing is a box.
 *
 * @module services/font-coverage
 */

import { getFontBuffers } from './fonts.js';

// ---------------------------------------------------------------------------
// Minimal TrueType/OpenType cmap reader
// ---------------------------------------------------------------------------

/**
 * Every codepoint a font's `cmap` maps to a real glyph.
 *
 * Handles formats 0 / 4 / 6 / 12 — the ones fonttools emits for these
 * families. A font carrying only some other format would read as empty, which
 * `font-coverage.test.ts` fails loudly on rather than passing silently.
 */
export function readCmapCodepoints(ttf: Uint8Array): Set<number> {
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
  }
  return out;
}

// ---------------------------------------------------------------------------
// The union, and the filter
// ---------------------------------------------------------------------------

/**
 * Codepoints that are never dropped even if no cmap claims them.
 *
 * Whitespace has no glyph to miss, and the replacement is drawn from the
 * bundled set anyway. Keeping newlines and spaces means filtering never
 * reflows a description.
 */
const ALWAYS_KEEP = new Set([0x09, 0x0a, 0x0d, 0x20]);

/**
 * Below this, treat the coverage set as "the fonts did not load" and filter
 * nothing.
 *
 * The real union across the ten bundled faces is several thousand codepoints
 * (`font-coverage.filter.test.ts` asserts > 1000 against the files on disk), so
 * anything this small means the buffers were empty or unparseable — and
 * filtering against an empty set would blank every card. Latin-1 alone is 256.
 */
const MIN_PLAUSIBLE_COVERAGE = 256;

/**
 * Union of every font's cmap.
 *
 * Pure, so a test can build it from the real files on disk. That matters here:
 * an unmocked `.ttf` import resolves through Vite's asset pipeline to a URL
 * *string*, and `new Uint8Array('<string>')` coerces to a zero-length buffer
 * rather than throwing (see the DEAD-005 note in `fonts.test.ts`). A test that
 * went through `getFontBuffers()` would therefore measure an empty set and
 * pass every assertion for the wrong reason.
 */
export function buildCoverage(buffers: readonly Uint8Array[]): Set<number> {
  const union = new Set<number>();
  for (const buffer of buffers) {
    try {
      for (const cp of readCmapCodepoints(buffer)) union.add(cp);
    } catch {
      // A font we cannot parse contributes nothing rather than failing the
      // render — the others still cover the Latin and CJK sets.
    }
  }
  return union;
}

let coverageCache: Set<number> | null = null;

/**
 * Every codepoint the bundled faces can draw.
 *
 * Parsed once per isolate off the buffers `getFontBuffers()` already holds, so
 * a request that renders no card pays nothing.
 */
export function getRenderableCodepoints(): Set<number> {
  coverageCache ??= buildCoverage(getFontBuffers());
  return coverageCache;
}

/**
 * Drop the codepoints the bundled fonts cannot draw.
 *
 * @param covered - the coverage set to measure against; defaults to the
 *                  bundled faces. Pass one explicitly to test against fonts
 *                  read from disk.
 * @returns the drawable text and how many codepoints were removed
 */
export function filterToRenderable(
  text: string,
  covered: Set<number> = getRenderableCodepoints(),
): { text: string; dropped: number } {
  // Fail OPEN. If the coverage set is implausibly small the fonts did not
  // parse, and filtering against it would strip every character of every card
  // — far worse than the tofu this exists to prevent. That is not theoretical:
  // an unmocked `.ttf` import resolves to a URL string under vitest and yields
  // a zero-length buffer without throwing (DEAD-005), which is exactly how
  // this was found. Any real union across these ten faces is in the thousands.
  if (covered.size < MIN_PLAUSIBLE_COVERAGE) return { text, dropped: 0 };

  let dropped = 0;
  let out = '';

  // Iterating the string yields whole code points, so an astral character is
  // one decision rather than two half-surrogates.
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (covered.has(cp) || ALWAYS_KEEP.has(cp)) {
      out += char;
    } else {
      dropped++;
    }
  }

  return { text: out, dropped };
}

/**
 * `filterToRenderable` for a line that must not come back empty.
 *
 * A preset whose name lies entirely outside the subset would otherwise leave
 * the card's title blank, which reads as a broken render rather than a
 * degraded one. The em dash is in `CODE_GLYPHS`, so it is always drawable, and
 * the embed beside the card still shows the real name.
 */
export function filterToRenderableTitle(
  text: string,
  covered: Set<number> = getRenderableCodepoints(),
): { text: string; dropped: number } {
  const filtered = filterToRenderable(text, covered);
  const trimmed = filtered.text.trim();
  return trimmed.length > 0 ? { ...filtered, text: trimmed } : { ...filtered, text: '—' };
}
