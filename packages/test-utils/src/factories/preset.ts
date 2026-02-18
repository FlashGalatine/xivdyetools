/**
 * Preset factory functions for testing
 *
 * Provides functions to create mock presets, preset rows, and submissions.
 *
 * @example
 * ```typescript
 * // Create a mock preset
 * const preset = createMockPreset({ name: 'Custom Name' });
 *
 * // Create a database row
 * const row = createMockPresetRow({ status: 'pending' });
 *
 * // Create a submission
 * const submission = createMockSubmission({ dyes: [1, 2, 3, 4, 5] });
 * ```
 */

import type {
  CommunityPreset,
  PresetSubmission,
  PresetStatus,
  PresetCategory,
} from '@xivdyetools/types/preset';
import { nextStringId } from '../utils/counters.js';

/**
 * Preset database row type (as stored in D1)
 * Note: dyes and tags are JSON strings, is_curated is 0 or 1
 */
export interface PresetRow {
  id: string;
  name: string;
  description: string;
  category_id: string;
  dyes: string; // JSON string
  tags: string; // JSON string
  author_discord_id: string | null;
  author_name: string | null;
  vote_count: number;
  status: string;
  is_curated: number; // SQLite boolean (0 or 1)
  created_at: string;
  updated_at: string;
  dye_signature: string | null;
  previous_values: string | null;
}

// Re-export types for convenience
export type { CommunityPreset, PresetSubmission, PresetStatus };

/**
 * Creates a mock preset submission
 *
 * @param overrides - Optional overrides for the default values
 * @returns A PresetSubmission object
 */
export function createMockSubmission(overrides: Partial<PresetSubmission> = {}): PresetSubmission {
  return {
    name: 'Test Preset',
    description: 'A test preset description that is long enough.',
    category_id: 'aesthetics',
    dyes: [1, 2, 3],
    tags: ['test', 'mock'],
    ...overrides,
  };
}

/**
 * Creates a mock preset row (as returned from database)
 *
 * Note: In the database, `dyes` and `tags` are JSON strings,
 * and `is_curated` is a number (0 or 1).
 *
 * @param overrides - Optional overrides for the default values
 * @returns A PresetRow object
 */
export function createMockPresetRow(overrides: Partial<PresetRow> = {}): PresetRow {
  const id = overrides.id ?? nextStringId('preset');
  const now = new Date().toISOString();

  return {
    id,
    name: 'Test Preset',
    description: 'A test preset description',
    category_id: 'aesthetics',
    dyes: JSON.stringify([1, 2, 3]),
    tags: JSON.stringify(['test', 'mock']),
    author_discord_id: '123456789',
    author_name: 'TestUser',
    vote_count: 0,
    status: 'approved',
    is_curated: 0,
    created_at: now,
    updated_at: now,
    dye_signature: JSON.stringify([1, 2, 3]),
    previous_values: null,
    ...overrides,
  };
}

/**
 * Creates a mock CommunityPreset (domain object)
 *
 * Note: In domain objects, `dyes` and `tags` are arrays,
 * and `is_curated` is a boolean.
 *
 * @param overrides - Optional overrides for the default values
 * @returns A CommunityPreset object
 */
export function createMockPreset(overrides: Partial<CommunityPreset> = {}): CommunityPreset {
  const id = overrides.id ?? nextStringId('preset');
  const now = new Date().toISOString();

  return {
    id,
    name: 'Test Preset',
    description: 'A test preset description',
    category_id: 'aesthetics',
    dyes: [1, 2, 3],
    tags: ['test', 'mock'],
    author_discord_id: '123456789',
    author_name: 'TestUser',
    vote_count: 0,
    status: 'approved',
    is_curated: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Creates multiple mock presets
 *
 * @param count - Number of presets to create
 * @param overrides - Optional overrides to apply to all presets
 * @returns Array of CommunityPreset objects
 */
export function createMockPresets(
  count: number,
  overrides: Partial<CommunityPreset> = {}
): CommunityPreset[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPreset({
      name: `Test Preset ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Creates a preset with specific status
 *
 * @param status - The preset status
 * @param overrides - Optional additional overrides
 * @returns A CommunityPreset object
 */
export function createPresetWithStatus(
  status: PresetStatus,
  overrides: Partial<CommunityPreset> = {}
): CommunityPreset {
  return createMockPreset({ status, ...overrides });
}

/**
 * Creates a curated preset
 *
 * @param overrides - Optional overrides
 * @returns A curated CommunityPreset object
 */
export function createCuratedPreset(
  overrides: Partial<CommunityPreset> = {}
): CommunityPreset {
  return createMockPreset({
    is_curated: true,
    status: 'approved',
    ...overrides,
  });
}

/**
 * Converts a CommunityPreset to a PresetRow (for database mocking)
 *
 * @param preset - The CommunityPreset to convert
 * @returns A PresetRow object
 */
export function presetToRow(preset: CommunityPreset): PresetRow {
  return {
    ...preset,
    dyes: JSON.stringify(preset.dyes),
    tags: JSON.stringify(preset.tags),
    is_curated: preset.is_curated ? 1 : 0,
    dye_signature: JSON.stringify(preset.dyes),
    previous_values: null,
  };
}

/**
 * Converts a PresetRow to a CommunityPreset (for domain logic)
 *
 * @param row - The PresetRow to convert
 * @returns A CommunityPreset object
 */
export function rowToPreset(row: PresetRow): CommunityPreset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category_id: row.category_id as PresetCategory,
    dyes: JSON.parse(row.dyes),
    tags: JSON.parse(row.tags),
    author_discord_id: row.author_discord_id,
    author_name: row.author_name,
    vote_count: row.vote_count,
    status: row.status as PresetStatus,
    is_curated: row.is_curated === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
