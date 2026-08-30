/**
 * CommandTrace — the dispatcher-owned lifecycle behind every Tier A datapoint.
 * Spec: docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DRAIN_DEADLINE_MS,
  startCommandTrace,
  tracedExecutionContext,
  markCommandOutcome,
  finishCommandTrace,
  trackButtonClick,
  interactionIdentity,
  classifyError,
  bucketLocale,
  subcommandOf,
  trackedCommandName,
  buttonKindOf,
} from './command-trace.js';
import { createMockEnv } from '../test-utils.js';
import type { DiscordInteraction } from '../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { UniversalisError } from '../types/budget.js';
import { PresetAPIError } from '../types/preset.js';

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./analytics.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./analytics.js')>()),
  trackCommandWithKV: trackMock,
}));

// Fresh spies per test: an assertion on `logger.error` must not pass on a
// call some earlier test made.
let logger: ExtendedLogger & { error: ReturnType<typeof vi.fn> };

function interaction(overrides: Partial<DiscordInteraction> = {}): DiscordInteraction {
  return {
    id: 'i1',
    application_id: 'app',
    token: 'tok',
    type: 2,
    data: { name: 'harmony' },
    user: { id: 'u1' },
    ...overrides,
  } as DiscordInteraction;
}

function realCtx() {
  const promises: Promise<unknown>[] = [];
  return {
    waitUntil: vi.fn((p: Promise<unknown>) => { promises.push(p); }),
    passThroughOnException: vi.fn(),
    _all: () => Promise.allSettled(promises),
    /** The trace's own write (finishCommandTrace's waitUntil is always the last one). */
    _write: () => promises[promises.length - 1],
  } as unknown as ExecutionContext & { _all: () => Promise<unknown[]>; _write: () => Promise<unknown> };
}

const fields = { command: 'harmony', subcommand: '', userId: 'u1', locale: 'en' };

beforeEach(() => {
  vi.useFakeTimers();
  trackMock.mockClear();
  logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as typeof logger;
});
afterEach(() => vi.useRealTimers());

describe('lifecycle', () => {
  it('finishing an immediate command writes one datapoint with latency and ok', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    startCommandTrace(ix, fields);
    vi.advanceTimersByTime(40);
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(env, {
      commandName: 'harmony', userId: 'u1', guildId: undefined, success: true,
      outcome: 'ok', subcommand: '', locale: 'en', kind: 'command', latencyMs: 40,
    });
    // The drain deadline was cleared once the work settled.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is idempotent', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    finishCommandTrace(env, ix, ctx, logger);
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trace.finished).toBe(true);
  });

  it('waits for promises captured through the traced ctx before writing, and measures latency to their settlement', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    const traced = tracedExecutionContext(ctx, trace);
    let release!: () => void;
    const work = new Promise<void>((r) => { release = r; });
    traced.waitUntil(work);
    expect(ctx.waitUntil).toHaveBeenCalledWith(work); // forwarded to the real ctx

    finishCommandTrace(env, ix, ctx, logger);
    await Promise.resolve();
    expect(trackMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    release();
    await ctx._all();
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: true, outcome: 'ok', latencyMs: 250 });
  });

  it('also awaits promises added while draining', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    const traced = tracedExecutionContext(ctx, trace);
    let releaseSecond!: () => void;
    const second = new Promise<void>((r) => { releaseSecond = r; });
    traced.waitUntil(Promise.resolve().then(() => { traced.waitUntil(second); }));
    finishCommandTrace(env, ix, ctx, logger);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(trackMock).not.toHaveBeenCalled();
    releaseSecond();
    await ctx._all();
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it('writes the datapoint as unknown when the captured work has not settled by the drain deadline', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    const traced = tracedExecutionContext(ctx, trace);
    traced.waitUntil(new Promise<void>(() => { /* a stalled service-binding call */ }));
    finishCommandTrace(env, ix, ctx, logger);

    await vi.advanceTimersByTimeAsync(DRAIN_DEADLINE_MS - 1);
    expect(trackMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await ctx._write(); // not _all(): the stalled promise is forwarded to the real ctx and never settles
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock.mock.calls[0][1]).toMatchObject({
      success: false, outcome: 'unknown', latencyMs: DRAIN_DEADLINE_MS,
    });
  });

  it('keeps a marked outcome when the deadline fires', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    tracedExecutionContext(ctx, trace).waitUntil(new Promise<void>(() => {}));
    markCommandOutcome(ix, 'upstream_presets');
    finishCommandTrace(env, ix, ctx, logger);
    await vi.advanceTimersByTimeAsync(DRAIN_DEADLINE_MS);
    await ctx._write();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'upstream_presets' });
  });

  it('a rejected captured promise classifies as the failure, unless an outcome was marked first', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    const traced = tracedExecutionContext(ctx, trace);
    traced.waitUntil(Promise.reject(new UniversalisError(503, 'down')));
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'upstream_universalis' });

    trackMock.mockClear();
    const ix2 = interaction({ id: 'i2' });
    const ctx2 = realCtx();
    const trace2 = startCommandTrace(ix2, fields);
    const traced2 = tracedExecutionContext(ctx2, trace2);
    markCommandOutcome(ix2, 'render');
    traced2.waitUntil(Promise.reject(new Error('later')));
    finishCommandTrace(env, ix2, ctx2, logger);
    await ctx2._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'render' });
  });

  it('markCommandOutcome: first mark wins, no-op without a trace, never throws', () => {
    const ix = interaction();
    expect(() => markCommandOutcome(ix, 'render')).not.toThrow();
    const trace = startCommandTrace(ix, fields);
    markCommandOutcome(ix, 'upstream_presets');
    markCommandOutcome(ix, 'render');
    expect(trace.outcome).toBe('upstream_presets');
  });

  it('the dispatcher marks its own failures the same way: rate_limited / a classified throw', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    startCommandTrace(ix, fields);
    markCommandOutcome(ix, 'rate_limited');
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'rate_limited' });

    trackMock.mockClear();
    const ix2 = interaction({ id: 'i2' });
    const ctx2 = realCtx();
    startCommandTrace(ix2, fields);
    markCommandOutcome(ix2, classifyError(new PresetAPIError(503, 'down')));
    finishCommandTrace(env, ix2, ctx2, logger);
    await ctx2._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'upstream_presets' });
  });

  it('an upstream 4xx marked through classifyError is rejected AND answered (two axes)', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    markCommandOutcome(ix, classifyError(new PresetAPIError(403, 'not the owner')));
    expect(trace.outcome).toBe('rejected');
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: true, outcome: 'rejected' });
  });

  it('a served failure (/dye text fallback) is answered but keeps its outcome; unserved render is a failure', async () => {
    const env = createMockEnv();
    const ix = interaction({ data: { name: 'dye' } });
    const ctx = realCtx();
    startCommandTrace(ix, { ...fields, command: 'dye', subcommand: 'info' });
    markCommandOutcome(ix, 'render', { served: true });
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: true, outcome: 'render' });

    trackMock.mockClear();
    const ix2 = interaction({ id: 'i2' });
    const ctx2 = realCtx();
    startCommandTrace(ix2, fields);
    markCommandOutcome(ix2, 'render');
    finishCommandTrace(env, ix2, ctx2, logger);
    await ctx2._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'render' });
  });

  it('served is a no-op on ok, and a later mark cannot flip an earlier unserved failure', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    startCommandTrace(ix, fields);
    markCommandOutcome(ix, 'ok', { served: true });
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: true, outcome: 'ok' });

    trackMock.mockClear();
    const ix2 = interaction({ id: 'i2' });
    const ctx2 = realCtx();
    const trace2 = startCommandTrace(ix2, fields);
    markCommandOutcome(ix2, 'render');
    markCommandOutcome(ix2, 'render', { served: true });
    expect(trace2.served).toBe(false);
    finishCommandTrace(env, ix2, ctx2, logger);
    await ctx2._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'render' });
  });

  it('finish without a trace is a no-op; a tracking failure is logged, never thrown', async () => {
    const env = createMockEnv();
    const ctx = realCtx();
    finishCommandTrace(env, interaction(), ctx, logger);
    expect(trackMock).not.toHaveBeenCalled();

    const failure = new Error('AE down');
    trackMock.mockRejectedValueOnce(failure);
    const ix = interaction();
    startCommandTrace(ix, fields);
    finishCommandTrace(env, ix, ctx, logger);
    await expect(ctx._all()).resolves.toBeDefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Analytics tracking failed', failure);
  });
});

describe('trackButtonClick', () => {
  it('writes one AE-only button datapoint with the shared identity columns', async () => {
    const env = createMockEnv();
    const ctx = realCtx();
    const ix = interaction({ data: { custom_id: 'copy_hex_FF0000', component_type: 2 }, guild_id: 'g1', locale: 'de' });
    trackButtonClick(env, ctx, logger, ix, 'copy_hex');
    await ctx._all();
    expect(trackMock).toHaveBeenCalledWith(env, {
      commandName: 'button', userId: 'u1', guildId: 'g1', success: true,
      outcome: 'ok', subcommand: 'copy_hex', locale: 'de', kind: 'button', latencyMs: 0,
    });
  });

  it('writes nothing without a user id and logs (never throws) a tracking failure', async () => {
    const env = createMockEnv();
    const ctx = realCtx();
    trackButtonClick(env, ctx, logger, interaction({ user: undefined }), 'copy_rgb');
    await ctx._all();
    expect(trackMock).not.toHaveBeenCalled();

    const failure = new Error('AE down');
    trackMock.mockRejectedValueOnce(failure);
    trackButtonClick(env, ctx, logger, interaction(), 'copy_rgb');
    await expect(ctx._all()).resolves.toBeDefined();
    expect(logger.error).toHaveBeenCalledWith('Analytics tracking failed', failure);
  });
});

describe('helpers', () => {
  it('interactionIdentity reads the member user first, then the DM user, and buckets the locale', () => {
    expect(interactionIdentity(interaction({ member: { user: { id: 'm1' } }, guild_id: 'g1', locale: 'ja' } as Partial<DiscordInteraction>)))
      .toEqual({ userId: 'm1', guildId: 'g1', locale: 'ja' });
    expect(interactionIdentity(interaction({ locale: 'pt-BR' }))).toEqual({ userId: 'u1', guildId: undefined, locale: 'other' });
    expect(interactionIdentity(interaction({ user: undefined })).userId).toBeUndefined();
  });

  it.each([
    [undefined, 'other'], ['en-US', 'en'], ['en-GB', 'en'], ['ja', 'ja'], ['zh-TW', 'zh'], ['pt-BR', 'other'],
  ])('bucketLocale(%j) → %s', (input, expected) => {
    expect(bucketLocale(input)).toBe(expected);
  });

  it('subcommandOf reads a typed subcommand option and ignores plain options', () => {
    expect(subcommandOf(interaction({ data: { name: 'dye', options: [{ name: 'info', type: 1, options: [] }] } }))).toBe('info');
    expect(subcommandOf(interaction({ data: { name: 'harmony', options: [{ name: 'color', type: 3, value: 'x' }] } }))).toBe('');
    // Discord always types its options; an untyped first option is not guessed at.
    expect(subcommandOf(interaction({ data: { name: 'dye', options: [{ name: 'info', options: [] }] } }))).toBe('');
    expect(subcommandOf(interaction({ data: { name: 'about' } }))).toBe('');
  });

  it('subcommandOf records a subcommand group as <group>_<sub>', () => {
    expect(subcommandOf(interaction({
      data: { name: 'preset', options: [{ name: 'favorite', type: 2, options: [{ name: 'add', type: 1, options: [] }] }] },
    }))).toBe('favorite_add');
    expect(subcommandOf(interaction({
      data: { name: 'preset', options: [{ name: 'favorite', type: 2, options: [] }] },
    }))).toBe('favorite_');
  });

  it('trackedCommandName keeps the extractor split and passes everything else through', () => {
    expect(trackedCommandName(interaction({ data: { name: 'extractor', options: [{ name: 'image', type: 1 }] } }))).toBe('extractor_image');
    expect(trackedCommandName(interaction({ data: { name: 'dye', options: [{ name: 'info', type: 1 }] } }))).toBe('dye');
    expect(trackedCommandName(interaction({ data: undefined }))).toBeUndefined();
  });

  it.each([
    ['copy_hex_FF0000', 'copy_hex'], ['copy_rgb_1', 'copy_rgb'], ['copy_hsv_x', 'copy_hsv'], ['preview_approve_1', null], ['', null],
  ])('buttonKindOf(%j) → %j', (id, expected) => {
    expect(buttonKindOf(id)).toBe(expected);
  });

  it.each([
    // upstream: 5xx, 429 and network (status 0) are the upstream's fault
    [new UniversalisError(503, 'x'), undefined, {}, 'upstream_universalis'],
    [new UniversalisError(429, 'x'), undefined, {}, 'upstream_universalis'],
    [new UniversalisError(0, 'network'), undefined, {}, 'upstream_universalis'],
    [new PresetAPIError(500, 'x'), undefined, {}, 'upstream_presets'],
    [new PresetAPIError(502, 'x'), 'render', {}, 'upstream_presets'],
    // upstream: a 4xx other than 429 is the service's own reply, relayed by the handler → rejected
    [new UniversalisError(400, 'unknown world'), undefined, {}, 'rejected'],
    [new UniversalisError(404, 'no such item'), undefined, {}, 'rejected'],
    [new PresetAPIError(400, 'validation'), undefined, {}, 'rejected'],
    [new PresetAPIError(403, 'not the owner'), undefined, {}, 'rejected'],
    [new PresetAPIError(404, 'no such preset'), undefined, {}, 'rejected'],
    [new PresetAPIError(409, 'already voted'), undefined, {}, 'rejected'],
    [new PresetAPIError(429, 'slow down'), undefined, {}, 'upstream_presets'],
    [new PresetAPIError(undefined as unknown as number, 'binding'), undefined, {}, 'upstream_presets'],
    // image input: image-worker's real messages, only when the caller had an image
    [new Error('Only Discord CDN URLs are allowed for security'), undefined, { imageInput: true }, 'image_input'],
    [new Error('Image too large. Maximum size is 10MB'), undefined, { imageInput: true }, 'image_input'],
    [new Error('Unsupported image format. Use PNG, JPEG, GIF, WebP, or BMP'), undefined, { imageInput: true }, 'image_input'],
    [new Error('Image fetch timed out'), undefined, { imageInput: true }, 'image_input'],
    [new Error('Failed to fetch image: HTTP 403'), 'render', { imageInput: true }, 'image_input'],
    [new Error('Image fetch timed out'), undefined, {}, 'unknown'],
    [new Error('Image processing failed: HTTP 500'), undefined, { imageInput: true }, 'unknown'],
    // fallback
    [new Error('Invalid SVG format'), 'render', {}, 'render'],
    [new Error('boom'), 'render', {}, 'render'],
    [new Error('boom'), undefined, {}, 'unknown'],
    ['not an error', 'render', {}, 'unknown'],
  ] as const)('classifyError(%o, %s, %o) → %s', (error, fallback, options, expected) => {
    expect(classifyError(error, fallback, options)).toBe(expected);
  });
});
