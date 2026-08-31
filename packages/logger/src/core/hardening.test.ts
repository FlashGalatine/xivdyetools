/**
 * Logger hardening (FINDING-026, 2026-08-21 security audit;
 * FINDING-025, 2026-08-29 security audit).
 *
 * - a circular or BigInt-bearing context must not make `write()` throw (a log
 *   call was able to fail the request that made it)
 * - the `message` argument is sanitised like error messages are
 * - extra secret-shaped key names are redacted (privateKey, setCookie,
 *   webhookUrl, authHeader, cookie, sessionId)
 * - secret-shaped VALUES are redacted regardless of key (Bearer …, JWTs,
 *   Discord bot tokens)
 * - FINDING-025: the value-shape scan also reaches string items inside
 *   arrays (including arrays nested in arrays), and a bare token with no
 *   key name in front of it inside free text (`message`, `error.message`,
 *   and a non-Error throw) — plus a shape bug in the same array recursion
 *   (an array item that was itself an array used to be spread into a
 *   plain object with numeric-string keys)
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

describe('FINDING-025 (2026-08-29 audit): array items and free text', () => {
  // Reused across cases so a transcription slip can't silently produce a
  // string that fails to match `looksLikeSecretValue` in the first place.
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXNpZ25hdHVyZS1zaWduYXR1cmU';

  describe('string array items', () => {
    it('redacts a JWT that is a bare string item inside an array', () => {
      const { logger, lines } = capture();
      // The finding's own example key. `tokens` (plural) is a deliberate
      // choice: normalized it is "tokens", and SENSITIVE_SUFFIX requires a
      // key to literally END in "token" — "tokens" does not match, so this
      // key is NOT wholesale-redacted by the key-name rule one level up.
      // This case exercises the array value-shape scan itself; reverting
      // just that scan (not the key-name rule) makes it fail.
      logger.warn('x', { tokens: [jwt] });
      const out = lines()[0];
      expect(out).not.toContain(jwt);
      expect(out).toContain('[REDACTED]');
    });

    it('reaches a string item nested two arrays deep, leaving sibling items alone', () => {
      const { logger, lines } = capture();
      logger.info('x', { batches: [[jwt, 'safe-item']] });
      const out = lines()[0];
      expect(out).not.toContain(jwt);
      expect(out).toContain('[REDACTED]');
      expect(out).toContain('safe-item');
    });

    it('does NOT redact a UUID array item (false-positive guard)', () => {
      const { logger, lines } = capture();
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      logger.info('x', { ids: [uuid, 'plain-item'] });
      const out = lines()[0];
      expect(out).toContain(uuid);
      expect(out).toContain('plain-item');
      expect(out).not.toContain('[REDACTED]');
    });
  });

  describe('nested-array shape bug', () => {
    it('preserves array shape when an item is itself an array (no numeric-key reshaping)', () => {
      const { logger, lines } = capture();
      logger.info('x', { a: [[1, 2]] });
      const parsed = JSON.parse(lines()[0]) as { context: { a: unknown } };
      // Before the fix, an array item that is itself an array went through
      // redactSensitiveFields's `{ ...context }` spread, which turns an
      // array into a plain object with numeric-string keys:
      // `{ a: [[1, 2]] }` silently became `{ a: [{ '0': 1, '1': 2 }] }`.
      expect(parsed.context.a).toEqual([[1, 2]]);
    });
  });

  describe('free text: message, error.message, and non-Error throws', () => {
    it('redacts a bare JWT embedded in the message, leaving surrounding prose intact', () => {
      const { logger, lines } = capture();
      logger.warn(`refresh failed for ${jwt} at 12:04`);
      const out = lines()[0];
      expect(out).not.toContain(jwt);
      expect(out).toContain('[REDACTED]');
      expect(out).toContain('refresh failed for');
      expect(out).toContain('at 12:04');
    });

    it('redacts a bare Discord-bot-token-shaped value in error.message', () => {
      const { logger, lines } = capture();
      // Assembled at runtime on purpose: a token-shaped literal trips secret
      // scanners even though every part is synthetic (see the FINDING-026
      // test above for the same trick).
      const discordish = [
        'MTIzNDU2Nzg5MDEyMzQ1Njc4',
        'GabcDe',
        'abcdefghijklmnopqrstuvwxyz012',
      ].join('.');
      logger.error('upstream call failed', new Error(`Discord API rejected credentials ${discordish}`));
      const out = lines()[0];
      expect(out).not.toContain(discordish);
      expect(out).toContain('[REDACTED]');
    });

    it('redacts a bare JWT in a non-Error throw value (third sanitizeErrorMessage call site)', () => {
      const { logger, lines } = capture();
      // Not a real `throw` — `error()`'s second param is `unknown` by
      // design (formatError() handles both Error and non-Error values).
      logger.error('failed', `upstream said: ${jwt}`);
      const out = lines()[0];
      expect(out).not.toContain(jwt);
      expect(out).toContain('[REDACTED]');
    });
  });

  describe('free text false-positive guards', () => {
    it('does NOT redact a sha256-shaped hex hash inside a message', () => {
      const { logger, lines } = capture();
      // 64 lowercase hex chars — the shape of a content hash or cache key,
      // not a secret. The 64-hex pattern is whole-value-anchored by design
      // and must never run over free text (see the base-logger comment).
      const sha256ish = 'a1b2c3d4'.repeat(8);
      expect(sha256ish).toHaveLength(64);
      logger.info(`build artifact sha256:${sha256ish} cached`);
      const out = lines()[0];
      expect(out).toContain(sha256ish);
      expect(out).not.toContain('[REDACTED]');
    });

    it('does NOT redact a short base64-ish id inside a message', () => {
      const { logger, lines } = capture();
      const requestId = 'Xk9pQ2mZaB7c';
      logger.info(`cache hit for id ${requestId}`);
      const out = lines()[0];
      expect(out).toContain(requestId);
      expect(out).not.toContain('[REDACTED]');
    });
  });
});
