/**
 * The public docs describe the Dye Object as data (`docs/.vitepress/theme/lib/fields.ts`),
 * folded under every card that returns dyes. Nothing else ties that table to the
 * serializer, so this pins them together: every key `serializeDye()` emits has a row,
 * every row is a key the serializer emits, in the same order.
 *
 * The docs module is read as text rather than imported: it is browser-side theme
 * code, and importing it here would make the dead-code gate read it as test-only.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createMockDye } from '@xivdyetools/test-utils';
import { serializeDye } from '../src/lib/dye-serializer.js';

// The import.meta.url STRING, not a URL object: workers-types and @types/node
// disagree about URL, and the string form is the one both accept.
const FIELDS_SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/.vitepress/theme/lib/fields.ts');

function documentedDyeFields(): string[] {
  const text = readFileSync(FIELDS_SOURCE, 'utf8');
  const dyeBlock = text.slice(text.indexOf('dye: {'));
  return [...dyeBlock.matchAll(/\{\s*name:\s*'([A-Za-z]+)'/g)].map((m) => m[1]);
}

describe('docs Dye Object table ↔ serializeDye()', () => {
  it('documents exactly the serialized keys, in serializer order', () => {
    const emitted = Object.keys(serializeDye(createMockDye(), 'ローズピンク'));
    expect(documentedDyeFields()).toEqual(emitted);
  });

  it('documents localizedName as optional', () => {
    const withoutLocale = Object.keys(serializeDye(createMockDye()));
    expect(withoutLocale).not.toContain('localizedName');
    expect(documentedDyeFields()).toContain('localizedName');
  });
});
