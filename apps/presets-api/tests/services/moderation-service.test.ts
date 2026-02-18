/**
 * Moderation Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    moderateContent,
    notifyModerators,
    checkLocalFilter,
    escapeRegex,
    compileProfanityPatterns,
    _resetPatternsForTesting,
    _setTestPatterns,
} from '../../src/services/moderation-service';
import { createMockEnv, resetCounters } from '../test-utils';
import type { Env } from '../../src/types';

// Mock fetch for external API calls
const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

describe('ModerationService', () => {
    beforeEach(() => {
        resetCounters();
        fetchMock = vi.fn();
        globalThis.fetch = fetchMock;
        // Reset patterns before each test
        _resetPatternsForTesting();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.clearAllMocks();
        // Reset patterns after each test
        _resetPatternsForTesting();
    });

    // ============================================
    // escapeRegex Helper
    // ============================================

    describe('escapeRegex', () => {
        it('should escape special regex characters', () => {
            expect(escapeRegex('test.*')).toBe('test\\.\\*');
            expect(escapeRegex('foo+bar')).toBe('foo\\+bar');
            expect(escapeRegex('a?b')).toBe('a\\?b');
            expect(escapeRegex('$100')).toBe('\\$100');
            expect(escapeRegex('(test)')).toBe('\\(test\\)');
            expect(escapeRegex('[abc]')).toBe('\\[abc\\]');
        });

        it('should leave normal characters unchanged', () => {
            expect(escapeRegex('hello')).toBe('hello');
            expect(escapeRegex('test123')).toBe('test123');
        });
    });

    // ============================================
    // compileProfanityPatterns
    // ============================================

    describe('compileProfanityPatterns', () => {
        it('should compile word lists into CompiledProfanity structure', () => {
            const wordLists = {
                en: ['bad', 'word'],
                de: ['schlecht'],
            };

            const compiled = compileProfanityPatterns(wordLists);

            expect(compiled.wordSet.size).toBe(3);
            expect(compiled.combinedPattern).toBeInstanceOf(RegExp);
        });

        it('should create case-insensitive patterns', () => {
            const compiled = compileProfanityPatterns({ en: ['test'] });

            expect(compiled.combinedPattern?.test('TEST')).toBe(true);
            expect(compiled.combinedPattern?.test('Test')).toBe(true);
            expect(compiled.combinedPattern?.test('test')).toBe(true);
        });

        it('should use word boundary matching', () => {
            const compiled = compileProfanityPatterns({ en: ['bad'] });

            // Should match whole word
            expect(compiled.combinedPattern?.test('bad')).toBe(true);
            expect(compiled.combinedPattern?.test('very bad word')).toBe(true);

            // Should NOT match partial words
            expect(compiled.combinedPattern?.test('badger')).toBe(false);
            expect(compiled.combinedPattern?.test('notbad')).toBe(false);
        });

        it('should handle empty word lists', () => {
            const compiled = compileProfanityPatterns({});
            expect(compiled.wordSet.size).toBe(0);
            expect(compiled.combinedPattern).toBeNull();
        });
    });

    // ============================================
    // checkLocalFilter - Direct Testing
    // ============================================

    describe('checkLocalFilter', () => {
        it('should return null for clean content with custom patterns', () => {
            _setTestPatterns([/\bbadword\b/i]);
            const result = checkLocalFilter('Good Name', 'Nice description');
            expect(result).toBeNull();
        });

        it('should flag content matching custom pattern in name', () => {
            _setTestPatterns([/\bbadword\b/i]);
            const result = checkLocalFilter('This is badword here', 'Clean description');

            expect(result).not.toBeNull();
            expect(result!.passed).toBe(false);
            expect(result!.flaggedField).toBe('name');
            expect(result!.method).toBe('local');
        });

        it('should flag content matching custom pattern in description only', () => {
            _setTestPatterns([/\bbadword\b/i]);
            const result = checkLocalFilter('Clean Name', 'This has badword in it');

            expect(result).not.toBeNull();
            expect(result!.passed).toBe(false);
            expect(result!.flaggedField).toBe('description');
            expect(result!.method).toBe('local');
        });

        it('should check against multiple patterns', () => {
            _setTestPatterns([/\bword1\b/i, /\bword2\b/i, /\bword3\b/i]);

            // First pattern doesn't match, second does
            const result = checkLocalFilter('Contains word2', 'Description');

            expect(result).not.toBeNull();
            expect(result!.passed).toBe(false);
        });

        it('should use injected patterns when set via _setTestPatterns', () => {
            _setTestPatterns([/\btestbadword\b/i]);

            // Now checkLocalFilter should use injected patterns
            const result = checkLocalFilter('Has testbadword', 'Clean');

            expect(result).not.toBeNull();
            expect(result!.passed).toBe(false);
            expect(result!.flaggedField).toBe('name');
        });

        it('should return clean after patterns are reset', () => {
            _setTestPatterns([/\btestbadword\b/i]);
            _resetPatternsForTesting();

            // After reset, should use default production patterns (may or may not flag)
            // Since production patterns are populated, test with innocuous content
            const result = checkLocalFilter('Hello', 'World');

            // Innocuous content should not be flagged
            expect(result).toBeNull();
        });

        it('should handle case insensitivity correctly', () => {
            _setTestPatterns([/\bBADWORD\b/i]);

            const result1 = checkLocalFilter('badword', 'Clean');
            const result2 = checkLocalFilter('BADWORD', 'Clean');
            const result3 = checkLocalFilter('BadWord', 'Clean');

            expect(result1).not.toBeNull();
            expect(result2).not.toBeNull();
            expect(result3).not.toBeNull();
        });
    });

    // ============================================
    // moderateContent - Local Filter
    // ============================================

    describe('moderateContent - Local Filter', () => {
        it('should pass clean content', async () => {
            const env = createMockEnv();

            const result = await moderateContent(
                'Beautiful Sunset Palette',
                'A lovely collection of warm sunset colors',
                env
            );

            expect(result.passed).toBe(true);
            expect(result.method).toBe('local'); // No Perspective API configured
        });

        it('should pass content when local lists are empty (relies on Perspective API)', async () => {
            const env = createMockEnv();

            // Since local profanity lists are intentionally empty,
            // content passes through local filter and relies on Perspective API
            const result = await moderateContent(
                'Any Content Here',
                'A normal description here',
                env
            );

            expect(result.passed).toBe(true);
            expect(result.method).toBe('local'); // No Perspective API configured
        });

        it('should return local method when no Perspective API configured', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: undefined });

            const result = await moderateContent(
                'Normal Palette Name',
                'This description has some words',
                env
            );

            expect(result.passed).toBe(true);
            expect(result.method).toBe('local');
        });

        it('should handle empty name gracefully', async () => {
            const env = createMockEnv();

            const result = await moderateContent(
                '',
                'A valid description here',
                env
            );

            expect(result.passed).toBe(true);
        });

        it('should handle empty description gracefully', async () => {
            const env = createMockEnv();

            const result = await moderateContent(
                'Valid Palette Name',
                '',
                env
            );

            expect(result.passed).toBe(true);
        });

        it('should handle unicode content gracefully', async () => {
            const env = createMockEnv();

            const result = await moderateContent(
                '日本語パレット',
                '説明文がここにあります',
                env
            );

            expect(result.passed).toBe(true);
        });

        it('should handle special regex characters in content', async () => {
            const env = createMockEnv();

            // These characters could cause regex issues if not escaped
            const result = await moderateContent(
                'Test.*+?^${}()|[]\\',
                'Description with special [brackets] and {braces}',
                env
            );

            expect(result.passed).toBe(true);
        });

        it('should handle very long content', async () => {
            const env = createMockEnv();

            const result = await moderateContent(
                'A'.repeat(100),
                'B'.repeat(500),
                env
            );

            expect(result.passed).toBe(true);
        });

        it('should handle content with multiple whitespace', async () => {
            const env = createMockEnv();

            const result = await moderateContent(
                '  Spaced   Name  ',
                '  Description  with  lots    of    spaces  ',
                env
            );

            expect(result.passed).toBe(true);
        });

        it('should return early when local filter catches flagged content', async () => {
            // Inject custom patterns that WILL match
            _setTestPatterns([/\bflaggedword\b/i]);

            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });

            const result = await moderateContent(
                'Contains flaggedword here',
                'Normal description',
                env
            );

            // Should fail from local filter
            expect(result.passed).toBe(false);
            expect(result.method).toBe('local');
            expect(result.flaggedField).toBe('name');
            expect(result.flaggedReason).toBe('Contains prohibited content');

            // Perspective API should NOT be called because local filter returned early
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should flag description when local filter matches only description', async () => {
            _setTestPatterns([/\bbadcontent\b/i]);

            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });

            const result = await moderateContent(
                'Clean Name',
                'This description has badcontent in it',
                env
            );

            expect(result.passed).toBe(false);
            expect(result.method).toBe('local');
            expect(result.flaggedField).toBe('description');

            // Should not reach Perspective API
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // moderateContent - Perspective API
    // ============================================

    describe('moderateContent - Perspective API', () => {
        it('should skip Perspective API if not configured', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: undefined });

            await moderateContent('Test', 'Test description', env);

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should call Perspective API when configured', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    attributeScores: {
                        TOXICITY: { summaryScore: { value: 0.1 } },
                        SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
                        IDENTITY_ATTACK: { summaryScore: { value: 0.02 } },
                        INSULT: { summaryScore: { value: 0.1 } },
                        PROFANITY: { summaryScore: { value: 0.1 } },
                    },
                }),
            });

            const result = await moderateContent(
                'Nice Palette',
                'A beautiful description',
                env
            );

            expect(fetchMock).toHaveBeenCalledOnce();
            expect(result.passed).toBe(true);
            expect(result.method).toBe('all');
            expect(result.scores).toBeDefined();
        });

        it('should flag high toxicity from Perspective API', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    attributeScores: {
                        TOXICITY: { summaryScore: { value: 0.85 } },
                        SEVERE_TOXICITY: { summaryScore: { value: 0.3 } },
                        IDENTITY_ATTACK: { summaryScore: { value: 0.1 } },
                        INSULT: { summaryScore: { value: 0.2 } },
                        PROFANITY: { summaryScore: { value: 0.15 } },
                    },
                }),
            });

            const result = await moderateContent(
                'Sneaky Bad Content',
                'Something the local filter missed',
                env
            );

            expect(result.passed).toBe(false);
            expect(result.method).toBe('perspective');
            expect(result.flaggedField).toBe('content');
            expect(result.flaggedReason).toContain('toxicity');
            expect(result.scores?.toxicity).toBe(0.85);
        });

        it('should flag any score above threshold', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    attributeScores: {
                        TOXICITY: { summaryScore: { value: 0.3 } },
                        SEVERE_TOXICITY: { summaryScore: { value: 0.1 } },
                        IDENTITY_ATTACK: { summaryScore: { value: 0.75 } }, // Above threshold
                        INSULT: { summaryScore: { value: 0.2 } },
                        PROFANITY: { summaryScore: { value: 0.15 } },
                    },
                }),
            });

            const result = await moderateContent(
                'Test',
                'Test',
                env
            );

            expect(result.passed).toBe(false);
            expect(result.flaggedReason).toContain('identityAttack');
        });

        it('should gracefully handle Perspective API errors', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });

            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            });

            const result = await moderateContent(
                'Test Palette',
                'Normal description',
                env
            );

            // Should still pass if local filter passed and API failed
            expect(result.passed).toBe(true);
            expect(result.method).toBe('local');
        });

        it('should gracefully handle network errors', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });

            fetchMock.mockRejectedValueOnce(new Error('Network error'));

            const result = await moderateContent(
                'Test Palette',
                'Normal description',
                env
            );

            expect(result.passed).toBe(true);
            expect(result.method).toBe('local');
        });

        it('should call Perspective API regardless since local lists are empty', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    attributeScores: {
                        TOXICITY: { summaryScore: { value: 0.9 } },
                        SEVERE_TOXICITY: { summaryScore: { value: 0.1 } },
                        IDENTITY_ATTACK: { summaryScore: { value: 0.1 } },
                        INSULT: { summaryScore: { value: 0.1 } },
                        PROFANITY: { summaryScore: { value: 0.1 } },
                    },
                }),
            });

            const result = await moderateContent(
                'Some Palette',
                'Normal description',
                env
            );

            // Since local lists are empty, Perspective API is always called when configured
            expect(fetchMock).toHaveBeenCalledOnce();
            // If Perspective flags it, it should fail
            expect(result.passed).toBe(false);
        });
    });

    // ============================================
    // notifyModerators
    // ============================================

    describe('notifyModerators', () => {
        const mockAlert = {
            presetId: 'preset-123',
            presetName: 'Flagged Preset',
            description: 'This preset was flagged for review',
            dyes: [1, 2, 3],
            authorName: 'TestUser',
            authorId: 'user-456',
            flagReason: 'Contains prohibited content',
        };

        it('should skip if no webhook or bot token configured', async () => {
            const env = createMockEnv({
                MODERATION_WEBHOOK_URL: undefined,
                OWNER_DISCORD_ID: undefined,
                DISCORD_BOT_TOKEN: undefined,
            });

            await notifyModerators(mockAlert, env);

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should send webhook notification if configured', async () => {
            const env = createMockEnv({
                MODERATION_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
            });

            fetchMock.mockResolvedValueOnce({ ok: true });

            await notifyModerators(mockAlert, env);

            expect(fetchMock).toHaveBeenCalledOnce();
            expect(fetchMock).toHaveBeenCalledWith(
                'https://discord.com/api/webhooks/123/abc',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        });

        it('should send DM to owner if bot token configured', async () => {
            const env = createMockEnv({
                OWNER_DISCORD_ID: 'owner-123',
                DISCORD_BOT_TOKEN: 'bot-token-abc',
            });

            // Mock creating DM channel
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'dm-channel-id' }),
            });

            // Mock sending message
            fetchMock.mockResolvedValueOnce({ ok: true });

            await notifyModerators(mockAlert, env);

            expect(fetchMock).toHaveBeenCalledTimes(2);

            // First call creates DM channel
            expect(fetchMock).toHaveBeenNthCalledWith(
                1,
                'https://discord.com/api/v10/users/@me/channels',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: 'Bot bot-token-abc',
                    }),
                })
            );

            // Second call sends message
            expect(fetchMock).toHaveBeenNthCalledWith(
                2,
                'https://discord.com/api/v10/channels/dm-channel-id/messages',
                expect.objectContaining({
                    method: 'POST',
                })
            );
        });

        it('should handle failed DM channel creation gracefully', async () => {
            const env = createMockEnv({
                OWNER_DISCORD_ID: 'owner-123',
                DISCORD_BOT_TOKEN: 'bot-token-abc',
            });

            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 403,
            });

            // Should not throw
            await expect(notifyModerators(mockAlert, env)).resolves.not.toThrow();
        });

        it('should handle webhook failure gracefully', async () => {
            const env = createMockEnv({
                MODERATION_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
            });

            fetchMock.mockRejectedValueOnce(new Error('Network error'));

            // Should not throw
            await expect(notifyModerators(mockAlert, env)).resolves.not.toThrow();
        });

        it('should include all alert fields in embed', async () => {
            const env = createMockEnv({
                MODERATION_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
            });

            fetchMock.mockResolvedValueOnce({ ok: true });

            await notifyModerators(mockAlert, env);

            const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
            const embed = callBody.embeds[0];

            expect(embed.title).toContain('Pending Review');
            expect(embed.fields.some((f: { name: string }) => f.name === 'Name')).toBe(true);
            expect(embed.fields.some((f: { name: string }) => f.name === 'Submitted by')).toBe(true);
            expect(embed.fields.some((f: { name: string }) => f.name === 'Flagged Reason')).toBe(true);
        });

        it('should handle DM send failure gracefully', async () => {
            const env = createMockEnv({
                OWNER_DISCORD_ID: 'owner-123',
                DISCORD_BOT_TOKEN: 'bot-token-abc',
            });

            // Mock creating DM channel successfully
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'dm-channel-id' }),
            });

            // Mock sending message fails
            fetchMock.mockRejectedValueOnce(new Error('Failed to send DM'));

            // Should not throw
            await expect(notifyModerators(mockAlert, env)).resolves.not.toThrow();

            // Both requests should have been attempted
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should send both webhook and DM if both configured', async () => {
            const env = createMockEnv({
                MODERATION_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
                OWNER_DISCORD_ID: 'owner-123',
                DISCORD_BOT_TOKEN: 'bot-token-abc',
            });

            // Webhook success
            fetchMock.mockResolvedValueOnce({ ok: true });
            // DM channel creation success
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'dm-channel-id' }),
            });
            // DM send success
            fetchMock.mockResolvedValueOnce({ ok: true });

            await notifyModerators(mockAlert, env);

            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        it('should truncate long descriptions in embed', async () => {
            const env = createMockEnv({
                MODERATION_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
            });

            const alertWithLongDesc = {
                ...mockAlert,
                description: 'A'.repeat(500), // Very long description
            };

            fetchMock.mockResolvedValueOnce({ ok: true });

            await notifyModerators(alertWithLongDesc, env);

            const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
            const embed = callBody.embeds[0];
            const descField = embed.fields.find((f: { name: string }) => f.name === 'Description');

            // Description should be truncated to 200 chars
            expect(descField.value.length).toBeLessThanOrEqual(200);
        });
    });
});
