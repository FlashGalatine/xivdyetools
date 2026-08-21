/**
 * Component / modal rate limiting (MOD-12, FINDING-034, 2026-08-21 audit).
 *
 * Slash commands and autocomplete were rate limited per user; button clicks
 * and modal submits were not. Every mutating path checks MODERATOR_IDS first,
 * so the unthrottled paths were cheap rejections — but they still reached
 * presets-api / D1 for moderators. They now share the `command` limiter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockKV, createMockD1Database } from '@xivdyetools/test-utils';
import type { Env } from './types/env.js';
import * as rateLimit from './middleware/rate-limit.js';
import * as buttons from './handlers/buttons/index.js';
import * as modals from './handlers/modals/index.js';

vi.mock('./middleware/rate-limit.js', async () => {
  const actual = await vi.importActual<typeof import('./middleware/rate-limit.js')>(
    './middleware/rate-limit.js',
  );
  return {
    ...actual,
    checkRateLimit: vi.fn(),
    incrementRateLimit: vi.fn(async () => undefined),
  };
});
vi.mock('./handlers/buttons/index.js', async () => {
  const actual = await vi.importActual<typeof import('./handlers/buttons/index.js')>(
    './handlers/buttons/index.js',
  );
  return { ...actual, handleButtonInteraction: vi.fn(async () => Response.json({ ok: 'button' })) };
});
vi.mock('./handlers/modals/index.js', async () => {
  const actual = await vi.importActual<typeof import('./handlers/modals/index.js')>(
    './handlers/modals/index.js',
  );
  return {
    ...actual,
    handlePresetRejectionModal: vi.fn(async () => Response.json({ ok: 'modal' })),
  };
});

const { handleComponent, handleModal } = await import('./index.js');

type Interaction = Parameters<typeof handleComponent>[0];

const MOD = '111111111111111111';
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;

function buttonInteraction(userId?: string): Interaction {
  return {
    id: 'int-1',
    token: 'tok',
    application_id: 'app',
    type: 3,
    ...(userId ? { member: { user: { id: userId, username: 'someone' } } } : {}),
    data: { custom_id: 'preset_approve_a0000000-0000-4000-8000-000000000001', component_type: 2 },
  } as unknown as Interaction;
}

function modalInteraction(userId?: string): Interaction {
  return {
    id: 'int-1',
    token: 'tok',
    application_id: 'app',
    type: 5,
    ...(userId ? { member: { user: { id: userId, username: 'someone' } } } : {}),
    data: {
      custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
      components: [{ type: 1, components: [{ type: 4, custom_id: 'rejection_reason', value: 'long enough reason' }] }],
    },
  } as unknown as Interaction;
}

describe('MOD-12: buttons and modals share the command rate limit', () => {
  let env: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('a rate-limited button click gets the rate-limit reply and never reaches the handler', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
      retryAfter: 30,
    });

    const res = await handleComponent(buttonInteraction(MOD), env, ctx, logger);
    const json = (await res.json()) as { data: { content: string; flags: number } };

    expect(json.data.content).toContain('Rate limit exceeded');
    expect(json.data.flags).toBe(64);
    expect(buttons.handleButtonInteraction).not.toHaveBeenCalled();
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith(
      env.KV,
      MOD,
      'command',
      rateLimit.RATE_LIMIT_CONFIGS.command,
      expect.anything(),
    );
  });

  it('an allowed button click reaches the handler and counts against the command limiter', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValueOnce({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 30_000,
    });

    const res = await handleComponent(buttonInteraction(MOD), env, ctx, logger);

    expect((await res.json()) as unknown).toEqual({ ok: 'button' });
    expect(buttons.handleButtonInteraction).toHaveBeenCalledTimes(1);
    expect(ctx.waitUntil).toHaveBeenCalled();
    expect(rateLimit.incrementRateLimit).toHaveBeenCalledWith(env.KV, MOD, 'command', 3, expect.anything());
  });

  it('a rate-limited modal submit gets the rate-limit reply and never reaches the handler', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
      retryAfter: 30,
    });

    const res = await handleModal(modalInteraction(MOD), env, ctx, logger);
    const json = (await res.json()) as { data: { content: string } };

    expect(json.data.content).toContain('Rate limit exceeded');
    expect(modals.handlePresetRejectionModal).not.toHaveBeenCalled();
  });

  it('an allowed modal submit reaches the handler', async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValueOnce({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 30_000,
    });

    const res = await handleModal(modalInteraction(MOD), env, ctx, logger);

    expect((await res.json()) as unknown).toEqual({ ok: 'modal' });
    expect(modals.handlePresetRejectionModal).toHaveBeenCalledTimes(1);
  });

  it('an interaction without a user is refused before any limiter or handler runs', async () => {
    const res = await handleComponent(buttonInteraction(undefined), env, ctx, logger);
    const json = (await res.json()) as { data: { content: string; flags: number } };

    expect(json.data.flags).toBe(64);
    expect(json.data.content).toContain('Unable to identify user');
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(buttons.handleButtonInteraction).not.toHaveBeenCalled();
  });
});
