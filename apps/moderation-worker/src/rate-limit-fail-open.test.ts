/**
 * Rate limiter fail-open visibility (FINDING-012, 2026-08-29 security audit).
 *
 * `CloudflareRateLimiter` allows the request when the native binding errors —
 * an accepted trade-off (docs/architecture/security-trade-offs.md) on the
 * condition that the event is logged. It was not: the limiter is a per-isolate
 * singleton built without a logger, and `checkRateLimit` dropped the
 * `backendError` flag, so a broken `RL_COMMAND` / `RL_AUTOCOMPLETE` binding
 * disabled per-user limiting with no error and no log line at all.
 *
 * These tests drive the real middleware through the real limiter with a
 * binding whose `limit()` rejects: the request must still be served (fail
 * open) AND the request logger must carry the warning. Deliberately no
 * client-visible header — it would tell an abuser exactly when the limiter is
 * off.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockKV, createMockD1Database } from '@xivdyetools/test-utils';
import type { Env } from './types/env.js';
import * as rateLimit from './middleware/rate-limit.js';
import * as banService from './services/ban-service.js';
import * as buttons from './handlers/buttons/index.js';

vi.mock('./services/ban-service.js', () => ({
  searchPresetAuthors: vi.fn(),
  searchBannedUsers: vi.fn(),
}));
vi.mock('./handlers/buttons/index.js', async () => {
  const actual = await vi.importActual<typeof import('./handlers/buttons/index.js')>(
    './handlers/buttons/index.js',
  );
  return { ...actual, handleButtonInteraction: vi.fn(async () => Response.json({ ok: 'button' })) };
});

const { handleComponent, handleAutocomplete } = await import('./index.js');

const MOD = '111111111111111111';
const FAIL_OPEN_WARNING = 'Rate limiter backend error — request allowed (fail-open)';

/** A native rate-limit binding that is down. */
function throwingBinding(): RateLimit {
  return {
    limit: async () => {
      throw new Error('rate limit binding unavailable');
    },
  } as unknown as RateLimit;
}

function buttonInteraction(): Parameters<typeof handleComponent>[0] {
  return {
    id: 'int-1',
    token: 'tok',
    application_id: 'app',
    type: 3,
    member: { user: { id: MOD, username: 'someone' } },
    data: { custom_id: 'preset_approve_a0000000-0000-4000-8000-000000000001', component_type: 2 },
  } as unknown as Parameters<typeof handleComponent>[0];
}

function autocompleteInteraction(): Parameters<typeof handleAutocomplete>[0] {
  return {
    id: 'int-2',
    token: 'tok',
    application_id: 'app',
    type: 4,
    member: { user: { id: MOD, username: 'someone' } },
    data: {
      name: 'preset',
      options: [
        {
          name: 'unban_user',
          type: 1,
          options: [{ name: 'user', type: 3, value: 'a', focused: true }],
        },
      ],
    },
  } as unknown as Parameters<typeof handleAutocomplete>[0];
}

describe('FINDING-012: a broken rate-limit binding fails open loudly', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.resetRateLimiterInstance();
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    env = {
      DISCORD_PUBLIC_KEY: 'k',
      DISCORD_TOKEN: 't',
      DISCORD_CLIENT_ID: 'app',
      MODERATOR_IDS: MOD,
      MODERATION_CHANNEL_ID: 'channel-mod',
      BOT_API_SECRET: 's',
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
      DB: createMockD1Database() as unknown as D1Database,
      KV: createMockKV() as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };
    ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => p),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
    vi.mocked(banService.searchBannedUsers).mockResolvedValue([
      { discordId: '999', xivAuthId: null, username: 'banned-person' },
    ] as never);
  });

  it('serves the command interaction and warns once with the interaction type', async () => {
    env.RL_COMMAND = throwingBinding();

    const res = await handleComponent(buttonInteraction(), env, ctx, logger as never);

    // fail open: the click still reached its handler
    expect((await res.json()) as unknown).toEqual({ ok: 'button' });
    expect(buttons.handleButtonInteraction).toHaveBeenCalledTimes(1);
    // ...and the fail-open is on the record
    expect(logger.warn).toHaveBeenCalledWith(FAIL_OPEN_WARNING, { type: 'command' });
    expect(logger.warn.mock.calls.filter((c) => c[0] === FAIL_OPEN_WARNING)).toHaveLength(1);
  });

  it('serves the autocomplete interaction and warns with type autocomplete', async () => {
    env.RL_AUTOCOMPLETE = throwingBinding();

    const res = await handleAutocomplete(autocompleteInteraction(), env, ctx, logger as never);
    const json = (await res.json()) as { data: { choices: unknown[] } };

    // fail open: the moderator still gets their choices
    expect(banService.searchBannedUsers).toHaveBeenCalledTimes(1);
    expect(json.data.choices).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(FAIL_OPEN_WARNING, { type: 'autocomplete' });
  });

  it('says nothing when the binding is healthy', async () => {
    const healthy = { limit: async () => ({ success: true }) } as unknown as RateLimit;
    env.RL_COMMAND = healthy;
    env.RL_AUTOCOMPLETE = healthy;

    await handleComponent(buttonInteraction(), env, ctx, logger as never);

    expect(buttons.handleButtonInteraction).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls.filter((c) => c[0] === FAIL_OPEN_WARNING)).toHaveLength(0);
  });
});
