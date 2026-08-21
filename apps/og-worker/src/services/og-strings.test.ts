/**
 * Card-string coverage ×6 — the picture localises via `?lang=`, so any gap
 * here is an English word on a Japanese card, not a missing translation file.
 */
import { describe, it, expect } from 'vitest';
import type { LocaleCode } from '@xivdyetools/types';
import {
  OG_DECK,
  OG_DECK_LINE,
  TOOL_TAG,
  deckLine,
  getOgDeck,
  getToolTag,
  type DeckLineKey,
  type ToolTagKey,
} from './og-strings';

const LOCALES: LocaleCode[] = ['en', 'de', 'fr', 'ja', 'ko', 'zh'];
const TOOLS: ToolTagKey[] = [
  'harmony',
  'gradient',
  'mixer',
  'swatch',
  'comparison',
  'accessibility',
  'extractor',
  'presets',
  'budget',
];
const LINES: DeckLineKey[] = ['swatchNearest', 'extractorCount', 'budgetBest', 'a11yDyeCount'];

describe('TOOL_TAG', () => {
  it('covers all nine tools in all six locales', () => {
    for (const locale of LOCALES) {
      for (const tool of TOOLS) {
        expect(TOOL_TAG[locale][tool], `${locale}.${tool}`).toBeTruthy();
      }
    }
  });

  it('takes the design vocabulary — a card label, shorter than the deck name', () => {
    expect(getToolTag('comparison', 'en')).toBe('COMPARE');
    expect(getToolTag('accessibility', 'en')).toBe('VISION');
    expect(getToolTag('extractor', 'en')).toBe('EXTRACT');
    expect(getToolTag('presets', 'en')).toBe('PRESET');
  });

  it('falls back to EN for an unknown locale', () => {
    expect(getToolTag('harmony', 'xx' as LocaleCode)).toBe('HARMONY');
  });
});

describe('OG_DECK', () => {
  it('covers nine tools plus root in all six locales', () => {
    for (const locale of LOCALES) {
      for (const key of [...TOOLS, 'root'] as const) {
        expect(OG_DECK[locale][key].name, `${locale}.${key}.name`).toBeTruthy();
        expect(OG_DECK[locale][key].sub, `${locale}.${key}.sub`).toBeTruthy();
      }
    }
  });

  it('the root name never localises', () => {
    for (const locale of LOCALES) {
      expect(getOgDeck('root', locale).name).toBe('XIV Dye Tools');
    }
  });

  it('EN writes EN-US', () => {
    for (const key of [...TOOLS, 'root'] as const) {
      expect(`${OG_DECK.en[key].name} ${OG_DECK.en[key].sub}`).not.toMatch(/colour/i);
    }
  });
});

describe('OG_DECK_LINE', () => {
  it('covers all four authored lines in all six locales', () => {
    for (const locale of LOCALES) {
      for (const key of LINES) {
        expect(OG_DECK_LINE[locale][key], `${locale}.${key}`).toBeTruthy();
      }
    }
  });

  it('substitutes {n} and {hex}', () => {
    expect(deckLine('swatchNearest', 'en', { n: 4, hex: '#7A6B4F' })).toBe('Nearest 4 to #7A6B4F');
    expect(deckLine('extractorCount', 'en', { n: 5 })).toBe('5 colors from an image');
    expect(deckLine('a11yDyeCount', 'de', { n: 3 })).toBe('3 Farbstoffe');
  });

  it('leaves no placeholder unfilled in any locale', () => {
    for (const locale of LOCALES) {
      for (const key of LINES) {
        const out = deckLine(key, locale, { n: 4, hex: '#ABCDEF' });
        expect(out, `${locale}.${key}`).not.toMatch(/\{n\}|\{hex\}/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// OG_EMBED — the crawler copy ×6 (2026-08-20 i18n audit, OG-I18N-002)
// ---------------------------------------------------------------------------
import { OG_EMBED, embed, type EmbedKey } from './og-embed';

const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('OG_EMBED', () => {
  const keys = Object.keys(OG_EMBED.en) as EmbedKey[];

  it('covers every embed string in all six locales', () => {
    expect(keys.length).toBeGreaterThan(30);
    for (const lc of LOCALES) {
      for (const k of keys) {
        expect(OG_EMBED[lc][k], `${lc}.${k}`).toBeTruthy();
      }
      expect(Object.keys(OG_EMBED[lc]).sort()).toEqual([...keys].sort());
    }
  });

  it('every locale carries exactly the placeholders EN does', () => {
    for (const lc of LOCALES) {
      for (const k of keys) {
        expect(placeholders(OG_EMBED[lc][k]), `${lc}.${k}`).toEqual(placeholders(OG_EMBED.en[k]));
      }
    }
  });

  it('embed() fills every named variable and falls back to EN', () => {
    expect(embed('harmony.titleNoDye', 'ja', { harmony: '補色' })).toContain('補色');
    expect(embed('harmony.titleNoDye', 'ja', { harmony: '補色' })).not.toMatch(/\{\w+\}/);
    expect(embed('gender.female', 'en')).toBe('female');
    expect(embed('gender.female', 'xx' as LocaleCode)).toBe('female');
  });

  it('EN writes EN-US', () => {
    expect(JSON.stringify(OG_EMBED.en)).not.toMatch(/colour/i);
  });
});
