import { describe, it, expect } from 'vitest';
import {
  MANUAL_TOPICS,
  LODESTONE_BY_REGION,
  getLearnLink,
  getLodestoneLink,
} from '../learn-links.js';

describe('manual topics + learn-more links', () => {
  it('has the six-topic roster in register order', () => {
    expect(MANUAL_TOPICS.map((t) => t.id)).toEqual([
      'match_image',
      'color_vision',
      'contrast',
      'matching_methods',
      'spectrum_prices',
      'character_file',
    ]);
  });

  it('a missing locale degrades to no link, never the English one', () => {
    // ZH colour-vision source is deliberately open
    expect(getLearnLink('color_vision', 'zh')).toBeNull();
    // Contrast links only the endorsed translations (en/fr/zh)
    expect(getLearnLink('contrast', 'de')).toBeNull();
    expect(getLearnLink('contrast', 'ko')).toBeNull();
    expect(getLearnLink('contrast', 'ja')).toBeNull();
  });

  it('colour vision links five locales with the decided authorities', () => {
    expect(getLearnLink('color_vision', 'en')?.host).toBe('www.nei.nih.gov');
    expect(getLearnLink('color_vision', 'de')?.host).toBe('www.portal-der-augenmedizin.de');
    expect(getLearnLink('color_vision', 'fr')?.host).toBe('fr.wikipedia.org');
    expect(getLearnLink('color_vision', 'ja')?.host).toBe('www.gankaikai.or.jp');
    expect(getLearnLink('color_vision', 'ko')?.host).toBe('health.kdca.go.kr');
  });

  it('matching methods links our own docs in all six locales', () => {
    for (const locale of ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const) {
      expect(getLearnLink('matching_methods', locale)?.host).toBe('developers.xivdyetools.app');
    }
  });

  it('image tips, spectrum (region-keyed) and character file link nothing per-locale', () => {
    for (const locale of ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const) {
      expect(getLearnLink('match_image', locale)).toBeNull();
      expect(getLearnLink('spectrum_prices', locale)).toBeNull();
      expect(getLearnLink('character_file', locale)).toBeNull();
    }
  });

  it('spectrum resolves through Lodestone regions, not locales', () => {
    expect(Object.keys(LODESTONE_BY_REGION).sort()).toEqual(['de', 'eu', 'fr', 'jp', 'na']);
    expect(getLodestoneLink('eu').url).toBe('https://eu.finalfantasyxiv.com/lodestone/');
  });

  it('every URL is https and its host matches the printed host', () => {
    const links = [
      ...MANUAL_TOPICS.flatMap((t) => Object.values(t.links)),
      ...Object.values(LODESTONE_BY_REGION),
    ];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const url = new URL(link.url);
      expect(url.protocol, link.url).toBe('https:');
      expect(url.host, link.url).toBe(link.host);
    }
  });
});
