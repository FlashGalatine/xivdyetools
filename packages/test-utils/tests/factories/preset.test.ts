/**
 * Tests for preset factory functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../../src/utils/counters.js';
import {
  createMockSubmission,
  createMockPresetRow,
  createMockPreset,
  createMockPresets,
  createPresetWithStatus,
  createCuratedPreset,
  presetToRow,
  rowToPreset,
} from '../../src/factories/preset.js';

beforeEach(() => {
  resetCounters();
});

describe('createMockSubmission', () => {
  it('creates a submission with defaults', () => {
    const submission = createMockSubmission();

    expect(submission.name).toBe('Test Preset');
    expect(submission.description).toBe('A test preset description that is long enough.');
    expect(submission.category_id).toBe('aesthetics');
    expect(submission.dyes).toEqual([1, 2, 3]);
    expect(submission.tags).toEqual(['test', 'mock']);
  });

  it('accepts overrides', () => {
    const submission = createMockSubmission({
      name: 'Custom Preset',
      dyes: [4, 5, 6, 7, 8],
    });

    expect(submission.name).toBe('Custom Preset');
    expect(submission.dyes).toEqual([4, 5, 6, 7, 8]);
  });
});

describe('createMockPresetRow', () => {
  it('creates a preset row with defaults', () => {
    const row = createMockPresetRow();

    // TEST-DESIGN-001: IDs are now random for parallel test safety
    expect(row.id).toMatch(/^preset-[a-z0-9]{8}$/);
    expect(row.name).toBe('Test Preset');
    expect(row.description).toBe('A test preset description');
    expect(row.category_id).toBe('aesthetics');
    expect(row.dyes).toBe('[1,2,3]');
    expect(row.tags).toBe('["test","mock"]');
    expect(row.author_discord_id).toBe('123456789');
    expect(row.author_name).toBe('TestUser');
    expect(row.vote_count).toBe(0);
    expect(row.status).toBe('approved');
    expect(row.is_curated).toBe(0);
    expect(row.created_at).toBeDefined();
    expect(row.updated_at).toBeDefined();
    expect(row.dye_signature).toBe('[1,2,3]');
    expect(row.previous_values).toBeNull();
  });

  it('has JSON string dyes and tags', () => {
    const row = createMockPresetRow();

    expect(() => JSON.parse(row.dyes)).not.toThrow();
    expect(() => JSON.parse(row.tags)).not.toThrow();
    expect(JSON.parse(row.dyes)).toEqual([1, 2, 3]);
  });

  it('accepts overrides', () => {
    const row = createMockPresetRow({
      id: 'custom-id',
      status: 'pending',
      is_curated: 1,
    });

    expect(row.id).toBe('custom-id');
    expect(row.status).toBe('pending');
    expect(row.is_curated).toBe(1);
  });

  it('generates unique IDs', () => {
    const row1 = createMockPresetRow();
    const row2 = createMockPresetRow();

    expect(row1.id).not.toBe(row2.id);
  });
});

describe('createMockPreset', () => {
  it('creates a preset with defaults', () => {
    const preset = createMockPreset();

    // TEST-DESIGN-001: IDs are now random for parallel test safety
    expect(preset.id).toMatch(/^preset-[a-z0-9]{8}$/);
    expect(preset.name).toBe('Test Preset');
    expect(preset.description).toBe('A test preset description');
    expect(preset.category_id).toBe('aesthetics');
    expect(preset.dyes).toEqual([1, 2, 3]);
    expect(preset.tags).toEqual(['test', 'mock']);
    expect(preset.author_discord_id).toBe('123456789');
    expect(preset.author_name).toBe('TestUser');
    expect(preset.vote_count).toBe(0);
    expect(preset.status).toBe('approved');
    expect(preset.is_curated).toBe(false);
  });

  it('has array dyes and tags (not strings)', () => {
    const preset = createMockPreset();

    expect(Array.isArray(preset.dyes)).toBe(true);
    expect(Array.isArray(preset.tags)).toBe(true);
  });

  it('accepts overrides', () => {
    const preset = createMockPreset({
      name: 'Custom Name',
      dyes: [5, 6, 7, 8, 9],
      vote_count: 100,
    });

    expect(preset.name).toBe('Custom Name');
    expect(preset.dyes).toEqual([5, 6, 7, 8, 9]);
    expect(preset.vote_count).toBe(100);
  });

  it('generates unique IDs', () => {
    const preset1 = createMockPreset();
    const preset2 = createMockPreset();

    expect(preset1.id).not.toBe(preset2.id);
  });
});

describe('createMockPresets', () => {
  it('creates specified number of presets', () => {
    const presets = createMockPresets(5);

    expect(presets).toHaveLength(5);
  });

  it('generates unique names with index', () => {
    const presets = createMockPresets(3);

    expect(presets[0].name).toBe('Test Preset 1');
    expect(presets[1].name).toBe('Test Preset 2');
    expect(presets[2].name).toBe('Test Preset 3');
  });

  it('applies overrides to all presets', () => {
    const presets = createMockPresets(3, { status: 'pending' });

    expect(presets.every((p) => p.status === 'pending')).toBe(true);
  });

  it('generates unique IDs', () => {
    const presets = createMockPresets(3);
    const ids = presets.map((p) => p.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });
});

describe('createPresetWithStatus', () => {
  it('creates preset with specified status', () => {
    const pending = createPresetWithStatus('pending');
    const approved = createPresetWithStatus('approved');
    const rejected = createPresetWithStatus('rejected');

    expect(pending.status).toBe('pending');
    expect(approved.status).toBe('approved');
    expect(rejected.status).toBe('rejected');
  });

  it('accepts additional overrides', () => {
    const preset = createPresetWithStatus('pending', { name: 'Pending Preset' });

    expect(preset.status).toBe('pending');
    expect(preset.name).toBe('Pending Preset');
  });
});

describe('createCuratedPreset', () => {
  it('creates a curated preset', () => {
    const preset = createCuratedPreset();

    expect(preset.is_curated).toBe(true);
    expect(preset.status).toBe('approved');
  });

  it('accepts overrides', () => {
    const preset = createCuratedPreset({ name: 'Official Theme' });

    expect(preset.name).toBe('Official Theme');
    expect(preset.is_curated).toBe(true);
  });
});

describe('presetToRow', () => {
  it('converts dyes array to JSON string', () => {
    const preset = createMockPreset({ dyes: [1, 2, 3, 4, 5] });

    const row = presetToRow(preset);

    expect(row.dyes).toBe('[1,2,3,4,5]');
  });

  it('converts tags array to JSON string', () => {
    const preset = createMockPreset({ tags: ['red', 'warm', 'summer'] });

    const row = presetToRow(preset);

    expect(row.tags).toBe('["red","warm","summer"]');
  });

  it('converts is_curated boolean to number', () => {
    const curatedPreset = createMockPreset({ is_curated: true });
    const normalPreset = createMockPreset({ is_curated: false });

    expect(presetToRow(curatedPreset).is_curated).toBe(1);
    expect(presetToRow(normalPreset).is_curated).toBe(0);
  });

  it('adds dye_signature', () => {
    const preset = createMockPreset({ dyes: [1, 2, 3] });

    const row = presetToRow(preset);

    expect(row.dye_signature).toBe('[1,2,3]');
  });

  it('sets previous_values to null', () => {
    const preset = createMockPreset();

    const row = presetToRow(preset);

    expect(row.previous_values).toBeNull();
  });
});

describe('rowToPreset', () => {
  it('parses dyes JSON string to array', () => {
    const row = createMockPresetRow({ dyes: '[4,5,6,7,8]' });

    const preset = rowToPreset(row);

    expect(preset.dyes).toEqual([4, 5, 6, 7, 8]);
  });

  it('parses tags JSON string to array', () => {
    const row = createMockPresetRow({ tags: '["cool","blue"]' });

    const preset = rowToPreset(row);

    expect(preset.tags).toEqual(['cool', 'blue']);
  });

  it('converts is_curated number to boolean', () => {
    const curatedRow = createMockPresetRow({ is_curated: 1 });
    const normalRow = createMockPresetRow({ is_curated: 0 });

    expect(rowToPreset(curatedRow).is_curated).toBe(true);
    expect(rowToPreset(normalRow).is_curated).toBe(false);
  });

  it('preserves all other properties', () => {
    const row = createMockPresetRow({
      id: 'test-id',
      name: 'Test Name',
      vote_count: 42,
    });

    const preset = rowToPreset(row);

    expect(preset.id).toBe('test-id');
    expect(preset.name).toBe('Test Name');
    expect(preset.vote_count).toBe(42);
  });

  it('roundtrips with presetToRow', () => {
    const original = createMockPreset({
      id: 'roundtrip-test',
      name: 'Roundtrip Test',
      dyes: [1, 2, 3, 4, 5],
      tags: ['test', 'roundtrip'],
      is_curated: true,
    });

    const row = presetToRow(original);
    const restored = rowToPreset(row);

    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.dyes).toEqual(original.dyes);
    expect(restored.tags).toEqual(original.tags);
    expect(restored.is_curated).toBe(original.is_curated);
  });
});
