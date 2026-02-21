/**
 * Tests for /preset command handler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePresetCommand } from './preset.js';
import type { DiscordInteraction, Env, InteractionResponseBody } from '../../types/env.js';

// ---------------------------------------------------------------------------
// Mock Dyes
// ---------------------------------------------------------------------------
const dyeRed = { id: 1, name: 'Rolanberry Red', hex: '#FF0000', category: 'General', itemID: 1001 };
const dyeBlue = { id: 2, name: 'Ceruleum Blue', hex: '#0000FF', category: 'General', itemID: 1002 };
const dyeGreen = { id: 3, name: 'Celeste Green', hex: '#00FF00', category: 'General', itemID: 1003 };

// ---------------------------------------------------------------------------
// Mock Presets
// ---------------------------------------------------------------------------
const mockPreset = {
    id: 'preset-1',
    name: 'Test Preset',
    description: 'A test preset',
    category_id: 'glamour',
    dyes: [1, 2, 3],
    tags: ['test', 'glamour'],
    author_discord_id: 'user-1',
    author_name: 'tester',
    vote_count: 10,
    status: 'approved',
    is_curated: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@xivdyetools/core', () => {
    class MockDyeService {
        searchByName(query: string) {
            const lowerQuery = query.toLowerCase();
            if (lowerQuery.includes('red')) return [dyeRed];
            if (lowerQuery.includes('blue')) return [dyeBlue];
            if (lowerQuery.includes('green')) return [dyeGreen];
            return [];
        }
        getDyeById(id: number) {
            if (id === 1) return dyeRed;
            if (id === 2) return dyeBlue;
            if (id === 3) return dyeGreen;
            return null;
        }
    }

    return { DyeService: MockDyeService, dyeDatabase: [] };
});

vi.mock('../../services/emoji.js', () => ({ getDyeEmoji: (id: number) => id ? '🎨' : undefined }));
vi.mock('../../services/i18n.js', () => ({
    initializeLocale: vi.fn().mockResolvedValue(undefined),
    getLocalizedDyeName: (_id: number, name: string) => `${name}-localized`,
}));

const mockEditOriginalResponse = vi.fn().mockResolvedValue(undefined);
const mockSendMessage = vi.fn().mockResolvedValue(undefined);
vi.mock('../../utils/discord-api.js', () => ({
    editOriginalResponse: (...args: unknown[]) => mockEditOriginalResponse(...args),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

const mockRenderSvgToPng = vi.fn().mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4E, 0x47]));
vi.mock('../../services/svg/renderer.js', () => ({
    renderSvgToPng: (...args: unknown[]) => mockRenderSvgToPng(...args),
}));

vi.mock('../../services/svg/preset-swatch.js', () => ({
    generatePresetSwatch: vi.fn(() => '<svg></svg>'),
}));

// Preset API Mocks
const mockIsApiEnabled = vi.fn().mockReturnValue(true);
const mockGetPresets = vi.fn().mockResolvedValue({ presets: [mockPreset], total: 1 });
const mockGetPreset = vi.fn().mockResolvedValue(mockPreset);
const mockGetRandomPreset = vi.fn().mockResolvedValue(mockPreset);
const mockSubmitPreset = vi.fn().mockResolvedValue({ preset: mockPreset, moderation_status: 'approved' });
const mockHasVoted = vi.fn().mockResolvedValue(false);
const mockVoteForPreset = vi.fn().mockResolvedValue({ new_vote_count: 11 });
const mockRemoveVote = vi.fn().mockResolvedValue({ new_vote_count: 9 });
const mockIsModerator = vi.fn().mockReturnValue(false);
const mockEditPreset = vi.fn().mockResolvedValue({ success: true, preset: mockPreset, moderation_status: 'approved' });

vi.mock('../../services/preset-api.js', () => ({
    isApiEnabled: (...args: unknown[]) => mockIsApiEnabled(...args),
    getPresets: (...args: unknown[]) => mockGetPresets(...args),
    getPreset: (...args: unknown[]) => mockGetPreset(...args),
    getRandomPreset: (...args: unknown[]) => mockGetRandomPreset(...args),
    submitPreset: (...args: unknown[]) => mockSubmitPreset(...args),
    hasVoted: (...args: unknown[]) => mockHasVoted(...args),
    voteForPreset: (...args: unknown[]) => mockVoteForPreset(...args),
    removeVote: (...args: unknown[]) => mockRemoveVote(...args),
    isModerator: (...args: unknown[]) => mockIsModerator(...args),
    editPreset: (...args: unknown[]) => mockEditPreset(...args),
    getPendingPresets: vi.fn().mockResolvedValue([]),
    approvePreset: vi.fn().mockResolvedValue({ id: 'preset-1', name: 'Test Preset', status: 'approved' }),
    rejectPreset: vi.fn().mockResolvedValue({ id: 'preset-1', name: 'Test Preset', status: 'rejected' }),
    getModerationStats: vi.fn().mockResolvedValue({ pending_count: 5, approved_count: 100, rejected_count: 10, flagged_count: 2 }),
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
            'preset.title': 'Community Presets',
            'preset.randomTitle': 'Random Preset',
            'preset.apiDisabled': 'Preset API is disabled',
            'preset.noneInCategory': 'No presets in this category',
            'preset.notFound': 'Preset not found',
            'preset.notEnoughDyes': 'At least 2 dyes required',
            'preset.invalidDye': 'Invalid dye name',
            'preset.submitted': 'Preset Submitted',
            'preset.submittedApproved': 'Your preset has been approved!',
            'preset.submittedPending': 'Your preset is pending review',
            'preset.duplicateExists': 'Duplicate Exists',
            'preset.duplicateVoted': 'Vote added to existing preset',
            'preset.voteAdded': 'Vote Added',
            'preset.voteRemoved': 'Vote Removed',
            'preset.currentVotes': `Current votes: ${String(vars?.count ?? 0)}`,
            'preset.useShowTip': 'Use /preset show to view details',
            'preset.moderation.accessDenied': 'Access denied - moderators only',
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
        name: 'preset',
        options: [],
    },
    locale: 'en-US',
    member: { user: { id: 'user-1', username: 'tester', global_name: 'Tester' } },
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

describe('/preset command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsApiEnabled.mockReturnValue(true);
        mockGetPreset.mockResolvedValue(mockPreset);
        mockGetPresets.mockResolvedValue({ presets: [mockPreset], total: 1 });
        mockHasVoted.mockResolvedValue(false);
    });

    describe('API disabled', () => {
        it('returns error when preset API is disabled', async () => {
            mockIsApiEnabled.mockReturnValue(false);

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'list', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.embeds![0].description).toBe('Preset API is disabled');
        });
    });

    describe('invalid subcommand', () => {
        it('returns error for missing subcommand', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.content).toBe('Invalid command structure');
        });

        it('returns error for unknown subcommand', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'unknown', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.content).toContain('Unknown subcommand');
        });
    });

    describe('/preset list', () => {
        it('lists presets successfully', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'list', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.type).toBe(5); // Deferred
            expect(ctx.waitUntil).toHaveBeenCalled();
        });

        it('filters by category', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'list',
                        options: [{ name: 'category', value: 'glamour' }],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockGetPresets).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ category: 'glamour' })
            );
        });

        it('sorts by specified order', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'list',
                        options: [{ name: 'sort', value: 'recent' }],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockGetPresets).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ sort: 'recent' })
            );
        });

        it('shows message when no presets found', async () => {
            mockGetPresets.mockResolvedValueOnce({ presets: [], total: 0 });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'list', options: [] }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalled();
        });
    });

    describe('/preset show', () => {
        it('returns error when preset name is missing', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'show', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.embeds![0].description).toBe('Missing input');
        });

        it('shows preset details', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'show',
                        options: [{ name: 'name', value: 'preset-1' }],
                    }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.type).toBe(5); // Deferred
            expect(ctx.waitUntil).toHaveBeenCalled();
        });

        it('shows error when preset not found', async () => {
            mockGetPreset.mockResolvedValueOnce(null);

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'show',
                        options: [{ name: 'name', value: 'nonexistent' }],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({ description: 'Preset not found' }),
                    ]),
                })
            );
        });
    });

    describe('/preset random', () => {
        it('gets random preset', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'random', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.type).toBe(5);
            expect(ctx.waitUntil).toHaveBeenCalled();
        });

        it('gets random preset by category', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'random',
                        options: [{ name: 'category', value: 'glamour' }],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockGetRandomPreset).toHaveBeenCalledWith(
                expect.anything(),
                'glamour'
            );
        });
    });

    describe('/preset submit', () => {
        it('returns error when required fields are missing', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'submit',
                        options: [{ name: 'preset_name', value: 'Test' }],
                    }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.embeds![0].description).toBe('Missing input');
        });

        it('returns error when less than 2 dyes provided', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'submit',
                        options: [
                            { name: 'preset_name', value: 'Test Preset' },
                            { name: 'description', value: 'A test' },
                            { name: 'category', value: 'glamour' },
                            { name: 'dye1', value: 'Rolanberry Red' },
                        ],
                    }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.embeds![0].description).toBe('At least 2 dyes required');
        });

        it('returns error for invalid dye name', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'submit',
                        options: [
                            { name: 'preset_name', value: 'Test Preset' },
                            { name: 'description', value: 'A test' },
                            { name: 'category', value: 'glamour' },
                            { name: 'dye1', value: 'Rolanberry Red' },
                            { name: 'dye2', value: 'Unknown Dye' },
                        ],
                    }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.embeds![0].description).toBe('Invalid dye name');
        });

        it('submits preset successfully', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'submit',
                        options: [
                            { name: 'preset_name', value: 'Test Preset' },
                            { name: 'description', value: 'A test' },
                            { name: 'category', value: 'glamour' },
                            { name: 'dye1', value: 'Rolanberry Red' },
                            { name: 'dye2', value: 'Ceruleum Blue' },
                        ],
                    }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.type).toBe(5);
            expect(ctx.waitUntil).toHaveBeenCalled();
        });

        it('parses tags from comma-separated input', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'submit',
                        options: [
                            { name: 'preset_name', value: 'Test Preset' },
                            { name: 'description', value: 'A test' },
                            { name: 'category', value: 'glamour' },
                            { name: 'dye1', value: 'Rolanberry Red' },
                            { name: 'dye2', value: 'Ceruleum Blue' },
                            { name: 'tags', value: 'tag1, tag2, tag3' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockSubmitPreset).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ tags: ['tag1', 'tag2', 'tag3'] }),
                expect.anything(),
                expect.anything()
            );
        });
    });

    describe('/preset vote', () => {
        it('returns error when preset ID is missing', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'vote', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.embeds![0].description).toBe('Missing input');
        });

        it('adds vote when not already voted', async () => {
            mockHasVoted.mockResolvedValueOnce(false);

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'vote',
                        options: [{ name: 'preset', value: 'preset-1' }],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockVoteForPreset).toHaveBeenCalled();
        });

        it('removes vote when already voted', async () => {
            mockHasVoted.mockResolvedValueOnce(true);

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'vote',
                        options: [{ name: 'preset', value: 'preset-1' }],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockRemoveVote).toHaveBeenCalled();
        });
    });

    describe('/preset edit', () => {
        it('returns error when preset ID is missing', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'edit', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.embeds![0].description).toBe('Missing input');
        });

        it('returns error when no updates provided', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [{ name: 'preset', value: 'preset-1' }],
                    }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.data!.embeds![0].description).toContain('at least one field');
        });

        it('edits preset successfully', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'name', value: 'Updated Name' },
                        ],
                    }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            expect(res).toBeDefined();
            expect(ctx.waitUntil).toHaveBeenCalled();
        });

        it('returns error when preset not found', async () => {
            mockGetPreset.mockResolvedValueOnce(null);

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'nonexistent' },
                            { name: 'name', value: 'Updated Name' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: 'Preset not found',
                        }),
                    ]),
                })
            );
        });

        it('returns error when user does not own the preset', async () => {
            mockGetPreset.mockResolvedValueOnce({
                ...mockPreset,
                author_discord_id: 'different-user',
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'name', value: 'Updated Name' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: 'You can only edit your own presets.',
                        }),
                    ]),
                })
            );
        });

        it('edits preset with description only', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'description', value: 'New Description' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditPreset).toHaveBeenCalledWith(
                expect.anything(),
                'preset-1',
                expect.objectContaining({ description: 'New Description' }),
                expect.anything(),
                expect.anything()
            );
        });

        it('edits preset with tags', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'tags', value: 'tag1, tag2, tag3' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditPreset).toHaveBeenCalledWith(
                expect.anything(),
                'preset-1',
                expect.objectContaining({ tags: ['tag1', 'tag2', 'tag3'] }),
                expect.anything(),
                expect.anything()
            );
        });

        it('edits preset with dye replacement at existing position', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'dye1', value: 'Ceruleum Blue' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditPreset).toHaveBeenCalledWith(
                expect.anything(),
                'preset-1',
                expect.objectContaining({
                    dyes: expect.arrayContaining([2]), // dyeBlue.id
                }),
                expect.anything(),
                expect.anything()
            );
        });

        it('edits preset with dye addition extending array', async () => {
            mockGetPreset.mockResolvedValueOnce({
                ...mockPreset,
                dyes: [1, 2], // Only 2 dyes
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'dye3', value: 'Celeste Green' }, // Add at position 3
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditPreset).toHaveBeenCalledWith(
                expect.anything(),
                'preset-1',
                expect.objectContaining({
                    dyes: [1, 2, 3], // Extended with green
                }),
                expect.anything(),
                expect.anything()
            );
        });

        it('returns error for invalid dye name in edit', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'dye1', value: 'Nonexistent Dye' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: expect.stringContaining('Invalid dye'),
                        }),
                    ]),
                })
            );
        });

        it('returns error when dye count falls below 2', async () => {
            mockGetPreset.mockResolvedValueOnce({
                ...mockPreset,
                dyes: [1], // Only 1 dye (invalid)
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'dye1', value: 'Rolanberry Red' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: expect.stringContaining('2-5 dyes'),
                        }),
                    ]),
                })
            );
        });

        it('handles duplicate_dyes error from API', async () => {
            mockEditPreset.mockResolvedValueOnce({
                success: false,
                error: 'duplicate_dyes',
                duplicate: {
                    id: 'other-preset',
                    name: 'Existing Preset',
                    author_name: 'Other Author',
                },
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'name', value: 'Updated Name' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            title: expect.stringContaining('Duplicate'),
                        }),
                    ]),
                })
            );
        });

        it('shows pending status when edit requires moderation', async () => {
            mockEditPreset.mockResolvedValueOnce({
                success: true,
                preset: { ...mockPreset, name: 'Updated Name' },
                moderation_status: 'pending',
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'name', value: 'Updated Name' },
                        ],
                    }],
                },
            };

            const envWithMod = { ...env, MODERATION_CHANNEL_ID: 'mod-channel' } as Env;
            await handlePresetCommand(interaction, envWithMod, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            title: expect.stringContaining('Pending Review'),
                        }),
                    ]),
                })
            );
            expect(mockSendMessage).toHaveBeenCalled();
        });

        it('shows approved status for immediate edit approval', async () => {
            mockEditPreset.mockResolvedValueOnce({
                success: true,
                preset: { ...mockPreset, name: 'Updated Name' },
                moderation_status: 'approved',
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'name', value: 'Updated Name' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            title: expect.stringContaining('Updated'),
                        }),
                    ]),
                })
            );
        });

        it('handles API error during edit', async () => {
            mockEditPreset.mockRejectedValueOnce(new Error('API error'));

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'name', value: 'Updated Name' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: expect.stringContaining('Failed to edit'),
                        }),
                    ]),
                })
            );
        });
    });

    // Note: /preset moderate tests removed
    // Moderation commands (moderate, ban_user, unban_user) are now handled
    // by xivdyetools-moderation-worker

    describe('DM context handling', () => {
        it('handles user from DM context (no member)', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                member: undefined,
                user: { id: 'dm-user-1', username: 'dm-tester', global_name: 'DM Tester' },
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'list', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            const body = (await res.json()) as InteractionResponseBody;

            expect(body.type).toBe(5);
        });
    });

    describe('/preset list edge cases', () => {
        it('shows default "No presets found" message when no category filter and empty results', async () => {
            mockGetPresets.mockResolvedValueOnce({ presets: [], total: 0 });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'list', options: [] }], // No category
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: 'No presets found.',
                        }),
                    ]),
                })
            );
        });

        it('handles API error in list command', async () => {
            mockGetPresets.mockRejectedValueOnce(new Error('API error'));

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'list', options: [] }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: 'Failed to load presets.',
                        }),
                    ]),
                })
            );
        });
    });

    describe('/preset random edge cases', () => {
        it('shows "No presets found" without category when no preset available', async () => {
            mockGetRandomPreset.mockResolvedValueOnce(null);

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'random', options: [] }], // No category
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: 'No presets found.',
                        }),
                    ]),
                })
            );
        });

        it('shows category-specific message when no preset in category', async () => {
            mockGetRandomPreset.mockResolvedValueOnce(null);

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'random',
                        options: [{ name: 'category', value: 'glamour' }],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: 'No presets in this category',
                        }),
                    ]),
                })
            );
        });

        it('handles API error in random command', async () => {
            mockGetRandomPreset.mockRejectedValueOnce(new Error('API error'));

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'random', options: [] }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: 'Failed to load random preset.',
                        }),
                    ]),
                })
            );
        });
    });

    describe('/preset submit notifications', () => {
        it('notifies submission log channel when approved and SUBMISSION_LOG_CHANNEL_ID is set', async () => {
            mockSubmitPreset.mockResolvedValueOnce({
                success: true,
                preset: mockPreset,
                moderation_status: 'approved',
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'submit',
                        options: [
                            { name: 'preset_name', value: 'Test Preset' },
                            { name: 'description', value: 'A test' },
                            { name: 'category', value: 'glamour' },
                            { name: 'dye1', value: 'Rolanberry Red' },
                            { name: 'dye2', value: 'Ceruleum Blue' },
                        ],
                    }],
                },
            };

            const envWithSubmissionChannel = {
                ...env,
                SUBMISSION_LOG_CHANNEL_ID: 'submission-channel',
            } as Env;

            await handlePresetCommand(interaction, envWithSubmissionChannel, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.anything(),
                'submission-channel',
                expect.anything()
            );
        });

        it('notifies moderation channel when pending and MODERATION_CHANNEL_ID is set', async () => {
            mockSubmitPreset.mockResolvedValueOnce({
                success: true,
                preset: mockPreset,
                moderation_status: 'pending',
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'submit',
                        options: [
                            { name: 'preset_name', value: 'Test Preset' },
                            { name: 'description', value: 'A test' },
                            { name: 'category', value: 'glamour' },
                            { name: 'dye1', value: 'Rolanberry Red' },
                            { name: 'dye2', value: 'Ceruleum Blue' },
                        ],
                    }],
                },
            };

            const envWithModerationChannel = {
                ...env,
                MODERATION_CHANNEL_ID: 'moderation-channel',
            } as Env;

            await handlePresetCommand(interaction, envWithModerationChannel, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.anything(),
                'moderation-channel',
                expect.anything()
            );
        });

        it('handles PresetAPIError in submit command', async () => {
            const { PresetAPIError } = await import('../../types/preset.js');
            mockSubmitPreset.mockRejectedValueOnce(
                new PresetAPIError(409, 'Preset name already exists')
            );

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'submit',
                        options: [
                            { name: 'preset_name', value: 'Test Preset' },
                            { name: 'description', value: 'A test' },
                            { name: 'category', value: 'glamour' },
                            { name: 'dye1', value: 'Rolanberry Red' },
                            { name: 'dye2', value: 'Ceruleum Blue' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            // PresetAPIError uses the message in the embed
            expect(mockEditOriginalResponse).toHaveBeenCalled();
            const call = mockEditOriginalResponse.mock.calls[0];
            expect(call[2].embeds[0].title).toContain('Error');
        });

        it('handles duplicate preset with vote_added', async () => {
            mockSubmitPreset.mockResolvedValueOnce({
                duplicate: {
                    id: 'existing-1',
                    name: 'Existing Preset',
                    author_name: 'Original Author',
                    vote_count: 5,
                },
                vote_added: true,
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'submit',
                        options: [
                            { name: 'preset_name', value: 'Test Preset' },
                            { name: 'description', value: 'A test' },
                            { name: 'category', value: 'glamour' },
                            { name: 'dye1', value: 'Rolanberry Red' },
                            { name: 'dye2', value: 'Ceruleum Blue' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: expect.stringContaining('Vote added to existing preset'),
                        }),
                    ]),
                })
            );
        });
    });

    describe('/preset show edge cases', () => {
        it('handles API error in show command', async () => {
            mockGetPreset.mockRejectedValueOnce(new Error('API error'));

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'show',
                        options: [{ name: 'name', value: 'preset-1' }],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: 'Failed to load preset.',
                        }),
                    ]),
                })
            );
        });
    });

    describe('/preset vote edge cases', () => {
        it('handles API error in vote command', async () => {
            mockHasVoted.mockResolvedValueOnce(false);
            mockVoteForPreset.mockRejectedValueOnce(new Error('API error'));

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'vote',
                        options: [{ name: 'preset', value: 'preset-1' }],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockEditOriginalResponse).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: 'Failed to process vote.',
                        }),
                    ]),
                })
            );
        });
    });

    describe('/preset edit notifications', () => {
        it('notifies moderation channel with all change types (name, description, dyes, tags)', async () => {
            mockGetPreset.mockResolvedValueOnce({
                ...mockPreset,
                name: 'Original Name',
                description: 'Original description',
                dyes: [1, 2],
                tags: ['old-tag'],
            });
            mockEditPreset.mockResolvedValueOnce({
                success: true,
                preset: {
                    ...mockPreset,
                    name: 'New Name',
                    description: 'New description',
                    dyes: [1, 2, 3],
                    tags: ['new-tag'],
                },
                moderation_status: 'pending',
            });

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'name', value: 'New Name' },
                            { name: 'description', value: 'New description' },
                            { name: 'tags', value: 'new-tag' },
                            { name: 'dye3', value: 'Celeste Green' },
                        ],
                    }],
                },
            };

            const envWithMod = { ...env, MODERATION_CHANNEL_ID: 'mod-channel' } as Env;
            await handlePresetCommand(interaction, envWithMod, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.anything(),
                'mod-channel',
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            description: expect.stringContaining('Changes:'),
                        }),
                    ]),
                })
            );
        });

        it('handles PresetAPIError in edit command', async () => {
            const { PresetAPIError } = await import('../../types/preset.js');
            mockEditPreset.mockRejectedValueOnce(
                new PresetAPIError(403, 'Unauthorized to edit this preset')
            );

            const interaction: DiscordInteraction = {
                ...baseInteraction,
                data: {
                    ...baseInteraction.data,
                    options: [{
                        type: 1,
                        name: 'edit',
                        options: [
                            { name: 'preset', value: 'preset-1' },
                            { name: 'name', value: 'Updated Name' },
                        ],
                    }],
                },
            };

            await handlePresetCommand(interaction, env, ctx);
            await new Promise((resolve) => setTimeout(resolve, 100));

            // PresetAPIError uses the message in the embed
            expect(mockEditOriginalResponse).toHaveBeenCalled();
            const call = mockEditOriginalResponse.mock.calls[0];
            expect(call[2].embeds[0].title).toContain('Error');
        });
    });

    // Note: /preset moderate approvals tests removed
    // Moderation commands are now handled by xivdyetools-moderation-worker

    describe('user fallback handling', () => {
        it('falls back to username when global_name is not available', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                member: {
                    user: {
                        id: 'user-1',
                        username: 'fallback-username',
                        // no global_name
                    },
                },
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'list', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            expect(res).toBeDefined();
        });

        it('falls back to DM user username when no global_name', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                member: undefined,
                user: {
                    id: 'dm-user-1',
                    username: 'dm-fallback-username',
                    // no global_name
                },
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'list', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            expect(res).toBeDefined();
        });

        it('uses "Unknown" when no user info available', async () => {
            const interaction: DiscordInteraction = {
                ...baseInteraction,
                member: undefined,
                user: undefined,
                data: {
                    ...baseInteraction.data,
                    options: [{ type: 1, name: 'list', options: [] }],
                },
            };

            const res = await handlePresetCommand(interaction, env, ctx);
            expect(res).toBeDefined();
        });
    });
});
