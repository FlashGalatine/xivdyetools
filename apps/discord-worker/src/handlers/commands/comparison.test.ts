/**
 * Tests for /comparison command handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleComparisonCommand } from './comparison.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';

// Mock dependencies
vi.mock('@xivdyetools/core', () => {
  class MockDyeService {
    searchByName(query: string) {
      if (query.toLowerCase().includes('snow')) {
        return [{
          id: 1,
          name: 'Snow White',
          hex: '#FFFFFF',
          rgb: { r: 255, g: 255, b: 255 },
          hsv: { h: 0, s: 0, v: 100 },
          category: 'Standard',
          itemID: 5694,
        }];
      }
      if (query.toLowerCase().includes('soot')) {
        return [{
          id: 2,
          name: 'Soot Black',
          hex: '#1A1A1A',
          rgb: { r: 26, g: 26, b: 26 },
          hsv: { h: 0, s: 0, v: 10 },
          category: 'Standard',
          itemID: 5695,
        }];
      }
      if (query.toLowerCase().includes('facewear')) {
        return [{
          id: 99,
          name: 'Facewear Red',
          hex: '#FF0000',
          rgb: { r: 255, g: 0, b: 0 },
          category: 'Facewear',
        }];
      }
      if (query.toLowerCase().includes('notfound')) {
        return [];
      }
      return [{
        id: 3,
        name: query,
        hex: '#FF5733',
        rgb: { r: 255, g: 87, b: 51 },
        hsv: { h: 11, s: 80, v: 100 },
        category: 'Standard',
        itemID: 5696,
      }];
    }
    findClosestDye(hex: string) {
      return {
        id: 10,
        name: 'Closest Dye',
        hex,
        rgb: { r: 255, g: 87, b: 51 },
        hsv: { h: 11, s: 80, v: 100 },
        category: 'Standard',
        itemID: 5697,
      };
    }
  }

  return {
    DyeService: MockDyeService,
    dyeDatabase: {},
  };
});

vi.mock('../../services/bot-i18n.js', () => ({
  createUserTranslator: vi.fn().mockResolvedValue({
    t: (key: string, vars?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'common.error': 'Error',
        'errors.missingInput': 'Please provide at least two dyes to compare',
        'errors.invalidColor': `Could not find dye or parse color: ${vars?.input}`,
        'errors.generationFailed': 'Failed to generate comparison image',
        'comparison.title': 'Dye Comparison',
        'common.footer': 'XIV Dye Tools',
      };
      return translations[key] || key;
    },
    getLocale: () => 'en',
  }),
  createTranslator: vi.fn((locale: string) => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'common.error': 'Error',
        'errors.generationFailed': 'Failed to generate comparison image',
        'comparison.title': 'Dye Comparison',
        'common.footer': 'XIV Dye Tools',
      };
      return translations[key] || key;
    },
    getLocale: () => locale,
  })),
}));

vi.mock('../../services/i18n.js', () => ({
  initializeLocale: vi.fn(),
  getLocalizedDyeName: vi.fn((itemId: number, name: string) => name),
}));

vi.mock('../../services/svg/comparison-grid.js', () => ({
  generateComparisonGrid: vi.fn().mockReturnValue('<svg>comparison</svg>'),
}));

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

vi.mock('../../services/emoji.js', () => ({
  getDyeEmoji: vi.fn((id: number) => (id === 1 ? '⚪' : id === 2 ? '⬛' : null)),
}));

vi.mock('../../utils/discord-api.js', () => ({
  editOriginalResponse: vi.fn().mockResolvedValue({ ok: true }),
}));

import { editOriginalResponse } from '../../utils/discord-api.js';
import { generateComparisonGrid } from '../../services/svg/comparison-grid.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';

describe('comparison.ts', () => {
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
    it('should return error for missing dye inputs', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: 'snow white', type: 3 },
            // Missing dye2
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(4);
      expect(data.data!.embeds![0].title).toContain('Error');
      expect(data.data!.embeds![0].description).toContain('Please provide');
      expect(data.data!.flags).toBe(64);
    });

    it('should return error when no dye1 provided', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(4);
      expect(data.data!.flags).toBe(64);
    });

    it('should return error for invalid color input', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: 'notfound', type: 3 },
            { name: 'dye2', value: 'snow white', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(4);
      expect(data.data!.embeds![0].description).toContain('notfound');
      expect(data.data!.flags).toBe(64);
    });

    it('should return error for multiple invalid inputs', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: 'notfound1', type: 3 },
            { name: 'dye2', value: 'notfound2', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(4);
      expect(data.data!.embeds![0].description).toContain('notfound1');
      expect(data.data!.embeds![0].description).toContain('notfound2');
    });
  });

  describe('successful comparison', () => {
    it('should defer response for two valid dyes', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
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

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });

    it('should process comparison in background', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
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

      await handleComparisonCommand(interaction, mockEnv, mockCtx);
      await Promise.all(waitUntilPromises);

      expect(generateComparisonGrid).toHaveBeenCalledWith(
        expect.objectContaining({
          dyes: expect.arrayContaining([
            expect.objectContaining({ name: 'Snow White' }),
            expect.objectContaining({ name: 'Soot Black' }),
          ]),
          width: 800,
          showHsv: true,
        })
      );
      expect(renderSvgToPng).toHaveBeenCalled();
      expect(editOriginalResponse).toHaveBeenCalled();
    });

    it('should accept hex colors', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: '#FF0000', type: 3 },
            { name: 'dye2', value: '#00FF00', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5);
    });

    it('should accept hex colors without # prefix', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: 'FF0000', type: 3 },
            { name: 'dye2', value: '00FF00', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5);
    });

    it('should handle three dyes', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: 'snow white', type: 3 },
            { name: 'dye2', value: 'soot black', type: 3 },
            { name: 'dye3', value: 'test', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5);
    });

    it('should handle four dyes', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
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

      await handleComparisonCommand(interaction, mockEnv, mockCtx);
      await Promise.all(waitUntilPromises);

      expect(generateComparisonGrid).toHaveBeenCalledWith(
        expect.objectContaining({
          dyes: expect.arrayContaining([
            expect.any(Object),
            expect.any(Object),
            expect.any(Object),
            expect.any(Object),
          ]),
        })
      );
    });

    it('should handle member.user.id for guild interactions', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: 'snow white', type: 3 },
            { name: 'dye2', value: 'soot black', type: 3 },
          ],
        },
        member: { user: { id: 'user-456' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(5);
    });

    it('should reject Facewear dye when searching by name', async () => {
      // Facewear dyes are excluded from color resolution, so searching
      // for 'facewear' should return an error for invalid color
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: 'snow white', type: 3 },
            { name: 'dye2', value: 'facewear', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // Should return an immediate error response (type 4) because
      // Facewear dyes are excluded from color resolution
      expect(data.type).toBe(4);
      expect(data.data?.embeds?.[0]?.description).toContain('Could not find');
    });
  });

  describe('error handling', () => {
    it('should handle render errors gracefully', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValueOnce(new Error('Render failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
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

      await handleComparisonCommand(interaction, mockEnv, mockCtx);
      await Promise.all(waitUntilPromises);

      expect(editOriginalResponse).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('Failed'),
            }),
          ]),
        })
      );

      consoleSpy.mockRestore();
    });

    it('should handle generateComparisonGrid errors gracefully', async () => {
      vi.mocked(generateComparisonGrid).mockImplementationOnce(() => {
        throw new Error('SVG generation failed');
      });

      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
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

      await handleComparisonCommand(interaction, mockEnv, mockCtx);
      await Promise.all(waitUntilPromises);

      // Errors are logged via structured logger (when provided), not console.error
      // Verify the error response is still sent to Discord
      expect(editOriginalResponse).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Error'),
            }),
          ]),
        })
      );
    });
  });

  describe('locale handling', () => {
    it('should use user locale from interaction', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: 'snow white', type: 3 },
            { name: 'dye2', value: 'soot black', type: 3 },
          ],
        },
        user: { id: 'user-123' },
        locale: 'de',
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      await handleComparisonCommand(interaction, mockEnv, mockCtx);

      const { createUserTranslator } = await import('../../services/bot-i18n.js');
      expect(createUserTranslator).toHaveBeenCalledWith(
        mockEnv.KV,
        'user-123',
        'de'
      );
    });

    it('should handle missing user info gracefully', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'comparison',
          options: [
            { name: 'dye1', value: 'snow white', type: 3 },
            { name: 'dye2', value: 'soot black', type: 3 },
          ],
        },
        // No user or member
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleComparisonCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // Should still work with 'unknown' user ID
      expect(data.type).toBe(5);
    });
  });
});
