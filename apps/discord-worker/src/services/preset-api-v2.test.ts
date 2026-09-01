/**
 * Bot → presets-api request signing v2 (FINDING-014, 2026-08-21 audit).
 *
 * Every signed request carries `X-Request-Signature-V2` (+ a nonce) binding
 * method, path and body. The legacy v1 header (`X-Request-Signature`) is no
 * longer sent — presets-api stopped accepting it in 2.2.0 and the bot stopped
 * sending it in 5.1.0 (FINDING-015, 2026-08-29 audit).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyBotSignatureV2 } from '@xivdyetools/auth';
import { getPresets, submitPreset } from './preset-api.js';

const SECRET = 'test-signing-secret-padding-1234';

function captureEnv(): { env: any; calls: Request[] } {
  const calls: Request[] = [];
  const env: any = {
    PRESETS_API: {
      fetch: vi.fn(async (req: Request) => {
        calls.push(req);
        return Response.json({ presets: [], total: 0, page: 1, success: true, preset: { id: 'p1' } });
      }),
    },
    BOT_API_SECRET: 'secret-token',
    BOT_SIGNING_SECRET: SECRET,
  };
  return { env, calls };
}

async function reqFields(req: Request) {
  const clone = req.clone();
  const body = req.method === 'GET' ? undefined : await clone.text();
  return {
    method: req.method,
    path: new URL(req.url).pathname,
    body,
    timestamp: req.headers.get('X-Request-Timestamp') ?? undefined,
    nonce: req.headers.get('X-Request-Nonce') ?? undefined,
    userDiscordId: req.headers.get('X-User-Discord-ID') ?? undefined,
    userName: req.headers.get('X-User-Discord-Name') ?? undefined,
  };
}

describe('preset-api v2 request signatures', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a v2 signature + nonce on a GET that verifies against method and path', async () => {
    const { env, calls } = captureEnv();
    await getPresets(env);

    const req = calls[0];
    const sig = req.headers.get('X-Request-Signature-V2');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(req.headers.get('X-Request-Nonce')).toBeTruthy();
    expect(req.headers.get('X-Request-Signature')).toBeNull(); // v1 retired (FINDING-015)

    await expect(verifyBotSignatureV2(sig, await reqFields(req), SECRET)).resolves.toBe(true);
  });

  it('binds the JSON body and the submitting user on POST', async () => {
    const { env, calls } = captureEnv();
    await submitPreset(
      env,
      { name: 'Test preset name', description: 'A description long enough', category_id: 'jobs', dyes: [1, 2, 3], tags: [] } as any,
      '123456789012345678',
      'Tester',
    );

    const req = calls[0];
    const sig = req.headers.get('X-Request-Signature-V2');
    const fields = await reqFields(req);
    expect(fields.userDiscordId).toBe('123456789012345678');
    await expect(verifyBotSignatureV2(sig, fields, SECRET)).resolves.toBe(true);
    await expect(verifyBotSignatureV2(sig, { ...fields, body: '{"name":"other"}' }, SECRET)).resolves.toBe(false);
  });
});
