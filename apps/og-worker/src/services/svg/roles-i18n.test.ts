/**
 * Band role labels ×6 (2026-08-20 i18n audit, OG-I18N-011/012): the word-roles
 * a card prints beside a band — BASE, TARGET, AS DESIGNED, … — localize like
 * the bot's cards do (bot-logic `card.base` → BASIS / ベース). Codes stay
 * codes: A/B/C, ΔE…, DEUT, the budget tier names.
 */
import { describe, it, expect } from 'vitest';
import {
  generateHarmonyOG,
  generateGradientOG,
  generateMixerOG,
  generateSwatchOG,
  generateComparisonOG,
  generateAccessibilityOG,
  generatePresetsOG,
  generateBudgetOG,
} from './index';
import { notFoundBand } from './band-shared';
import { getToolTag } from '../og-strings';

const texts = (svg: string): string[] =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).filter(Boolean);

describe('band role labels localize', () => {
  it('harmony: BASE → BASIS / ベース', () => {
    expect(texts(generateHarmonyOG({ dyeId: 1, harmonyType: 'triadic', locale: 'de' }))).toContain('BASIS');
    expect(texts(generateHarmonyOG({ dyeId: 1, harmonyType: 'triadic', locale: 'ja' }))).toContain('ベース');
    expect(texts(generateHarmonyOG({ dyeId: 1, harmonyType: 'triadic', locale: 'en' }))).toContain('BASE');
  });

  it('gradient: START / END', () => {
    const de = texts(generateGradientOG({ startDyeId: 1, endDyeId: 102, steps: 5, locale: 'de' }));
    expect(de).toContain('START');
    expect(de).toContain('ENDE');
    expect(de).not.toContain('END');
  });

  it('mixer: BUYABLE → 購入可; the A/B/C codes stay codes', () => {
    const ja = texts(generateMixerOG({ dyeAId: 1, dyeBId: 102, dyeCId: 5, ratio: 30, locale: 'ja' }));
    expect(ja).toContain('購入可');
    expect(ja).not.toContain('BUYABLE');
    expect(ja).toContain('A');
  });

  it('swatch: TARGET / NO STAIN ID', () => {
    const de = texts(generateSwatchOG({ color: 'AABBCC', limit: 3, locale: 'de' }));
    expect(de).toContain('ZIEL');
    expect(de).toContain('KEINE STAIN-ID');
  });

  it('comparison: CLOSEST PAIR, and the X-frame verdict CLOSEST Δ', () => {
    const ko = texts(generateComparisonOG({ dyeIds: [1, 2, 3], locale: 'ko' }));
    expect(ko).toContain('최근접 쌍');
    const koX = texts(generateComparisonOG({ dyeIds: [1, 2, 3], locale: 'ko', frame: 'x' }));
    expect(koX.some((t) => /^최근접 Δ/.test(t))).toBe(true);
    expect(koX.some((t) => /^CLOSEST/.test(t))).toBe(false);
  });

  it('accessibility: AS DESIGNED → WIE ENTWORFEN', () => {
    const de = texts(generateAccessibilityOG({ dyeIds: [1, 2], visionType: 'deuteranopia', locale: 'de' }));
    expect(de).toContain('WIE ENTWORFEN');
    expect(de).not.toContain('AS DESIGNED');
  });

  it('presets: CURATED → 精选 on both frames', () => {
    expect(texts(generatePresetsOG({ presetId: 'gc-maelstrom', locale: 'zh' }))).toContain('精选');
    const x = texts(generatePresetsOG({ presetId: 'gc-maelstrom', locale: 'zh', frame: 'x' }));
    expect(x.some((t) => t.endsWith('· 精选'))).toBe(true);
  });

  it('budget: TARGET ·, the vendor footer, BEST · on X — tier codes and 216 G stay', () => {
    const fr = texts(generateBudgetOG({ dyeId: 1, locale: 'fr' }));
    expect(fr.some((t) => t.startsWith('CIBLE · '))).toBe(true);
    expect(fr.some((t) => t.startsWith('MARCHAND 216 G'))).toBe(true);
    const frX = texts(generateBudgetOG({ dyeId: 1, locale: 'fr', frame: 'x' }));
    expect(frX.some((t) => t.startsWith('MEILLEUR · '))).toBe(true);
    expect(frX.some((t) => /^(TARGET|VENDOR|BEST)/.test(t))).toBe(false);
  });

  it('budget ja/zh deck: the fullwidth colon carries its own space — no ASCII gap after it (OG-I18N-012)', () => {
    const ja = texts(generateBudgetOG({ dyeId: 1, locale: 'ja' }));
    const deck = ja.find((t) => t.includes('最良'));
    expect(deck).toBeDefined();
    expect(deck).not.toMatch(/：\s/);
    expect(deck).toMatch(/：\S/);
    const en = texts(generateBudgetOG({ dyeId: 1, locale: 'en' }));
    expect(en.some((t) => /^Best per point: \S/.test(t))).toBe(true);
  });

  it('not-found band: NOT FOUND → INTROUVABLE', () => {
    const fr = texts(notFoundBand(getToolTag('harmony', 'fr'), 'harmony', '#9999', 'harmony', 'discord', 'fr'));
    expect(fr).toContain('INTROUVABLE');
  });
});
