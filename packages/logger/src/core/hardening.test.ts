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
import { safeStringify } from './base-logger.js';

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

describe('S10-R14 (2026-08-30 fix round 3): safeStringify is path-scoped, not "seen anywhere"', () => {
  // S10-R12's memoization made an aliased reference the SAME object, not
  // an independent copy — safeStringify's OLD global "seen" set read that
  // as a cycle and replaced the second (and later) occurrence with
  // "[Circular]", silently dropping legitimate repeated data. These
  // assert on the EMITTED JSON STRING (safeStringify's return value)
  // rather than an in-memory tree, because capturing the in-memory tree is
  // exactly why the earlier suite could not see this regression.

  it('does not flag an aliased sibling object as circular', () => {
    const shared = { password: '[REDACTED]' };
    const json = safeStringify({ a: shared, b: shared });
    expect(json).not.toContain('[Circular]');
    expect(JSON.parse(json)).toEqual({
      a: { password: '[REDACTED]' },
      b: { password: '[REDACTED]' },
    });
  });

  it('does not flag the same object repeated across array items as circular', () => {
    const dye = { id: 5, hex: '#fff' };
    const json = safeStringify({ list: [dye, dye, dye] });
    expect(json).not.toContain('[Circular]');
    expect(JSON.parse(json)).toEqual({
      list: [
        { id: 5, hex: '#fff' },
        { id: 5, hex: '#fff' },
        { id: 5, hex: '#fff' },
      ],
    });
  });

  it('does not flag a heavily-aliased array (fill) as circular', () => {
    const o = { id: 1 };
    const json = safeStringify(new Array(6).fill(o));
    expect(json).not.toContain('[Circular]');
    expect(JSON.parse(json)).toEqual(new Array(6).fill({ id: 1 }));
  });

  it('still flags a genuine self-cycle as circular', () => {
    const o: Record<string, unknown> = { name: 'o', password: 'hunter2' };
    o.self = o;
    const json = safeStringify({ o });
    expect(json).toContain('"self":"[Circular]"');
  });

  it('still flags a genuine two-node cycle as circular', () => {
    const a: Record<string, unknown> = { password: 'p1' };
    const b: Record<string, unknown> = { ref: a };
    a.other = b;
    const json = safeStringify(a);
    expect(json).toContain('"ref":"[Circular]"');
  });

  it('handles aliasing and a genuine cycle together in one call', () => {
    const shared = { tag: 'shared' };
    const cyclic: Record<string, unknown> = { name: 'cyc' };
    cyclic.self = cyclic;
    const json = safeStringify({ a: shared, b: shared, c: cyclic });
    const parsed = JSON.parse(json) as {
      a: { tag: string };
      b: { tag: string };
      c: { name: string; self: string };
    };
    expect(parsed.a).toEqual({ tag: 'shared' });
    expect(parsed.b).toEqual({ tag: 'shared' });
    expect(parsed.c.self).toBe('[Circular]');
  });

  it('still converts BigInt to its decimal string (unchanged by the rewrite)', () => {
    const json = safeStringify({ n: 123n });
    expect(json).toBe('{"n":"123"}');
  });
});

describe('S10-R18 (2026-08-30 fix round 4): safeStringify bounds a maximally-shared DAG', () => {
  // Memoization (S10-R12) guarantees the redacted tree is maximally
  // shared; path-scoping (S10-R14) correctly does NOT treat that sharing
  // as a cycle, which means a shared subtree is walked once PER PATH to
  // it, not once per distinct node. For a binary alias chain that's
  // exponential in depth. These tests go through `safeStringify` itself —
  // the actual serialiser every Worker's `JsonAdapter` calls — not
  // `TestLogger.entries`, because capturing the in-memory tree is exactly
  // why this was invisible to the suite before.

  it('bounds the EXACT structure and depth that reportedly stalled >300s (the S10-R12 test shape, 40 levels)', () => {
    let level: Record<string, unknown> = { leaf: 'x' };
    for (let i = 0; i < 40; i++) {
      level = { a: level, b: level };
    }
    const json = safeStringify(level);
    // Deterministic, not timing-based: a correct bound always produces
    // this marker for a structure this size, regardless of how fast the
    // machine is. (Separately confirmed via a throwaway probe, not
    // committed, that this now completes in low tens of milliseconds —
    // not asserted here per the house lesson that a wall-clock assertion
    // on synchronous code is a flake, or worse, a hang, waiting to
    // happen.)
    expect(json).toContain('[Truncated]');
  });

  it('bounds a smaller-but-still-exponential structure too (depth 17, 131072 paths)', () => {
    let level: Record<string, unknown> = { leaf: 'x' };
    for (let i = 0; i < 17; i++) {
      level = { a: level, b: level };
    }
    const json = safeStringify(level);
    expect(json).toContain('[Truncated]');
  });

  it('does NOT truncate a small, legitimately-aliased structure (regression guard against over-truncation)', () => {
    let level: Record<string, unknown> = { leaf: 'x' };
    for (let i = 0; i < 10; i++) {
      level = { a: level, b: level };
    }
    const json = safeStringify(level);
    expect(json).not.toContain('[Truncated]');
    // The leaf is still reachable and intact at this size.
    expect(json).toContain('"leaf":"x"');
  });

  it('truncates deterministically past the bound on a flat, linear (non-exponential) structure', () => {
    // 60000 DISTINCT numbers — no aliasing, no exponential cost, purely a
    // count past MAX_STRINGIFY_NODES. This isolates "does the bound exist
    // and fire" from "does it correctly avoid firing on the pathological
    // shape" (the tests above).
    const arr = Array.from({ length: 60_000 }, (_, i) => i);
    const json = safeStringify(arr);
    const parsed = JSON.parse(json) as unknown[];
    expect(parsed).toHaveLength(60_000);
    // Comfortably within the budget: the real value survives.
    expect(parsed[100]).toBe(100);
    // Comfortably past it: truncated, not the real value.
    expect(parsed[59_999]).toBe('[Truncated]');
  });
});
