/**
 * Tests for Preset API Client
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isApiEnabled,
  isModerator,
  getPresets,
  getPreset,
  getPresetBatch,
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
import {
  createBotSignatureV2,
  BOT_SIGNATURE_NONCE_HEADER,
  BOT_SIGNATURE_V2_HEADER,
} from '@xivdyetools/auth';

const PRESET_ID = '12345678-1234-4123-8123-123456789abc';
const PREVIEW_IMAGE_KEY = `${PRESET_ID}/abcdefab-cdef-4def-8abc-defabcdefabc.webp`;

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

      const result = await setPreviewImageStatus(
        env,
        PRESET_ID,
        'approve',
        PREVIEW_IMAGE_KEY,
        'mod123',
        'ModName',
      );

      expect(result).toEqual({ success: true, preview_image_status: 'approved' });
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/api/v1/moderation/${PRESET_ID}/preview-image`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ action: 'approve', preview_image_key: PREVIEW_IMAGE_KEY }),
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

      const result = await setPreviewImageStatus(
        env,
        PRESET_ID,
        'reject',
        PREVIEW_IMAGE_KEY,
        'mod123',
        'ModName',
      );

      expect(result).toEqual({ success: true, preview_image_status: 'none' });
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/api/v1/moderation/${PRESET_ID}/preview-image`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ action: 'reject', preview_image_key: PREVIEW_IMAGE_KEY }),
        }),
      );
    });

    it('binds the exact revision-bearing body into the v2 HMAC signature', async () => {
      const env = createMockEnv({ withUrlConfig: true, withBotSigningSecret: true });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, preview_image_status: 'approved' }),
      });

      await setPreviewImageStatus(
        env,
        PRESET_ID,
        'approve',
        PREVIEW_IMAGE_KEY,
        'mod123',
        'ModName',
      );

      const options = mockFetch.mock.calls[0][1];
      const headers = options.headers as Record<string, string>;
      const expectedSignature = await createBotSignatureV2(
        {
          method: 'PATCH',
          path: `/api/v1/moderation/${PRESET_ID}/preview-image`,
          body: JSON.stringify({ action: 'approve', preview_image_key: PREVIEW_IMAGE_KEY }),
          timestamp: headers['X-Request-Timestamp'],
          nonce: headers[BOT_SIGNATURE_NONCE_HEADER],
          userDiscordId: 'mod123',
          userName: 'ModName',
        },
        env.BOT_SIGNING_SECRET,
      );

      expect(headers[BOT_SIGNATURE_V2_HEADER]).toBe(expectedSignature);
    });

    it('should surface a PresetAPIError when the moderation route rejects the request', async () => {
      const env = createMockEnv({ withUrlConfig: true });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Not a moderator' }),
      });

      await expect(
        setPreviewImageStatus(env, PRESET_ID, 'approve', PREVIEW_IMAGE_KEY, 'user123'),
      ).rejects.toThrow(PresetAPIError);
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

    // REFACTOR-003: Discord rejects a whole autocomplete response when any
    // choice name exceeds 100 characters — "Name (X★) by Author" can exceed
    // that with a long name/author, so it must be truncated.
    it('truncates a choice name over 100 characters', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      const mockPresets = [
        {
          id: '1',
          name: 'A'.repeat(120),
          vote_count: 5,
          author_name: 'Someone With A Very Long Display Name Indeed',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ presets: mockPresets, total: 1 }),
      });

      const result = await searchPresetsForAutocomplete(env, 'test');

      expect(result[0].name.length).toBeLessThanOrEqual(100);
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

      expect(mockFetch.mock.calls[0][0]).toBe(
        `https://api.example.com/api/v1/presets/${ENCODED_ID}`,
      );
      expect(mockFetch.mock.calls[0][0]).not.toContain('/presets/../');
    });

    it('editPreset encodes the id', async () => {
      const env = createMockEnv({ withUrlConfig: true });
      okFetch({ success: true });

      await editPreset(env, HOSTILE_ID, { name: 'n' }, '123', 'u');

      expect(mockFetch.mock.calls[0][0]).toBe(
        `https://api.example.com/api/v1/presets/${ENCODED_ID}`,
      );
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

      await setPreviewImageStatus(env, HOSTILE_ID, 'approve', PREVIEW_IMAGE_KEY, '123', 'mod');

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


describe('getPresetBatch strict favorites contract', () => {
  const a = 'saved-a';
  const b = 'saved-b';
  const preset = { id: a, name: 'First', category_id: 'aesthetics', status: 'approved' };
  beforeEach(() => vi.clearAllMocks());
  it.each([1, 10, 50])('sends %i IDs in one signed acting-user POST body', async (count) => {
    const env = createMockEnv({ withServiceBinding: true, withBotSigningSecret: true });
    const ids = Array.from({ length: count }, (_, i) => `saved-${i}`);
    env.PRESETS_API.fetch.mockResolvedValue(Response.json({
      success: true, presets: ids.map((id) => ({ ...preset, id })), missing_ids: [],
    }));
    const result = await getPresetBatch(env, ids, '12345678901234567', { requestId: 'trace-42' });
    expect(result.presets.map((p) => p.id)).toEqual(ids);
    expect(env.PRESETS_API.fetch).toHaveBeenCalledTimes(1);
    const request = env.PRESETS_API.fetch.mock.calls[0][0] as Request;
    const body = await request.text();
    expect(request.url).toBe('https://internal/api/v1/presets/batch');
    expect(request.method).toBe('POST');
    expect(JSON.parse(body)).toEqual({ ids });
    expect(request.headers.get('X-User-Discord-ID')).toBe('12345678901234567');
    expect(request.headers.get('X-Request-ID')).toBe('trace-42');
    const signature = await createBotSignatureV2({
      method: 'POST', path: '/api/v1/presets/batch', body,
      timestamp: request.headers.get('X-Request-Timestamp')!,
      nonce: request.headers.get(BOT_SIGNATURE_NONCE_HEADER)!,
      userDiscordId: '12345678901234567',
    }, env.BOT_SIGNING_SECRET);
    expect(request.headers.get(BOT_SIGNATURE_V2_HEADER)).toBe(signature);
  });
  it('deduplicates requested IDs and restores favorite order from an unordered response', async () => {
    const env = createMockEnv({ withServiceBinding: true, withBotSigningSecret: true });
    env.PRESETS_API.fetch.mockResolvedValue(Response.json({
      success: true, presets: [{ ...preset, id: b }, preset], missing_ids: ['missing'],
    }));
    const result = await getPresetBatch(env, [a, 'missing', b, a], 'user');
    expect(result.presets.map((p) => p.id)).toEqual([a, b]);
    expect(result.missing_ids).toEqual(['missing']);
    const request = env.PRESETS_API.fetch.mock.calls[0][0] as Request;
    expect(await request.json()).toEqual({ ids: [a, 'missing', b] });
  });
  it('accepts an explicit all-missing classification without calling individual GETs', async () => {
    const env = createMockEnv({ withServiceBinding: true, withBotSigningSecret: true });
    env.PRESETS_API.fetch.mockResolvedValue(Response.json({ success: true, presets: [], missing_ids: [b, a] }));
    await expect(getPresetBatch(env, [a, b], 'user')).resolves.toEqual({ presets: [], missing_ids: [a, b] });
    expect(env.PRESETS_API.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    null,
    { success: false, presets: [preset], missing_ids: [b] },
    { success: true, presets: [preset] },
    { success: true, presets: [preset], missing_ids: [] },
    { success: true, presets: [preset, preset], missing_ids: [b] },
    { success: true, presets: [preset], missing_ids: [b, b] },
    { success: true, presets: [preset], missing_ids: [a, b] },
    { success: true, presets: [preset], missing_ids: [b, 'extra'] },
    { success: true, presets: [preset, { ...preset, id: 'extra' }], missing_ids: [b] },
    { success: true, presets: [{ ...preset, name: 7 }], missing_ids: [b] },
    { success: true, presets: [{ ...preset, category_id: null }], missing_ids: [b] },
    { success: true, presets: [{ ...preset, status: 'pending' }], missing_ids: [b] },
    { success: true, presets: [null], missing_ids: [b] },
    { success: true, presets: [preset], missing_ids: [7] },
  ])('rejects malformed or incomplete classifications as upstream: %j', async (body) => {
    const env = createMockEnv({ withServiceBinding: true, withBotSigningSecret: true });
    env.PRESETS_API.fetch.mockResolvedValue(Response.json(body));
    await expect(getPresetBatch(env, [a, b], 'user')).rejects.toMatchObject({ statusCode: 502 });
    expect(env.PRESETS_API.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([{ ids: [] }, { ids: Array<string>(51).fill(a) }, { ids: [''] }, { ids: ['x'.repeat(129)] }])('rejects invalid input without a request: %j', async ({ ids }) => {
    const env = createMockEnv({ withServiceBinding: true, withBotSigningSecret: true });
    await expect(getPresetBatch(env, ids, 'user')).rejects.toBeInstanceOf(PresetAPIError);
    expect(env.PRESETS_API.fetch).not.toHaveBeenCalled();
  });
  it('requires signed acting-user context before making a request', async () => {
    const env = createMockEnv({ withServiceBinding: true });
    await expect(getPresetBatch(env, [a], 'user')).rejects.toBeInstanceOf(PresetAPIError);
    env.BOT_SIGNING_SECRET = 't'.repeat(32);
    await expect(getPresetBatch(env, [a], '')).rejects.toBeInstanceOf(PresetAPIError);
    expect(env.PRESETS_API.fetch).not.toHaveBeenCalled();
  });
  it.each(['transport', 'json', 'http'])('propagates %s failures with one request and no fanout', async (failure) => {
    const env = createMockEnv({ withServiceBinding: true, withBotSigningSecret: true });
    if (failure === 'transport') env.PRESETS_API.fetch.mockRejectedValue(new Error('network'));
    if (failure === 'json') env.PRESETS_API.fetch.mockResolvedValue(new Response('invalid'));
    if (failure === 'http') env.PRESETS_API.fetch.mockResolvedValue(Response.json({ error: 'busy' }, { status: 429 }));
    await expect(getPresetBatch(env, [a], 'user')).rejects.toBeInstanceOf(PresetAPIError);
    expect(env.PRESETS_API.fetch).toHaveBeenCalledTimes(1);
  });
});
