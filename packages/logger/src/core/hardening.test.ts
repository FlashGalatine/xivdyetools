/**
 * Logger hardening (FINDING-026, 2026-08-21 security audit).
 *
 * - a circular or BigInt-bearing context must not make `write()` throw (a log
 *   call was able to fail the request that made it)
 * - the `message` argument is sanitised like error messages are
 * - extra secret-shaped key names are redacted (privateKey, setCookie,
 *   webhookUrl, authHeader, cookie, sessionId)
 * - secret-shaped VALUES are redacted regardless of key (Bearer …, JWTs,
 *   Discord bot tokens)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { JsonAdapter } from '../adapters/json-adapter.js';

function capture(): { logger: JsonAdapter; lines: () => string[] } {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const logger = new JsonAdapter({ level: 'debug' });
  return { logger, lines: () => spy.mock.calls.map((c) => String(c[0])) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger hardening', () => {
  it('does not throw on a circular context and marks the back-reference', () => {
    const { logger, lines } = capture();
    const ctx: Record<string, unknown> = { a: 1 };
    ctx.self = ctx;

    expect(() => logger.info('hello', ctx)).not.toThrow();
    const out = lines();
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('"a":1');
    expect(out[0]).toContain('[Circular]');
  });

  it('does not throw on BigInt values', () => {
    const { logger, lines } = capture();
    expect(() => logger.info('big', { n: 123n })).not.toThrow();
    expect(lines()[0]).toContain('"n":"123"');
  });

  it('sanitises the message argument', () => {
    const { logger, lines } = capture();
    logger.warn('upstream failed token=abc123 for user');
    expect(lines()[0]).toContain('token=[REDACTED]');
    expect(lines()[0]).not.toContain('abc123');
  });

  it('redacts additional secret-shaped key names', () => {
    const { logger, lines } = capture();
    logger.info('ctx', {
      privateKey: 'pk',
      setCookie: 'session=1',
      webhookUrl: 'https://discord.com/api/webhooks/1/abc',
      authHeader: 'Bearer x',
      cookie: 'a=b',
      sessionId: 's-1',
      safe: 'keep-me',
    });
    const out = lines()[0];
    for (const leaked of ['"pk"', 'session=1', 'webhooks/1/abc', 'Bearer x', '"a=b"', 's-1']) {
      expect(out).not.toContain(leaked);
    }
    expect(out).toContain('keep-me');
  });

  it('redacts secret-shaped values under innocuous keys', () => {
    const { logger, lines } = capture();
    // Assembled at runtime on purpose: a token-shaped literal trips secret
    // scanners (GitHub push protection flags it as a Discord bot token) even
    // though every part is synthetic.
    const discordish = ['MTIzNDU2Nzg5MDEyMzQ1Njc4', 'GabcDe', 'abcdefghijklmnopqrstuvwxyz012'].join('.');
    logger.info('ctx', {
      note: 'Bearer abc.def.ghi',
      jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXNpZ25hdHVyZS1zaWduYXR1cmU',
      discordish,
      plain: 'hello world',
    });
    const out = lines()[0];
    expect(out).not.toContain('abc.def.ghi');
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(out).not.toContain(discordish);
    expect(out).not.toContain('MTIzNDU2Nzg5MDEyMzQ1Njc4');
    expect(out).toContain('hello world');
  });

  it('logs non-Error throws through the sanitiser', () => {
    const { logger, lines } = capture();
    logger.error('failed', 'password=hunter2');
    expect(lines()[0]).not.toContain('hunter2');
  });
});
