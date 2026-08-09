/**
 * Tests for the shared palette export generators.
 *
 * These are the guardrails for output that users paste into real stylesheets:
 * every generated identifier must be a valid CSS ident, and the source/dye
 * pairing must survive every format.
 */

import { describe, it, expect } from 'vitest';
import type { Dye } from '@xivdyetools/types';
import {
  EXPORT_FORMATS,
  exportFilename,
  exportMimeType,
  generateExport,
  type ExportPayload,
} from '../palette-export';

function makeDye(overrides: Partial<Dye> = {}): Dye {
  return {
    stainID: 27,
    itemID: 5729,
    name: 'Rolanberry Red',
    hex: '#a22c34',
    category: 'Red',
    acquisition: 'Vendor',
    ...overrides,
  } as unknown as Dye;
}

const PAYLOAD: ExportPayload = {
  tool: 'extractor',
  title: 'Extracted Palette',
  meta: ['Interpolation: oklch · 4 steps'],
  entries: [
    { key: 'pick-1', source: '#a32d35', dye: makeDye(), delta: 3.42 },
    { key: 'pick-2', source: '#112233' },
    { key: 'pick-3', dye: makeDye({ name: 'Snow White', stainID: 1, hex: '#e8e8e8' }) },
  ],
};

describe('generateExport', () => {
  it('emits both the source and the dye for a matched entry (CSS)', () => {
    const css = generateExport(PAYLOAD, 'css');
    expect(css).toContain('--pick-1-source: #A32D35;');
    expect(css).toContain('--pick-1-dye: #A22C34;');
  });

  it('annotates entries with dye name, stainID and drift', () => {
    const css = generateExport(PAYLOAD, 'css');
    expect(css).toContain('/* pick-1 — Rolanberry Red · stainID 27 · ΔE 3.4 */');
  });

  it('omits the half that does not exist', () => {
    const css = generateExport(PAYLOAD, 'css');
    // A one-sided entry drops the suffix — there is no other half to
    // disambiguate from, and `--dye-1-dye` is a stutter.
    expect(css).toContain('--pick-2: #112233;');
    expect(css).not.toContain('--pick-2-dye');
    expect(css).not.toContain('--pick-2-source');
    expect(css).toContain('--pick-3: #E8E8E8;');
    expect(css).not.toContain('--pick-3-source');
  });

  it('uppercases hex and tolerates a missing leading hash', () => {
    const css = generateExport(
      { tool: 't', title: 'T', entries: [{ key: 'a', source: 'abcdef' }] },
      'css'
    );
    expect(css).toContain('--a: #ABCDEF;');
  });

  it('prefixes Tailwind tokens with --color- so they become utilities', () => {
    const out = generateExport(PAYLOAD, 'tailwind');
    expect(out).toContain('@theme {');
    expect(out).toContain('--color-pick-1-dye: #A22C34;');
  });

  it('uses SCSS variables, not custom properties', () => {
    const out = generateExport(PAYLOAD, 'scss');
    expect(out).toContain('$pick-1-source: #A32D35;');
    expect(out).not.toContain(':root');
  });

  it('produces machine-readable JSON carrying the canonical stainID', () => {
    const parsed = JSON.parse(generateExport(PAYLOAD, 'json'));
    expect(parsed.tool).toBe('extractor');
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.entries[0].dye).toEqual({
      stainID: 27,
      name: 'Rolanberry Red',
      hex: '#A22C34',
    });
    expect(parsed.entries[0].deltaE).toBe(3.42);
    expect(parsed.entries[1].dye).toBeUndefined();
  });

  it('splits plain hex into selectable source and dye blocks', () => {
    const out = generateExport(PAYLOAD, 'hex');
    expect(out).toContain('Source\n#A32D35\n#112233');
    expect(out).toContain('Dyes\n#A22C34\n#E8E8E8');
  });

  it('carries meta lines into every commented format', () => {
    expect(generateExport(PAYLOAD, 'css')).toContain('Interpolation: oklch · 4 steps');
    expect(generateExport(PAYLOAD, 'scss')).toContain('Interpolation: oklch · 4 steps');
    expect(JSON.parse(generateExport(PAYLOAD, 'json')).meta).toEqual([
      'Interpolation: oklch · 4 steps',
    ]);
  });

  it('pluralizes the entry count honestly', () => {
    const single: ExportPayload = {
      tool: 't',
      title: 'T',
      entries: [{ key: 'a', source: '#fff' }],
    };
    expect(generateExport(single, 'css')).toContain('1 entry');
    expect(generateExport(PAYLOAD, 'css')).toContain('3 entries');
  });

  it('produces non-empty output in every format', () => {
    for (const format of EXPORT_FORMATS) {
      expect(generateExport(PAYLOAD, format).length).toBeGreaterThan(0);
    }
  });
});

describe('file metadata', () => {
  it('names Tailwind exports .css and hex exports .txt', () => {
    expect(exportFilename(PAYLOAD, 'tailwind')).toMatch(/^xiv-extractor-\d{4}-\d{2}-\d{2}\.css$/);
    expect(exportFilename(PAYLOAD, 'hex')).toMatch(/\.txt$/);
    expect(exportFilename(PAYLOAD, 'scss')).toMatch(/\.scss$/);
  });

  it('maps each format to a sane MIME type', () => {
    expect(exportMimeType('css')).toBe('text/css');
    expect(exportMimeType('json')).toBe('application/json');
    expect(exportMimeType('hex')).toBe('text/plain');
  });
});
