import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockKV } from '@xivdyetools/test-utils';
import { createBotSignatureV2 } from '@xivdyetools/auth';
import { authMiddleware, requireAuth, requireModerator } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createExpiredJWT, createMockEnv, createTestJWT } from '../test-utils';

const U = '0b8a1c52-4d6e-4f43-9a55-1f0f6a7c9e21';
const D = '123456789012345678';
const claims = {
  sub: U,
  username: 'Tester',
  discord_id: D,
  auth_provider: 'discord',
  identity_revision: 3,
};

describe('OAuth session validation before granting web authority', () => {
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  let env: Env;
  let validateSession: ReturnType<typeof vi.fn<() => Promise<unknown>>>;
  let reached: ReturnType<typeof vi.fn<() => void>>;
  beforeEach(() => {
    validateSession = vi.fn(async () => ({ version: 1, status: 'valid' }));
    env = createMockEnv({
      MODERATOR_IDS: D,
      OAUTH_SESSION_CHECK_ENABLED: 'true',
      OAUTH_IDENTITY: { validateSession },
    });
    reached = vi.fn();
    app = new Hono();
    app.use('*', authMiddleware);
    app.all('*', (c) => {
      reached();
      const denied = c.req.path === '/moderator' ? requireModerator(c) : requireAuth(c);
      return denied ?? c.json(c.get('auth'));
    });
  });
  afterEach(() => vi.useRealTimers());
  async function request(overrides: Record<string, unknown> = {}, path = '/owner') {
    const token = await createTestJWT(env.JWT_SECRET!, { ...claims, ...overrides });
    return app.request(path, { headers: { Authorization: `Bearer ${token}` } }, env);
  }
  it('sends only the minimal signed claim DTO and grants the current session', async () => {
    const response = await request({ username: 'Not sent', avatar: 'Not sent' }, '/moderator');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ userDiscordId: D, jwtSub: U, isModerator: true });
    expect(validateSession).toHaveBeenCalledExactlyOnceWith({
      sub: U,
      discordId: D,
      authProvider: 'discord',
      identityRevision: 3,
    });
  });
  it('leaves legacy revision absent for the provider to decide against current revision zero', async () => {
    expect(
      (
        await request({
          identity_revision: undefined,
          auth_provider: 'xivauth',
          discord_id: undefined,
        })
      ).status,
    ).toBe(200);
    expect(validateSession).toHaveBeenCalledExactlyOnceWith({ sub: U, authProvider: 'xivauth' });
  });
  for (const status of ['stale', 'missing'] as const) {
    it.each(['/owner', '/moderator', '/api/v1/presets/refresh-author'])(
      `${status} denies %s before downstream authority`,
      async (path) => {
        validateSession.mockResolvedValue({ version: 1, status });
        expect((await request({}, path)).status).toBe(401);
        expect(reached).not.toHaveBeenCalled();
      },
    );
  }
  it.each(
    [
      { version: 1, status: 'pending' },
      { version: 2, status: 'valid' },
      { version: 1, status: 'valid', internalId: U },
      { version: 1, status: 'unknown' },
      { status: 'valid' },
      Object.assign(Object.create({ version: 1, status: 'valid' }), { alienA: 1, alienB: 2 }),
      null,
      [],
      'valid',
    ].map((reply) => [reply]),
  )('fails closed on pending or malformed reply %j', async (reply) => {
    validateSession.mockResolvedValue(reply);
    expect((await request()).status).toBe(503);
    expect(reached).not.toHaveBeenCalled();
  });
  it.each([
    { auth_provider: undefined },
    { auth_provider: 'other' },
    { auth_provider: null },
    { identity_revision: '3' },
    { identity_revision: -1 },
    { identity_revision: 0.5 },
    { identity_revision: Number.MAX_SAFE_INTEGER + 1 },
    { identity_revision: null },
    { discord_id: 123 },
    { discord_id: '' },
  ])('rejects malformed identity claims before RPC %j', async (overrides) => {
    expect((await request(overrides)).status).toBe(401);
    expect(validateSession).not.toHaveBeenCalled();
    expect(reached).not.toHaveBeenCalled();
  });
  it('accepts explicit zero revision and null Discord claim without inventing a link', async () => {
    expect(
      (await request({ identity_revision: 0, discord_id: null, auth_provider: 'xivauth' })).status,
    ).toBe(200);
    expect(validateSession).toHaveBeenCalledExactlyOnceWith({
      sub: U,
      identityRevision: 0,
      discordId: null,
      authProvider: 'xivauth',
    });
  });
  it('fails closed on provider rejection without leaking its payload', async () => {
    validateSession.mockRejectedValue(new Error(`private ${U}`));
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(U);
    expect(reached).not.toHaveBeenCalled();
  });
  it('bounds a hung provider and ignores its late successful reply', async () => {
    let resolve!: (reply: unknown) => void;
    validateSession.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const token = await createTestJWT(env.JWT_SECRET!, claims);
    vi.useFakeTimers();
    const pending = app.request('/owner', { headers: { Authorization: `Bearer ${token}` } }, env);
    await vi.waitFor(() => expect(validateSession).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(2000);
    expect((await pending).status).toBe(503);
    resolve({ version: 1, status: 'valid' });
    await Promise.resolve();
    expect(reached).not.toHaveBeenCalled();
  });
  it.each([undefined, 'false'])('does not contact OAuth while flag is %s', async (flag) => {
    env.OAUTH_SESSION_CHECK_ENABLED = flag;
    validateSession.mockRejectedValue(new Error('must not call'));
    expect((await request()).status).toBe(200);
    expect(validateSession).not.toHaveBeenCalled();
  });
  it.each([undefined, {}, { validateSession: 'invalid' }])(
    'fails closed when active binding is malformed %j',
    async (binding) => {
      env.OAUTH_IDENTITY = binding as Env['OAUTH_IDENTITY'];
      expect((await request()).status).toBe(503);
      expect(reached).not.toHaveBeenCalled();
    },
  );
  it.each(['signature', 'issuer', 'expiry', 'revocation'])(
    'rejects %s before calling OAuth',
    async (failure) => {
      env.JWT_ISSUER = 'xivdyetools-oauth-worker';
      env.TOKEN_BLACKLIST = createMockKV() as unknown as KVNamespace;
      const payload = {
        ...claims,
        iss: failure === 'issuer' ? 'https://wrong.example' : env.JWT_ISSUER,
        jti: 'revoked',
      };
      const token =
        failure === 'expiry'
          ? await createExpiredJWT(env.JWT_SECRET!, payload)
          : await createTestJWT(
              failure === 'signature'
                ? 'a-wrong-secret-long-enough-for-the-library'
                : env.JWT_SECRET!,
              payload,
              3600,
              failure === 'issuer' ? 'https://wrong.example' : env.JWT_ISSUER,
            );
      if (failure === 'revocation') await env.TOKEN_BLACKLIST.put('revoked:revoked', '1');
      expect(
        (await app.request('/owner', { headers: { Authorization: `Bearer ${token}` } }, env))
          .status,
      ).toBe(401);
      expect(validateSession).not.toHaveBeenCalled();
    },
  );
  it('leaves valid signed bot authentication independent of OAuth', async () => {
    env.ENVIRONMENT = 'production';
    env.BOT_SIGNING_SECRET = 'a-bot-signing-secret-with-more-than-32-characters';
    validateSession.mockRejectedValue(new Error('must not call'));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomUUID();
    const signature = await createBotSignatureV2(
      { method: 'GET', path: '/moderator', timestamp, nonce, userDiscordId: D },
      env.BOT_SIGNING_SECRET,
    );
    const response = await app.request(
      '/moderator',
      {
        headers: {
          Authorization: 'Bearer test-bot-secret',
          'X-User-Discord-ID': D,
          'X-Request-Timestamp': timestamp,
          'X-Request-Nonce': nonce,
          'X-Request-Signature-V2': signature,
        },
      },
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ authSource: 'bot', isModerator: true });
    expect(validateSession).not.toHaveBeenCalled();
  });
});
