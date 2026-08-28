/**
 * /extractor color — matching-method resolution.
 *
 * The schema offers a `matching` option; it must drive BOTH the ranking and
 * the card (14J·2 tier bars, ΔE column tag, key line). Resolution order is
 * explicit option → stored preference → suite default (ΔE2000).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColorService } from '@xivdyetools/core';
import type { Env, DiscordInteraction } from '../../types/env.js';

const renderSvgToPngMock = vi.hoisted(() => vi.fn());
const editOriginalResponseMock = vi.hoisted(() => vi.fn());
const getUserPreferencesMock = vi.hoisted(() => vi.fn());
const generateNearestSheetMock = vi.hoisted(() => vi.fn((_opts: unknown) => '<svg />'));
const translatorStub = vi.hoisted(() => ({
  t: vi.fn((key: string) => (key === 'card.matchKey' ? 'nearest by ΔE2000' : key)),
  getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../services/svg/renderer.js', () => ({ renderSvgToPng: renderSvgToPngMock }));
vi.mock('../../utils/discord-api.js', () => ({
  editOriginalResponse: editOriginalResponseMock,
  safeEditOriginalResponse: editOriginalResponseMock,
}));
vi.mock('../../services/bot-i18n.js', () => ({
  createTranslator: vi.fn(() => translatorStub),
  createUserTranslator: vi.fn(async () => translatorStub),
  createUserTranslatorWithPrefs: vi.fn(async (kv: unknown, userId: string) => ({
    t: translatorStub,
    prefs: await getUserPreferencesMock(kv, userId),
  })),
}));
vi.mock('../../services/i18n.js', () => ({
  discordLocaleToLocaleCode: vi.fn(() => 'en'),
  initializeLocale: vi.fn(async () => undefined),
  getLocalizedDyeName: vi.fn((_id: number, name: string) => name),
}));
vi.mock('../../services/preferences.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/preferences.js')>()),
  getUserPreferences: getUserPreferencesMock,
}));
vi.mock('@xivdyetools/svg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xivdyetools/svg')>()),
  generateNearestSheet: generateNearestSheetMock,
}));
vi.mock('../../services/image-client.js', () => ({ extractImagePixels: vi.fn() }));

import { handleExtractorCommand } from './extractor.js';

function makeInteraction(
  colorOptions: Array<{ name: string; value: unknown }>,
): DiscordInteraction {
  return {
    id: 'i-1',
    token: 'tok',
    type: 2,
    locale: 'en-US',
    member: { user: { id: 'user-1' } },
    data: { name: 'extractor', options: [{ name: 'color', options: colorOptions }] },
  } as unknown as DiscordInteraction;
}

function makeCtx() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as ExecutionContext,
    flush: () => Promise.all(pending),
  };
}

const env = { KV: {}, DISCORD_CLIENT_ID: 'app' } as unknown as Env;

describe('/extractor color — matching method', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderSvgToPngMock.mockResolvedValue(new Uint8Array([1]));
    getUserPreferencesMock.mockResolvedValue({});
  });

  it('defaults to ΔE2000 and passes it to the card', async () => {
    const { ctx, flush } = makeCtx();
    await handleExtractorCommand(
      makeInteraction([
        { name: 'color', value: '#4A6B8C' },
        { name: 'count', value: 3 },
      ]),
      env,
      ctx,
    );
    await flush();

    expect(generateNearestSheetMock).toHaveBeenCalledTimes(1);
    const opts = generateNearestSheetMock.mock.calls[0][0] as unknown as {
      method: string;
      labels: { matchKey: string };
      rows: Array<{ hex: string; deltaE: number }>;
    };
    expect(opts.method).toBe('ciede2000');
    expect(opts.labels.matchKey).toBe('nearest by ΔE2000');
    // rows are the ΔE2000-nearest dyes, ascending, measured in ΔE2000
    for (const r of opts.rows) {
      expect(r.deltaE).toBeCloseTo(
        ColorService.getDistanceForMethod('#4A6B8C', r.hex, 'ciede2000'),
        6,
      );
    }
    expect(opts.rows.map((r) => r.deltaE)).toEqual(
      [...opts.rows.map((r) => r.deltaE)].sort((a, b) => a - b),
    );
  });

  it('honours an explicit matching option (ranking + card tag)', async () => {
    const { ctx, flush } = makeCtx();
    await handleExtractorCommand(
      makeInteraction([
        { name: 'color', value: '#4A6B8C' },
        { name: 'count', value: 3 },
        { name: 'matching', value: 'redmean' },
      ]),
      env,
      ctx,
    );
    await flush();

    const opts = generateNearestSheetMock.mock.calls[0][0] as unknown as {
      method: string;
      labels: { matchKey: string };
      rows: Array<{ hex: string; deltaE: number }>;
    };
    expect(opts.method).toBe('redmean');
    expect(opts.labels.matchKey).toBe('nearest by REDMEAN');
    for (const r of opts.rows) {
      expect(r.deltaE).toBeCloseTo(
        ColorService.getDistanceForMethod('#4A6B8C', r.hex, 'redmean'),
        6,
      );
    }
  });

  it('falls back to the stored preference when no option is given', async () => {
    getUserPreferencesMock.mockResolvedValue({ matching: 'oklab' });
    const { ctx, flush } = makeCtx();
    await handleExtractorCommand(makeInteraction([{ name: 'color', value: '#4A6B8C' }]), env, ctx);
    await flush();

    const opts = generateNearestSheetMock.mock.calls[0][0] as unknown as {
      method: string;
      labels: { matchKey: string };
    };
    expect(opts.method).toBe('oklab');
    expect(opts.labels.matchKey).toBe('nearest by ΔEOK');
  });
});

describe('/extractor color — result count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderSvgToPngMock.mockResolvedValue(new Uint8Array([1]));
    getUserPreferencesMock.mockResolvedValue({});
  });

  it('an explicit count option wins over a stored preference', async () => {
    getUserPreferencesMock.mockResolvedValue({ count: 8 });
    const { ctx, flush } = makeCtx();
    await handleExtractorCommand(
      makeInteraction([
        { name: 'color', value: '#4A6B8C' },
        { name: 'count', value: 2 },
      ]),
      env,
      ctx,
    );
    await flush();

    const opts = generateNearestSheetMock.mock.calls[0][0] as unknown as { rows: unknown[] };
    expect(opts.rows).toHaveLength(2);
  });

  it('falls back to the stored preference when no count option is given', async () => {
    getUserPreferencesMock.mockResolvedValue({ count: 3 });
    const { ctx, flush } = makeCtx();
    await handleExtractorCommand(makeInteraction([{ name: 'color', value: '#4A6B8C' }]), env, ctx);
    await flush();

    const opts = generateNearestSheetMock.mock.calls[0][0] as unknown as { rows: unknown[] };
    expect(opts.rows).toHaveLength(3);
  });

  it('defaults to a single match when neither an option nor a stored preference is set', async () => {
    getUserPreferencesMock.mockResolvedValue({});
    const { ctx, flush } = makeCtx();
    await handleExtractorCommand(makeInteraction([{ name: 'color', value: '#4A6B8C' }]), env, ctx);
    await flush();

    const opts = generateNearestSheetMock.mock.calls[0][0] as unknown as { rows: unknown[] };
    expect(opts.rows).toHaveLength(1);
    // The single-match case gets copy buttons on the response.
    const response = editOriginalResponseMock.mock.calls[0][2] as { components?: unknown[] };
    expect(response.components).toBeDefined();
  });
});
