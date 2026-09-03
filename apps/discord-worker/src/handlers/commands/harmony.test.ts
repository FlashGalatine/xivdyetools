import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleHarmonyCommand } from './harmony.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

const resolveUserLocaleMock = vi.hoisted(() => vi.fn());
const initializeLocaleMock = vi.hoisted(() => vi.fn());
const getLocalizedDyeNameMock = vi.hoisted(() =>
  vi.fn((itemID?: number, name?: string) => name ?? `dye-${itemID ?? 'unknown'}`),
);
const createUserTranslatorMock = vi.hoisted(() => vi.fn());
const createTranslatorMock = vi.hoisted(() => vi.fn());
const renderSvgToPngMock = vi.hoisted(() => vi.fn());
const editOriginalResponseMock = vi.hoisted(() => vi.fn());

const translatorStub = vi.hoisted(() => ({
  t: vi.fn((key: string) => key),
  getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../services/i18n.js', () => ({
  resolveUserLocale: resolveUserLocaleMock,
  initializeLocale: initializeLocaleMock,
  getLocalizedDyeName: getLocalizedDyeNameMock,
  discordLocaleToLocaleCode: vi.fn().mockReturnValue('en'),
}));

vi.mock('../../services/bot-i18n.js', () => ({
  createUserTranslator: createUserTranslatorMock.mockImplementation(
    async (kv, userId: string, discordLocale?: string) => {
      await resolveUserLocaleMock(kv, userId, discordLocale);
      return translatorStub;
    },
  ),
  createTranslator: createTranslatorMock.mockReturnValue(translatorStub),
}));

vi.mock('@xivdyetools/svg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xivdyetools/svg')>()),
  generateHarmonyCard: vi.fn(() => '<svg />'),
}));

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: renderSvgToPngMock,
}));

vi.mock('../../utils/discord-api.js', () => ({
  editOriginalResponse: editOriginalResponseMock,
  safeEditOriginalResponse: editOriginalResponseMock,
}));

vi.mock('../../utils/response.js', () => ({
  deferredResponse: () => new Response('{"type": 5}'),
  errorEmbed: (title: string, description: string) => ({ title, description }),
}));

vi.mock('../../services/emoji.js', () => ({
  // discord-handlers-13: this returned '🎨' for ANY truthy number, so
  // getDyeEmoji(5729) -- an itemID, which production answers `undefined`
  // for -- looked identical to getDyeEmoji(1). Every assertion about the
  // base-colour line therefore passed whichever id shape the handler
  // handed over, which is precisely discord-handlers-02. Emoji are keyed
  // per STAIN, so only 1-254 may resolve.
  getDyeEmoji: (id: number) =>
    Number.isInteger(id) && id >= 1 && id <= 254 ? '🎨' : undefined,
}));

const mockDyeRed = {
  id: 1001,
  name: 'Rolanberry Red',
  hex: '#FF0000',
  category: 'General',
  itemID: 1001,
  stainID: 1,
};
const mockDyeGreen = {
  id: 1002,
  name: 'Celeste Green',
  hex: '#00FF00',
  category: 'General',
  itemID: 1002,
  stainID: 2,
};
const mockDyeBlue = {
  id: 1003,
  name: 'Ceruleum Blue',
  hex: '#0000FF',
  category: 'General',
  itemID: 1003,
  stainID: 3,
};

vi.mock('@xivdyetools/core', () => {
  class MockDyeService {
    searchByName(query: string) {
      const lower = query.toLowerCase();
      if (lower.includes('red')) return [mockDyeRed];
      if (lower.includes('green')) return [mockDyeGreen];
      if (lower.includes('blue')) return [mockDyeBlue];
      return [];
    }
    findTriadicDyes() {
      return [mockDyeRed, mockDyeGreen, mockDyeBlue];
    }
    findComplementaryPair() {
      return mockDyeGreen;
    }
    findAnalogousDyes() {
      return [mockDyeRed, mockDyeGreen];
    }
    findSplitComplementaryDyes() {
      return [mockDyeGreen, mockDyeBlue];
    }
    findTetradicDyes() {
      return [mockDyeRed, mockDyeGreen, mockDyeBlue];
    }
    findSquareDyes() {
      return [mockDyeRed, mockDyeGreen, mockDyeBlue];
    }
    findMonochromaticDyes() {
      return [mockDyeRed];
    }
    // discord-handlers-13: absent entirely, so the base-colour emoji path
    // (which resolves an itemID to its stainID before asking for a chip) could
    // never run under test.
    getDyeById(id: number) {
      return [mockDyeRed, mockDyeGreen, mockDyeBlue].find((d) => d.id === id) ?? null;
    }
  }

  class MockLocalizationService {
    async setLocale(_locale: string): Promise<void> {}
    getDyeName(_itemID: number): string | undefined {
      return undefined;
    }
    getCategory(category: string): string {
      return category;
    }
  }

  const dyeDatabase = {} as const;
  // 11A pairing: ideal hues via rotateHue, verdicts via ΔE2000
  const ColorService = {
    rotateHue: (hex: string, _degrees: number) => hex,
    getDistanceForMethod: () => 5,
  };
  return {
    DyeService: MockDyeService,
    dyeDatabase,
    LocalizationService: MockLocalizationService,
    ColorService,
    filterDyes: (_f: unknown, dyes: unknown[]) => dyes,
  };
});

describe('handleHarmonyCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserLocaleMock.mockResolvedValue('en');
    initializeLocaleMock.mockResolvedValue(undefined);
    renderSvgToPngMock.mockResolvedValue(new Uint8Array([1]));
  });

  const createContext = () => {
    const waitUntilCalls: Array<Promise<unknown>> = [];
    return {
      ctx: {
        waitUntil(promise: Promise<unknown>) {
          waitUntilCalls.push(promise);
        },
      } as any,
      waitUntilCalls,
    };
  };

  const baseInteraction = {
    id: 'interaction-1',
    application_id: 'app-id',
    member: { user: { id: 'user-123' } },
    data: { options: [] },
    locale: 'en-US',
    token: 'token-abc',
  } as unknown as DiscordInteraction;

  const env = {
    KV: {
      // The handlers read stored preferences (theme, matching) before they
      // render; an empty object throws on kv.get, which swallowed the render
      // path and made these assertions vacuous.
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
      list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    } as unknown as KVNamespace,
    DISCORD_CLIENT_ID: 'client-123',
    DISCORD_PUBLIC_KEY: 'pk',
    DISCORD_TOKEN: 'token',
    PRESETS_API_URL: 'https://api.example.com',
  } as Env;

  it('resolves locale once per request', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: { options: [{ name: 'color', value: '#ffffff' }] },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);

    expect(response.status).toBe(200);
    expect(createUserTranslatorMock).toHaveBeenCalledTimes(1);
    expect(resolveUserLocaleMock).toHaveBeenCalledTimes(1);
    expect(createTranslatorMock).toHaveBeenCalledTimes(1);
  });

  // discord-handlers-13: making the getDyeEmoji mock discriminate (above) is
  // only half of it -- NOTHING in this file ever read the base-colour line, so
  // the handler could hand over any id shape and no assertion moved. This is
  // the assertion that closes discord-handlers-02: the base row must carry a
  // colour chip, which it only does if the handler resolves a STAIN id.
  it('prefixes the base colour with its dye emoji', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: { options: [{ name: 'color', value: 'Rolanberry Red' }] },
    } as unknown as DiscordInteraction;

    await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);

    const payload = editOriginalResponseMock.mock.calls.at(-1)?.[2] as
      | { embeds?: Array<{ description?: string }> }
      | undefined;
    const description = payload?.embeds?.[0]?.description ?? '';

    expect(description).toContain('harmony.baseColor');
    // The chip. Passing an itemID here resolves to `undefined` in production,
    // which is how the base row came to be the one line with no colour chip
    // while every numbered row below it had one.
    expect(description).toMatch(/harmony\.baseColor: 🎨 /);
  });

  it('returns error when color is missing', async () => {
    const { ctx } = createContext();

    const interaction = {
      ...baseInteraction,
      data: { options: [] },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    expect(response.status).toBe(200);
    // Should have rendered error response
    expect(translatorStub.t).toHaveBeenCalledWith('errors.missingInput');
  });

  it('returns error for invalid color input', async () => {
    const { ctx } = createContext();

    const interaction = {
      ...baseInteraction,
      data: { options: [{ name: 'color', value: 'not-a-valid-color' }] },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    expect(response.status).toBe(200);
  });

  it('processes triadic harmony type', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          { name: 'type', value: 'triadic' },
        ],
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('processes complementary harmony type', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          { name: 'type', value: 'complementary' },
        ],
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('processes analogous harmony type', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          { name: 'type', value: 'analogous' },
        ],
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('processes split-complementary harmony type', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          { name: 'type', value: 'split-complementary' },
        ],
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('processes tetradic harmony type', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          { name: 'type', value: 'tetradic' },
        ],
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('processes square harmony type', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          { name: 'type', value: 'square' },
        ],
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('processes monochromatic harmony type', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          { name: 'type', value: 'monochromatic' },
        ],
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('accepts dye name as color input', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: { options: [{ name: 'color', value: 'Rolanberry Red' }] },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('normalizes hex colors without # prefix', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: { options: [{ name: 'color', value: 'FF0000' }] },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('handles DM context (no member, uses user)', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      member: undefined,
      user: { id: 'dm-user-1' },
      data: { options: [{ name: 'color', value: '#FF0000' }] },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });

  it('handles rendering error gracefully', async () => {
    const { ctx, waitUntilCalls } = createContext();
    renderSvgToPngMock.mockRejectedValueOnce(new Error('Render failed'));

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          { name: 'type', value: 'triadic' },
        ],
      },
    } as unknown as DiscordInteraction;

    const { startCommandTrace } = await import('../../services/command-trace.js');
    const trace = startCommandTrace(interaction, { command: 'harmony', subcommand: '', userId: 'u1', locale: 'en' });

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
    // Should have called editOriginalResponse with error
    expect(editOriginalResponseMock).toHaveBeenCalled();
    expect(trace.outcome).toBe('render');
  });

  it('handles rendering error with logger', async () => {
    const { ctx, waitUntilCalls } = createContext();
    renderSvgToPngMock.mockRejectedValueOnce(new Error('Render failed'));
    const mockLogger = { error: vi.fn() };

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          { name: 'type', value: 'triadic' },
        ],
      },
    } as unknown as DiscordInteraction;

    await handleHarmonyCommand(interaction, env, ctx, mockLogger as any);
    await Promise.all(waitUntilCalls);

    expect(mockLogger.error).toHaveBeenCalledWith('Harmony render error', expect.any(Error));
  });

  it('handles case when no harmony dyes are found', async () => {
    // Override the mock to return null for complementary
    const { DyeService } = await import('@xivdyetools/core');
    vi.spyOn(DyeService.prototype, 'findComplementaryPair').mockReturnValueOnce(null);

    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#000000' },
          { name: 'type', value: 'complementary' },
        ],
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
    // Should have sent error about no matches found
    expect(editOriginalResponseMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            description: 'errors.noMatchFound',
          }),
        ]),
      }),
    );

    // Restore original
    vi.spyOn(DyeService.prototype, 'findComplementaryPair').mockRestore();
  });

  it('uses default triadic type for unknown harmony type', async () => {
    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#FF0000' },
          // No type specified - should default to triadic
        ],
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });
});
