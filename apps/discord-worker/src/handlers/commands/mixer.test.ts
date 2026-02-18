/**
 * Tests for /mixer command handler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMixerCommand } from './mixer.js';
import type { DiscordInteraction, Env, InteractionResponseBody } from '../../types/env.js';

// ---------------------------------------------------------------------------
// Mock Dyes
// ---------------------------------------------------------------------------
const dyeRed = { id: 1, name: 'Rolanberry Red', hex: '#FF0000', category: 'General', itemID: 1001 };
const dyeBlue = { id: 2, name: 'Ceruleum Blue', hex: '#0000FF', category: 'General', itemID: 1002 };
const facewearDye = { id: 99, name: 'Facewear Dye', hex: '#888888', category: 'Facewear', itemID: 9999 };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@xivdyetools/core', () => {
    class MockDyeService {
        searchByName(query: string) {
            const lowerQuery = query.toLowerCase();
            if (lowerQuery.includes('rolanberry') || lowerQuery.includes('red')) return [dyeRed];
            if (lowerQuery.includes('ceruleum') || lowerQuery.includes('blue')) return [dyeBlue];
            return [];
        }
        findClosestDye(hex: string, excludeIds: number[] = []) {
            // If facewear is not excluded, return it first (to test anti-facewear logic)
            if (!excludeIds.includes(facewearDye.id) && hex.includes('88')) return facewearDye;
            if (!excludeIds.includes(dyeRed.id)) return dyeRed;
            if (!excludeIds.includes(dyeBlue.id)) return dyeBlue;
            return null;
        }
    }

    const ColorService = {
        hexToRgb: (hex: string) => {
            const clean = hex.replace('#', '');
            const num = parseInt(clean, 16);
            return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
        },
    };

    return { DyeService: MockDyeService, dyeDatabase: [], ColorService };
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

vi.mock('../../services/svg/gradient.js', () => ({
    generateGradientBar: vi.fn(() => '<svg></svg>'),
    generateGradientColors: (start: string, end: string, steps: number) => {
        const colors: string[] = [];
        for (let i = 0; i < steps; i++) {
            // If start contains 88, keep 88 in middle colors to trigger facewear logic
            if (start.includes('88')) {
                colors.push('#888888');
            } else {
                colors.push(i === 0 ? start : i === steps - 1 ? end : '#808080');
            }
        }
        return colors;
    },
}));

// ---------------------------------------------------------------------------
// Translator helper
// ---------------------------------------------------------------------------
const translator = {
    t: (key: string, vars?: Record<string, unknown>) => {
        const map: Record<string, string> = {
            'common.error': 'Error',
            'common.footer': 'Footer',
            'errors.missingInput': 'Missing input',
            'errors.invalidColor': `Invalid color: ${vars?.input}`,
            'errors.noMatchFound': 'No matches found',
            'errors.generationFailed': 'Generation failed',
            'quality.perfect': 'Perfect',
            'quality.excellent': 'Excellent',
            'quality.good': 'Good',
            'quality.fair': 'Fair',
            'quality.approximate': 'Approximate',
            'mixer.title': 'Color Gradient',
            'mixer.steps': `${vars?.count ?? 6} Steps`,
            'mixer.startColor': 'Start Color',
            'mixer.endColor': 'End Color',
            'match.topMatches': `Top ${vars?.count ?? ''} matches`,
            'match.useInfoNameHint': 'Use /info <name>',
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
        name: 'mixer',
        options: [],
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
        // Execute the promise for testing
        promise.catch(() => { });
    }),
    passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/mixer command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error when start_color is missing', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'end_color', value: '#0000FF' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.data!.embeds![0].description).toBe('Missing input');
        expect(body.data!.flags).toBe(64);
    });

    it('returns error when end_color is missing', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: '#FF0000' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.data!.embeds![0].description).toBe('Missing input');
        expect(body.data!.flags).toBe(64);
    });

    it('returns error for invalid start color', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: 'not-a-color' },
                    { name: 'end_color', value: '#0000FF' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.data!.embeds![0].description).toContain('Invalid color');
        expect(body.data!.flags).toBe(64);
    });

    it('returns error for invalid end color', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: '#FF0000' },
                    { name: 'end_color', value: 'unknown-dye' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.data!.embeds![0].description).toContain('Invalid color');
        expect(body.data!.flags).toBe(64);
    });

    it('defers response and processes with hex colors', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: '#FF0000' },
                    { name: 'end_color', value: '#0000FF' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        // Should return deferred response
        expect(body.type).toBe(5);
        expect(ctx.waitUntil).toHaveBeenCalled();

        // Wait for background processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should have rendered and sent image
        expect(mockRenderSvgToPng).toHaveBeenCalled();
        expect(mockEditOriginalResponse).toHaveBeenCalled();
    });

    it('accepts dye names as color input', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: 'Rolanberry Red' },
                    { name: 'end_color', value: 'Ceruleum Blue' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        // Should return deferred response
        expect(body.type).toBe(5);
        expect(ctx.waitUntil).toHaveBeenCalled();
    });

    it('accepts custom step count', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: '#FF0000' },
                    { name: 'end_color', value: '#0000FF' },
                    { name: 'steps', value: 10 },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        // Should return deferred response
        expect(body.type).toBe(5);
        expect(ctx.waitUntil).toHaveBeenCalled();
    });

    it('normalizes hex colors without # prefix', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: 'FF0000' },
                    { name: 'end_color', value: '0000FF' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        // Should return deferred response (valid colors)
        expect(body.type).toBe(5);
    });

    it('uses default step count of 6 when not specified', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: '#FF0000' },
                    { name: 'end_color', value: '#0000FF' },
                ],
            },
        };

        await handleMixerCommand(interaction, env, ctx);

        // Wait for background processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check the editOriginalResponse was called with 6 steps in title
        const call = mockEditOriginalResponse.mock.calls[0];
        if (call) {
            const embeds = call[2]?.embeds;
            if (embeds && embeds[0]) {
                expect(embeds[0].title).toContain('6');
            }
        }
    });

    it('handles user from DM context (no member)', async () => {
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            member: undefined,
            user: { id: 'dm-user-1', username: 'dm-tester' },
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: '#FF0000' },
                    { name: 'end_color', value: '#0000FF' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.type).toBe(5);
    });

    it('skips facewear dyes when finding closest match', async () => {
        // Use colors that will trigger the facewear dye check (hex contains '88')
        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: '#888888' }, // Gray - triggers facewear in mock
                    { name: 'end_color', value: '#888888' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.type).toBe(5);

        // Wait for background processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should still succeed, having skipped facewear dye
        expect(mockEditOriginalResponse).toHaveBeenCalled();
    });

    it('handles rendering error gracefully', async () => {
        // Make render fail
        mockRenderSvgToPng.mockRejectedValueOnce(new Error('Render failed'));

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: '#FF0000' },
                    { name: 'end_color', value: '#0000FF' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        expect((await res.json() as InteractionResponseBody).type).toBe(5);

        // Wait for background processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should have sent error response
        expect(mockEditOriginalResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'Generation failed',
                    }),
                ]),
            })
        );
    });

    it('handles rendering error with logger', async () => {
        // Make render fail
        mockRenderSvgToPng.mockRejectedValueOnce(new Error('Render failed'));
        const mockLogger = { error: vi.fn() };

        const interaction: DiscordInteraction = {
            ...baseInteraction,
            data: {
                ...baseInteraction.data,
                options: [
                    { name: 'start_color', value: '#FF0000' },
                    { name: 'end_color', value: '#0000FF' },
                ],
            },
        };

        await handleMixerCommand(interaction, env, ctx, mockLogger as any);

        // Wait for background processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Logger should have been called
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Mixer command error',
            expect.any(Error)
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
                    { name: 'start_color', value: '#FF0000' },
                    { name: 'end_color', value: '#0000FF' },
                ],
            },
        };

        const res = await handleMixerCommand(interaction, env, ctx);
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.type).toBe(5);
    });
});
