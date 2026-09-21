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
  // I18N-006: mirrors the real `card.colours` plural rule closely enough to
  // prove the caller passes the count through `.tc()` rather than `.t()`.
  tc: vi.fn((key: string, count: number, vars?: Record<string, unknown>) => {
    if (key === 'card.colours') return count === 1 ? `${vars?.n} color` : `${vars?.n} colors`;
    return key;
  }),
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
const extractImagePixelsMock = vi.hoisted(() => vi.fn());
vi.mock('../../services/image-client.js', () => ({ extractImagePixels: extractImagePixelsMock }));

import { handleExtractorCommand } from './extractor.js';
import { PaletteService } from '@xivdyetools/core';
import { dyeService } from '@xivdyetools/bot-logic';

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
    expect(opts.labels.matchKey).toBe('nearest by ΔEOK2');
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

describe('/extractor image — color count line (I18N-006)', () => {
  function makeImageInteraction(attachmentId: string, url: string): DiscordInteraction {
    return {
      id: 'i-image-1',
      token: 'tok',
      type: 2,
      locale: 'en-US',
      member: { user: { id: 'user-1' } },
      data: {
        name: 'extractor',
        options: [{ name: 'image', options: [{ name: 'image', value: attachmentId }] }],
        resolved: { attachments: { [attachmentId]: { url } } },
      },
    } as unknown as DiscordInteraction;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    renderSvgToPngMock.mockResolvedValue(new Uint8Array([1]));
    getUserPreferencesMock.mockResolvedValue({});
    extractImagePixelsMock.mockResolvedValue({
      pixels: new Uint8Array([255, 0, 0, 255]),
      width: 1,
      height: 1,
    });
  });

  it('renders the singular "1 color" line when only one dye match survives', async () => {
    const dye = dyeService.getAllDyes()[0];
    const spy = vi
      .spyOn(PaletteService.prototype, 'extractAndMatchPalette')
      .mockReturnValue([
        { extracted: { r: 255, g: 0, b: 0 }, matchedDye: dye, distance: 0, dominance: 1 },
      ]);
    try {
      const { ctx, flush } = makeCtx();
      await handleExtractorCommand(
        makeImageInteraction('att-1', 'https://example.com/i.png'),
        env,
        ctx,
      );
      await flush();

      const response = editOriginalResponseMock.mock.calls[0][2] as {
        embeds: Array<{ description: string }>;
      };
      expect(response.embeds[0].description).toContain('1 color\n');
      expect(response.embeds[0].description).not.toContain('1 colors');
    } finally {
      spy.mockRestore();
    }
  });

  it('renders the plural form for more than one match', async () => {
    const dyes = dyeService.getAllDyes().slice(0, 2);
    const spy = vi.spyOn(PaletteService.prototype, 'extractAndMatchPalette').mockReturnValue([
      { extracted: { r: 255, g: 0, b: 0 }, matchedDye: dyes[0], distance: 0, dominance: 0.6 },
      { extracted: { r: 0, g: 255, b: 0 }, matchedDye: dyes[1], distance: 0, dominance: 0.4 },
    ]);
    try {
      const { ctx, flush } = makeCtx();
      await handleExtractorCommand(
        makeImageInteraction('att-1', 'https://example.com/i.png'),
        env,
        ctx,
      );
      await flush();

      const response = editOriginalResponseMock.mock.calls[0][2] as {
        embeds: Array<{ description: string }>;
      };
      expect(response.embeds[0].description).toContain('2 colors');
    } finally {
      spy.mockRestore();
    }
  });
});
