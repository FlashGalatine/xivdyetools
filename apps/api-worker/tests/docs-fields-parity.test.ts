/**
 * The public docs describe response objects as data (`docs/.vitepress/theme/lib/fields.ts`),
 * folded under the cards that return them. Nothing else ties those tables to the
 * serializers, so this pins each set: every key the serializer emits has a row, every row
 * is a key the serializer emits, in the same order.
 *
 * The docs module is read as text rather than imported: it is browser-side theme
 * code, and importing it here would make the dead-code gate read it as test-only.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createMockDye } from '@xivdyetools/test-utils';
import { LocalizationService, generateHarmonySlots } from '@xivdyetools/core';
import { serializeDye } from '../src/lib/dye-serializer.js';
import { serializeHarmonySlot, serializeWheelPosition, serializeWheelSummary } from '../src/lib/harmony.js';
import { dyeService } from '../src/lib/services.js';

// The import.meta.url STRING, not a URL object: workers-types and @types/node
// disagree about URL, and the string form is the one both accept.
const FIELDS_SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/.vitepress/theme/lib/fields.ts');

/** The `name:` entries of one `FIELD_SETS` block, in file order. */
function documentedFields(setName: string): string[] {
  const text = readFileSync(FIELDS_SOURCE, 'utf8');
  const start = text.indexOf(`\n  ${setName}: {`);
  if (start < 0) throw new Error(`fields.ts has no "${setName}" set`);
  const end = text.indexOf('\n  },', start);
  return [...text.slice(start, end).matchAll(/\{\s*name:\s*'([A-Za-z]+)'/g)].map((m) => m[1]);
}

describe('docs field tables ↔ serializers', () => {
  it('Dye Object documents exactly the serialized keys, in serializer order', () => {
    const emitted = Object.keys(serializeDye(createMockDye(), 'ローズピンク'));
    expect(documentedFields('dye')).toEqual(emitted);
  });

  it('Dye Object documents localizedName as optional', () => {
    const withoutLocale = Object.keys(serializeDye(createMockDye()));
    expect(withoutLocale).not.toContain('localizedName');
    expect(documentedFields('dye')).toContain('localizedName');
  });

  it('Wheel documents exactly the wheel summary keys', () => {
    expect(documentedFields('wheel')).toEqual(Object.keys(serializeWheelSummary('ryb', 'en')));
  });

  it('Wheel Position documents exactly the position keys (localizedName optional)', async () => {
    // The route middleware loads the locale per request; here we do it by hand.
    await LocalizationService.ensureLocaleLoaded('ja');
    const dye = dyeService.getAllDyes()[0];
    const emitted = Object.keys(serializeWheelPosition(dye, 12.345, 'ja'));
    expect(documentedFields('wheelPosition')).toEqual(emitted);
    expect(Object.keys(serializeWheelPosition(dye, 12.345, 'en'))).not.toContain('localizedName');
  });

  it('Harmony Slot documents exactly the slot keys', () => {
    const [slot] = generateHarmonySlots('#FF0000', 'complementary', dyeService.getAllDyes(), {
      usePerceptualMatching: true,
      matchingMethod: 'ciede2000',
    });
    expect(documentedFields('harmonySlot')).toEqual(Object.keys(serializeHarmonySlot(slot, 'en')));
  });
});
