/**
 * Vote factory functions for testing
 *
 * Provides functions to create mock votes.
 * TEST-DESIGN-001: Uses random IDs for parallel test safety.
 *
 * @example
 * ```typescript
 * const vote = createMockVote({ preset_id: 'preset-xyz' });
 * const votes = createMockVotes(5, { user_discord_id: '123' });
 * ```
 */

import { randomStringId } from '../utils/counters.js';

/**
 * Vote database row type (as stored in D1)
 */
export interface VoteRow {
  preset_id: string;
  user_discord_id: string;
  created_at: string;
}

/**
 * Creates a mock vote row
 *
 * TEST-DESIGN-001: Uses random preset IDs for parallel test safety.
 *
 * @param overrides - Optional overrides for the default values
 * @returns A VoteRow object
 */
export function createMockVoteRow(overrides: Partial<VoteRow> = {}): VoteRow {
  return {
    preset_id: randomStringId('preset'),
    user_discord_id: '123456789',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Alias for createMockVoteRow
 */
export const createMockVote = createMockVoteRow;

/**
 * Creates multiple mock votes
 *
 * @param count - Number of votes to create
 * @param overrides - Optional overrides to apply to all votes
 * @returns Array of VoteRow objects
 */
export function createMockVotes(
  count: number,
  overrides: Partial<VoteRow> = {}
): VoteRow[] {
  return Array.from({ length: count }, () => createMockVoteRow(overrides));
}

/**
 * Creates votes for a specific preset from multiple users
 *
 * @param presetId - The preset ID
 * @param userCount - Number of unique users to vote
 * @returns Array of VoteRow objects
 */
export function createVotesForPreset(
  presetId: string,
  userCount: number
): VoteRow[] {
  return Array.from({ length: userCount }, (_, i) =>
    createMockVoteRow({
      preset_id: presetId,
      user_discord_id: `user-${i + 1}`,
    })
  );
}

/**
 * Creates votes from a specific user for multiple presets
 *
 * @param userId - The user's Discord ID
 * @param presetIds - Array of preset IDs to vote for
 * @returns Array of VoteRow objects
 */
export function createVotesFromUser(
  userId: string,
  presetIds: string[]
): VoteRow[] {
  return presetIds.map((presetId) =>
    createMockVoteRow({
      preset_id: presetId,
      user_discord_id: userId,
    })
  );
}
