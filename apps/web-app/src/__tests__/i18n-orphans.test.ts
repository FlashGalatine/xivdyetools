/**
 * XIV Dye Tools - i18n Orphan Gate
 *
 * `scripts/validate-i18n.js` proves every key the code references exists in
 * every locale. This is the other direction: every key the locales define is
 * reachable from src/. Without it, 472 keys (26 % of every locale file) had
 * accumulated unread across the v3 -> v4 -> 5.0 rewrites, each one still being
 * offered to translators (2026-08-16 audit, DEAD-022).
 *
 * The oracle is deliberately generous about dynamic keys (any `` `ns.${…}` ``
 * template marks the whole prefix reachable — see the script header), so a
 * failure here is a real orphan, not a false alarm. If you delete a feature,
 * delete its keys from ALL six locale files in the same change.
 *
 * @module __tests__/i18n-orphans.test
 */

import { describe, it, expect } from 'vitest';
// Plain JS script; typed by scripts/analyze-unused-keys.d.ts
import { findUnusedKeys, buildUsageOracle } from '../../scripts/analyze-unused-keys.js';

describe('i18n orphan gate', () => {
  it('every key in en.json is reachable from src/', () => {
    const result = findUnusedKeys();
    expect(result.total).toBeGreaterThan(500);
    expect(result.unused, `orphaned locale keys:\n  ${result.unused.join('\n  ')}`).toEqual([]);
  });

  describe('usage oracle', () => {
    it('recognises exact literals in every quote style', () => {
      const o = buildUsageOracle(`t('a.b'); t("c.d"); const k = \`e.f\`;`);
      expect(o.isUsed('a.b')).toBe('literal');
      expect(o.isUsed('c.d')).toBe('literal');
      expect(o.isUsed('e.f')).toBe('literal');
      expect(o.isUsed('a.bc')).toBeNull();
    });

    it('treats keys under a template prefix as reachable', () => {
      const o = buildUsageOracle('t(`harmony.types.${camel}Desc`); t(`mixer.model${Model}`)');
      expect(o.isUsed('harmony.types.triadicDesc')).toBe('prefix:harmony.types.');
      expect(o.isUsed('mixer.modelRgb')).toBe('prefix:mixer.model');
      expect(o.isUsed('mixer.other')).toBeNull();
    });

    it('treats a whole-prefix-is-a-variable template as reachable by suffix', () => {
      const o = buildUsageOracle('t(`${tool.translationKey}.shortName`)');
      expect(o.isUsed('tools.harmony.shortName')).toBe('suffix:.shortName');
      expect(o.isUsed('tools.harmony.subtitle')).toBeNull();
    });
  });
});
