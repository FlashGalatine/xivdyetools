/**
 * Tests for preset factory functions
 */
import { describe, it, expect } from 'vitest';
import { createMockSubmission, createMockPresetRow } from '../../src/factories/preset.js';

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
