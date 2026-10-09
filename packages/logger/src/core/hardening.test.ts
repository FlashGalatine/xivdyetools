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

  // NOTE on the two tests below: if `MAX_STRINGIFY_NODES` is ever removed or
  // raised past this shape, the depth-40 case does not go RED — it HANGS, and
  // vitest cannot preempt synchronous JS, so CI would time out rather than
  // report a failure. The depth-17 case is the one that fails cleanly (~106 ms)
  // and is therefore the load-bearing regression test; depth 40 earns its place
  // only by pinning the exact shape that stalled in review. Keep both, and
  // reach for depth 17 first when changing the bound.
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

describe('BUG-140 (2026-10-04 deep dive): free-text pass over context strings', () => {
  function ctxOf(line: string | undefined): Record<string, unknown> {
    return (JSON.parse(line ?? '{}') as { context: Record<string, unknown> }).context;
  }

  it('redacts a key=value secret embedded in a string value, keeping the prose', () => {
    const { logger, lines } = capture();
    logger.warn('x', { detail: 'upstream said password=hunter2 and gave up' });
    const out = lines()[0];
    expect(out).not.toContain('hunter2');
    expect(ctxOf(out).detail).toBe('upstream said password=[REDACTED] and gave up');
  });

  it('redacts a JSON-shaped secret inside a string value', () => {
    const { logger, lines } = capture();
    const body = '{"access_token":"abc123"}';
    logger.warn('x', { body });
    const out = ctxOf(lines()[0]).body;
    expect(out).not.toContain('abc123');
    // Same text, same rules: identical to what the message path produces.
    expect(out).toBe(logger.sanitizeMessage(body));
  });

  it('redacts inside nested objects and string array items', () => {
    const { logger, lines } = capture();
    logger.warn('x', {
      nested: { deep: { note: 'client_secret=zzz9 end' } },
      list: ['fine', 'x token=abc y', ['inner api_key=k1']],
    });
    const out = lines()[0];
    expect(out).not.toContain('zzz9');
    expect(out).not.toContain('abc y');
    expect(out).not.toContain('k1');
    const c = ctxOf(out) as { list: unknown[] };
    expect(c.list[0]).toBe('fine');
    expect(c.list[1]).toBe('x token=[REDACTED] y');
  });

  it('is skipped when sanitizeErrors is false, while key redaction still runs', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new JsonAdapter({ level: 'debug', sanitizeErrors: false });
    logger.warn('x', { detail: 'password=hunter2', password: 'p' });
    const c = ctxOf(String(spy.mock.calls[0]?.[0]));
    expect(c.detail).toBe('password=hunter2');
    expect(c.password).toBe('[REDACTED]');
  });

  it('leaves benign strings byte-identical (false-positive guards)', () => {
    const { logger, lines } = capture();
    const sha = 'a'.repeat(64);
    const benign = {
      a: `digest ${sha} ok`,
      b: 'XIVAuth token exchange failed',
      c: 'cache hit for id Xk9pQ2mZaB7c',
      d: 'plain text',
    };
    logger.warn('x', benign);
    expect(ctxOf(lines()[0])).toEqual(benign);
  });

  it('keeps the whole-value shape verdict ahead of the free-text pass', () => {
    const { logger, lines } = capture();
    logger.warn('x', { a: 'Bearer abc.def', b: 'f'.repeat(64) });
    expect(ctxOf(lines()[0])).toEqual({ a: '[REDACTED]', b: '[REDACTED]' });
  });

  it('never rewrites object keys', () => {
    const { logger, lines } = capture();
    logger.warn('x', { 'token=abc': 'v' });
    expect(Object.keys(ctxOf(lines()[0]))).toEqual(['token=abc']);
  });

  it('is idempotent through child()/setContext (global context is merged again)', () => {
    const { logger, lines } = capture();
    logger.setContext({ g: 'see password=hunter2 now' });
    logger.child({ c: 'x token=abc y' }).warn('x', { l: 'secret: s1' });
    const c = ctxOf(lines()[0]);
    expect(c.g).toBe('see password=[REDACTED] now');
    expect(c.c).toBe('x token=[REDACTED] y');
    expect(c.l).toBe('secret=[REDACTED]');
    expect(logger.redactContext(c)).toEqual(c);
  });

  it('redactContext() applies it too', () => {
    const { logger } = capture();
    expect(logger.redactContext({ d: 'password=hunter2' })).toEqual({ d: 'password=[REDACTED]' });
  });
});

describe('BUG-141 (2026-10-04 deep dive): toJSON values survive redaction', () => {
  function ctxOf(line: string | undefined): Record<string, unknown> {
    return (JSON.parse(line ?? '{}') as { context: Record<string, unknown> }).context;
  }

  it('serializes Date and URL values instead of logging {}', () => {
    const { logger, lines } = capture();
    logger.info('x', { at: new Date(0), u: new URL('https://a.b/c') });
    const c = ctxOf(lines()[0]);
    expect(c.at).toBe('1970-01-01T00:00:00.000Z');
    expect(c.u).toBe('https://a.b/c');
  });

  it('handles Dates inside arrays and an invalid Date', () => {
    const { logger, lines } = capture();
    logger.info('x', { list: [new Date(0), [new Date(0)]], bad: new Date(NaN) });
    const c = ctxOf(lines()[0]);
    expect(c.list).toEqual(['1970-01-01T00:00:00.000Z', ['1970-01-01T00:00:00.000Z']]);
    expect(c.bad).toBeNull();
  });

  it('redacts the toJSON result, not the original', () => {
    const { logger, lines } = capture();
    class Box {
      toJSON(): unknown {
        return { token: 't', ok: 1, nested: { password: 'p' } };
      }
    }
    logger.info('x', { box: new Box(), arr: [new Box()] });
    const out = lines()[0];
    expect(out).not.toMatch(/"token":"t"/);
    const c = ctxOf(out) as { box: Record<string, unknown>; arr: Record<string, unknown>[] };
    expect(c.box).toEqual({ token: '[REDACTED]', ok: 1, nested: { password: '[REDACTED]' } });
    expect(c.arr[0]).toEqual(c.box);
  });

  it('redacts a toJSON string result (shape check and free-text pass)', () => {
    const { logger, lines } = capture();
    const jwt = 'eyJhbGciOiJI.eyJzdWIiOiIx.c2lnbmF0dXJl';
    logger.info('x', {
      a: { toJSON: () => jwt },
      b: { toJSON: () => 'got password=hunter2' },
      c: [{ toJSON: () => 'x token=abc' }],
    });
    const c = ctxOf(lines()[0]) as { a: unknown; b: unknown; c: unknown[] };
    expect(c.a).toBe('[REDACTED]');
    expect(c.b).toBe('got password=[REDACTED]');
    expect(c.c[0]).toBe('x token=[REDACTED]');
  });

  it('redacts a secret carried in a URL href', () => {
    const { logger, lines } = capture();
    logger.info('x', { u: new URL('https://a.b/c?token=abc&y=1') });
    expect(ctxOf(lines()[0]).u).toBe('https://a.b/c?token=[REDACTED]');
  });

  it('passes the key to toJSON and keeps primitive results', () => {
    const { logger, lines } = capture();
    const seen: string[] = [];
    logger.info('x', {
      n: { toJSON: (k: string) => (seen.push(k), 42) },
      z: { toJSON: () => null },
      arr: [{ toJSON: (k: string) => (seen.push(k), true) }],
    });
    expect(seen).toEqual(['n', '0']);
    expect(ctxOf(lines()[0])).toEqual({ n: 42, z: null, arr: [true] });
  });

  it('falls back to the spread copy when toJSON throws or returns itself', () => {
    const { logger } = capture();
    const self: Record<string, unknown> = { token: 't', keep: 1 };
    self.toJSON = () => self;
    const bad = {
      keep: 2,
      password: 'p',
      toJSON() {
        throw new Error('boom');
      },
    };
    class Getter {
      keep = 3;
      get toJSON(): never {
        throw new Error('getter boom');
      }
    }
    const getter = new Getter();
    // Checked at the redaction layer: a throwing toJSON would also trip
    // JSON.stringify later (safeStringify already degrades that to an error
    // line), which is not what is under test here.
    let c: Record<string, Record<string, unknown>> = {};
    expect(() => {
      c = logger.redactContext({ self, bad, getter, arr: [bad] }) as typeof c;
    }).not.toThrow();
    expect(c.self.token).toBe('[REDACTED]');
    expect(c.self.keep).toBe(1);
    expect(c.bad.keep).toBe(2);
    expect(c.bad.password).toBe('[REDACTED]');
    expect(c.getter.keep).toBe(3);
    expect((c.arr as unknown as Record<string, unknown>[])[0]?.password).toBe('[REDACTED]');
  });

  it('marks a toJSON result that points back at the original as circular', () => {
    const { logger, lines } = capture();
    const orig: Record<string, unknown> = {};
    orig.toJSON = () => ({ back: orig, token: 't' });
    expect(() => logger.info('x', { orig })).not.toThrow();
    const out = lines()[0];
    expect(out).toContain('[Circular]');
    expect(out).not.toMatch(/"token":"t"/);
  });

  it('keeps Map, Set and Error as {} (no toJSON, same as JSON.stringify)', () => {
    const { logger, lines } = capture();
    logger.info('x', { m: new Map([[1, 2]]), s: new Set([1]), e: new Error('boom') });
    expect(ctxOf(lines()[0])).toEqual({ m: {}, s: {}, e: {} });
  });

  it('memoizes an aliased toJSON value without error', () => {
    const { logger, lines } = capture();
    const d = new Date(0);
    logger.info('x', { a: d, b: d, list: [d, d] });
    const c = ctxOf(lines()[0]);
    expect(c.a).toBe('1970-01-01T00:00:00.000Z');
    expect(c.b).toBe(c.a);
    expect(c.list).toEqual([c.a, c.a]);
  });

  it('keeps a Date under a sensitive key redacted', () => {
    const { logger, lines } = capture();
    logger.info('x', { token: new Date(0) });
    expect(ctxOf(lines()[0]).token).toBe('[REDACTED]');
  });
});

describe('OPT-010 (2026-10-04 deep dive): redact set is built once', () => {
  it('still matches user fields across case/separators at every depth', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new JsonAdapter({ level: 'debug', redactFields: ['My_Custom-Key'] });
    logger.info('x', { mycustomkey: 1, a: { MYCUSTOMKEY: 2, b: [{ my_custom_key: 3, ok: 4 }] } });
    const c = (JSON.parse(String(spy.mock.calls[0]?.[0])) as { context: unknown }).context;
    expect(c).toEqual({
      mycustomkey: '[REDACTED]',
      a: { MYCUSTOMKEY: '[REDACTED]', b: [{ my_custom_key: '[REDACTED]', ok: 4 }] },
    });
  });

  it('does not re-normalize the field list per object node', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new JsonAdapter({ level: 'debug' });
    let ctx: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 20; i++) ctx = { k: ctx };
    const lower = vi.spyOn(String.prototype, 'toLowerCase');
    logger.info('x', ctx);
    const calls = lower.mock.calls.length;
    lower.mockRestore();
    expect(spy).toHaveBeenCalledTimes(1);
    // A per-node rebuild costs about 20 * (22 + 1) calls; keys only is ~21.
    expect(calls).toBeLessThan(20 * 5);
  });
});

describe('BUG-141 review follow-ups (2026-10-06)', () => {
  function ctxOf(line: string | undefined): Record<string, unknown> {
    return (JSON.parse(line ?? '{}') as { context: Record<string, unknown> }).context;
  }

  it('does not let a serializer hook survive redaction (toJSON result with its own toJSON)', () => {
    const { logger, lines } = capture();
    logger.info('x', {
      a: { toJSON: () => ({ b: 1, toJSON: () => ({ password: 'leak2' }) }) },
      arr: [{ toJSON: () => ({ b: 2, toJSON: () => ({ password: 'leak3' }) }) }],
    });
    const out = lines()[0] ?? '';
    expect(out).not.toMatch(/leak\d/);
    expect(ctxOf(out)).toEqual({ a: { b: 1 }, arr: [{ b: 2 }] });
  });

  it('does not let a top-level own toJSON emit an unredacted result', () => {
    const { logger, lines } = capture();
    logger.info('m', { keep: 1, toJSON: () => ({ password: 'leak1' }) });
    const out = lines()[0] ?? '';
    expect(out).not.toContain('leak1');
    expect(ctxOf(out)).toEqual({ keep: 1 });
  });

  it('logs normally when a toJSON throws (no serialization-failure line)', () => {
    const { logger, lines } = capture();
    logger.info('m', {
      bad: {
        keep: 2,
        toJSON() {
          throw new Error('boom');
        },
      },
    });
    const out = lines()[0] ?? '';
    expect(out).not.toContain('could not be serialised');
    expect(ctxOf(out)).toEqual({ bad: { keep: 2 } });
  });

  it('bounds a toJSON that manufactures depth on demand (never throws, fails closed)', () => {
    const { logger, lines } = capture();
    class Inf {
      toJSON(): unknown {
        return { child: new Inf() };
      }
    }
    expect(() => logger.info('m', { a: new Inf() })).not.toThrow();
    const out = lines()[0] ?? '';
    expect(out).toContain('[Truncated]');
  });

  it('bounds the TOTAL toJSON calls of a fan-out toJSON (fast, fails closed)', () => {
    const { logger, lines } = capture();
    let calls = 0;
    class Fan {
      constructor(private readonly depth: number) {}
      toJSON(): unknown {
        calls++;
        return this.depth >= 16 ?{ leaf: 1 } : { a: new Fan(this.depth + 1), b: new Fan(this.depth + 1) };
      }
    }
    const start = Date.now();
    expect(() => logger.info('m', { a: new Fan(0) })).not.toThrow();
    expect(Date.now() - start).toBeLessThan(2000);
    expect(calls).toBeLessThanOrEqual(4096);
    expect(lines()[0] ?? '').toContain('[Truncated]');
  });

  it('does not call an Error toJSON when sanitizeErrors is on (spread path, no stack)', () => {
    class AppLike extends Error {
      toJSON(): unknown {
        return {
          name: 'AppLike',
          code: 'E1',
          message: 'bad password=hunter2',
          stack: 'at /abs/x.ts:1',
        };
      }
    }
    const { logger, lines } = capture();
    logger.info('m', { err: new AppLike('x'), arr: [new AppLike('y')] });
    const out = lines()[0] ?? '';
    expect(out).not.toContain('/abs/x.ts');
    expect(out).not.toContain('hunter2');
    // No own enumerable fields, so the spread copy is empty (as before BUG-141).
    expect(ctxOf(out)).toEqual({ err: {}, arr: [{}] });

    const raw = new JsonAdapter({ level: 'debug', sanitizeErrors: false });
    raw.info('m', { err: new AppLike('x') });
    const spy = vi.mocked(console.log);
    expect(String(spy.mock.calls.at(-1)?.[0])).toContain('/abs/x.ts');
  });

  it('redacts credentials in a URL object and in a message (userinfo)', () => {
    const { logger, lines } = capture();
    logger.info('fetch https://admin:hunter2@example.com/x failed', {
      u: new URL('https://admin:hunter2@example.com/x'),
      s: 'see postgres://svc:p4ss@db:5432/app',
      ok: 'https://example.com/a:b@c',
    });
    const out = lines()[0] ?? '';
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('p4ss');
    expect(ctxOf(out).u).toBe('https://admin:[REDACTED]@example.com/x');
    expect(ctxOf(out).ok).toBe('https://example.com/a:b@c');
    const twice = logger.sanitizeMessage(logger.sanitizeMessage('https://a:b@h/'));
    expect(twice).toBe('https://a:[REDACTED]@h/');
  });

  it('redacts userinfo with an empty user name (redis://:pass@host)', () => {
    const { logger, lines } = capture();
    logger.info('conn redis://:p4ss@host:6379 down', {
      s: 'redis://:p4ss@host:6379',
      u: new URL('redis://:p4ss@host:6379'),
      ok: 'https://example.com/a:b@c',
    });
    const out = lines()[0] ?? '';
    expect(out).not.toContain('p4ss');
    expect(ctxOf(out).s).toBe('redis://:[REDACTED]@host:6379');
    expect(ctxOf(out).u).toBe('redis://:[REDACTED]@host:6379');
    expect(ctxOf(out).ok).toBe('https://example.com/a:b@c');
  });

  it('redacts a toJSON array result item by item', () => {
    const { logger, lines } = capture();
    logger.info('x', { a: { toJSON: () => ['password=hunter2', { token: 't' }] } });
    expect(ctxOf(lines()[0]).a).toEqual(['password=[REDACTED]', { token: '[REDACTED]' }]);
  });

  it('calls toJSON once for an aliased object and returns one shared result', () => {
    const { logger } = capture();
    let calls = 0;
    const shared = {
      toJSON: () => {
        calls++;
        return { v: 1 };
      },
    };
    const redacted = logger.redactContext({ a: shared, b: shared }) as Record<string, unknown>;
    expect(calls).toBe(1);
    expect(redacted.a).toBe(redacted.b);
  });

  it('applies the whole-value shape check to a toJSON string result (64-hex)', () => {
    const { logger, lines } = capture();
    logger.info('x', { a: { toJSON: () => 'a'.repeat(64) } });
    expect(ctxOf(lines()[0]).a).toBe('[REDACTED]');
  });

  it('redacts compound keys by suffix (sessionToken, userPassword, webhookSecret)', () => {
    const { logger, lines } = capture();
    logger.info('x', {
      sessionToken: 'a',
      n: { userPassword: 'b', webhookSecret: 'c', fine: 'd' },
    });
    expect(ctxOf(lines()[0])).toEqual({
      sessionToken: '[REDACTED]',
      n: { userPassword: '[REDACTED]', webhookSecret: '[REDACTED]', fine: 'd' },
    });
  });
});

describe('Sprint 12 release blockers (2026-10-06)', () => {
  function ctxOf(line: string | undefined): Record<string, unknown> {
    return (JSON.parse(line ?? '{}') as { context: Record<string, unknown> }).context;
  }

  describe('free-text rules stay linear on adversarial 100 KB input', () => {
    // A wall-clock bound, on purpose. Every input below took 3-8 s per call
    // with the unbounded URL-userinfo scheme (`[a-z][a-z0-9+.-]*://`), and the
    // `eyJ-` run about 5 s with the plain JWT pattern (also at 2.2.1). Fixed,
    // each call measures 0.1-17 ms, so 250 ms leaves room for a CI machine
    // five times slower while staying far below the quadratic times. The
    // explicit timeout lets a regression report as this assertion failing
    // instead of as a vitest timeout.
    const BOUND_MS = 250;
    const n = 100_000;
    const rep = (unit: string): string => unit.repeat(Math.ceil(n / unit.length)).slice(0, n);
    const inputs: Array<[string, string]> = [
      ['letters', rep('q')],
      ['hex then z', rep('0123456789abcdef') + 'z'],
      ['base64', rep('QUJD') + '='],
      ['"a." runs', rep('a.')],
      ['"a://:" then x', 'a://:' + rep('x')],
      ['"eyJ-" runs', rep('eyJ-')],
    ];

    it.each(inputs)(
      '%s: message, error.message and a context string each log in under 250 ms',
      (_name, s) => {
        const { logger, lines } = capture();
        const time = (fn: () => void): number => {
          const t0 = performance.now();
          fn();
          return performance.now() - t0;
        };
        const ms = {
          message: time(() => logger.info(s)),
          error: time(() => logger.error('m', new Error(s))),
          context: time(() => logger.info('m', { p: s })),
        };
        expect(lines()).toHaveLength(3);
        const slow = Object.entries(ms).filter(([, v]) => v >= BOUND_MS);
        expect(slow, JSON.stringify(ms)).toEqual([]);
      },
      120_000,
    );

    it('keeps the URL-userinfo output of the unbounded rule', () => {
      const { logger } = capture();
      const cases: Array<[string, string]> = [
        ['foohttps://u:p@h', 'foohttps://u:[REDACTED]@h'],
        ['git+ssh://u:p@h/r', 'git+ssh://u:[REDACTED]@h/r'],
        ['HTTPS://U:P@H', 'HTTPS://U:[REDACTED]@H'],
        [`${'a'.repeat(40)}://u:p@h`, `${'a'.repeat(40)}://u:[REDACTED]@h`],
        ['http://host:8080/x@y', 'http://host:8080/x@y'],
      ];
      for (const [input, expected] of cases) {
        expect(logger.sanitizeMessage(input)).toBe(expected);
      }
    });

    it('keeps the JWT output of the plain pattern (hyphen and underscore neighbours, short header)', () => {
      const { logger } = capture();
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXNpZ25hdHVyZS1zaWduYXR1cmU';
      expect(logger.sanitizeMessage(`x-${jwt}`)).toBe('x-[REDACTED]');
      expect(logger.sanitizeMessage(`_${jwt}`)).toBe(`_${jwt}`);
      expect(logger.sanitizeMessage('eyJabc.def.ghi')).toBe('eyJabc.def.ghi');
      // A run whose header is too short must not hide a real JWT after it.
      const real = `eyJ${'a'.repeat(10)}.${'b'.repeat(8)}.${'c'.repeat(8)}`;
      expect(logger.sanitizeMessage(`eyJabc.${real}`)).toBe('eyJabc.[REDACTED]');
      expect(logger.redactContext({ v: `see ${jwt} ok`, w: 'eyJ-eyJ-' })).toEqual({
        v: '[REDACTED]',
        w: 'eyJ-eyJ-',
      });
    });
  });

  describe('toJSON budget counts only results that can fan out', () => {
    it('logs 5000 rows that each carry a Date with no [Truncated] and every Date as ISO', () => {
      const { logger, lines } = capture();
      const rows = Array.from({ length: 5000 }, (_, id) => ({ id, at: new Date(0) }));
      logger.info('m', { rows });
      const out = lines()[0] ?? '';
      expect(out).not.toContain('[Truncated]');
      const got = ctxOf(out).rows as Array<{ id: number; at: unknown }>;
      expect(got).toHaveLength(5000);
      expect(got.every((r, i) => r.id === i && r.at === '1970-01-01T00:00:00.000Z')).toBe(true);
    });
  });

  describe('an Error toJSON never runs under sanitizeErrors', () => {
    class StackString extends Error {
      toJSON(): unknown {
        return String(this.stack);
      }
    }
    class NestedStack extends Error {
      toJSON(): unknown {
        return { detail: { trace: this.stack } };
      }
    }
    // Same shape as `@xivdyetools/types` AppError: parameter properties and an
    // assigned `name` are own enumerable fields; `toJSON` includes `stack`.
    class AppErrorLike extends Error {
      constructor(
        public code: string,
        message: string,
        public severity: string = 'error',
      ) {
        super(message);
        this.name = 'AppErrorLike';
      }
      toJSON(): Record<string, unknown> {
        return {
          name: this.name,
          code: this.code,
          message: this.message,
          severity: this.severity,
          stack: this.stack,
        };
      }
    }

    it('logs own enumerable fields only, with no stack, when sanitizeErrors is on', () => {
      const { logger, lines } = capture();
      logger.info('m', {
        a: new StackString('x'),
        b: new NestedStack('y'),
        c: new AppErrorLike('E1', 'bad password=hunter2', 'warning'),
        list: [new StackString('z'), new NestedStack('w')],
      });
      const out = lines()[0] ?? '';
      expect(out).not.toContain('hardening.test');
      expect(out).not.toContain('hunter2');
      expect(ctxOf(out)).toEqual({
        a: {},
        b: {},
        c: { name: 'AppErrorLike', code: 'E1', severity: 'warning' },
        list: [{}, {}],
      });
    });

    it('still calls toJSON when sanitizeErrors is off', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const raw = new JsonAdapter({ level: 'debug', sanitizeErrors: false });
      const a = new StackString('x');
      const b = new NestedStack('y');
      const c = new AppErrorLike('E1', 'bad', 'warning');
      raw.info('m', { a, b, c });
      const got = ctxOf(String(spy.mock.calls[0]?.[0]));
      expect(got.a).toBe(String(a.stack));
      expect(got.b).toEqual({ detail: { trace: b.stack } });
      expect(got.c).toEqual({
        name: 'AppErrorLike',
        code: 'E1',
        message: 'bad',
        severity: 'warning',
        stack: c.stack,
      });
      expect(String(spy.mock.calls[0]?.[0])).toContain('hardening.test');
    });
  });
});

describe('Sprint 12 final guards (2026-10-06): a hostile value never throws out of a log call', () => {
  it('a Proxy whose getPrototypeOf trap throws is logged, not thrown', () => {
    const { logger, lines } = capture();
    const hostile = new Proxy(
      { x: 1 },
      {
        getPrototypeOf() {
          throw new Error('proto trap');
        },
      }
    );
    expect(() => logger.info('m', { a: { b: hostile }, list: [hostile] })).not.toThrow();
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('"x":1');
  });

  it('a toJSON result whose ownKeys trap throws becomes [Unserializable]', () => {
    const { logger, lines } = capture();
    const hostileResult = new Proxy(
      { y: 2 },
      {
        ownKeys() {
          throw new Error('ownKeys trap');
        },
      }
    );
    const value = { toJSON: () => hostileResult };
    expect(() => logger.info('m', { a: { v: value } })).not.toThrow();
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('"v":"[Unserializable]"');
  });
});
