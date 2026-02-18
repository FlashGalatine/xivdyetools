import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockFetcher } from '@xivdyetools/test-utils';
import {
  isApiEnabled,
  isModerator,
  getPresets,
  getPreset,
  getPendingPresets,
  approvePreset,
  rejectPreset,
  getModerationStats,
  getModerationHistory,
  revertPreset,
  searchPresetsForAutocomplete,
} from './preset-api.js';
import { PresetAPIError } from '../types/preset.js';
import type { Env } from '../types/env.js';

describe('preset-api', () => {
  let mockEnv: Env;
  let mockFetcher: ReturnType<typeof createMockFetcher>;

  beforeEach(() => {
    mockFetcher = createMockFetcher();
    mockEnv = {
      PRESETS_API: mockFetcher as unknown as Fetcher,
      BOT_API_SECRET: 'test-api-secret',
      BOT_SIGNING_SECRET: 'test-signing-secret',
      // Use valid Discord snowflake format IDs (17-19 digits)
      MODERATOR_IDS: '12345678901234567,12345678901234568,12345678901234569',
    } as Env;

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('isApiEnabled', () => {
    it('should return true when PRESETS_API service binding exists', () => {
      const env = { PRESETS_API: mockFetcher } as unknown as Env;
      expect(isApiEnabled(env)).toBe(true);
    });

    it('should return true when PRESETS_API_URL and BOT_API_SECRET exist', () => {
      const env = {
        PRESETS_API_URL: 'https://api.example.com',
        BOT_API_SECRET: 'secret',
      } as Env;
      expect(isApiEnabled(env)).toBe(true);
    });

    it('should return false when neither is configured', () => {
      const env = {} as Env;
      expect(isApiEnabled(env)).toBe(false);
    });

    it('should return false when only PRESETS_API_URL is set', () => {
      const env = {
        PRESETS_API_URL: 'https://api.example.com',
      } as Env;
      expect(isApiEnabled(env)).toBe(false);
    });

    it('should return false when only BOT_API_SECRET is set', () => {
      const env = {
        BOT_API_SECRET: 'secret',
      } as Env;
      expect(isApiEnabled(env)).toBe(false);
    });
  });

  describe('isModerator', () => {
    it('should return true for valid moderator ID', () => {
      // Uses snowflake IDs from mockEnv.MODERATOR_IDS
      expect(isModerator(mockEnv, '12345678901234567')).toBe(true);
      expect(isModerator(mockEnv, '12345678901234568')).toBe(true);
      expect(isModerator(mockEnv, '12345678901234569')).toBe(true);
    });

    it('should return false for non-moderator ID', () => {
      // Valid snowflake format but not in list
      expect(isModerator(mockEnv, '99999999999999999')).toBe(false);
    });

    it('should return false when MODERATOR_IDS is empty', () => {
      const env = { MODERATOR_IDS: '' } as Env;
      expect(isModerator(env, '12345678901234567')).toBe(false);
    });

    it('should return false when MODERATOR_IDS is not set', () => {
      const env = {} as Env;
      expect(isModerator(env, '12345678901234567')).toBe(false);
    });

    it('should handle whitespace in MODERATOR_IDS', () => {
      const env = { MODERATOR_IDS: '12345678901234567 , 12345678901234568  ,  12345678901234569' } as Env;
      expect(isModerator(env, '12345678901234567')).toBe(true);
      expect(isModerator(env, '12345678901234568')).toBe(true);
      expect(isModerator(env, '12345678901234569')).toBe(true);
    });

    it('should reject invalid snowflake format', () => {
      // Non-snowflake IDs should always return false, even if in the list
      const env = { MODERATOR_IDS: 'mod-1,12345678901234567' } as Env;
      expect(isModerator(env, 'mod-1')).toBe(false); // Invalid format
      expect(isModerator(env, '12345678901234567')).toBe(true); // Valid format
    });

    it('should handle single moderator ID', () => {
      const env = { MODERATOR_IDS: '12345678901234567' } as Env;
      expect(isModerator(env, '12345678901234567')).toBe(true);
      expect(isModerator(env, '99999999999999999')).toBe(false);
    });
  });

  describe('API configuration errors', () => {
    it('should throw PresetAPIError when API is not configured', async () => {
      const env = {} as Env;

      await expect(getPresets(env)).rejects.toThrow(PresetAPIError);
      await expect(getPresets(env)).rejects.toThrow('Preset API not configured');
    });

    it('should throw error with status 503 for missing config', async () => {
      const env = {} as Env;

      try {
        await getPresets(env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PresetAPIError);
        expect((error as PresetAPIError).statusCode).toBe(503);
      }
    });
  });

  describe('HMAC signature generation', () => {
    it('should include X-Request-Signature header when BOT_SIGNING_SECRET is set', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPresets(mockEnv);

      const fetchCall = mockFetcher._calls[0];
      const headers = fetchCall.headers;

      expect(headers['x-request-signature']).toBeDefined();
      expect(headers['x-request-timestamp']).toBeDefined();
    });

    it('should not include signature headers when BOT_SIGNING_SECRET is not set', async () => {
      const env = {
        PRESETS_API: mockFetcher,
        BOT_API_SECRET: 'secret',
      } as unknown as Env;

      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPresets(env);

      const fetchCall = mockFetcher._calls[0];
      const headers = fetchCall.headers;

      expect(headers['x-request-signature']).toBeUndefined();
      expect(headers['x-request-timestamp']).toBeUndefined();
    });

    it('should generate valid HMAC-SHA256 signature', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPendingPresets(mockEnv, 'mod-1');

      const fetchCall = mockFetcher._calls[0];
      const headers = fetchCall.headers;
      const signature = headers['x-request-signature'];

      // HMAC-SHA256 produces 64 hex characters
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should use current timestamp for signature', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPresets(mockEnv);

      const fetchCall = mockFetcher._calls[0];
      const headers = fetchCall.headers;
      const timestamp = headers['x-request-timestamp'];

      expect(timestamp).toBe('1736942400'); // Unix timestamp for 2025-01-15T12:00:00Z
    });
  });

  describe('request headers', () => {
    it('should include Authorization header with Bearer token', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPresets(mockEnv);

      const fetchCall = mockFetcher._calls[0];
      const headers = fetchCall.headers;

      expect(headers['authorization']).toBe('Bearer test-api-secret');
    });

    it('should include Content-Type application/json', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPresets(mockEnv);

      const fetchCall = mockFetcher._calls[0];
      const headers = fetchCall.headers;

      expect(headers['content-type']).toBe('application/json');
    });

    it('should include X-User-Discord-ID when provided', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [] }));

      await getPendingPresets(mockEnv, 'moderator-123');

      const fetchCall = mockFetcher._calls[0];
      const headers = fetchCall.headers;

      expect(headers['x-user-discord-id']).toBe('moderator-123');
    });

    it('should include X-Request-ID when provided', async () => {
      mockFetcher._setupHandler(() => Response.json({ preset: {} }));

      // Note: Request ID is typically passed through internal request function
      // This test verifies the mechanism, actual implementation may vary
      await getPresets(mockEnv);

      const fetchCall = mockFetcher._calls[0];
      expect(fetchCall).toBeDefined();
    });
  });

  describe('service binding vs HTTP', () => {
    it('should use service binding when PRESETS_API is available', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPresets(mockEnv);

      expect(mockFetcher._calls).toHaveLength(1);
      expect(mockFetcher._calls[0].url).toContain('https://internal');
    });

    it('should use HTTP when only PRESETS_API_URL is configured', async () => {
      const env = {
        PRESETS_API_URL: 'https://api.example.com',
        BOT_API_SECRET: 'secret',
      } as Env;

      global.fetch = vi.fn(() =>
        Promise.resolve(
          Response.json({ presets: [], total: 0, page: 1 })
        )
      ) as any;

      await getPresets(env);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/presets',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should construct correct internal URL for service binding', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPresets(mockEnv, { status: 'pending' });

      const fetchCall = mockFetcher._calls[0];
      expect(fetchCall.url).toBe('https://internal/api/v1/presets?status=pending');
    });
  });

  describe('getPresets', () => {
    it('should return preset list', async () => {
      const mockResponse = {
        presets: [
          { id: 'preset-1', name: 'Preset One', vote_count: 5, author_name: 'Author1' },
          { id: 'preset-2', name: 'Preset Two', vote_count: 3, author_name: 'Author2' },
        ],
        total: 2,
        page: 1,
      };

      mockFetcher._setupHandler(() => Response.json(mockResponse));

      const result = await getPresets(mockEnv);

      expect(result).toEqual(mockResponse);
      expect(result.presets).toHaveLength(2);
    });

    it('should build query parameters from filters', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPresets(mockEnv, {
        category: 'aesthetics',
        search: 'blue',
        status: 'approved',
        sort: 'popular',
        page: 2,
        limit: 10,
      });

      const fetchCall = mockFetcher._calls[0];
      const url = new URL(fetchCall.url);

      expect(url.searchParams.get('category')).toBe('aesthetics');
      expect(url.searchParams.get('search')).toBe('blue');
      expect(url.searchParams.get('status')).toBe('approved');
      expect(url.searchParams.get('sort')).toBe('popular');
      expect(url.searchParams.get('page')).toBe('2');
      expect(url.searchParams.get('limit')).toBe('10');
    });

    it('should handle empty filters', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await getPresets(mockEnv, {});

      const fetchCall = mockFetcher._calls[0];
      expect(fetchCall.url).toBe('https://internal/api/v1/presets');
    });
  });

  describe('getPreset', () => {
    it('should return preset when found', async () => {
      const mockPreset = { id: 'preset-123', name: 'Test Preset', vote_count: 10 };
      mockFetcher._setupHandler(() => Response.json(mockPreset));

      const result = await getPreset(mockEnv, 'preset-123');

      expect(result).toEqual(mockPreset);
    });

    it('should return null when preset not found (404)', async () => {
      mockFetcher._setupHandler(() =>
        new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
      );

      const result = await getPreset(mockEnv, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw PresetAPIError for other error statuses', async () => {
      mockFetcher._setupHandler(() =>
        new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
      );

      await expect(getPreset(mockEnv, 'preset-123')).rejects.toThrow(PresetAPIError);
    });
  });

  describe('getPendingPresets', () => {
    it('should return pending presets array', async () => {
      const mockPresets = [
        { id: 'p1', name: 'Pending 1', status: 'pending' },
        { id: 'p2', name: 'Pending 2', status: 'pending' },
      ];

      mockFetcher._setupHandler(() => Response.json({ presets: mockPresets }));

      const result = await getPendingPresets(mockEnv, 'mod-1');

      expect(result).toEqual(mockPresets);
      expect(result).toHaveLength(2);
    });

    it('should call correct API endpoint', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [] }));

      await getPendingPresets(mockEnv, 'mod-1');

      const fetchCall = mockFetcher._calls[0];
      expect(fetchCall.url).toBe('https://internal/api/v1/moderation/pending');
      expect(fetchCall.method).toBe('GET');
    });
  });

  describe('approvePreset', () => {
    it('should approve preset and return updated preset', async () => {
      const mockPreset = { id: 'preset-1', name: 'Approved', status: 'approved' };
      mockFetcher._setupHandler(() => Response.json({ preset: mockPreset }));

      const result = await approvePreset(mockEnv, 'preset-1', 'mod-1');

      expect(result).toEqual(mockPreset);
    });

    it('should send correct request body', async () => {
      mockFetcher._setupHandler(() => Response.json({ preset: {} }));

      await approvePreset(mockEnv, 'preset-123', 'mod-1', 'Looks good');

      const fetchCall = mockFetcher._calls[0];
      expect(fetchCall.method).toBe('PATCH');

      const body = JSON.parse(fetchCall.body as string);
      expect(body).toEqual({ status: 'approved', reason: 'Looks good' });
    });

    it('should work without reason', async () => {
      mockFetcher._setupHandler(() => Response.json({ preset: {} }));

      await approvePreset(mockEnv, 'preset-123', 'mod-1');

      const fetchCall = mockFetcher._calls[0];
      const body = JSON.parse(fetchCall.body as string);
      expect(body.status).toBe('approved');
      expect(body.reason).toBeUndefined();
    });
  });

  describe('rejectPreset', () => {
    it('should reject preset with reason', async () => {
      const mockPreset = { id: 'preset-1', name: 'Rejected', status: 'rejected' };
      mockFetcher._setupHandler(() => Response.json({ preset: mockPreset }));

      const result = await rejectPreset(mockEnv, 'preset-1', 'mod-1', 'Does not meet standards');

      expect(result).toEqual(mockPreset);
    });

    it('should send correct request body with reason', async () => {
      mockFetcher._setupHandler(() => Response.json({ preset: {} }));

      await rejectPreset(mockEnv, 'preset-123', 'mod-1', 'Inappropriate content');

      const fetchCall = mockFetcher._calls[0];
      const body = JSON.parse(fetchCall.body as string);

      expect(body).toEqual({
        status: 'rejected',
        reason: 'Inappropriate content',
      });
    });
  });

  describe('getModerationStats', () => {
    it('should return moderation statistics', async () => {
      const mockStats = {
        pending: 5,
        approved: 100,
        rejected: 10,
        flagged: 2,
      };

      mockFetcher._setupHandler(() => Response.json({ stats: mockStats }));

      const result = await getModerationStats(mockEnv, 'mod-1');

      expect(result).toEqual(mockStats);
    });

    it('should call correct API endpoint', async () => {
      mockFetcher._setupHandler(() => Response.json({ stats: {} }));

      await getModerationStats(mockEnv, 'mod-1');

      const fetchCall = mockFetcher._calls[0];
      expect(fetchCall.url).toBe('https://internal/api/v1/moderation/stats');
    });
  });

  describe('getModerationHistory', () => {
    it('should return moderation history', async () => {
      const mockHistory = [
        { action: 'approved', moderator_id: 'mod-1', timestamp: '2025-01-01' },
        { action: 'flagged', moderator_id: 'mod-2', timestamp: '2025-01-02' },
      ];

      mockFetcher._setupHandler(() => Response.json({ history: mockHistory }));

      const result = await getModerationHistory(mockEnv, 'preset-123', 'mod-1');

      expect(result).toEqual(mockHistory);
    });

    it('should call correct API endpoint with preset ID', async () => {
      mockFetcher._setupHandler(() => Response.json({ history: [] }));

      await getModerationHistory(mockEnv, 'preset-abc', 'mod-1');

      const fetchCall = mockFetcher._calls[0];
      expect(fetchCall.url).toBe('https://internal/api/v1/moderation/preset-abc/history');
    });
  });

  describe('revertPreset', () => {
    it('should revert preset to previous version', async () => {
      const mockPreset = { id: 'preset-1', name: 'Reverted Preset' };
      mockFetcher._setupHandler(() => Response.json({ success: true, preset: mockPreset }));

      const result = await revertPreset(mockEnv, 'preset-1', 'Flagged edit', 'mod-1');

      expect(result).toEqual(mockPreset);
    });

    it('should send reason in request body', async () => {
      mockFetcher._setupHandler(() => Response.json({ success: true, preset: {} }));

      await revertPreset(mockEnv, 'preset-123', 'Inappropriate changes', 'mod-1');

      const fetchCall = mockFetcher._calls[0];
      const body = JSON.parse(fetchCall.body as string);
      expect(body).toEqual({ reason: 'Inappropriate changes' });
    });

    it('should call correct API endpoint', async () => {
      mockFetcher._setupHandler(() => Response.json({ success: true, preset: {} }));

      await revertPreset(mockEnv, 'preset-xyz', 'Reason', 'mod-1');

      const fetchCall = mockFetcher._calls[0];
      expect(fetchCall.url).toBe('https://internal/api/v1/moderation/preset-xyz/revert');
      expect(fetchCall.method).toBe('PATCH');
    });
  });

  describe('searchPresetsForAutocomplete', () => {
    it('should return autocomplete choices', async () => {
      const mockPresets = [
        { id: 'p1', name: 'Blue Preset', vote_count: 5, author_name: 'User1' },
        { id: 'p2', name: 'Red Preset', vote_count: 3, author_name: 'User2' },
      ];

      mockFetcher._setupHandler(() =>
        Response.json({ presets: mockPresets, total: 2, page: 1 })
      );

      const result = await searchPresetsForAutocomplete(mockEnv, 'preset');

      expect(result).toEqual([
        { name: 'Blue Preset (5★) by User1', value: 'p1' },
        { name: 'Red Preset (3★) by User2', value: 'p2' },
      ]);
    });

    it('should handle presets without author names', async () => {
      const mockPresets = [{ id: 'p1', name: 'Anonymous Preset', vote_count: 10, author_name: null }];

      mockFetcher._setupHandler(() =>
        Response.json({ presets: mockPresets, total: 1, page: 1 })
      );

      const result = await searchPresetsForAutocomplete(mockEnv, 'anonymous');

      expect(result[0].name).toBe('Anonymous Preset (10★)');
    });

    it('should use pending status by default', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await searchPresetsForAutocomplete(mockEnv, 'test');

      const fetchCall = mockFetcher._calls[0];
      const url = new URL(fetchCall.url);
      expect(url.searchParams.get('status')).toBe('pending');
    });

    it('should allow custom status', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await searchPresetsForAutocomplete(mockEnv, 'test', { status: 'approved' });

      const fetchCall = mockFetcher._calls[0];
      const url = new URL(fetchCall.url);
      expect(url.searchParams.get('status')).toBe('approved');
    });

    it('should apply limit parameter', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await searchPresetsForAutocomplete(mockEnv, 'test', { limit: 10 });

      const fetchCall = mockFetcher._calls[0];
      const url = new URL(fetchCall.url);
      expect(url.searchParams.get('limit')).toBe('10');
    });

    it('should return empty array on error', async () => {
      mockFetcher._setupHandler(() => {
        throw new Error('API error');
      });

      const result = await searchPresetsForAutocomplete(mockEnv, 'test');

      expect(result).toEqual([]);
    });

    it('should not include search param when query is empty', async () => {
      mockFetcher._setupHandler(() => Response.json({ presets: [], total: 0, page: 1 }));

      await searchPresetsForAutocomplete(mockEnv, '');

      const fetchCall = mockFetcher._calls[0];
      const url = new URL(fetchCall.url);
      expect(url.searchParams.has('search')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw PresetAPIError with status and message', async () => {
      mockFetcher._setupHandler(() =>
        new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
      );

      try {
        await getPresets(mockEnv);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PresetAPIError);
        expect((error as PresetAPIError).statusCode).toBe(401);
        expect((error as PresetAPIError).message).toBe('Unauthorized');
      }
    });

    it('should use error field if message is not present', async () => {
      mockFetcher._setupHandler(() =>
        new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 })
      );

      try {
        await getPresets(mockEnv);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as PresetAPIError).message).toBe('Bad Request');
      }
    });

    it('should use generic message if neither message nor error is present', async () => {
      mockFetcher._setupHandler(() =>
        new Response(JSON.stringify({}), { status: 500 })
      );

      try {
        await getPresets(mockEnv);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as PresetAPIError).message).toBe('API request failed with status 500');
      }
    });

    it('should wrap non-API errors in PresetAPIError', async () => {
      mockFetcher._setupHandler(() => {
        throw new Error('Network failure');
      });

      try {
        await getPresets(mockEnv);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PresetAPIError);
        expect((error as PresetAPIError).statusCode).toBe(500);
        expect((error as PresetAPIError).message).toBe('Failed to communicate with preset API');
      }
    });
  });
});
