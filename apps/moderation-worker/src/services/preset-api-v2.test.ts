/**
 * Bot → presets-api request signing v2 (FINDING-014, 2026-08-21 audit).
 *
 * Every signed request carries `X-Request-Signature-V2` (+ a nonce) that binds
 * method, path and body, so a captured header tuple cannot be replayed against
 * a different route. The legacy v1 header (`X-Request-Signature`) is no longer
 * sent — presets-api stopped accepting it in 2.2.0 and this bot stopped
 * sending it in 1.6.0 (FINDING-015, 2026-08-29 audit).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockFetcher } from '@xivdyetools/test-utils';
import { verifyBotSignatureV2 } from '@xivdyetools/auth';
import { getPresets, approvePreset } from './preset-api.js';
import type { Env } from '../types/env.js';

const SECRET = 'test-signing-secret-padding-1234';

describe('preset-api v2 request signatures', () => {
  let mockEnv: Env;
  let mockFetcher: ReturnType<typeof createMockFetcher>;

  beforeEach(() => {
    mockFetcher = createMockFetcher();
    mockEnv = {
      PRESETS_API: mockFetcher as unknown as Fetcher,
      BOT_API_SECRET: 'test-api-secret',
      BOT_SIGNING_SECRET: SECRET,
      MODERATOR_IDS: '12345678901234567',
    } as Env;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sends a v2 signature + nonce on a GET that verifies against method, path and empty body', async () => {
    mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

    await getPresets(mockEnv);

    const call = mockFetcher._calls[0];
    const sig = call.headers['x-request-signature-v2'];
    const nonce = call.headers['x-request-nonce'];
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(nonce).toBeTruthy();
    // v1 retired (FINDING-015)
    expect(call.headers['x-request-signature']).toBeUndefined();

    await expect(
      verifyBotSignatureV2(
        sig,
        {
          method: call.method,
          path: new URL(call.url).pathname,
          body: call.body,
          timestamp: call.headers['x-request-timestamp'],
          nonce,
          userDiscordId: call.headers['x-user-discord-id'],
          userName: call.headers['x-user-discord-name'],
        },
        SECRET,
      ),
    ).resolves.toBe(true);
  });

  it('binds the JSON body and identity on a moderator PATCH', async () => {
    mockFetcher._setupHandler(() => Response.json({ success: true, preset: { id: 'p1' } }));

    await approvePreset(mockEnv, 'p1', '12345678901234567', 'Mod');

    const call = mockFetcher._calls[0];
    const sig = call.headers['x-request-signature-v2'];
    const req = {
      method: call.method,
      path: new URL(call.url).pathname,
      body: call.body,
      timestamp: call.headers['x-request-timestamp'],
      nonce: call.headers['x-request-nonce'],
      userDiscordId: call.headers['x-user-discord-id'],
      userName: call.headers['x-user-discord-name'],
    };
    await expect(verifyBotSignatureV2(sig, req, SECRET)).resolves.toBe(true);
    // tampering with the body invalidates it
    await expect(verifyBotSignatureV2(sig, { ...req, body: '{"status":"rejected"}' }, SECRET)).resolves.toBe(false);
  });
});
