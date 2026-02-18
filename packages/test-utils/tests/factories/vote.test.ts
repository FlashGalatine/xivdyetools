/**
 * Tests for vote factory functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../../src/utils/counters.js';
import {
  createMockVoteRow,
  createMockVote,
  createMockVotes,
  createVotesForPreset,
  createVotesFromUser,
} from '../../src/factories/vote.js';

beforeEach(() => {
  resetCounters();
});

describe('createMockVoteRow', () => {
  it('creates a vote row with defaults', () => {
    const row = createMockVoteRow();

    // TEST-DESIGN-001: IDs are now random for parallel test safety
    expect(row.preset_id).toMatch(/^preset-[a-z0-9]{8}$/);
    expect(row.user_discord_id).toBe('123456789');
    expect(row.created_at).toBeDefined();
  });

  it('accepts overrides', () => {
    const row = createMockVoteRow({
      preset_id: 'my-preset',
      user_discord_id: 'custom-user',
    });

    expect(row.preset_id).toBe('my-preset');
    expect(row.user_discord_id).toBe('custom-user');
  });

  it('generates unique preset IDs', () => {
    const row1 = createMockVoteRow();
    const row2 = createMockVoteRow();

    expect(row1.preset_id).not.toBe(row2.preset_id);
  });
});

describe('createMockVote', () => {
  it('is an alias for createMockVoteRow', () => {
    expect(createMockVote).toBe(createMockVoteRow);
  });

  it('creates a vote with defaults', () => {
    const vote = createMockVote();

    // TEST-DESIGN-001: IDs are now random for parallel test safety
    expect(vote.preset_id).toMatch(/^preset-[a-z0-9]{8}$/);
    expect(vote.user_discord_id).toBe('123456789');
    expect(vote.created_at).toBeDefined();
  });

  it('accepts overrides', () => {
    const vote = createMockVote({
      preset_id: 'preset-999',
      user_discord_id: 'user-123',
    });

    expect(vote.preset_id).toBe('preset-999');
    expect(vote.user_discord_id).toBe('user-123');
  });
});

describe('createMockVotes', () => {
  it('creates specified number of votes', () => {
    const votes = createMockVotes(5);

    expect(votes).toHaveLength(5);
  });

  it('generates unique preset IDs for each vote', () => {
    const votes = createMockVotes(10);
    const presetIds = votes.map((v) => v.preset_id);
    const uniquePresetIds = new Set(presetIds);

    expect(uniquePresetIds.size).toBe(10);
  });

  it('applies overrides to all votes', () => {
    const votes = createMockVotes(3, { preset_id: 'shared-preset' });

    expect(votes.every((v) => v.preset_id === 'shared-preset')).toBe(true);
  });
});

describe('createVotesForPreset', () => {
  it('creates votes for a specific preset', () => {
    const votes = createVotesForPreset('popular-preset', 5);

    expect(votes).toHaveLength(5);
    expect(votes.every((v) => v.preset_id === 'popular-preset')).toBe(true);
  });

  it('generates unique user IDs for each vote', () => {
    const votes = createVotesForPreset('preset-abc', 3);
    const userIds = votes.map((v) => v.user_discord_id);
    const uniqueUserIds = new Set(userIds);

    expect(uniqueUserIds.size).toBe(3);
  });

  it('user IDs are numbered sequentially', () => {
    const votes = createVotesForPreset('preset-xyz', 3);

    expect(votes[0].user_discord_id).toBe('user-1');
    expect(votes[1].user_discord_id).toBe('user-2');
    expect(votes[2].user_discord_id).toBe('user-3');
  });
});

describe('createVotesFromUser', () => {
  it('creates votes from a specific user for given presets', () => {
    const presetIds = ['preset-a', 'preset-b', 'preset-c'];
    const votes = createVotesFromUser('active-user', presetIds);

    expect(votes).toHaveLength(3);
    expect(votes.every((v) => v.user_discord_id === 'active-user')).toBe(true);
  });

  it('creates votes for each preset ID', () => {
    const presetIds = ['preset-1', 'preset-2', 'preset-3'];
    const votes = createVotesFromUser('user-abc', presetIds);

    expect(votes[0].preset_id).toBe('preset-1');
    expect(votes[1].preset_id).toBe('preset-2');
    expect(votes[2].preset_id).toBe('preset-3');
  });

  it('returns empty array for empty presetIds', () => {
    const votes = createVotesFromUser('user-xyz', []);

    expect(votes).toHaveLength(0);
  });
});
