/**
 * Autocomplete authorization (FINDING-006, 2026-08-21 security audit).
 *
 * Every slash command, button and modal in this worker enforces the
 * MODERATOR_IDS allowlist — autocomplete did not, yet `/preset ban_user` and
 * `unban_user` autocomplete query the production presets D1 directly and
 * return the live banned-user list and author name → Discord-ID pairs. Any
 * user who could see the command could enumerate them. Autocomplete must
 * apply the same moderator gate and answer non-moderators with no choices.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockKV, createMockD1Database } from '@xivdyetools/test-utils';
import type { Env } from './types/env.js';
import * as banService from './services/ban-service.js';
import * as rateLimit from './middleware/rate-limit.js';

vi.mock('./services/ban-service.js', () => ({
  searchPresetAuthors: vi.fn(),
  searchBannedUsers: vi.fn(),
}));
vi.mock('./services/preset-api.js', async () => {
  const actual = await vi.importActual<typeof import('./services/preset-api.js')>(
    './services/preset-api.js',
  );
  return { ...actual, searchPresetsForAutocomplete: vi.fn(async () => []) };
});

const { handleAutocomplete } = await import('./index.js');

type AutocompleteInteraction = Parameters<typeof handleAutocomplete>[0];

function autocompleteInteraction(
  userId: string,
  subcommand: 'ban_user' | 'unban_user',
): AutocompleteInteraction {
  return {
    id: 'int-1',
    token: 'tok',
    application_id: 'app',
    type: 4,
    channel_id: 'channel-mod',
    member: { user: { id: userId, username: 'someone' } },
    data: {
      name: 'preset',
      options: [
        {
          name: subcommand,
          type: 1,
          options: [{ name: 'user', type: 3, value: 'a', focused: true }],
        },
      ],
    },
  } as unknown as AutocompleteInteraction;
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
const ctx = { waitUntil: vi.fn((p: Promise<unknown>) => p), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

describe('handleAutocomplete moderator gate', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.resetRateLimiterInstance();
    env = {
      DISCORD_PUBLIC_KEY: 'k',
      DISCORD_TOKEN: 't',
      DISCORD_CLIENT_ID: 'app',
      // isModerator() requires snowflake-shaped ids
      MODERATOR_IDS: '111111111111111111,222222222222222222',
      MODERATION_CHANNEL_ID: 'channel-mod',
      SUBMISSION_LOG_CHANNEL_ID: 'channel-log',
      BOT_API_SECRET: 's',
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
      DB: createMockD1Database() as unknown as D1Database,
      KV: createMockKV() as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };
    vi.mocked(banService.searchBannedUsers).mockResolvedValue([
      { discordId: '999', xivAuthId: null, username: 'banned-person' },
    ] as never);
    vi.mocked(banService.searchPresetAuthors).mockResolvedValue([
      { discordId: '555', username: 'author', presetCount: 3 },
    ] as never);
  });

  it('returns no choices and never touches D1 for a non-moderator (unban_user → banned list)', async () => {
    const res = await handleAutocomplete(autocompleteInteraction('333333333333333333', 'unban_user'), env, ctx, logger);
    const json = (await res.json()) as { data: { choices: unknown[] } };
    expect(json.data.choices).toEqual([]);
    expect(banService.searchBannedUsers).not.toHaveBeenCalled();
  });

  it('returns no choices and never touches D1 for a non-moderator (ban_user → author ids)', async () => {
    const res = await handleAutocomplete(autocompleteInteraction('333333333333333333', 'ban_user'), env, ctx, logger);
    const json = (await res.json()) as { data: { choices: unknown[] } };
    expect(json.data.choices).toEqual([]);
    expect(banService.searchPresetAuthors).not.toHaveBeenCalled();
  });

  it('still serves choices to a moderator', async () => {
    const res = await handleAutocomplete(
      autocompleteInteraction('111111111111111111', 'unban_user'),
      env,
      ctx,
      logger,
    );
    const json = (await res.json()) as { data: { choices: Array<{ name: string }> } };
    expect((logger as { warn: { mock: { calls: unknown[] } } }).warn.mock.calls).toEqual([]);
    expect((logger as { error: { mock: { calls: unknown[] } } }).error.mock.calls).toEqual([]);
    expect(json.data.choices).toHaveLength(1);
    expect(json.data.choices[0].name).toContain('banned-person');
  });
});
