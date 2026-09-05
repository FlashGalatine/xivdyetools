import { describe, it, expect } from 'vitest';
import { generateHarmonyCard, type HarmonyCardOptions } from './harmony-card.js';

const base: HarmonyCardOptions = {
  typeLabel: 'Complementary',
  baseHex: '#B02020',
  baseName: 'Dalamud Red',
  slots: [
    {
      idealHex: '#20B0B0',
      hex: '#1E9E9E',
      localizedName: 'Turquoise Green',
      subText: '#1E9E9E · Stain 42',
      deltaE: 4.2,
      angleLabel: '180°',
    },
  ],
  labels: { base: 'BASE', ideal: 'IDEAL HUE', found: 'NEAREST DYE', bandKey: 'KEY', derivedNote: null },
  tierWords: ['EXACT', 'CLOSE', 'LOOSE', 'UNREACHABLE'],
  lang: 'en',
};

describe('harmony card wheel token', () => {
  it('prints nothing extra on the default wheel', () => {
    const svg = generateHarmonyCard(base);
    expect(svg).not.toContain('RYB');
  });

  it('prints the wheel name, uppercased, under the harmony type when given', () => {
    const svg = generateHarmonyCard({ ...base, wheelLabel: "RYB (artist's)" });
    // cardText escapes ' to &apos; (see base-escape.test.ts); uppercasing
    // happens before escaping, so the entity name itself stays lowercase.
    expect(svg).toContain("RYB (ARTIST&apos;S)");
  });
});
