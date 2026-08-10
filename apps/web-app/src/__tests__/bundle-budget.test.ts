/**
 * XIV Dye Tools - Bundle Budget Tests
 *
 * Regression guard for `scripts/check-bundle-size.js`, which gates the
 * Cloudflare Pages deploy in both `deploy-web-app.yml` and
 * `deploy-web-app-beta.yml`. When it is wrong, it is wrong in one of two
 * expensive ways, and this file covers both:
 *
 *  1. **False pass.** The limits used to be matched with
 *     `file.includes('tool-harmony')` against files Vite names
 *     `harmony-tool-<hash>.js`. Nine of sixteen limits could never match, so
 *     every tool chunk shipped ungated while the report looked like coverage.
 *     A limit that cannot fail is worse than no limit.
 *
 *  2. **False fail.** The old total summed all six locale chunks, but
 *     `language-service.ts` dynamically imports exactly one. Adding i18n keys
 *     therefore charged ~6x their real cost to the budget, and the gate failed
 *     on growth no visitor would ever download -- blocking a deploy for a
 *     regression that did not exist.
 *
 * @module __tests__/bundle-budget.test
 */

import { describe, it, expect } from 'vitest';
// Plain JS build script; typed by scripts/check-bundle-size.d.ts
import {
  computeTotals,
  limitFor,
  discoverLocaleCodes,
  localeChunkPattern,
} from '../../scripts/check-bundle-size.js';

const KB = 1024;

/** The chunk names Vite actually emits, as observed in a real `dist/assets`. */
const EMITTED = [
  'index-c6Z6Liqk.js',
  'v4-layout-D-5IUL3s.js',
  'modals-D2tilf0C.js',
  'vendor-core-ER2u2Xo3.js',
  'vendor-lit-DofBZjG5.js',
  'harmony-tool-C56N1vVT.js',
  'mixer-tool-CejXJXV3.js',
  'swatch-tool-sW510XRe.js',
  'comparison-tool-DhFdpE3U.js',
  'accessibility-tool-yZsJb8LL.js',
  'budget-tool-Dn0RbM32.js',
  'gradient-tool-Bp82TAg1.js',
  'extractor-tool-CH2K8_6m.js',
  'preset-tool-CoZ2lLlP.js',
  'dye-selector-B6HfW2Vr.js',
  'result-card-BbI3D-js.js',
  'index-xwH458Lu.css',
];

const LOCALES = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];

describe('bundle budget', () => {
  describe('every emitted chunk is actually gated', () => {
    it.each(EMITTED)('%s resolves to a named limit, not the default', (file) => {
      // This is the assertion the old substring matcher would have failed for
      // all nine tool chunks.
      expect(limitFor(file).named).toBe(true);
    });

    it.each(LOCALES)('locale chunk %s- is gated as a locale', (code) => {
      const { named, label } = limitFor(`${code}-AbCdEf12.js`);
      expect(named).toBe(true);
      expect(label).toBe('locale');
    });

    it('gates an unrecognised chunk rather than skipping it', () => {
      // Unmatched files used to be silently dropped from the report entirely.
      const { named, limit } = limitFor('something-brand-new-Xy12Ab34.js');
      expect(named).toBe(false);
      expect(limit).toBeGreaterThan(0);
    });

    it('gates CSS as CSS, not as the main JS entry', () => {
      // /^index-/ matches `index-<hash>.css` too; the css rule must win, or the
      // stylesheet silently inherits the much larger JS entry budget.
      expect(limitFor('index-xwH458Lu.css').label).toBe('css');
      expect(limitFor('index-c6Z6Liqk.js').label).toBe('main entry');
    });
  });

  describe('payload counts one locale, not all of them', () => {
    const sized = (files: string[], size: number) => files.map((file) => ({ file, size }));

    it('charges only the largest locale to the payload', () => {
      const { payloadSize, totalJsSize } = computeTotals([
        { file: 'index-aaaaaaaa.js', size: 100 * KB },
        ...LOCALES.map((c, i) => ({ file: `${c}-bbbbbbbb.js`, size: (10 + i) * KB })),
      ]);

      // 6 locales at 10..15 KB = 75 KB emitted, but only the 15 KB one counts.
      expect(totalJsSize).toBe(175 * KB);
      expect(payloadSize).toBe(115 * KB);
    });

    it('does not grow the payload when a seventh language is added', () => {
      const base = sized(['index-aaaaaaaa.js'], 100 * KB).concat(
        LOCALES.map((c) => ({ file: `${c}-bbbbbbbb.js`, size: 20 * KB }))
      );
      // A new locale the same size as the others: more artifacts, same visitor cost.
      const withSeventh = [...base, { file: 'pt-cccccccc.js', size: 20 * KB }];

      // The locale set is discovered from src/locales/, so a hypothetical `pt`
      // is passed in the same way the real run would pick it up once pt.json
      // exists. Hardcoding the six current codes is what this guards against.
      const before = computeTotals(base, { localePattern: localeChunkPattern(LOCALES) });
      const after = computeTotals(withSeventh, {
        localePattern: localeChunkPattern([...LOCALES, 'pt']),
      });

      expect(after.totalJsSize).toBeGreaterThan(before.totalJsSize);
      expect(after.payloadSize).toBe(before.payloadSize);
    });

    it('discovers the shipping locales from src/locales/ rather than a literal', () => {
      const codes = discoverLocaleCodes();
      expect(codes.sort()).toEqual([...LOCALES].sort());
      // And the derived pattern really matches an emitted chunk name.
      expect(localeChunkPattern(codes).test('ja-BpZu0wHZ.js')).toBe(true);
      expect(localeChunkPattern(codes).test('harmony-tool-C56N1vVT.js')).toBe(false);
    });

    it('does grow the payload when real code is added', () => {
      const base = sized(['index-aaaaaaaa.js', 'en-bbbbbbbb.js'], 50 * KB);
      const after = computeTotals([...base, { file: 'new-tool-dddddddd.js', size: 30 * KB }]);
      expect(after.payloadSize).toBe(computeTotals(base).payloadSize + 30 * KB);
    });

    it('ignores non-JS assets in both totals', () => {
      const { totalJsSize, payloadSize } = computeTotals([
        { file: 'index-aaaaaaaa.js', size: 40 * KB },
        { file: 'index-bbbbbbbb.css', size: 80 * KB },
      ]);
      expect(totalJsSize).toBe(40 * KB);
      expect(payloadSize).toBe(40 * KB);
    });
  });

  describe('over-budget chunks are flagged', () => {
    it('marks a chunk that exceeds its limit', () => {
      const { results } = computeTotals([{ file: 'vendor-lit-aaaaaaaa.js', size: 500 * KB }]);
      expect(results[0].exceeds).toBe(true);
      expect(results[0].status).toBe('❌');
    });

    it('does not mark a merely tight chunk as failed', () => {
      // ❌ used to appear at >=90% of limit even while passing, which made a
      // green run read as red.
      const { results } = computeTotals([{ file: 'vendor-lit-aaaaaaaa.js', size: 19 * KB }]);
      expect(results[0].exceeds).toBe(false);
      expect(results[0].status).not.toBe('❌');
    });
  });
});
