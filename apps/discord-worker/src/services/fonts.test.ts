/**
 * Tests for Fonts Service
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the font file imports before importing the module.
//
// DEAD-005: this list must mirror the `.ttf` imports in fonts.ts exactly.
// Vitest resolves an *unmocked* .ttf through Vite's asset pipeline to a URL
// string, and `new Uint8Array('<string>')` coerces to NaN — yielding a
// zero-length buffer instead of throwing. A missing mock is therefore silent,
// and a stale one (this file mocked the long-deleted Habibi-Regular.ttf) is
// silent too. The byte lengths below are distinct so the assertions can prove
// every font actually arrived.
vi.mock('../fonts/SpaceGrotesk-Regular.ttf', () => ({
  default: new ArrayBuffer(100),
}));
vi.mock('../fonts/SpaceGrotesk-SemiBold.ttf', () => ({
  default: new ArrayBuffer(101),
}));
vi.mock('../fonts/SpaceGrotesk-Bold.ttf', () => ({
  default: new ArrayBuffer(102),
}));
vi.mock('../fonts/Onest-Regular.ttf', () => ({
  default: new ArrayBuffer(200),
}));
vi.mock('../fonts/Onest-SemiBold.ttf', () => ({
  default: new ArrayBuffer(201),
}));
vi.mock('../fonts/Onest-Bold.ttf', () => ({
  default: new ArrayBuffer(202),
}));
vi.mock('../fonts/FragmentMono-Regular.ttf', () => ({
  default: new ArrayBuffer(175),
}));
// CJK font mocks
vi.mock('../fonts/NotoSansSC-Subset.ttf', () => ({
  default: new ArrayBuffer(222),
}));
vi.mock('../fonts/NotoSansKR-Subset.ttf', () => ({
  default: new ArrayBuffer(155),
}));
vi.mock('../fonts/NotoSansJP-Subset.ttf', () => ({
  default: new ArrayBuffer(188),
}));

// Now import the module with mocked dependencies
import { getFontBuffers } from './fonts.js';

describe('fonts.ts', () => {
  describe('getFontBuffers', () => {
    it('should return an array of Uint8Arrays', () => {
      const buffers = getFontBuffers();

      expect(Array.isArray(buffers)).toBe(true);
      expect(buffers).toHaveLength(10);

      for (const buffer of buffers) {
        expect(buffer).toBeInstanceOf(Uint8Array);
      }
    });

    it('carries the bytes of every declared font, in import order', () => {
      // DEAD-005: `toBeInstanceOf(Uint8Array)` passes for a zero-length
      // buffer, so it cannot tell a mocked font from an unmocked one.
      // Asserting the exact byte lengths is what makes a drifted mock
      // list fail loudly instead of silently rendering nothing.
      // No locale (and every locale but ja) loads the CJK faces SC, KR, JP.
      expect(getFontBuffers().map((b) => b.byteLength)).toEqual([
        100, // Space Grotesk Regular
        101, // Space Grotesk SemiBold
        102, // Space Grotesk Bold
        200, // Onest Regular
        201, // Onest SemiBold
        202, // Onest Bold
        175, // Fragment Mono
        222, // Noto Sans SC
        155, // Noto Sans KR
        188, // Noto Sans JP
      ]);
    });

    // resvg fills a glyph the primary (Latin) face lacks from the loaded faces
    // in LOAD order — the font-family list does not choose the fallback face.
    // So this order is what decides Japanese vs Chinese letterforms for a
    // kanji both JP and SC carry: JP first for ja, SC, KR, JP for the rest.
    // font-load-order.test.ts proves it with real renders.
    it('loads the CJK faces JP, SC, KR for ja', () => {
      expect(getFontBuffers('ja').map((b) => b.byteLength)).toEqual([
        100, // Space Grotesk Regular
        101, // Space Grotesk SemiBold
        102, // Space Grotesk Bold
        200, // Onest Regular
        201, // Onest SemiBold
        202, // Onest Bold
        175, // Fragment Mono
        188, // Noto Sans JP
        222, // Noto Sans SC
        155, // Noto Sans KR
      ]);
    });

    it.each(['en', 'de', 'fr', 'ko', 'zh'] as const)(
      '%s keeps the SC, KR, JP order: the very array a call without a locale gets',
      (locale) => {
        expect(getFontBuffers(locale)).toBe(getFontBuffers());
      },
    );

    it('reorders the same buffers for ja instead of copying them', () => {
      const ja = getFontBuffers('ja');
      const rest = getFontBuffers();
      expect(ja).not.toBe(rest);
      expect(ja).toHaveLength(rest.length);
      for (const buffer of ja) expect(rest).toContain(buffer);
    });

    it('should cache font buffers on subsequent calls', () => {
      const firstCall = getFontBuffers();
      const secondCall = getFontBuffers();

      // Same reference should be returned
      expect(firstCall).toBe(secondCall);
      // …and per order: ja has its own cached array
      expect(getFontBuffers('ja')).toBe(getFontBuffers('ja'));
    });
  });
});
