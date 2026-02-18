/**
 * Tests for /match_image command handler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMatchImageCommand } from './match-image.js';
import type { DiscordInteraction, Env, InteractionResponseBody } from '../../types/env.js';

// ---------------------------------------------------------------------------
// Mock Dyes
// ---------------------------------------------------------------------------
const dyeRed = { id: 1, name: 'Rolanberry Red', hex: '#FF0000', category: 'General', itemID: 1001 };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// Overridable mock functions for test-specific behavior
let mockExtractAndMatchPalette = vi.fn((_rgbData: number[][], _dyeService: unknown, options: { colorCount?: number }) => {
    const count = options?.colorCount ?? 1;
    const matches = [];
    for (let i = 0; i < count; i++) {
        matches.push({
            extracted: `#${(i * 17).toString(16).padStart(2, '0').repeat(3)}`,
            matchedDye: { ...dyeRed, id: dyeRed.id + i },
            distance: i * 10,
            dominance: Math.round(100 / count),
        });
    }
    return matches;
});

let mockPixelDataToRGBFiltered = vi.fn((pixels: Uint8ClampedArray) => {
    if (pixels.length === 0) return [];
    // Return mock RGB data
    return [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
});

vi.mock('@xivdyetools/core', () => {
    class MockDyeService {
        searchByName() {
            return [dyeRed];
        }
        findClosestDye() {
            return dyeRed;
        }
    }

    class MockPaletteService {
        extractAndMatchPalette(rgbData: number[][], dyeService: unknown, options: { colorCount?: number }) {
            return mockExtractAndMatchPalette(rgbData, dyeService, options);
        }
        static pixelDataToRGBFiltered(pixels: Uint8ClampedArray) {
            return mockPixelDataToRGBFiltered(pixels);
        }
    }

    return { DyeService: MockDyeService, dyeDatabase: [], PaletteService: MockPaletteService };
});

vi.mock('../../services/emoji.js', () => ({ getDyeEmoji: (id: number) => id ? '🎨' : undefined }));
vi.mock('../../services/i18n.js', () => ({
    initializeLocale: vi.fn().mockResolvedValue(undefined),
    getLocalizedDyeName: (_id: number, name: string) => `${name}-localized`,
    discordLocaleToLocaleCode: (locale: string) => locale?.split('-')[0] || 'en',
}));

const mockEditOriginalResponse = vi.fn().mockResolvedValue(undefined);
vi.mock('../../utils/discord-api.js', () => ({
    editOriginalResponse: (...args: unknown[]) => mockEditOriginalResponse(...args),
}));

const mockRenderSvgToPng = vi.fn().mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4E, 0x47]));
vi.mock('../../services/svg/renderer.js', () => ({
    renderSvgToPng: (...args: unknown[]) => mockRenderSvgToPng(...args),
}));

vi.mock('../../services/svg/palette-grid.js', () => ({
    generatePaletteGrid: vi.fn(() => '<svg></svg>'),
}));

const mockValidateAndFetchImage = vi.fn().mockResolvedValue({
    buffer: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
    contentType: 'image/png',
});
const mockProcessImageForExtraction = vi.fn().mockResolvedValue({
    pixels: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
    width: 1,
    height: 3,
});

vi.mock('../../services/image/index.js', () => ({
    validateAndFetchImage: (...args: unknown[]) => mockValidateAndFetchImage(...args),
    processImageForExtraction: (...args: unknown[]) => mockProcessImageForExtraction(...args),
}));

vi.mock('../../types/image.js', () => ({
    getMatchQuality: (distance: number) => ({
        shortLabel: distance === 0 ? 'PERFECT' : distance < 10 ? 'EXCELLENT' : 'GOOD',
        color: '#00FF00',
    }),
}));

// ---------------------------------------------------------------------------
// Translator helper
// ---------------------------------------------------------------------------
const translator = {
    t: (key: string, vars?: Record<string, unknown>) => {
        const map: Record<string, string> = {
            'common.error': 'Error',
            'common.footer': 'Footer',
            'matchImage.missingImage': 'Please attach an image',
            'matchImage.invalidAttachment': 'Invalid attachment',
            'matchImage.noColors': 'No colors found',
            'matchImage.extractionFailed': 'Extraction failed',
            'matchImage.colorMatch': 'Color Match',
            'matchImage.colorPalette': `Color Palette (${vars?.count ?? 1} colors)`,
            'matchImage.closestMatch': 'Closest Match',
            'matchImage.topMatches': `Top ${vars?.count ?? 1} Matches`,
            'matchImage.extractionMethod': 'K-means clustering',
            'matchImage.processingFailed': 'Processing failed',
            'matchImage.onlyDiscord': 'Only Discord images allowed',
            'matchImage.imageTooLarge': 'Image too large',
            'matchImage.unsupportedFormat': 'Unsupported format',
            'matchImage.timeout': 'Request timeout',
            'quality.perfect': 'Perfect',
            'quality.excellent': 'Excellent',
            'quality.good': 'Good',
        };
        return map[key] ?? key;
    },
    getLocale: () => 'en',
};

vi.mock('../../services/bot-i18n.js', () => ({
    createUserTranslator: vi.fn(async () => translator),
    createTranslator: vi.fn(() => translator),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const baseInteraction: DiscordInteraction = {
    id: 'interaction-1',
    application_id: 'app-id',
    type: 2,
    token: 'test-token',
    data: {
        name: 'match_image',
        options: [],
        resolved: {
            attachments: {},
        },
    },
    locale: 'en-US',
    member: { user: { id: 'user-1', username: 'tester' } },
};

const env = {
    KV: {} as KVNamespace,
    DB: {} as D1Database,
    DISCORD_PUBLIC_KEY: 'pk',
    DISCORD_TOKEN: 'token',
    DISCORD_CLIENT_ID: 'client-id',
    PRESETS_API_URL: 'https://api.example.com',
} as Env;

const ctx: ExecutionContext = {
    waitUntil: vi.fn((promise: Promise<unknown>) => {
        promise.catch(() => { });
    }),
    passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/match_image command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockValidateAndFetchImage.mockResolvedValue({
            buffer: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
            contentType: 'image/png',
        });
        mockProcessImageForExtraction.mockResolvedValue({
            pixels: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
            width: 1,
            height: 3,
        });
        // Reset mock implementations to default
        mockExtractAndMatchPalette = vi.fn((_rgbData: number[][], _dyeService: unknown, options: { colorCount?: number }) => {
            const count = options?.colorCount ?? 1;
            const matches = [];
            for (let i = 0; i < count; i++) {
                matches.push({
                    extracted: `#${(i * 17).toString(16).padStart(2, '0').repeat(3)}`,
                    matchedDye: { ...dyeRed, id: dyeRed.id + i },
                    distance: i * 10,
                    dominance: Math.round(100 / count),
                });
            }
            return matches;
        });
        mockPixelDataToRGBFiltered = vi.fn((pixels: Uint8ClampedArray) => {
            if (pixels.length === 0) return [];
            return [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
        });
    });

    it('returns error when image attachment is missing', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [],
            },
        };

        const res = await handleMatchImageCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.data!.embeds![0].description).toBe('Please attach an image');
        expect(body.data!.flags).toBe(64);
    });

    it('returns error when attachment is not found in resolved', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {},
                },
            },
        };

        const res = await handleMatchImageCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.data!.embeds![0].description).toBe('Invalid attachment');
        expect(body.data!.flags).toBe(64);
    });

    it('defers response and processes image', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        const res = await handleMatchImageCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
        expect(ctx.waitUntil).toHaveBeenCalled();

        // Wait for background processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockValidateAndFetchImage).toHaveBeenCalled();
        expect(mockRenderSvgToPng).toHaveBeenCalled();
        expect(mockEditOriginalResponse).toHaveBeenCalled();
    });

    it('uses default color count of 1', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check the editOriginalResponse was called with "Closest Match" title (single color)
        const call = mockEditOriginalResponse.mock.calls[0];
        if (call && call[2]?.embeds?.[0]) {
            expect(call[2].embeds[0].title).toBe('Closest Match');
        }
    });

    it('accepts custom color count', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                    { name: 'colors', value: 5 },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        const call = mockEditOriginalResponse.mock.calls[0];
        if (call && call[2]?.embeds?.[0]) {
            expect(call[2].embeds[0].title).toContain('Matches');
        }
    });

    it('clamps color count to valid range (1-5)', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                    { name: 'colors', value: 10 }, // Over max
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        const res = await handleMatchImageCommand(interaction, env, ctx);
        expect(res).toBeDefined();
        expect(ctx.waitUntil).toHaveBeenCalled();
    });

    it('handles SSRF error from image validation', async () => {
        mockValidateAndFetchImage.mockRejectedValueOnce(new Error('SSRF protection: Only Discord CDN allowed'));

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockEditOriginalResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'Only Discord images allowed',
                    }),
                ]),
            })
        );
    });

    it('handles image too large error', async () => {
        mockValidateAndFetchImage.mockRejectedValueOnce(new Error('Image too large'));

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockEditOriginalResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'Image too large',
                    }),
                ]),
            })
        );
    });

    it('handles timeout error', async () => {
        mockValidateAndFetchImage.mockRejectedValueOnce(new Error('Request timeout'));

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockEditOriginalResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'Request timeout',
                    }),
                ]),
            })
        );
    });

    it('handles unsupported format error', async () => {
        mockValidateAndFetchImage.mockRejectedValueOnce(new Error('Unsupported format'));

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockEditOriginalResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'Unsupported format',
                    }),
                ]),
            })
        );
    });

    it('handles user from DM context (no member)', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            member: undefined,
            user: { id: 'dm-user-1', username: 'dm-tester' },
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        const res = await handleMatchImageCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.type).toBe(5);
    });

    it('handles empty pixel array (fully transparent image)', async () => {
        // Override mock to return empty array (all pixels transparent)
        mockPixelDataToRGBFiltered = vi.fn(() => []);

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockEditOriginalResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'No colors found',
                    }),
                ]),
            })
        );
    });

    it('handles empty matches from extractAndMatchPalette', async () => {
        // Override mock to return empty array (no matches)
        mockExtractAndMatchPalette = vi.fn(() => []);

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockEditOriginalResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'Extraction failed',
                    }),
                ]),
            })
        );
    });

    it('handles generic error (unknown error message)', async () => {
        mockValidateAndFetchImage.mockRejectedValueOnce(new Error('Some unexpected error'));

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockEditOriginalResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'Processing failed',
                    }),
                ]),
            })
        );
    });

    it('handles non-Error thrown', async () => {
        mockValidateAndFetchImage.mockRejectedValueOnce('string error');

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockEditOriginalResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'Processing failed',
                    }),
                ]),
            })
        );
    });

    it('logs error when logger is provided', async () => {
        mockValidateAndFetchImage.mockRejectedValueOnce(new Error('Test error'));
        const mockLogger = { error: vi.fn() };

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx, mockLogger as any);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockLogger.error).toHaveBeenCalledWith(
            'Match image command error',
            expect.any(Error)
        );
    });

    it('logs error with non-Error type when logger is provided', async () => {
        mockValidateAndFetchImage.mockRejectedValueOnce('non-error string');
        const mockLogger = { error: vi.fn() };

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        await handleMatchImageCommand(interaction, env, ctx, mockLogger as any);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockLogger.error).toHaveBeenCalledWith(
            'Match image command error',
            undefined
        );
    });

    it('falls back to default translator when no user ID', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            member: undefined,
            user: undefined,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        const res = await handleMatchImageCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.type).toBe(5);
    });

    it('clamps color count to minimum', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'image', value: 'attachment-id-123' },
                    { name: 'colors', value: 0 }, // Below min
                ],
                resolved: {
                    attachments: {
                        'attachment-id-123': {
                            id: 'attachment-id-123',
                            filename: 'test.png',
                            url: 'https://cdn.discordapp.com/attachments/test.png',
                            proxy_url: 'https://media.discordapp.net/attachments/test.png',
                            size: 1000,
                            content_type: 'image/png',
                        },
                    },
                },
            },
        };

        const res = await handleMatchImageCommand(interaction, env, ctx);
        expect(res).toBeDefined();
        expect(ctx.waitUntil).toHaveBeenCalled();
    });
});
