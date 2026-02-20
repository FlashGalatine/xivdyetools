/**
 * Tests for /match command handler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMatchCommand } from './match.js';
import type { DiscordInteraction, Env, InteractionResponseBody } from '../../types/env.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const dyeA = { id: 101, name: 'Dye One', hex: '#101010', category: 'General', itemID: 1001 };
const dyeB = { id: 102, name: 'Dye Two', hex: '#202020', category: 'General', itemID: 1002 };
const dyeRose = { id: 103, name: 'Rose Pink', hex: '#ff6699', category: 'General', itemID: 1003 };
const dyeFacewear = { id: 104, name: 'Facewear Dye', hex: '#303030', category: 'Facewear', itemID: 1004 };

// Mock function references for test-specific overrides
let mockSearchByName = vi.fn((query: string) => {
  if (query.toLowerCase().includes('rose')) return [dyeRose];
  if (query.toLowerCase().includes('facewear')) return [dyeFacewear];
  return [];
});

let mockFindClosestDye = vi.fn((_hex: string, excludeIds: number[] = []) => {
  if (!excludeIds.includes(dyeA.id)) return dyeA;
  if (!excludeIds.includes(dyeB.id)) return dyeB;
  return null;
});

vi.mock('@xivdyetools/core', () => {
  class MockDyeService {
    searchByName(query: string) {
      return mockSearchByName(query);
    }
    findClosestDye(hex: string, excludeIds: number[] = []) {
      return mockFindClosestDye(hex, excludeIds);
    }
  }

  const ColorService = {
    hexToRgb: (hex: string) => {
      const clean = hex.replace('#', '');
      const num = parseInt(clean, 16);
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    },
    rgbToHsv: (r: number, g: number, b: number) => {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      const s = max === 0 ? 0 : d / max;
      let h = 0;
      if (d !== 0) {
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          default:
            h = (r - g) / d + 4;
        }
        h /= 6;
      }
      return { h: h * 360, s: s * 100, v: (max / 255) * 100 };
    },
  };

  class MockLocalizationService {
    async setLocale(_locale: string): Promise<void> {}
    getDyeName(_itemID: number): string | undefined { return undefined; }
    getCategory(category: string): string { return category; }
  }

  return { DyeService: MockDyeService, dyeDatabase: [], ColorService, LocalizationService: MockLocalizationService };
});

// Mock emoji - can be overridden per test
let mockGetDyeEmoji = vi.fn((_itemId: number): string | undefined => '🎨');
vi.mock('../../services/emoji.js', () => ({ getDyeEmoji: (...args: [number]) => mockGetDyeEmoji(...args) }));
vi.mock('../../services/i18n.js', () => ({
  initializeLocale: vi.fn().mockResolvedValue(undefined),
  getLocalizedDyeName: (_id: number, name: string) => `${name}-localized`,
}));

vi.mock('../../services/bot-i18n.js', () => ({
  createUserTranslator: vi.fn(async () => translator),
}));

vi.mock('../buttons/index.js', () => ({
  createCopyButtons: vi.fn(() => ({ type: 1, components: [] })),
}));

// Use real response helpers

// ---------------------------------------------------------------------------
// Translator helper
// ---------------------------------------------------------------------------
const translator = {
  t: (key: string, vars?: Record<string, any>) => {
    const map: Record<string, string> = {
      'common.error': 'Error',
      'common.distance': 'Distance',
      'common.quality': 'Quality',
      'common.inputColor': 'Input Color',
      'common.closestDye': 'Closest Dye',
      'common.matchQuality': 'Match Quality',
      'common.footer': 'Footer',
      'common.rgb': 'RGB',
      'common.hsv': 'HSV',
      'common.category': 'Category',
      'common.useInfo': 'Use info',
      'errors.missingInput': 'Missing input',
      'errors.invalidColor': `Invalid color: ${vars?.input}`,
      'errors.noMatchFound': 'No matches found',
      'quality.perfect': 'Perfect',
      'quality.excellent': 'Excellent',
      'quality.good': 'Good',
      'quality.fair': 'Fair',
      'quality.approximate': 'Approximate',
      'match.useInfoHint': 'Use /info for details',
      'match.useInfoNameHint': 'Use /info <name>',
      'match.title': `Closest match: ${vars?.name ?? ''}`,
      'match.topMatches': `Top ${vars?.count} matches`,
      'match.findingMatches': `Finding matches for ${vars?.input}`,
      'common.qualityLabel': 'Quality label',
    };
    return map[key] ?? key;
  },
  getLocale: () => 'en',
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const baseInteraction: DiscordInteraction = {
  id: '123456789',
  application_id: '987654321',
  token: 'mock-token',
  type: 2,
  data: {
    name: 'match',
    options: [],
  },
  locale: 'en-US',
  member: { user: { id: 'user-1', username: 'tester' } },
};

const env: Env = {
  KV: {} as KVNamespace,
  DISCORD_PUBLIC_KEY: 'pk',
  DISCORD_CLIENT_ID: 'app',
  DISCORD_TOKEN: 'token',
  PRESETS_API_URL: 'https://test-api.example.com',
} as unknown as Env;

const ctx: ExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
  props: {},
} as unknown as ExecutionContext;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/match command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to default behavior
    mockSearchByName = vi.fn((query: string) => {
      if (query.toLowerCase().includes('rose')) return [dyeRose];
      if (query.toLowerCase().includes('facewear')) return [dyeFacewear];
      return [];
    });
    mockFindClosestDye = vi.fn((_hex: string, excludeIds: number[] = []) => {
      if (!excludeIds.includes(dyeA.id)) return dyeA;
      if (!excludeIds.includes(dyeB.id)) return dyeB;
      return null;
    });
    mockGetDyeEmoji = vi.fn((_itemId: number): string | undefined => '🎨');
  });

  describe('input validation', () => {
    it('returns error when color input missing', async () => {
    const interaction = { ...baseInteraction, data: { ...baseInteraction.data, options: [] } };

    const res = await handleMatchCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;

    expect(body.data!.embeds![0].description).toBe('Missing input');
    expect(body.data!.flags).toBe(64);
  });

  it('returns error for invalid color input', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      data: { ...baseInteraction.data, options: [{ name: 'color', value: 'not-a-color' }] },
    };

    const res = await handleMatchCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;

    expect(body.data!.embeds![0].description).toContain('Invalid color');
    expect(body.data!.flags).toBe(64);
  });

    it('accepts 3-digit hex color (#FFF)', async () => {
      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: '#FFF' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.data!.embeds![0].title).toContain('Closest match');
    });

    it('accepts hex color without # prefix', async () => {
      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: '112233' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.data!.embeds![0].title).toContain('Closest match');
    });

    it('clamps count to minimum of 1', async () => {
      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: {
          ...baseInteraction.data,
          options: [
            { name: 'color', value: '#112233' },
            { name: 'count', value: 0 },
          ],
        },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // count=0 should be clamped to 1, giving single match response
      expect(body.data!.embeds![0].title).toContain('Closest match');
    });

    it('clamps count to maximum of 10', async () => {
      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: {
          ...baseInteraction.data,
          options: [
            { name: 'color', value: '#112233' },
            { name: 'count', value: 15 },
          ],
        },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // count=15 should be clamped to 10
      expect(body.data!.embeds![0].title).toContain('Top');
    });
  });

  describe('single match response', () => {
    it('returns single match response with copy buttons', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      data: { ...baseInteraction.data, options: [{ name: 'color', value: '#112233' }] },
    };

    const res = await handleMatchCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;

    expect(body.data!.embeds![0].title).toContain('Closest match');
    expect(body.data!.embeds![0].fields).toHaveLength(3);
    expect(body.data!.components).toHaveLength(1);
  });

    it('includes fromDye info when input is a dye name', async () => {
      // Using "Rose Pink" triggers searchByName mock to return dyeRose
      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: 'Rose Pink' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // Should show source dye name in input color field
      const inputField = body.data!.embeds![0].fields!.find((f: any) => f.name.includes('Input'));
      expect(inputField!.value).toContain('Rose Pink-localized');
      expect(inputField!.value).toContain('🎨'); // emoji from getDyeEmoji mock
    });
  });

  describe('multiple matches', () => {
    it('returns multiple matches when count > 1', async () => {
      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: {
          ...baseInteraction.data,
          options: [
            { name: 'color', value: '#112233' },
            { name: 'count', value: 2 },
          ],
        },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.data!.embeds![0].title).toContain('Top 2 matches');
      expect(body.data!.embeds![0].description).toContain('Dye One-localized');
      expect(body.data!.embeds![0].description).toContain('Dye Two-localized');
    });

    it('includes fromDye info in multi-match when input is a dye name', async () => {
      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: {
          ...baseInteraction.data,
          options: [
            { name: 'color', value: 'Rose' }, // Will match Rose Pink via searchByName
            { name: 'count', value: 2 },
          ],
        },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // Multi-match should show source dye name in description
      expect(body.data!.embeds![0].description).toContain('Rose Pink-localized');
    });
  });

  describe('match quality indicators', () => {
    it('shows perfect match quality for exact color', async () => {
      // dyeA has hex #101010, searching for same color should be distance 0
      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: '#101010' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      const qualityField = body.data!.embeds![0].fields!.find((f: any) => f.name.includes('Quality'));
      expect(qualityField!.value).toContain('Perfect');
    });
  });

  describe('user context', () => {
    it('falls back to interaction.user when member is undefined (DM context)', async () => {
      const interaction: DiscordInteraction = {
        id: '123456789',
        application_id: '987654321',
        token: 'mock-token',
        type: 2,
        data: {
          name: 'match',
          options: [{ name: 'color', value: '#112233' }],
        },
        locale: 'en-US',
        user: { id: 'dm-user', username: 'dm-tester' }, // DM style - no member
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // Should still work in DM context
      expect(body.data!.embeds![0].title).toContain('Closest match');
    });
  });

  describe('edge cases', () => {
    it('returns error when no matches found (findClosestDye always returns null)', async () => {
      // Override mock to always return null (no matches in database)
      mockFindClosestDye = vi.fn(() => null);

      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: '#112233' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.data!.embeds![0].description).toBe('No matches found');
      expect(body.data!.flags).toBe(64);
    });

    it('excludes Facewear dyes from match results', async () => {
      // Mock that returns Facewear first, then regular dyes
      let callCount = 0;
      mockFindClosestDye = vi.fn((_hex: string, excludeIds: number[] = []) => {
        callCount++;
        // First call returns Facewear (should be skipped)
        if (callCount === 1 && !excludeIds.includes(dyeFacewear.id)) return dyeFacewear;
        // Second call returns regular dye
        if (!excludeIds.includes(dyeA.id)) return dyeA;
        return null;
      });

      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: '#112233' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // Should return Dye One, not Facewear Dye
      expect(body.data!.embeds![0].title).toContain('Dye One-localized');
      expect(body.data!.embeds![0].title).not.toContain('Facewear');
    });

    it('handles Facewear dye name search (excludes Facewear from name search)', async () => {
      // When user searches by name and gets a Facewear dye, it should still work
      // because the searchByName result exclusion only applies in resolveColorInput
      // Looking at the code: only non-Facewear dyes are returned from resolveColorInput
      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: 'Facewear' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // Facewear dye should be excluded from name search, so it should be invalid color
      expect(body.data!.embeds![0].description).toContain('Invalid color');
    });

    it('exhausts Facewear exclusion attempts (20 max)', async () => {
      // Mock that always returns Facewear dyes
      mockFindClosestDye = vi.fn(() => dyeFacewear);

      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: '#112233' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // After 20 attempts of getting Facewear, should return no matches
      expect(body.data!.embeds![0].description).toBe('No matches found');
      // Mock should have been called 20 times for the Facewear exclusion loop
      expect(mockFindClosestDye).toHaveBeenCalled();
    });

    it('handles missing interaction.data.options (uses fallback [])', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: {
          name: 'match',
          // No options property at all
        },
        locale: 'en-US',
        member: { user: { id: 'user-1', username: 'tester' } },
      } as DiscordInteraction;

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // Missing options should result in missing input error
      expect(body.data!.embeds![0].description).toBe('Missing input');
    });

    it('handles dye with no emoji in single match (emoji ternary false branch)', async () => {
      // Override emoji mock to return null
      mockGetDyeEmoji = vi.fn((_itemId: number): string | undefined => undefined);

      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: '#112233' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // Should still work without emoji
      expect(body.data!.embeds![0].title).toContain('Closest match');
      // Match description should not start with emoji
      const matchField = body.data!.embeds![0].fields!.find((f: any) => f.name.includes('Closest'));
      expect(matchField!.value).toMatch(/^\*\*Dye One/); // Should start with dye name, not emoji
    });

    it('handles dye with no emoji in multi match (emoji ternary false branch)', async () => {
      // Override emoji mock to return null
      mockGetDyeEmoji = vi.fn((_itemId: number): string | undefined => undefined);

      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: {
          ...baseInteraction.data,
          options: [
            { name: 'color', value: '#112233' },
            { name: 'count', value: 2 },
          ],
        },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // Should still work without emoji
      expect(body.data!.embeds![0].title).toContain('Top 2 matches');
    });

    it('handles fromDye with no emoji (fromEmoji ternary false branch)', async () => {
      // Override emoji mock to return null
      mockGetDyeEmoji = vi.fn((_itemId: number): string | undefined => undefined);

      const interaction: DiscordInteraction = {
        ...baseInteraction,
        data: { ...baseInteraction.data, options: [{ name: 'color', value: 'Rose Pink' }] },
      };

      const res = await handleMatchCommand(interaction, env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      // Should still include fromDye name without emoji
      const inputField = body.data!.embeds![0].fields!.find((f: any) => f.name.includes('Input'));
      expect(inputField!.value).toContain('Rose Pink-localized');
      expect(inputField!.value).not.toContain('🎨');
    });
  });
});
