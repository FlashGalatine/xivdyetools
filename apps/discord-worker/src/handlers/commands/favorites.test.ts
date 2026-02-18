/**
 * Tests for /favorites command handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFavoritesCommand } from './favorites.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';
import { DyeService } from '@xivdyetools/core';

// Mock dependencies
vi.mock('@xivdyetools/core', async () => {
  const actual = await vi.importActual('@xivdyetools/core');

  // Mock DyeService
  class MockDyeService {
    searchByName(query: string) {
      if (query.toLowerCase().includes('snow')) {
        return [{ id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'General', itemID: 5721 }];
      }
      return [];
    }

    getDyeById(id: number) {
      const dyes: Record<number, any> = {
        1: { id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'General', itemID: 5721 },
        2: { id: 2, name: 'Soot Black', hex: '#000000', category: 'General', itemID: 5722 },
        3: { id: 3, name: 'Rose Pink', hex: '#FF66CC', category: 'General', itemID: 5723 },
      };
      return dyes[id] || null;
    }

    findClosestDye(hex: string) {
      if (hex.toUpperCase() === '#FFFFFF') {
        return { id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'General', itemID: 5721 };
      }
      return { id: 2, name: 'Soot Black', hex: '#000000', category: 'General', itemID: 5722 };
    }
  }

  return {
    ...actual,
    DyeService: MockDyeService,
    dyeDatabase: [],
  };
});

vi.mock('../../services/user-storage.js');
vi.mock('../../services/emoji.js');
vi.mock('../../services/bot-i18n.js');
vi.mock('../../services/i18n.js');

// Import modules (response helpers are NOT mocked)
import { ephemeralResponse } from '../../utils/response.js';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  clearFavorites,
  MAX_FAVORITES,
} from '../../services/user-storage.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createUserTranslator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, getLocalizedCategory } from '../../services/i18n.js';

describe('/favorites command', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  // Mock translator
  const mockTranslator = {
    t: (key: string, vars?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'errors.missingSubcommand': 'Missing subcommand',
        'errors.unknownSubcommand': `Unknown subcommand: ${vars?.name}`,
        'errors.missingName': 'Please specify a dye',
        'errors.dyeNotFound': `Dye not found: ${vars?.name}`,
        'errors.failedToSave': 'Failed to save',
        'errors.failedToReset': 'Failed to reset',
        'common.error': 'Error',
        'common.success': 'Success',
        'favorites.alreadyFavorite': `${vars?.name} is already a favorite`,
        'favorites.limitReached': `Limit reached (max ${vars?.max})`,
        'favorites.added': `Added ${vars?.name} to favorites`,
        'favorites.removed': `Removed ${vars?.name} from favorites`,
        'favorites.notInFavorites': `${vars?.name} is not in favorites`,
        'favorites.title': 'Favorite Dyes',
        'favorites.empty': 'No favorites yet',
        'favorites.addHint': 'Use /favorites add to add dyes',
        'favorites.count': `${vars?.count} / ${vars?.max}`,
        'favorites.cleared': 'All favorites cleared',
      };
      return translations[key] || key;
    },
    getLocale: () => 'en',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv = {
      KV: {} as KVNamespace,
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_CLIENT_ID: 'test-app-id',
      DISCORD_TOKEN: 'test-token',
      PRESETS_API_URL: 'https://test-api.example.com',
    } as unknown as Env;

    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      props: {},
    } as unknown as ExecutionContext;

    // Setup mocks
    vi.mocked(createUserTranslator).mockResolvedValue(mockTranslator as any);
    vi.mocked(initializeLocale).mockResolvedValue(undefined);
    vi.mocked(getLocalizedDyeName).mockImplementation((_id: number, name: string) => name);
    vi.mocked(getLocalizedCategory).mockImplementation((cat: string) => cat);
    vi.mocked(getDyeEmoji).mockReturnValue('🎨');
  });

  describe('Missing user ID', () => {
    it('should return error when user ID is missing', async () => {
      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [{ type: 1, name: 'add', options: [] }],
        },
        locale: 'en-US',
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('Could not identify user');
      expect(data.data!.flags).toBe(64); // Ephemeral flag
    });
  });

  describe('Missing subcommand', () => {
    it('should return error when no subcommand provided', async () => {
      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('subcommand');
    });
  });

  describe('Unknown subcommand', () => {
    it('should return error for unknown subcommand', async () => {
      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [{ type: 1, name: 'unknown', options: [] }],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('Unknown subcommand');
    });
  });

  describe('/favorites add', () => {
    it('should add a dye to favorites by name', async () => {
      vi.mocked(addFavorite).mockResolvedValue({ success: true });

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [
            {
              type: 1,
              name: 'add',
              options: [{ name: 'dye', value: 'Snow White' }],
            },
          ],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(addFavorite).toHaveBeenCalledWith(mockEnv.KV, 'user-123', 1);
      expect(data.data!.embeds![0].description).toContain('Added Snow White to favorites');
    });

    it('should add a dye by hex color', async () => {
      vi.mocked(addFavorite).mockResolvedValue({ success: true });

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [
            {
              type: 1,
              name: 'add',
              options: [{ name: 'dye', value: '#FFFFFF' }],
            },
          ],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(addFavorite).toHaveBeenCalledWith(mockEnv.KV, 'user-123', 1);
      expect(data.data!.embeds![0].description).toContain('Added Snow White to favorites');
    });

    it('should return error when dye option is missing', async () => {
      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [{ type: 1, name: 'add', options: [] }],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toBe('Please specify a dye');
    });

    it('should return error when dye is not found', async () => {
      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [
            {
              type: 1,
              name: 'add',
              options: [{ name: 'dye', value: 'NonexistentDye' }],
            },
          ],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('Dye not found');
    });

    it('should return info message when dye already in favorites', async () => {
      vi.mocked(addFavorite).mockResolvedValue({ success: false, reason: 'alreadyExists' });

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [
            {
              type: 1,
              name: 'add',
              options: [{ name: 'dye', value: 'Snow White' }],
            },
          ],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('is already in your favorites');
    });

    it('should return error when favorite limit reached', async () => {
      vi.mocked(addFavorite).mockResolvedValue({ success: false, reason: 'limitReached' });

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [
            {
              type: 1,
              name: 'add',
              options: [{ name: 'dye', value: 'Snow White' }],
            },
          ],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('Limit reached');
    });

    it('should return error on unknown failure', async () => {
      vi.mocked(addFavorite).mockResolvedValue({ success: false, reason: 'error' });

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [
            {
              type: 1,
              name: 'add',
              options: [{ name: 'dye', value: 'Snow White' }],
            },
          ],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toBe('Failed to save');
    });
  });

  describe('/favorites remove', () => {
    it('should remove a dye from favorites', async () => {
      vi.mocked(removeFavorite).mockResolvedValue(true);

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [
            {
              type: 1,
              name: 'remove',
              options: [{ name: 'dye', value: 'Snow White' }],
            },
          ],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(removeFavorite).toHaveBeenCalledWith(mockEnv.KV, 'user-123', 1);
      expect(data.data!.embeds![0].description).toContain('Removed Snow White from favorites');
    });

    it('should return error when dye option is missing', async () => {
      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [{ type: 1, name: 'remove', options: [] }],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toBe('Please specify a dye');
    });

    it('should return error when dye is not found', async () => {
      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [
            {
              type: 1,
              name: 'remove',
              options: [{ name: 'dye', value: 'NonexistentDye' }],
            },
          ],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('Dye not found');
    });

    it('should return info message when dye not in favorites', async () => {
      vi.mocked(removeFavorite).mockResolvedValue(false);

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [
            {
              type: 1,
              name: 'remove',
              options: [{ name: 'dye', value: 'Snow White' }],
            },
          ],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('is not in your favorites');
    });
  });

  describe('/favorites list', () => {
    it('should list all favorites', async () => {
      vi.mocked(getFavorites).mockResolvedValue([1, 2, 3]);

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [{ type: 1, name: 'list', options: [] }],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(getFavorites).toHaveBeenCalledWith(mockEnv.KV, 'user-123');
      expect(data.data!.embeds![0].description).toContain('Snow White');
      expect(data.data!.embeds![0].description).toContain('Soot Black');
      expect(data.data!.embeds![0].description).toContain('Rose Pink');
    });

    it('should show empty message when no favorites', async () => {
      vi.mocked(getFavorites).mockResolvedValue([]);

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [{ type: 1, name: 'list', options: [] }],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('No favorites yet');
    });
  });

  describe('/favorites clear', () => {
    it('should clear all favorites', async () => {
      vi.mocked(getFavorites).mockResolvedValue([1, 2]);
      vi.mocked(clearFavorites).mockResolvedValue(true);

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [{ type: 1, name: 'clear', options: [] }],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(clearFavorites).toHaveBeenCalledWith(mockEnv.KV, 'user-123');
      expect(data.data!.embeds![0].description).toContain('All favorites cleared');
    });

    it('should show info message when already empty', async () => {
      vi.mocked(getFavorites).mockResolvedValue([]);

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [{ type: 1, name: 'clear', options: [] }],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toContain('No favorites yet');
    });

    it('should return error on clear failure', async () => {
      vi.mocked(getFavorites).mockResolvedValue([1, 2]);
      vi.mocked(clearFavorites).mockResolvedValue(false);

      const interaction: DiscordInteraction = {
        id: 'test-interaction',
        application_id: 'test-app-id',
        token: 'test-token',
        type: 2,
        data: {
          name: 'favorites',
          options: [{ type: 1, name: 'clear', options: [] }],
        },
        locale: 'en-US',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const response = await handleFavoritesCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].description).toBe('Failed to reset');
    });
  });
});
