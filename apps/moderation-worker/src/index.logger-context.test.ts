import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockD1Database, createMockKV } from '@xivdyetools/test-utils';
import app from './index.js';
import { verifyDiscordRequest } from './utils/verify.js';
import type { Env } from './types/env.js';

vi.mock('./utils/verify.js', () => ({ verifyDiscordRequest: vi.fn() }));
const contextErrorCalls = vi.hoisted(() => vi.fn());
vi.mock('@xivdyetools/logger/worker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/logger/worker')>();
  return {
    ...actual,
    createRequestLogger: (...args: Parameters<typeof actual.createRequestLogger>) => {
      const logger = actual.createRequestLogger(...args);
      const error = logger.error.bind(logger);
      logger.error = (...params) => {
        contextErrorCalls(...params);
        error(...params);
      };
      return logger;
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('H-MODERATION context-only errors', () => {
  describe.each([
    [2, 'interaction', 'name', 'commandName'],
    [4, 'autocomplete interaction', 'name', 'commandName'],
    [3, 'component interaction', 'custom_id', 'customId'],
    [5, 'modal interaction', 'custom_id', 'customId'],
  ] as const)('interaction type %s', (type, kind, inputField, contextField) => {
    it.each([
      'diagnostic',
      'Bearer synthetic-bearer',
      'https://discord.com/api/webhooks/123/synthetic-webhook',
      'https://discord.com/api/interactions/456/synthetic-interaction/callback',
    ])('retains safe context and redacts credentials (%s)', async (value) => {
      vi.mocked(verifyDiscordRequest).mockResolvedValue({
        isValid: true,
        error: '',
        body: JSON.stringify({ type, data: { [inputField]: value } }),
      });
      const lines: string[] = [];
      vi.spyOn(console, 'log').mockImplementation((line: unknown) => lines.push(String(line)));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const env = {
        DISCORD_TOKEN: 'synthetic-env-token',
        DISCORD_PUBLIC_KEY: 'a'.repeat(64),
        MODERATOR_IDS: '123456789012345678',
        MODERATION_CHANNEL_ID: '345678901234567890',
        DISCORD_CLIENT_ID: '1453806659708129374',
        PRESETS_API_URL: 'https://api.xivdyetools.app',
        KV: createMockKV(),
        DB: createMockD1Database(),
        PRESETS_API: {},
      } as unknown as Env;
      const ctx = {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      } as unknown as ExecutionContext;
      const response = await app.fetch(
        new Request('http://localhost/', { method: 'POST' }),
        env,
        ctx,
      );
      expect(response.status).toBe(200);
      if (type === 4) expect(await response.json()).toEqual({ type: 8, data: { choices: [] } });
      else expect(await response.json()).toMatchObject({ type: 4, data: { flags: 64 } });
      const message = `Unable to identify user from ${kind}`;
      expect(contextErrorCalls).toHaveBeenCalledExactlyOnceWith(message, undefined, {
        [contextField]: value,
      });
      const entry = lines
        .filter((line) => line.startsWith('{'))
        .map((line) => JSON.parse(line))
        .find((row) => row.message === message);
      expect(entry).toBeDefined();
      expect(entry.error).toBeUndefined();
      expect(entry.context[contextField]).toBe(
        value === 'diagnostic' ? 'diagnostic' : '[REDACTED]',
      );
      expect(entry.context.requestId).toEqual(expect.any(String));
      for (const secret of [
        'synthetic-bearer',
        'synthetic-webhook',
        'synthetic-interaction',
        'synthetic-env-token',
      ]) {
        expect(lines.join('\n')).not.toContain(secret);
      }
    });
  });
});
