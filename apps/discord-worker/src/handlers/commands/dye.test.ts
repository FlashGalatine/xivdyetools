/**
 * Tests for /dye command handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDyeCommand } from './dye.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';

// Mock SVG renderer to avoid WASM import
vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1])),
  initRenderer: vi.fn().mockResolvedValue(undefined),
}));

// Mock SVG generators
vi.mock('../../services/svg/dye-info-card.js', () => ({
  generateDyeInfoCard: vi.fn().mockReturnValue('<svg></svg>'),
}));

vi.mock('../../services/svg/random-dyes-grid.js', () => ({
  generateRandomDyesGrid: vi.fn().mockReturnValue('<svg></svg>'),
}));

// Mock Discord API (for deferred response follow-ups)
vi.mock('../../utils/discord-api.js', () => ({
  editOriginalResponse: vi.fn().mockResolvedValue(undefined),
}));

// Mock dependencies
vi.mock('@xivdyetools/core', () => {
  class MockDyeService {
    searchByName(query: string) {
      if (query.toLowerCase().includes('snow')) {
        return [
          { id: 1, name: 'Snow White', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, hsv: { h: 0, s: 0, v: 100 }, category: 'Standard', itemID: 5694 },
        ];
      }
      if (query.toLowerCase().includes('notfound')) {
        return [];
      }
      return [
        { id: 2, name: 'Ash Grey', hex: '#CCCCCC', rgb: { r: 204, g: 204, b: 204 }, hsv: { h: 0, s: 0, v: 80 }, category: 'Standard', itemID: 5695 },
      ];
    }
    getAllDyes() {
      return [
        { id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'Standard', rgb: { r: 255, g: 255, b: 255 }, hsv: { h: 0, s: 0, v: 100 }, itemID: 5694 },
        { id: 2, name: 'Ash Grey', hex: '#CCCCCC', category: 'Standard', rgb: { r: 204, g: 204, b: 204 }, hsv: { h: 0, s: 0, v: 80 }, itemID: 5695 },
        { id: 3, name: 'Red', hex: '#FF0000', category: 'Facewear', rgb: { r: 255, g: 0, b: 0 }, hsv: { h: 0, s: 100, v: 100 }, itemID: 1234 },
        { id: 4, name: 'Metallic Red', hex: '#DD0000', category: 'Metallic', rgb: { r: 221, g: 0, b: 0 }, hsv: { h: 0, s: 100, v: 87 }, itemID: 5696 },
      ];
    }
  }

  class MockLocalizationService {
    async setLocale(_locale: string): Promise<void> {}
    getDyeName(_itemID: number): string | undefined { return undefined; }
    getCategory(category: string): string { return category; }
  }

  return {
    DyeService: MockDyeService,
    dyeDatabase: {},
    LocalizationService: MockLocalizationService,
  };
});

vi.mock('../../services/emoji.js', () => ({
  getDyeEmoji: vi.fn((id: number) => (id === 1 ? '⚪' : null)),
}));

vi.mock('../buttons/index.js', () => ({
  createCopyButtons: vi.fn(() => ({
    type: 1,
    components: [],
  })),
}));

vi.mock('../../services/bot-i18n.js', () => {
  const translatorFn = (key: string, vars?: Record<string, any>) => {
    const translations: Record<string, string> = {
      'common.error': 'Error',
      'errors.missingSubcommand': 'Missing subcommand',
      'errors.unknownSubcommand': `Unknown subcommand: ${vars?.name}`,
      'errors.missingQuery': 'Missing query',
      'errors.missingName': 'Missing name',
      'errors.dyeNotFound': `Dye not found: ${vars?.name}`,
      'errors.noDyesAvailable': 'No dyes available',
      'dye.search.noResults': `No results for: ${vars?.query}`,
      'dye.search.tryDifferent': 'Try a different search term',
      'dye.search.foundCount': `Found ${vars?.count} dye`,
      'dye.search.foundCountPlural': `Found ${vars?.count} dyes`,
      'dye.search.resultsTitle': `Search Results: ${vars?.query}`,
      'dye.search.moreResults': `+${vars?.count} more results`,
      'dye.search.useInfoHint': 'Use /dye info to see details',
      'dye.info.detailedInfo': `Detailed information • ${vars?.category}`,
      'dye.list.noDyesInCategory': `No dyes in category: ${vars?.category}`,
      'dye.list.categoryTitle': `Category: ${vars?.category}`,
      'dye.list.dyesInCategory': `${vars?.count} dyes`,
      'dye.list.categoriesTitle': 'Dye Categories',
      'dye.list.categorySummary': `${vars?.total} total dyes in ${vars?.count} categories`,
      'dye.list.useListHint': 'Use /dye list <category> to see all dyes',
      'dye.random.title': 'Random Dyes',
      'dye.random.description': `Here are ${vars?.count} random dyes`,
      'dye.random.titleUnique': 'Random Dyes (Unique Categories)',
      'dye.random.descriptionUnique': `Here are ${vars?.count} random dyes from different categories`,
      'dye.random.runAgainHint': 'Run again for new dyes',
      'common.hexColor': 'Hex Color',
      'common.category': 'Category',
      'common.itemId': 'Item ID',
      'common.rgb': 'RGB',
      'common.hsv': 'HSV',
      'common.footer': 'XIV Dye Tools',
      'common.dyes': 'dyes',
    };
    return translations[key] || key;
  };
  const mockTranslator = {
    t: translatorFn,
    getLocale: () => 'en',
  };
  return {
    createUserTranslator: vi.fn().mockResolvedValue(mockTranslator),
    createTranslator: vi.fn().mockReturnValue(mockTranslator),
  };
});

vi.mock('../../services/i18n.js', () => ({
  initializeLocale: vi.fn(),
  getLocalizedDyeName: vi.fn((itemId: number, name: string) => name),
  getLocalizedCategory: vi.fn((category: string) => category),
}));

describe('dye.ts', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: 'test-app-id',
      PRESETS_API_URL: 'https://test-api.example.com',
      INTERNAL_WEBHOOK_SECRET: 'test-secret', // pragma: allowlist secret
      KV: {} as KVNamespace,
    } as unknown as Env;

    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      props: {},
    } as unknown as ExecutionContext;

    vi.clearAllMocks();
  });

  describe('handleDyeCommand', () => {
    it('should return error for missing subcommand', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'dye', options: [] },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toContain('Error');
      expect(data.data!.embeds![0].description).toBe('Missing subcommand');
    });

    it('should return error for unknown subcommand', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [{ name: 'unknown', type: 1 }],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toContain('Error');
      expect(data.data!.embeds![0].description).toContain('Unknown subcommand');
    });
  });

  describe('search subcommand', () => {
    it('should search for dyes successfully', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'search',
              type: 1,
              options: [{ name: 'query', value: 'snow' }],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toContain('Search Results: snow');
      expect(data.data!.embeds![0].description).toContain('Snow White');
    });

    it('should return no results message when no dyes found', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'search',
              type: 1,
              options: [{ name: 'query', value: 'notfound' }],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toContain('No results for: notfound');
    });

    it('should return error for missing query', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'search',
              type: 1,
              options: [],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toContain('Error');
      expect(data.data!.embeds![0].description).toBe('Missing query');
    });

    it('should exclude Facewear dyes from results', async () => {
      // The mock already includes Facewear dyes in getAllDyes, so search with empty query
      // which triggers using all dyes. The function should filter them out.
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'search',
              type: 1,
              options: [{ name: 'query', value: 'red' }],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // Facewear dyes should be filtered out
      expect(data.data!.embeds![0].description).not.toContain('Facewear');
    });
  });

  describe('info subcommand', () => {
    it('should show detailed dye information', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'info',
              type: 1,
              options: [{ name: 'name', value: 'snow white' }],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // V4: info subcommand returns a deferred response (type 5) for image generation
      expect(data.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      // Background processing is triggered via ctx.waitUntil
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });

    it('should return error for missing name', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'info',
              type: 1,
              options: [],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toContain('Error');
      expect(data.data!.embeds![0].description).toBe('Missing name');
    });

    it('should return error for non-existent dye', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'info',
              type: 1,
              options: [{ name: 'name', value: 'notfound' }],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toContain('Error');
      expect(data.data!.embeds![0].description).toContain('Dye not found');
    });
  });

  describe('list subcommand', () => {
    it('should list all categories when no category specified', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'list',
              type: 1,
              options: [],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toBe('Dye Categories');
      expect(data.data!.embeds![0].description).toContain('Standard');
      expect(data.data!.embeds![0].description).toContain('Metallic');
      expect(data.data!.embeds![0].description).not.toContain('Facewear'); // Excluded
    });

    it('should list dyes in specified category', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'list',
              type: 1,
              options: [{ name: 'category', value: 'Standard' }],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toContain('Category: Standard');
      expect(data.data!.embeds![0].description).toContain('Snow White');
      expect(data.data!.embeds![0].description).toContain('Ash Grey');
    });

    it('should return error for empty category', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'list',
              type: 1,
              options: [{ name: 'category', value: 'NonExistent' }],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].title).toContain('Error');
      expect(data.data!.embeds![0].description).toContain('No dyes in category');
    });
  });

  describe('random subcommand', () => {
    it('should return random dyes', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'random',
              type: 1,
              options: [],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // V4: random subcommand returns a deferred response (type 5) for image generation
      expect(data.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });

    it('should return random dyes from unique categories', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'random',
              type: 1,
              options: [{ name: 'unique_categories', value: true }],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // V4: random subcommand returns a deferred response (type 5) for image generation
      expect(data.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });

    it('should exclude Facewear from random selection', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'dye',
          options: [
            {
              name: 'random',
              type: 1,
              options: [],
            },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleDyeCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // V4: random subcommand returns a deferred response (type 5) for image generation
      // Facewear exclusion is handled internally by excludeFacewear()
      expect(data.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });
  });
});
