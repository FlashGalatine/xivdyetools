import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleHarmonyCommand, getHarmonyTypeChoices } from './harmony.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

const resolveUserLocaleMock = vi.hoisted(() => vi.fn());
const initializeLocaleMock = vi.hoisted(() => vi.fn());
const getLocalizedDyeNameMock = vi.hoisted(() => vi.fn((itemID?: number, name?: string) => name ?? `dye-${itemID ?? 'unknown'}`));
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
  createUserTranslator: createUserTranslatorMock.mockImplementation(async (kv, userId: string, discordLocale?: string) => {
    await resolveUserLocaleMock(kv, userId, discordLocale);
    return translatorStub;
  }),
  createTranslator: createTranslatorMock.mockReturnValue(translatorStub),
}));

vi.mock('@xivdyetools/svg', () => ({
  generateHarmonyWheel: vi.fn(() => '<svg />'),
}));

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: renderSvgToPngMock,
}));

vi.mock('../../utils/discord-api.js', () => ({
  editOriginalResponse: editOriginalResponseMock,
}));

vi.mock('../../utils/response.js', () => ({
  deferredResponse: () => new Response('{"type": 5}'),
  errorEmbed: (title: string, description: string) => ({ title, description }),
}));

vi.mock('../../services/emoji.js', () => ({
  getDyeEmoji: (id: number) => id ? '🎨' : undefined,
}));

const mockDyeRed = { id: 1, name: 'Rolanberry Red', hex: '#FF0000', category: 'General', itemID: 1001 };
const mockDyeGreen = { id: 2, name: 'Celeste Green', hex: '#00FF00', category: 'General', itemID: 1002 };
const mockDyeBlue = { id: 3, name: 'Ceruleum Blue', hex: '#0000FF', category: 'General', itemID: 1003 };

vi.mock('@xivdyetools/core', () => {
  class MockDyeService {
    searchByName(query: string) {
      const lower = query.toLowerCase();
      if (lower.includes('red')) return [mockDyeRed];
      if (lower.includes('green')) return [mockDyeGreen];
      if (lower.includes('blue')) return [mockDyeBlue];
      return [];
    }
    findTriadicDyes() { return [mockDyeRed, mockDyeGreen, mockDyeBlue]; }
    findComplementaryPair() { return mockDyeGreen; }
    findAnalogousDyes() { return [mockDyeRed, mockDyeGreen]; }
    findSplitComplementaryDyes() { return [mockDyeGreen, mockDyeBlue]; }
    findTetradicDyes() { return [mockDyeRed, mockDyeGreen, mockDyeBlue]; }
    findSquareDyes() { return [mockDyeRed, mockDyeGreen, mockDyeBlue]; }
    findMonochromaticDyes() { return [mockDyeRed]; }
  }

  class MockLocalizationService {
    async setLocale(_locale: string): Promise<void> {}
    getDyeName(_itemID: number): string | undefined { return undefined; }
    getCategory(category: string): string { return category; }
  }

  const dyeDatabase = {} as const;
  return { DyeService: MockDyeService, dyeDatabase, LocalizationService: MockLocalizationService };
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
    KV: {} as KVNamespace,
    DB: {} as D1Database,
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
    // Should have called editOriginalResponse with error
    expect(editOriginalResponseMock).toHaveBeenCalled();
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
        ]
      },
    } as unknown as DiscordInteraction;

    await handleHarmonyCommand(interaction, env, ctx, mockLogger as any);
    await Promise.all(waitUntilCalls);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Harmony render error',
      expect.any(Error)
    );
  });

  it('handles case when no harmony dyes are found', async () => {
    // Override the mock to return null for complementary
    const { DyeService } = await import('@xivdyetools/core');
    const originalFindComplementaryPair = DyeService.prototype.findComplementaryPair;
    vi.spyOn(DyeService.prototype, 'findComplementaryPair').mockReturnValueOnce(null);

    const { ctx, waitUntilCalls } = createContext();

    const interaction = {
      ...baseInteraction,
      data: {
        options: [
          { name: 'color', value: '#000000' },
          { name: 'type', value: 'complementary' },
        ]
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
      })
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
        ]
      },
    } as unknown as DiscordInteraction;

    const response = await handleHarmonyCommand(interaction, env, ctx);
    await Promise.all(waitUntilCalls);
    expect(response.status).toBe(200);
  });
});

describe('getHarmonyTypeChoices', () => {
  it('returns all harmony type choices', () => {
    const choices = getHarmonyTypeChoices();

    expect(choices).toHaveLength(7);
    expect(choices.map(c => c.value)).toEqual([
      'triadic',
      'complementary',
      'analogous',
      'split-complementary',
      'tetradic',
      'square',
      'monochromatic',
    ]);
  });
});
