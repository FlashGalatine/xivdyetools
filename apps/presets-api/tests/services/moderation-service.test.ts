/**
 * Moderation Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    moderateContent,
    checkLocalFilter,
    escapeRegex,
    compileProfanityPatterns,
    truncateUnicodeSafe,
    _resetPatternsForTesting,
    _setTestPatterns,
} from '../../src/services/moderation-service';
import { createMockEnv } from '../test-utils';

// Mock fetch for external API calls
const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

describe('ModerationService', () => {
    beforeEach(() => {
        fetchMock = vi.fn();
        globalThis.fetch = fetchMock as typeof globalThis.fetch;
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
    // truncateUnicodeSafe
    // ============================================

    describe('truncateUnicodeSafe', () => {
        it('should return string unchanged if within limit', () => {
            expect(truncateUnicodeSafe('hello', 10)).toBe('hello');
        });

        it('should truncate long strings with ellipsis', () => {
            const result = truncateUnicodeSafe('hello world', 8);
            expect(result.length).toBeLessThanOrEqual(8);
            expect(result).toContain('…');
        });

        it('should handle emoji/surrogate pairs correctly', () => {
            const emoji = '🌸🌸🌸🌸🌸'; // 5 emoji characters
            const result = truncateUnicodeSafe(emoji, 3);
            // Should not split a surrogate pair
            expect(result).toContain('…');
            // Array.from correctly counts code points
            expect(Array.from(result).length).toBeLessThanOrEqual(3);
        });

        it('should use custom suffix', () => {
            const result = truncateUnicodeSafe('hello world', 8, '...');
            expect(result).toContain('...');
        });

        it('should handle exact length strings', () => {
            expect(truncateUnicodeSafe('hello', 5)).toBe('hello');
        });

        it('should handle empty string', () => {
            expect(truncateUnicodeSafe('', 10)).toBe('');
        });

        it('should handle maxLength of 1 with suffix', () => {
            const result = truncateUnicodeSafe('hello', 1);
            expect(Array.from(result).length).toBeLessThanOrEqual(1);
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

        it('should handle missing score attributes from Perspective API', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });

            // Response with missing/undefined attributes
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    attributeScores: {
                        TOXICITY: { summaryScore: { value: 0.1 } },
                        // Missing SEVERE_TOXICITY, IDENTITY_ATTACK, INSULT, PROFANITY
                    },
                }),
            });

            const result = await moderateContent(
                'Test Palette',
                'Normal description',
                env
            );

            expect(result.passed).toBe(true);
            expect(result.method).toBe('all');
            expect(result.scores).toBeDefined();
            // Missing scores should default to 0
            expect(result.scores!.severeToxicity).toBe(0);
            expect(result.scores!.identityAttack).toBe(0);
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
    // Perspective request hygiene + fail-closed
    // (FINDING-005 / FINDING-006, 2026-08-29 security audit)
    // ============================================

    describe('moderateContent - Perspective request hygiene (FINDING-006)', () => {
        const PERSPECTIVE_URL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

        /** A 200 from Perspective with every score well below the threshold. */
        const cleanVerdict = () => ({
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

        it('sends the API key in the x-goog-api-key header and never in the URL', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'super-secret-key' });
            fetchMock.mockResolvedValueOnce(cleanVerdict());

            await moderateContent('Nice Palette', 'A beautiful description', env);

            const [url, init] = fetchMock.mock.calls[0];
            // A key in the query string is logged by proxies, CDNs and Google's
            // own access logs; a header is not.
            expect(String(url)).toBe(PERSPECTIVE_URL);
            expect(String(url)).not.toContain('key=');
            expect(String(url)).not.toContain('super-secret-key');
            expect(init.headers['x-goog-api-key']).toBe('super-secret-key');
            expect(init.headers['Content-Type']).toBe('application/json');
        });

        it('asks Perspective not to retain the comment, and keeps the abort signal', async () => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });
            fetchMock.mockResolvedValueOnce(cleanVerdict());

            await moderateContent('Nice Palette', 'A beautiful description', env);

            const init = fetchMock.mock.calls[0][1];
            const body = JSON.parse(init.body);
            // Without doNotStore, Perspective may keep the user-typed
            // name/description for research (FINDING-006).
            expect(body.doNotStore).toBe(true);
            expect(body.comment.text).toBe('Nice Palette A beautiful description');
            // PRESETS-HIGH-001's 5 s timeout survives the rewrite.
            expect(init.signal).toBeInstanceOf(AbortSignal);
        });
    });

    describe('moderateContent - fails closed when Perspective cannot answer (FINDING-005)', () => {
        let consoleError: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            // The service logs the failure it is reacting to; keep the suite's
            // own output clean without hiding the behaviour under test.
            consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleError.mockRestore();
        });

        it.each([
            [
                '429 (Perspective\'s default quota is ~1 QPS)',
                () =>
                    fetchMock.mockResolvedValueOnce({
                        ok: false,
                        status: 429,
                        text: async () => 'RESOURCE_EXHAUSTED',
                    }),
            ],
            [
                'a 500',
                () =>
                    fetchMock.mockResolvedValueOnce({
                        ok: false,
                        status: 500,
                        text: async () => 'Internal Server Error',
                    }),
            ],
            [
                'the 5 s timeout aborting the request',
                () =>
                    fetchMock.mockRejectedValueOnce(
                        new DOMException('The operation was aborted due to timeout', 'TimeoutError')
                    ),
            ],
            ['a thrown network error', () => fetchMock.mockRejectedValueOnce(new Error('Network error'))],
            [
                'a body that will not parse',
                () =>
                    fetchMock.mockResolvedValueOnce({
                        ok: true,
                        json: async () => {
                            throw new SyntaxError('Unexpected token < in JSON');
                        },
                    }),
            ],
            [
                'a 200 carrying no attributeScores',
                () => fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) }),
            ],
        ])('does not pass content on %s', async (_case, arrangeFetch) => {
            const env = createMockEnv({ PERSPECTIVE_API_KEY: 'test-api-key' });
            arrangeFetch();

            const result = await moderateContent('Test Palette', 'Normal description', env);

            // A configured moderation service that cannot answer is not an
            // all-clear: the caller must queue this for a human.
            expect(result.passed).toBe(false);
            expect(result.method).toBe('perspective_unavailable');
            expect(result.flaggedReason).toBeTruthy();
            expect(result.scores).toBeUndefined();
        });

        // The other side of this rule — with NO key configured nothing can fail
        // closed and the local list alone decides — is pinned by the existing
        // "should skip Perspective API if not configured" / "should return local
        // method when no Perspective API configured" / "should return early when
        // local filter catches flagged content" tests above, which assert
        // `passed: true, method: 'local'` and that fetch is never called.
    });

});

// ============================================================================
// presets-api-09: BUG-002's CJK matcher had no test at all
// ============================================================================
//
// `\b` never matches next to CJK, so ja/ko/zh entries are compiled into a
// separate boundary-less `cjkPattern` and checkLocalFilter tries BOTH patterns.
// Nothing exercised that: compileProfanityPatterns was only asserted on ASCII,
// and every checkLocalFilter test injects ASCII patterns through
// `_setTestPatterns`, which hard-codes `cjkPattern: null`. Deleting
// `profanity.cjkPattern` from the pattern array -- or reverting the
// asciiWords/cjkWords split -- left the entire suite green while silently
// disabling matching for six of the eleven shipped entries.
describe('CJK profanity matching (BUG-002)', () => {
    beforeEach(() => {
        _resetPatternsForTesting();
    });

    afterEach(() => {
        _resetPatternsForTesting();
    });

    it('compiles CJK words into cjkPattern, not the \\b-anchored one', () => {
        const compiled = compileProfanityPatterns({ zh: ['ai垃圾'] } as never);

        // `\b(ai垃圾)\b` would never match, so these words MUST NOT go into
        // the ASCII pattern.
        expect(compiled.cjkPattern).not.toBeNull();
        expect(compiled.combinedPattern).toBeNull();
        expect(compiled.cjkPattern?.test('这是ai垃圾啊')).toBe(true);
    });

    it('keeps ASCII words in the \\b-anchored pattern', () => {
        const compiled = compileProfanityPatterns({ en: ['badword'] } as never);

        expect(compiled.combinedPattern).not.toBeNull();
        expect(compiled.cjkPattern).toBeNull();
        // Anchoring is the point: a substring inside a longer word must not hit.
        expect(compiled.combinedPattern?.test('a badword here')).toBe(true);
        expect(compiled.combinedPattern?.test('notbadwordish')).toBe(false);
    });

    it('splits a mixed list across both patterns', () => {
        const compiled = compileProfanityPatterns({
            en: ['badword'],
            zh: ['ai垃圾'],
        } as never);

        expect(compiled.combinedPattern).not.toBeNull();
        expect(compiled.cjkPattern).not.toBeNull();
    });

    // Against the REAL shipped lists, not injected fixtures — the injection
    // helper cannot reach this path because it nulls cjkPattern.
    it.each([
        ['Chinese', 'ai垃圾'],
        ['Korean', 'ai 쓰레기'],
        ['Japanese', 'aiのゴミ'],
    ])('rejects a %s entry from the shipped list', (_label, word) => {
        const result = checkLocalFilter(word, 'a perfectly ordinary description');

        expect(result?.passed).toBe(false);
        expect(result?.flaggedField).toBe('name');
    });

    it('still accepts clean CJK text', () => {
        expect(checkLocalFilter('雪のように白い', 'きれいな色です')?.passed).not.toBe(false);
    });
});
