import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockEnv } from '../../tests/test-utils';
import { CharaQuotaError, createCharaAdmission } from './rate-limit';

afterEach(() => vi.restoreAllMocks());
const request = (ip?: string) => new Request('https://local.test', { headers: { ...(ip ? { 'CF-Connecting-IP': ip } : {}), 'X-Forwarded-For': 'spoofed' } });
describe('dedicated chara quota', () => {
  it.each(['development', 'production'])('isolates native public /64 and service budgets in %s', async (ENVIRONMENT) => {
    const publicLimit = ENVIRONMENT === 'production' ? 30 : 60;
    const pub = { limit: vi.fn(async () => ({ success: true })) };
    const svc = { limit: vi.fn(async () => ({ success: true })) };
    const env = createMockEnv({ ENVIRONMENT, CHARA_RATE_LIMITER: pub, CHARA_SERVICE_RATE_LIMITER: svc });
    for (const ip of ['2001:db8:1234:5678::1', '2001:db8:1234:5678::2', '2001:db8:1234:5679::1']) await createCharaAdmission(env, request(ip))();
    await createCharaAdmission(env, request())();
    expect(pub.limit.mock.calls.map((call) => (call as unknown as [{ key: string }])[0].key)).toEqual([
      `chara:ip:2001:db8:1234:5678:::t${publicLimit}_60`,
      `chara:ip:2001:db8:1234:5678:::t${publicLimit}_60`,
      `chara:ip:2001:db8:1234:5679:::t${publicLimit}_60`,
    ]);
    expect(svc.limit).toHaveBeenCalledWith({ key: `chara:svc:workers:t${publicLimit * 20}_60` });
  });
  it.each(['development', 'production'])('uses separate KV prefixes and exact 20x limits in %s', async (ENVIRONMENT) => {
    const env = createMockEnv({ ENVIRONMENT });
    const maximum = ENVIRONMENT === 'production' ? 30 : 60;
    const pub = createCharaAdmission(env, request('192.0.2.1'));
    const svc = createCharaAdmission(env, request());
    for (let i = 0; i < maximum; i++) await pub();
    await expect(pub()).rejects.toBeInstanceOf(CharaQuotaError);
    for (let i = 0; i < maximum * 20; i++) await svc();
    await expect(svc()).rejects.toBeInstanceOf(CharaQuotaError);
  });
  it('KV shares IPv6 /64 while separating another prefix and IPv4', async () => {
    const env = createMockEnv();
    const get = vi.spyOn(env.RATE_LIMIT, 'get');
    for (const ip of ['2001:db8::1', '2001:db8::2', '2001:db9::1', '192.0.2.1', '::ffff:192.0.2.1']) await createCharaAdmission(env, request(ip))();
    const keys = get.mock.calls.map((call) => call[0]);
    expect(keys[0]).toBe(keys[2]);
    expect(keys[0]).not.toBe(keys[4]);
    expect(keys[6]).toBe(keys[8]);
    expect(keys[0]).toMatch(/^chara:ip:/);
  });
  it.each([null, false, {}, { limit: 1 }])('rejects malformed native configuration before any admission: %s', (binding) => {
    const env = createMockEnv({ CHARA_RATE_LIMITER: binding as unknown as RateLimit });
    expect(() => createCharaAdmission(env, request('192.0.2.1'))).toThrow();
  });
  it('rejects malformed fallback and never downgrades a configured native binding', () => {
    expect(() => createCharaAdmission(createMockEnv({ RATE_LIMIT: {} as KVNamespace }), request())).toThrow();
    const env = createMockEnv({ CHARA_SERVICE_RATE_LIMITER: {} as RateLimit });
    const get = vi.spyOn(env.RATE_LIMIT, 'get');
    expect(() => createCharaAdmission(env, request())).toThrow();
    expect(get).not.toHaveBeenCalled();
  });
  it.each(['native', 'kv-read', 'kv-write'])('fails open on %s runtime error with fixed scope-only logs', async (kind) => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = createMockEnv();
    if (kind === 'native') env.CHARA_RATE_LIMITER = { limit: vi.fn(async () => { throw new Error('192.0.2.1 private URL'); }) };
    else vi.spyOn(env.RATE_LIMIT, kind === 'kv-read' ? 'get' : 'put').mockRejectedValue(new Error('192.0.2.1 private URL'));
    await expect(createCharaAdmission(env, request('192.0.2.1'))()).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalled();
    expect(JSON.stringify(warning.mock.calls)).not.toContain('192.0.2.1');
    expect(warning.mock.calls[0]).toEqual(['Chara rate limiter runtime failure; allowing operation', { scope: 'chara:ip:' }]);
  });
});
