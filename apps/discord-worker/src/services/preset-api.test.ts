/**
 * Tests for Preset API Client
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isApiEnabled,
  isModerator,
  getPresets,
  getPreset,
  getPresetByName,
  getRandomPreset,
  submitPreset,
  getMyPresets,
  editPreset,
  voteForPreset,
  removeVote,
  hasVoted,
  setPreviewImageStatus,
  searchPresetsForAutocomplete,
} from './preset-api.js';
import { PresetAPIError } from '../types/preset.js';

// Mock fetch for URL-based tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create mock environment
function createMockEnv(
  options: {
    withServiceBinding?: boolean;
    withUrlConfig?: boolean;
    moderatorIds?: string;
    withBotSigningSecret?: boolean;
  } = {},
): any {
  const env: any = {};

  if (options.withServiceBinding) {
    env.PRESETS_API = {
      fetch: vi.fn(),
    };
  }

  if (options.withUrlConfig) {
    env.PRESETS_API_URL = 'https://api.example.com';
    env.BOT_API_SECRET = 'secret-token';
  }

  if (options.moderatorIds) {
    env.MODERATOR_IDS = options.moderatorIds;
  }

  if (options.withBotSigningSecret) {
    env.BOT_SIGNING_SECRET = 'test-signing-secret-padding-1234';
  }

  return env;
}

describe('preset-api.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Utility Functions Tests
  // ==========================================================================

  describe('isApiEnabled', () => {
    it('should return true when service binding is configured', () => {
      const env = createMockEnv({ withServiceBinding: true });
      expect(isApiEnabled(env)).toBe(true);
    });

    it('should return true when URL and secret are configured', () => {
      const env = createMockEnv({ withUrlConfig: true });
      expect(isApiEnabled(env)).toBe(true);
    });

    it('should return false when neither is configured', () => {
      const env = createMockEnv();
      expect(isApiEnabled(env)).toBe(false);
    });

    it('should return false when only URL is configured without secret', () => {
      const env = { PRESETS_API_URL: 'https://api.example.com' };
      expect(isApiEnabled(env as any)).toBe(false);
    });
  });

  describe('isModerator', () => {
    it('should return true for moderator IDs', () => {
      const env = createMockEnv({
        moderatorIds: '11111111111111111,22222222222222222,33333333333333333',
      });
      expect(isModerator(env, '22222222222222222')).toBe(true);
    });

    it('should return false for non-moderator IDs', () => {
      const env = createMockEnv({
        moderatorIds: '11111111111111111,22222222222222222,33333333333333333',
      });
      expect(isModerator(env, '99999999999999999')).toBe(false);
    });

    it('should return false when MODERATOR_IDS is not set', () => {
      const env = createMockEnv();
      expect(isModerator(env, '11111111111111111')).toBe(false);
    });

    it('should handle whitespace in moderator IDs', () => {
      const env = createMockEnv({
        moderatorIds: '11111111111111111, 22222222222222222 , 33333333333333333',
      });
      expect(isModerator(env, '22222222222222222')).toBe(true);
    });
  });

  // ==========================================================================
  // API Request Tests (with URL-based config)
  // ==========================================================================

  describe('getPresets', () => {
    it('should fetch presets successfully', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockResponse = {
        presets: [{ id: '1', name: 'Test Preset' }],
        total: 1,
        page: 1,
        limit: 25,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getPresets(env);

      expect(result.presets).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/presets',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-token',
          }),
        }),
      );
    });

    it('should include filter parameters', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: [], total: 0 }),
      });

      await getPresets(env, {
        category: 'aesthetics',
        search: 'test',
        status: 'approved',
        sort: 'popular',
        page: 2,
        limit: 10,
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('category=aesthetics');
      expect(calledUrl).toContain('search=test');
      expect(calledUrl).toContain('status=approved');
      expect(calledUrl).toContain('sort=popular');
      expect(calledUrl).toContain('page=2');
      expect(calledUrl).toContain('limit=10');
    });

    it('should throw PresetAPIError when API is not configured', async () => {
      const env = createMockEnv();

      await expect(getPresets(env)).rejects.toThrow(PresetAPIError);
    });
  });

  describe('getPreset', () => {
    it('should return preset when found', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockPreset = { id: 'abc123', name: 'Test' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreset),
      });

      const result = await getPreset(env, 'abc123');

      expect(result).toEqual(mockPreset);
    });

    it('should return null when preset not found', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Not found' }),
      });

      const result = await getPreset(env, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should rethrow non-404 errors', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      await expect(getPreset(env, 'abc123')).rejects.toThrow(PresetAPIError);
    });
  });

  describe('getRandomPreset', () => {
    it('should return a random preset from pool', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockPresets = [
        { id: '1', name: 'Preset 1' },
        { id: '2', name: 'Preset 2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: mockPresets, total: 2 }),
      });

      const result = await getRandomPreset(env);

      expect(mockPresets).toContainEqual(result);
    });

    it('should filter by category when provided', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockPresets = [{ id: '1', name: 'Aesthetics Preset', category: 'aesthetics' }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: mockPresets, total: 1 }),
      });

      const result = await getRandomPreset(env, 'aesthetics');

      expect(result).toEqual(mockPresets[0]);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('category=aesthetics');
    });

    it('should return null when no presets available', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: [], total: 0 }),
      });

      const result = await getRandomPreset(env);

      expect(result).toBeNull();
    });
  });

  describe('submitPreset', () => {
    it('should submit a new preset', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockResponse = { id: 'new123', message: 'Created' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await submitPreset(
        env,
        {
          name: 'New Preset',
          description: 'Test description text',
          category_id: 'aesthetics',
          dyes: [1, 2],
          tags: [],
        },
        'user123',
        'TestUser',
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
        'X-User-Discord-ID': 'user123',
        'X-User-Discord-Name': 'TestUser',
      });
    });
  });

  describe('voteForPreset', () => {
    it('should add a vote', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockResponse = { success: true, vote_count: 5 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await voteForPreset(env, 'preset123', 'user123');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('removeVote', () => {
    it('should remove a vote successfully', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockResponse = { success: true, vote_count: 4 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await removeVote(env, 'preset123', 'user123');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/votes/preset123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'X-User-Discord-ID': 'user123',
          }),
        }),
      );
    });

    it('should handle vote removal errors', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'User has not voted for this preset' }),
      });

      await expect(removeVote(env, 'preset123', 'user123')).rejects.toThrow(PresetAPIError);
    });
  });

  describe('hasVoted', () => {
    it('should return true when user has voted', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ has_voted: true }),
      });

      const result = await hasVoted(env, 'preset123', 'user123');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await hasVoted(env, 'preset123', 'user123');

      expect(result).toBe(false);
    });

    it('should log error when logger is provided and error occurs', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockLogger = {
        error: vi.fn(),
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await hasVoted(env, 'preset123', 'user123', mockLogger as any);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to check vote status',
        expect.any(Error),
      );
    });
  });

  describe('getPresetByName', () => {
    it('should find exact match by name', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockPreset = { id: '1', name: 'Red Knight', vote_count: 5 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: [mockPreset], total: 1 }),
      });

      const result = await getPresetByName(env, 'Red Knight');

      expect(result).toEqual(mockPreset);
    });

    it('should return first partial match when no exact match', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockPresets = [
        { id: '1', name: 'Red Knight Armor', vote_count: 5 },
        { id: '2', name: 'Blue Knight', vote_count: 3 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: mockPresets, total: 2 }),
      });

      const result = await getPresetByName(env, 'knight');

      expect(result).toEqual(mockPresets[0]);
    });

    it('should return null when no match found', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: [], total: 0 }),
      });

      const result = await getPresetByName(env, 'Nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getMyPresets', () => {
    it('should fetch presets owned by user', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockPresets = [{ id: '1', name: 'My Preset', author_discord_id: 'user123' }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: mockPresets, total: 1 }),
      });

      const result = await getMyPresets(env, 'user123');

      expect(result).toEqual(mockPresets);
      expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
        'X-User-Discord-ID': 'user123',
      });
    });
  });

  describe('editPreset', () => {
    it('should edit a preset successfully', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockResponse = {
        preset: { id: 'preset123', name: 'Updated Name' },
        moderation_triggered: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await editPreset(
        env,
        'preset123',
        { name: 'Updated Name' },
        'user123',
        'TestUser',
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/presets/preset123',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'X-User-Discord-ID': 'user123',
            'X-User-Discord-Name': 'TestUser',
          }),
        }),
      );
    });

    it('should throw error on duplicate dye combination', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Duplicate dye combination' }),
      });

      await expect(
        editPreset(env, 'preset123', { dyes: [1, 2] }, 'user123', 'TestUser'),
      ).rejects.toThrow(PresetAPIError);
    });
  });

  describe('setPreviewImageStatus', () => {
    it('should call the preview-image moderation route with action approve, the clicking user id and name', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, preview_image_status: 'approved' }),
      });

      const result = await setPreviewImageStatus(env, 'preset123', 'approve', 'mod123', 'ModName');

      expect(result).toEqual({ success: true, preview_image_status: 'approved' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/moderation/preset123/preview-image',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ action: 'approve' }),
          headers: expect.objectContaining({
            'X-User-Discord-ID': 'mod123',
            'X-User-Discord-Name': 'ModName',
          }),
        }),
      );
    });

    it('should call the preview-image moderation route with action reject', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, preview_image_status: 'none' }),
      });

      const result = await setPreviewImageStatus(env, 'preset123', 'reject', 'mod123', 'ModName');

      expect(result).toEqual({ success: true, preview_image_status: 'none' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/moderation/preset123/preview-image',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ action: 'reject' }),
        }),
      );
    });

    it('should surface a PresetAPIError when the moderation route rejects the request', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Not a moderator' }),
      });

      await expect(setPreviewImageStatus(env, 'preset123', 'approve', 'user123')).rejects.toThrow(
        PresetAPIError,
      );
    });
  });

  describe('searchPresetsForAutocomplete', () => {
    it('should return formatted autocomplete choices', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockPresets = [
        { id: '1', name: 'Red Knight', vote_count: 5, author_name: 'User1' },
        { id: '2', name: 'Blue Mage', vote_count: 3 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: mockPresets, total: 2 }),
      });

      const result = await searchPresetsForAutocomplete(env, 'test');

      expect(result).toHaveLength(2);
      expect(result[0].name).toContain('Red Knight');
      expect(result[0].name).toContain('5★');
      expect(result[0].name).toContain('User1');
      expect(result[1].name).not.toContain('by');
    });

    it('should use popular sort when query is empty', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockPresets = [{ id: '1', name: 'Popular Preset', vote_count: 100 }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: mockPresets, total: 1 }),
      });

      const result = await searchPresetsForAutocomplete(env, '');

      expect(result).toHaveLength(1);
      // Verify sort=popular was used (check the URL)
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('sort=popular');
    });

    it('should respect status and limit options', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: [], total: 0 }),
      });

      await searchPresetsForAutocomplete(env, 'test', {
        status: 'pending',
        limit: 10,
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('status=pending');
      expect(calledUrl).toContain('limit=10');
    });

    it('should return empty array on error', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await searchPresetsForAutocomplete(env, 'test');

      expect(result).toEqual([]);
    });

    it('should log error when logger is provided and error occurs', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockLogger = {
        error: vi.fn(),
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await searchPresetsForAutocomplete(env, 'test', {
        logger: mockLogger as any,
      });

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Preset autocomplete search failed',
        expect.any(Error),
      );
    });
  });

  // ==========================================================================
  // Service Binding Tests
  // ==========================================================================

  describe('Service Binding', () => {
    it('should use service binding when available', async () => {
      const env = createMockEnv({ withServiceBinding: true, withUrlConfig: true });
      const mockResponse = { presets: [], total: 0 };

      env.PRESETS_API.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getPresets(env);

      // Should use service binding, not global fetch
      expect(env.PRESETS_API.fetch).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use internal URL for service binding', async () => {
      const env = createMockEnv({ withServiceBinding: true });
      const mockResponse = { presets: [], total: 0 };

      env.PRESETS_API.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getPresets(env);

      const calledRequest = env.PRESETS_API.fetch.mock.calls[0][0];
      expect(calledRequest.url).toContain('https://internal');
    });

    it('should add signature headers when BOT_SIGNING_SECRET is set', async () => {
      const env = createMockEnv({ withUrlConfig: true, withBotSigningSecret: true });
      const mockResponse = { presets: [], total: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getPresets(env);

      // Verify the fetch was called with signature headers
      const calledOptions = mockFetch.mock.calls[0][1];
      expect(calledOptions.headers['X-Request-Timestamp']).toBeDefined();
      expect(calledOptions.headers['X-Request-Signature']).toBeUndefined(); // v1 retired (FINDING-015)
    });
  });

  // ==========================================================================
  // FINDING-020 (2026-08-21 security audit): every caller-supplied path
  // segment is percent-encoded so `..`, `/`, `?` and `#` cannot steer the
  // request onto another presets-api route.
  // ==========================================================================
  describe('path-segment encoding (FINDING-020)', () => {
    const HOSTILE_ID = '../moderation/pending?x=1#frag';
    const ENCODED_ID = encodeURIComponent(HOSTILE_ID);

    function okFetch(payload: unknown = {}): void {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      });
    }

    it('getPreset encodes the id', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      okFetch({ id: 'x' });

      await getPreset(env, HOSTILE_ID);

      expect(mockFetch.mock.calls[0][0]).toBe(`https://api.example.com/api/v1/presets/${ENCODED_ID}`);
      expect(mockFetch.mock.calls[0][0]).not.toContain('/presets/../');
    });

    it('editPreset encodes the id', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      okFetch({ success: true });

      await editPreset(env, HOSTILE_ID, { name: 'n' }, '123', 'u');

      expect(mockFetch.mock.calls[0][0]).toBe(`https://api.example.com/api/v1/presets/${ENCODED_ID}`);
    });

    it('voteForPreset / removeVote / hasVoted encode the id', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      okFetch({ success: true, new_vote_count: 1 });
      await voteForPreset(env, HOSTILE_ID, '123');
      expect(mockFetch.mock.calls[0][0]).toBe(`https://api.example.com/api/v1/votes/${ENCODED_ID}`);

      okFetch({ success: true, new_vote_count: 0 });
      await removeVote(env, HOSTILE_ID, '123');
      expect(mockFetch.mock.calls[1][0]).toBe(`https://api.example.com/api/v1/votes/${ENCODED_ID}`);

      okFetch({ has_voted: false });
      await hasVoted(env, HOSTILE_ID, '123');
      expect(mockFetch.mock.calls[2][0]).toBe(
        `https://api.example.com/api/v1/votes/${ENCODED_ID}/check`,
      );
    });

    it('setPreviewImageStatus encodes the id', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      okFetch({ success: true, preview_image_status: 'approved' });

      await setPreviewImageStatus(env, HOSTILE_ID, 'approve', '123', 'mod');

      expect(mockFetch.mock.calls[0][0]).toBe(
        `https://api.example.com/api/v1/moderation/${ENCODED_ID}/preview-image`,
      );
    });

    it('a plain UUID is left readable (encoding is a no-op for it)', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      okFetch({ id: 'x' });

      await getPreset(env, '12345678-1234-4123-8123-123456789abc');

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.example.com/api/v1/presets/12345678-1234-4123-8123-123456789abc',
      );
    });
  });
});
