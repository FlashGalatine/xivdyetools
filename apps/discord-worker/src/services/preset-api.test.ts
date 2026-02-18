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
    getFeaturedPresets,
    submitPreset,
    deletePreset,
    getMyPresets,
    editPreset,
    voteForPreset,
    removeVote,
    hasVoted,
    getCategories,
    getPendingPresets,
    approvePreset,
    rejectPreset,
    flagPreset,
    getModerationStats,
    getModerationHistory,
    revertPreset,
    searchPresetsForAutocomplete,
} from './preset-api.js';
import { PresetAPIError } from '../types/preset.js';

// Mock fetch for URL-based tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create mock environment
function createMockEnv(options: {
    withServiceBinding?: boolean;
    withUrlConfig?: boolean;
    moderatorIds?: string;
    withBotSigningSecret?: boolean;
} = {}): any {
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
        env.BOT_SIGNING_SECRET = 'test-signing-secret';
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
            const env = createMockEnv({ moderatorIds: '123,456,789' });
            expect(isModerator(env, '456')).toBe(true);
        });

        it('should return false for non-moderator IDs', () => {
            const env = createMockEnv({ moderatorIds: '123,456,789' });
            expect(isModerator(env, '999')).toBe(false);
        });

        it('should return false when MODERATOR_IDS is not set', () => {
            const env = createMockEnv();
            expect(isModerator(env, '123')).toBe(false);
        });

        it('should handle whitespace in moderator IDs', () => {
            const env = createMockEnv({ moderatorIds: '123, 456 , 789' });
            expect(isModerator(env, '456')).toBe(true);
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
                })
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

    describe('getFeaturedPresets', () => {
        it('should fetch featured presets', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockPresets = [{ id: '1', name: 'Featured' }];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ presets: mockPresets }),
            });

            const result = await getFeaturedPresets(env);

            expect(result).toEqual(mockPresets);
            expect(mockFetch.mock.calls[0][0]).toContain('/featured');
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
            const mockPresets = [
                { id: '1', name: 'Aesthetics Preset', category: 'aesthetics' },
            ];

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
                { name: 'New Preset', description: 'Test description text', category_id: 'aesthetics', dyes: [1, 2], tags: [] },
                'user123',
                'TestUser'
            );

            expect(result).toEqual(mockResponse);
            expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
                'X-User-Discord-ID': 'user123',
                'X-User-Discord-Name': 'TestUser',
            });
        });
    });

    describe('deletePreset', () => {
        it('should return true on successful delete', async () => {
            const env = createMockEnv({ withUrlConfig: true });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });

            const result = await deletePreset(env, 'preset123', 'user123');

            expect(result).toBe(true);
        });

        it('should return false on 403 forbidden', async () => {
            const env = createMockEnv({ withUrlConfig: true });

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: () => Promise.resolve({ message: 'Forbidden' }),
            });

            const result = await deletePreset(env, 'preset123', 'user123');

            expect(result).toBe(false);
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
                })
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
                expect.any(Error)
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
            const mockPresets = [
                { id: '1', name: 'My Preset', author_discord_id: 'user123' },
            ];

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
                'TestUser'
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
                })
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
                editPreset(env, 'preset123', { dyes: [1, 2] }, 'user123', 'TestUser')
            ).rejects.toThrow(PresetAPIError);
        });
    });

    describe('getCategories', () => {
        it('should fetch categories', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockCategories = [
                { name: 'armor', count: 10 },
                { name: 'weapon', count: 5 },
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ categories: mockCategories }),
            });

            const result = await getCategories(env);

            expect(result).toEqual(mockCategories);
        });
    });

    // ==========================================================================
    // Moderation Function Tests
    // ==========================================================================

    describe('getPendingPresets', () => {
        it('should fetch pending presets for moderator', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockPresets = [
                { id: '1', name: 'Pending Preset', status: 'pending' },
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ presets: mockPresets }),
            });

            const result = await getPendingPresets(env, 'mod123');

            expect(result).toEqual(mockPresets);
            expect(mockFetch.mock.calls[0][0]).toContain('/moderation/pending');
            expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
                'X-User-Discord-ID': 'mod123',
            });
        });
    });

    describe('approvePreset', () => {
        it('should approve a preset', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockPreset = { id: 'preset123', name: 'Test', status: 'approved' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ preset: mockPreset }),
            });

            const result = await approvePreset(env, 'preset123', 'mod123');

            expect(result).toEqual(mockPreset);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/api/v1/moderation/preset123/status',
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'approved', reason: undefined }),
                })
            );
        });

        it('should approve a preset with reason', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockPreset = { id: 'preset123', name: 'Test', status: 'approved' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ preset: mockPreset }),
            });

            await approvePreset(env, 'preset123', 'mod123', 'Looks good');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({ status: 'approved', reason: 'Looks good' }),
                })
            );
        });
    });

    describe('rejectPreset', () => {
        it('should reject a preset with reason', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockPreset = { id: 'preset123', name: 'Test', status: 'rejected' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ preset: mockPreset }),
            });

            const result = await rejectPreset(env, 'preset123', 'mod123', 'Inappropriate content');

            expect(result).toEqual(mockPreset);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/api/v1/moderation/preset123/status',
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'rejected', reason: 'Inappropriate content' }),
                })
            );
        });
    });

    describe('flagPreset', () => {
        it('should flag a preset for review', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockPreset = { id: 'preset123', name: 'Test', status: 'flagged' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ preset: mockPreset }),
            });

            const result = await flagPreset(env, 'preset123', 'mod123', 'Needs review');

            expect(result).toEqual(mockPreset);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/api/v1/moderation/preset123/status',
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'flagged', reason: 'Needs review' }),
                })
            );
        });
    });

    describe('getModerationStats', () => {
        it('should fetch moderation statistics', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockStats = {
                total_pending: 5,
                total_approved: 100,
                total_rejected: 10,
                total_flagged: 2,
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: mockStats }),
            });

            const result = await getModerationStats(env, 'mod123');

            expect(result).toEqual(mockStats);
            expect(mockFetch.mock.calls[0][0]).toContain('/moderation/stats');
        });
    });

    describe('getModerationHistory', () => {
        it('should fetch moderation history for a preset', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockHistory = [
                { action: 'approved', moderator_id: 'mod123', timestamp: '2024-01-01' },
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ history: mockHistory }),
            });

            const result = await getModerationHistory(env, 'preset123', 'mod123');

            expect(result).toEqual(mockHistory);
            expect(mockFetch.mock.calls[0][0]).toContain('/moderation/preset123/history');
        });
    });

    describe('revertPreset', () => {
        it('should revert a preset to previous values', async () => {
            const env = createMockEnv({ withUrlConfig: true });
            const mockPreset = { id: 'preset123', name: 'Original Name', status: 'approved' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, preset: mockPreset }),
            });

            const result = await revertPreset(env, 'preset123', 'Reverting inappropriate edit', 'mod123');

            expect(result).toEqual(mockPreset);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/api/v1/moderation/preset123/revert',
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ reason: 'Reverting inappropriate edit' }),
                    headers: expect.objectContaining({
                        'X-User-Discord-ID': 'mod123',
                    }),
                })
            );
        });

        it('should throw error when no previous values exist', async () => {
            const env = createMockEnv({ withUrlConfig: true });

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: () => Promise.resolve({ message: 'No previous values to revert to' }),
            });

            await expect(
                revertPreset(env, 'preset123', 'Trying to revert', 'mod123')
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
            const mockPresets = [
                { id: '1', name: 'Popular Preset', vote_count: 100 },
            ];

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
                expect.any(Error)
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
            expect(calledOptions.headers['X-Request-Signature']).toBeDefined();
        });
    });
});
