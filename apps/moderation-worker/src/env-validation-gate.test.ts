/**
 * Startup env validation as a REQUEST GATE (FINDING-013, 2026-08-29 audit).
 *
 * `validateEnv` raises `Missing required env var in production: RL_COMMAND` /
 * `RL_AUTOCOMPLETE` when a production deploy lost a native rate-limit binding.
 * Logging that is not enough: Workers Logs are off on this script, so the
 * once-per-isolate `logValidationErrors` line reaches nobody and a production
 * bot would go on serving with per-user limiting quietly degraded to the KV
 * fallback. Those errors — and only those — must refuse every request,
 * `/health` included, so an uptime check goes red in minutes.
 *
 * These tests drive the real Hono app end to end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockKV, createMockD1Database } from '@xivdyetools/test-utils';
import type { Env } from './types/env.js';

/** A fully-configured environment; each test breaks exactly one thing. */
function validEnv(overrides: Partial<Env> = {}): Env {
  return {
    DISCORD_TOKEN: 'token-value',
    DISCORD_PUBLIC_KEY: 'a'.repeat(64),
    MODERATOR_IDS: '123456789012345678',
    MODERATION_CHANNEL_ID: '345678901234567890',
    DISCORD_CLIENT_ID: '1453806659708129374',
    PRESETS_API_URL: 'https://api.xivdyetools.app',
    BOT_API_SECRET: 'secret',
    KV: createMockKV() as unknown as KVNamespace,
    DB: createMockD1Database() as unknown as D1Database,
    PRESETS_API: {} as Fetcher,
    ...overrides,
  } as Env;
}

/** Both native rate-limit bindings, as production binds them. */
function boundLimiters(): Partial<Env> {
  const binding = { limit: async () => ({ success: true }) } as unknown as RateLimit;
  return { RL_COMMAND: binding, RL_AUTOCOMPLETE: binding };
}

const ctx = {
  waitUntil: vi.fn((p: Promise<unknown>) => p),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

/**
 * A fresh module instance per test: `startupValidationDone` in index.ts is
 * module state, and half of what these tests probe is what happens on the
 * SECOND request in an isolate.
 */
async function freshApp() {
  vi.resetModules();
  const mod = await import('./index.js');
  return mod.default;
}

/** A command interaction POST — unsigned, so a healthy worker answers 401. */
function interactionRequest(): [string, RequestInit] {
  return [
    'http://localhost/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 2, id: 'int-1', token: 'tok', data: { name: 'preset' } }),
    },
  ];
}

describe('FINDING-013: production refuses requests while a rate-limit binding is missing', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // The paths under test log by design; keep the suite output clean.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['RL_COMMAND', 'RL_AUTOCOMPLETE'] as const)(
    'answers a command interaction with 500 Service misconfigured when %s is missing',
    async (missing) => {
      const app = await freshApp();
      const env = validEnv({ ENVIRONMENT: 'production', ...boundLimiters(), [missing]: undefined });

      const res = await app.request(...interactionRequest(), env, ctx);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Service misconfigured' });
    },
  );

  it('answers /health with the same 500 — a red uptime check is the point', async () => {
    const app = await freshApp();
    const env = validEnv({
      ENVIRONMENT: 'production',
      ...boundLimiters(),
      RL_COMMAND: undefined,
    });

    const res = await app.request('http://localhost/health', {}, env, ctx);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Service misconfigured' });
  });

  it('refuses every request, not just the first one in the isolate (BUG-017)', async () => {
    const app = await freshApp();
    const env = validEnv({
      ENVIRONMENT: 'production',
      ...boundLimiters(),
      RL_AUTOCOMPLETE: undefined,
    });

    const first = await app.request('http://localhost/health', {}, env, ctx);
    const second = await app.request('http://localhost/health', {}, env, ctx);

    expect(first.status).toBe(500);
    expect(second.status).toBe(500);
    expect(await second.json()).toEqual({ error: 'Service misconfigured' });
  });

  it('serves production normally when both bindings are present', async () => {
    const app = await freshApp();
    const env = validEnv({ ENVIRONMENT: 'production', ...boundLimiters() });

    const health = await app.request('http://localhost/health', {}, env, ctx);
    const interaction = await app.request(...interactionRequest(), env, ctx);

    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });
    // reached the Ed25519 check instead of the config gate
    expect(interaction.status).toBe(401);
  });

  it('leaves the development worker alone with neither binding bound (KV fallback)', async () => {
    const app = await freshApp();
    const env = validEnv({ ENVIRONMENT: 'development' });

    const health = await app.request('http://localhost/health', {}, env, ctx);
    const interaction = await app.request(...interactionRequest(), env, ctx);

    expect(health.status).toBe(200);
    expect(interaction.status).toBe(401);
  });

  it('still only logs for a validation error that is not production-scoped', async () => {
    const app = await freshApp();
    // A malformed MODERATOR_IDS is an error, but not a production-only one
    const env = validEnv({ ENVIRONMENT: 'production', ...boundLimiters(), MODERATOR_IDS: 'nope' });

    const res = await app.request('http://localhost/health', {}, env, ctx);

    expect(res.status).toBe(200);
    expect(consoleError).toHaveBeenCalled();
  });
});
