/**
 * BUG-030: user-authored text has to be checked against the fonts that ship,
 * not against the locale data the subset was cut from.
 *
 * `font-coverage.test.ts` next door gates the subset against **locale** data —
 * dye names, bot UI strings, a fixed code-glyph list — and is green by
 * construction, because that is exactly the input `subset-cjk-fonts.py` reads.
 * A preset's name, description and author are written by users and share no
 * such guarantee: a preset called 桜の夢 draws tofu because no dye is named with
 * those characters.
 *
 * These tests use the real bundled buffers, so they measure what a deployed
 * card would actually draw.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCoverage, filterToRenderable, filterToRenderableTitle } from './font-coverage.js';

// Read the TTFs off disk rather than through `getFontBuffers()`. An unmocked
// `.ttf` import resolves to a URL string under vitest and coerces to a
// zero-length buffer without throwing (DEAD-005), so going through the bundled
// path would measure an EMPTY coverage set — and every assertion below would
// then pass for entirely the wrong reason.
// `fileURLToPath(new URL(...))` does not type-check here: this app loads both
// @cloudflare/workers-types and @types/node, so the global `URL` is not the
// `node:url` one the overload wants. Pass the string, as font-coverage.test.ts
// next door already does.
const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const covered = buildCoverage(
  readdirSync(fontsDir)
    .filter((f) => f.endsWith('.ttf'))
    .map((f) => new Uint8Array(readFileSync(join(fontsDir, f)))),
);

describe('the bundled coverage set', () => {
  it('is parsed off the real font files, not an empty set', () => {
    expect(covered.size).toBeGreaterThan(1000);
    expect(covered.has('A'.codePointAt(0)!)).toBe(true);
    expect(covered.has('#'.codePointAt(0)!)).toBe(true);
    // The em dash is in CODE_GLYPHS, which is why the title fallback uses it.
    expect(covered.has('—'.codePointAt(0)!)).toBe(true);
  });
});

describe('filterToRenderable', () => {
  it('leaves text the fonts can draw completely alone', () => {
    const out = filterToRenderable('Snow White · 42%', covered);
    expect(out.text).toBe('Snow White · 42%');
    expect(out.dropped).toBe(0);
  });

  it('keeps whitespace even though it has no glyph', () => {
    const out = filterToRenderable('two  lines\nhere\t.', covered);
    expect(out.text).toBe('two  lines\nhere\t.');
    expect(out.dropped).toBe(0);
  });

  it('drops a codepoint no bundled face can draw, and counts it', () => {
    // Deseret capital long I — a real, assigned codepoint in none of these
    // fonts, so it is a stable stand-in for "user text the subset never saw".
    const out = filterToRenderable(`before ${String.fromCodePoint(0x10400)} after`, covered);
    expect(out.text).toBe('before  after');
    expect(out.dropped).toBe(1);
  });

  it('counts by code point, not by UTF-16 unit', () => {
    // An astral character is 2 UTF-16 units but 1 code point; a per-unit loop
    // would report 2 and could leave half a surrogate pair behind.
    const out = filterToRenderable(String.fromCodePoint(0x10400).repeat(3), covered);
    expect(out.dropped).toBe(3);
    expect(out.text).toBe('');
  });

  it('preserves the CJK the subset was actually cut for', () => {
    // Dye-name characters. If this ever drops one, the subset and the cards
    // have diverged and `subset-cjk-fonts.py` needs re-running.
    for (const name of ['雪白', '메탈릭']) {
      expect(filterToRenderable(name, covered).dropped).toBe(0);
    }
  });
});

describe('an unusable coverage set', () => {
  /**
   * Found by a failing test rather than by design: `getFontBuffers()` yields
   * zero-length buffers under vitest, so the coverage set came back EMPTY and
   * every card's text was filtered down to nothing — `/preset show` handed the
   * generator a bare em dash for the title. Blanking every card is much worse
   * than the tofu this filter exists to prevent, so it now fails open.
   */
  it('filters nothing rather than blanking the card', () => {
    const broken = new Set<number>([65, 66, 67]);

    expect(filterToRenderable('桜の夢 Sunset', broken)).toEqual({
      text: '桜の夢 Sunset',
      dropped: 0,
    });
    expect(filterToRenderableTitle('桜の夢', broken).text).toBe('桜の夢');
  });

  it('still filters against a set large enough to be real', () => {
    // Just over the threshold, and deliberately missing the CJK.
    const latinish = new Set<number>(Array.from({ length: 300 }, (_, i) => i));

    const out = filterToRenderable('桜 Sunset', latinish);
    expect(out.text).toBe(' Sunset');
    expect(out.dropped).toBe(1);
  });
});

describe('filterToRenderableTitle', () => {
  it('falls back to an em dash rather than leaving the card blank', () => {
    const allUndrawable = String.fromCodePoint(0x10400, 0x10401, 0x10402);
    const out = filterToRenderableTitle(allUndrawable, covered);

    // A blank title reads as a broken render; the embed beside the card still
    // carries the real name, which Discord draws with the reader's own fonts.
    expect(out.text).toBe('—');
    expect(out.dropped).toBe(3);
  });

  it('trims what the filter leaves behind', () => {
    const out = filterToRenderableTitle(`${String.fromCodePoint(0x10400)} Sunset `, covered);
    expect(out.text).toBe('Sunset');
  });

  it('passes an ordinary title through untouched', () => {
    expect(filterToRenderableTitle('Sunset Palette', covered).text).toBe('Sunset Palette');
  });
});
