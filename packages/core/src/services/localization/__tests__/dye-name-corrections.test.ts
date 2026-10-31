/**
 * German and French dye names follow XIVAPI `Stain.Name` (PR #390, adopted in
 * core 5.16.0; research in docs/research/2026-10-29-dye-name-translations).
 *
 * These assertions read the GENERATED locale JSON, not a fixture, so they fail
 * if a regenerated locale drifts back to the earlier inflected German forms or
 * the lower-case French ones.
 */

import { describe, it, expect } from 'vitest';
import de from '../../../data/locales/de.json' with { type: 'json' };
import fr from '../../../data/locales/fr.json' with { type: 'json' };

const DE: Record<string, string> = {
  '5729': 'Schneeweiß',
  '5742': 'Blutrot',
  '13116': 'Metallic Silber',
  '30116': 'Rubinrot',
  '48163': 'Neonpink',
};
const FR: Record<string, string> = {
  '5729': 'Blanc neige',
  '5742': 'Rouge sang',
  '13116': 'Argent brillant',
  '30116': 'Rouge rubis',
  '48163': 'Rose néon',
};

describe('German and French dye names follow XIVAPI Stain.Name', () => {
  it.each(Object.entries(DE))('de %s is %s', (id, name) => {
    expect((de.dyeNames as Record<string, string>)[id]).toBe(name);
  });

  it.each(Object.entries(FR))('fr %s is %s', (id, name) => {
    expect((fr.dyeNames as Record<string, string>)[id]).toBe(name);
  });
});
