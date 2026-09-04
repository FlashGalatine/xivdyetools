/**
 * Tests for /accessibility command handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAccessibilityCommand } from './accessibility.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';

// Mock dependencies
vi.mock('@xivdyetools/core', () => {
  class MockDyeService {
    searchByName(query: string) {
      if (query.toLowerCase().includes('snow')) {
        return [
          {
            id: 1,
            name: 'Snow White',
            hex: '#FFFFFF',
            rgb: { r: 255, g: 255, b: 255 },
            hsv: { h: 0, s: 0, v: 100 },
            category: 'Standard',
            itemID: 5694,
          },
        ];
      }
      if (query.toLowerCase().includes('soot')) {
        return [
          {
            id: 2,
            name: 'Soot Black',
            hex: '#1A1A1A',
            rgb: { r: 26, g: 26, b: 26 },
            hsv: { h: 0, s: 0, v: 10 },
            category: 'Standard',
            itemID: 5695,
          },
        ];
      }
      if (query.toLowerCase().includes('facewear')) {
        return [
          {
            id: 99,
            name: 'Facewear Dye',
            hex: '#FF0000',
            rgb: { r: 255, g: 0, b: 0 },
            category: 'Facewear',
          },
        ];
      }
      if (query.toLowerCase().includes('notfound')) {
        return [];
      }
      return [
        {
          id: 3,
          name: 'Test Dye',
          hex: '#FF5733',
          rgb: { r: 255, g: 87, b: 51 },
          hsv: { h: 11, s: 80, v: 100 },
          category: 'Standard',
          itemID: 5696,
        },
      ];
    }
    findClosestDye(hex: string) {
      return {
        id: 1,
        name: 'Closest Dye',
        hex,
        rgb: { r: 255, g: 87, b: 51 },
        hsv: { h: 11, s: 80, v: 100 },
        category: 'Standard',
        itemID: 5697,
      };
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

  // 13D/E/H: simulation + ΔE2000 separation run through ColorService
  const ColorService = {
    simulateColorblindnessHex: (hex: string, _lens: string) => hex,
    getDistanceForMethod: () => 20,
  };

  return {
    DyeService: MockDyeService,
    dyeDatabase: {},
    LocalizationService: MockLocalizationService,
    ColorService,
    // `types/preferences.ts` builds MATCHING_METHODS at module scope from
    // these two, so they must exist on the mock or importing it throws before
    // any test runs. `oklab` is ΔEOK2 — the metric became ΔEOK2 in core 5.1.0.
    MATCHING_METHODS: ['ciede2000', 'oklab', 'cie76', 'redmean', 'rgb', 'distinguish'],
    MATCHING_METHOD_TAGS: {
      ciede2000: 'ΔE2000',
      oklab: 'ΔEOK2',
      cie76: 'ΔE76',
      redmean: 'REDMEAN',
      rgb: 'RGB DIST',
      distinguish: 'DISTINGUISH %',
      ratio: 'RATIO',
    },
  };
});

vi.mock('../../services/bot-i18n.js', () => ({
  createUserTranslator: vi.fn().mockResolvedValue({
    t: (key: string, vars?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'common.error': 'Error',
        'errors.missingInput': 'Please provide at least one dye or color',
        'errors.invalidColor': `Could not find dye or parse color: ${vars?.input}`,
        'errors.generationFailed': 'Failed to generate image',
        'accessibility.protanopia': 'Protanopia',
        'accessibility.deuteranopia': 'Deuteranopia',
        'accessibility.tritanopia': 'Tritanopia',
        'common.footer': 'XIV Dye Tools',
      };
      return translations[key] || key;
    },
    getLocale: () => 'en',
  }),
  createTranslator: vi.fn((locale: string) => ({
    t: (key: string, _vars?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'common.error': 'Error',
        'errors.generationFailed': 'Failed to generate image',
        'accessibility.protanopia': 'Protanopia',
        'accessibility.deuteranopia': 'Deuteranopia',
        'accessibility.tritanopia': 'Tritanopia',
        'common.footer': 'XIV Dye Tools',
      };
      return translations[key] || key;
    },
    getLocale: () => locale,
  })),
}));

vi.mock('../../services/i18n.js', () => ({
  discordLocaleToLocaleCode: vi.fn((_locale: string) => 'en'),
  initializeLocale: vi.fn(),
  getLocalizedDyeName: vi.fn((_itemId: number, name: string) => name),
}));

vi.mock('@xivdyetools/svg', () => ({
  generateA11yCard: vi.fn().mockReturnValue('<svg>accessibility</svg>'),
}));

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

vi.mock('../../services/emoji.js', () => ({
  getDyeEmoji: vi.fn((id: number) => (id === 1 ? '⚪' : id === 2 ? '⬛' : null)),
}));

vi.mock('../../utils/discord-api.js', () => {
  const editOriginalResponse = vi.fn().mockResolvedValue({ ok: true });
  // BUG-035: handlers call the safe wrapper; alias it to the same mock so
  // existing assertions on editOriginalResponse keep working
  return { editOriginalResponse, safeEditOriginalResponse: editOriginalResponse };
});

import { editOriginalResponse } from '../../utils/discord-api.js';
import { generateA11yCard } from '@xivdyetools/svg';
import { renderSvgToPng } from '../../services/svg/renderer.js';

describe('accessibility.ts', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;
  let waitUntilPromises: Promise<void>[];

  beforeEach(() => {
    waitUntilPromises = [];

    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: 'client-id',
      PRESETS_API_URL: 'https://test-api.example.com',
      INTERNAL_WEBHOOK_SECRET: 'test-secret',
      KV: {} as KVNamespace,
    } as unknown as Env;

    mockCtx = {
      waitUntil: vi.fn((promise: Promise<void>) => {
        waitUntilPromises.push(promise);
      }),
      passThroughOnException: vi.fn(),
      props: {},
    } as unknown as ExecutionContext;

    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('should return error for missing dye input', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [], // No dye options
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(4);
      expect(data.data!.embeds![0].title).toContain('Error');
      expect(data.data!.embeds![0].description).toContain('Please provide at least one dye');
      expect(data.data!.flags).toBe(64);
    });

    it('should return error for invalid color input', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: 'notfound', type: 3 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(4);
      expect(data.data!.embeds![0].title).toContain('Error');
      expect(data.data!.embeds![0].description).toContain('notfound');
      expect(data.data!.flags).toBe(64);
    });

    it('should handle member.user.id for guild interactions', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [], // No dye options
        },
        member: { user: { id: 'user-456' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      expect(response.status).toBe(200);
    });

    it('should handle interaction with no user info', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [],
        },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(4);
      // Uses fallback translator which returns translation keys
      expect(data.data!.embeds![0].description).toContain('missingInput');
    });
  });

  describe('single dye - colorblind simulation', () => {
    it('should defer response for valid single dye by name', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: 'snow white', type: 3 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });

    it('should defer response for valid single dye by hex', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: '#FF5733', type: 3 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5);
    });

    it('should defer response for hex without # prefix', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: 'FF5733', type: 3 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5);
    });

    it('should process single dye accessibility in background', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: 'snow white', type: 3 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      await handleAccessibilityCommand(interaction, mockEnv, mockCtx);

      // Wait for background processing
      await Promise.all(waitUntilPromises);

      expect(generateA11yCard).toHaveBeenCalled();
      expect(renderSvgToPng).toHaveBeenCalled();
      expect(editOriginalResponse).toHaveBeenCalled();
    });

    it('should respect vision type filter', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [
            { name: 'dye1', value: 'snow white', type: 3 },
            { name: 'vision', value: 'protanopia', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      await Promise.all(waitUntilPromises);

      // A single dye always renders 13H (every lens), whatever vision says
      expect(generateA11yCard).toHaveBeenCalledWith(expect.objectContaining({ mode: 'solo' }));
    });
  });

  describe('multiple dyes - contrast matrix', () => {
    it('should defer response for two dyes', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [
            { name: 'dye1', value: 'snow white', type: 3 },
            { name: 'dye2', value: 'soot black', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5);
    });

    it('should process multi-dye contrast in background', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [
            { name: 'dye1', value: 'snow white', type: 3 },
            { name: 'dye2', value: 'soot black', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      await Promise.all(waitUntilPromises);

      // A pair with no vision option renders 13E (all lenses)
      expect(generateA11yCard).toHaveBeenCalledWith(expect.objectContaining({ mode: 'all' }));
      expect(renderSvgToPng).toHaveBeenCalled();
      expect(editOriginalResponse).toHaveBeenCalled();
    });

    it('should handle up to 4 dyes', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [
            { name: 'dye1', value: '#FFFFFF', type: 3 },
            { name: 'dye2', value: '#000000', type: 3 },
            { name: 'dye3', value: '#FF0000', type: 3 },
            { name: 'dye4', value: '#00FF00', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle render errors gracefully', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValueOnce(new Error('Render failed'));

      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: 'snow white', type: 3 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const { startCommandTrace } = await import('../../services/command-trace.js');
      const trace = startCommandTrace(interaction, { command: 'accessibility', subcommand: '', userId: 'u1', locale: 'en' });

      await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      await Promise.all(waitUntilPromises);

      // Should send error response
      expect(editOriginalResponse).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('Failed'),
            }),
          ]),
        }),
      );
      expect(trace.outcome).toBe('render');
    });

    it('should filter out Facewear dyes', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: 'facewear', type: 3 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAccessibilityCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // Should return an immediate error response (type 4) because
      // Facewear dyes are excluded from color resolution
      expect(data.type).toBe(4);
      expect(data.data?.embeds?.[0]?.description).toContain('Could not find');
    });

    it('should log error when logger is provided', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValueOnce(new Error('Render failed'));
      const mockLogger = { error: vi.fn() };

      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: 'snow white', type: 3 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      await handleAccessibilityCommand(interaction, mockEnv, mockCtx, mockLogger as any);
      await Promise.all(waitUntilPromises);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Accessibility render error',
        expect.any(Error),
      );
    });

    it('should log undefined when non-Error is thrown', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValueOnce('string error');
      const mockLogger = { error: vi.fn() };

      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: 'snow white', type: 3 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      await handleAccessibilityCommand(interaction, mockEnv, mockCtx, mockLogger as any);
      await Promise.all(waitUntilPromises);

      expect(mockLogger.error).toHaveBeenCalledWith('Accessibility render error', undefined);
    });
  });

  describe('locale handling', () => {
    it('should use user locale from interaction', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'accessibility',
          options: [{ name: 'dye1', value: 'snow white', type: 3 }],
        },
        user: { id: 'user-123' },
        locale: 'ja',
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      await handleAccessibilityCommand(interaction, mockEnv, mockCtx);

      const { createUserTranslator } = await import('../../services/bot-i18n.js');
      expect(createUserTranslator).toHaveBeenCalledWith(mockEnv.KV, 'user-123', 'ja');
    });
  });
});
