/**
 * Preset factory functions for testing
 *
 * Provides functions to create mock preset rows and submissions.
 *
 * @example
 * ```typescript
 * // Create a database row
 * const row = createMockPresetRow({ status: 'pending' });
 *
 * // Create a submission
 * const submission = createMockSubmission({ dyes: [1, 2, 3, 4, 5] });
 * ```
 */

import type { CommunityPreset, PresetSubmission, PresetStatus } from '@xivdyetools/types/preset';
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
  example_link: string | null;
  preview_image_key: string | null;
  preview_image_status: string;
  secondary_categories: string; // JSON string
  rejection_reason?: string | null;
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
    example_link: null,
    preview_image_key: null,
    preview_image_status: 'none',
    secondary_categories: '[]',
    ...overrides,
  };
}
