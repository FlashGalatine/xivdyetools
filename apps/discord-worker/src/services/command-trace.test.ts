/**
 * CommandTrace — the dispatcher-owned lifecycle behind every Tier A datapoint.
 * Spec: docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startCommandTrace,
  getCommandTrace,
  tracedExecutionContext,
  markCommandOutcome,
  finishCommandTrace,
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

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as ExtendedLogger;

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
    _all: () => Promise.all(promises),
  } as unknown as ExecutionContext & { _all: () => Promise<unknown[]> };
}

const fields = { command: 'harmony', subcommand: '', userId: 'u1', locale: 'en' };

beforeEach(() => {
  vi.useFakeTimers();
  trackMock.mockClear();
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
  });

  it('is idempotent', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    startCommandTrace(ix, fields);
    finishCommandTrace(env, ix, ctx, logger);
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(getCommandTrace(ix)?.finished).toBe(true);
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
    startCommandTrace(ix, fields);
    markCommandOutcome(ix, 'upstream_presets');
    markCommandOutcome(ix, 'render');
    expect(getCommandTrace(ix)?.outcome).toBe('upstream_presets');
  });

  it('an explicit outcome on finish (rate_limited / unknown) is a failure', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    startCommandTrace(ix, fields);
    finishCommandTrace(env, ix, ctx, logger, 'rate_limited');
    await ctx._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'rate_limited' });
  });

  it('finish without a trace is a no-op; a tracking failure is logged, never thrown', async () => {
    const env = createMockEnv();
    const ctx = realCtx();
    finishCommandTrace(env, interaction(), ctx, logger);
    expect(trackMock).not.toHaveBeenCalled();

    trackMock.mockRejectedValueOnce(new Error('AE down'));
    const ix = interaction();
    startCommandTrace(ix, fields);
    finishCommandTrace(env, ix, ctx, logger);
    await expect(ctx._all()).resolves.toBeDefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it.each([
    [undefined, 'other'], ['en-US', 'en'], ['en-GB', 'en'], ['ja', 'ja'], ['zh-TW', 'zh'], ['pt-BR', 'other'],
  ])('bucketLocale(%j) → %s', (input, expected) => {
    expect(bucketLocale(input)).toBe(expected);
  });

  it('subcommandOf reads a subcommand option and ignores plain options', () => {
    expect(subcommandOf(interaction({ data: { name: 'dye', options: [{ name: 'info', type: 1, options: [] }] } }))).toBe('info');
    expect(subcommandOf(interaction({ data: { name: 'dye', options: [{ name: 'info', options: [] }] } }))).toBe('info');
    expect(subcommandOf(interaction({ data: { name: 'harmony', options: [{ name: 'color', type: 3, value: 'x' }] } }))).toBe('');
    expect(subcommandOf(interaction({ data: { name: 'about' } }))).toBe('');
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
    [new UniversalisError(503, 'x'), undefined, 'upstream_universalis'],
    [new PresetAPIError(500, 'x'), undefined, 'upstream_presets'],
    [new Error('SSRF blocked'), undefined, 'image_input'],
    [new Error('Only Discord CDN attachments'), undefined, 'image_input'],
    [new Error('Image too large'), undefined, 'image_input'],
    [new Error('Unsupported format'), undefined, 'image_input'],
    [new Error('fetch timeout'), undefined, 'image_input'],
    [new Error('boom'), 'render', 'render'],
    [new Error('boom'), undefined, 'unknown'],
    ['not an error', undefined, 'unknown'],
  ] as const)('classifyError(%o, %s) → %s', (error, fallback, expected) => {
    expect(classifyError(error, fallback)).toBe(expected);
  });
});
