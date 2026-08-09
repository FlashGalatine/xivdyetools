/**
 * Tests for /preferences Command Handler
 *
 * `/preferences` shows and edits a user's personal settings — race/clan, home
 * world, language, theme and dye filters. Every one of its responses is
 * therefore private: nobody else in the channel has a reason to see them, and
 * some (home world, language) are mildly identifying.
 *
 * The error paths were always ephemeral; the success paths were not, so
 * `/preferences show` broadcast a user's settings to the whole channel. These
 * tests pin the invariant so it cannot regress silently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePreferencesCommand } from './preferences.js';
import { MessageFlags } from '../../utils/response.js';

vi.mock('../../services/bot-i18n.js', () => ({
    createUserTranslator: vi.fn(() =>
        Promise.resolve({
            t: vi.fn((key: string) => key),
            getLocale: () => 'en',
            locale: 'en',
        })
    ),
}));

vi.mock('../../services/preferences.js', () => ({
    getUserPreferences: vi.fn(() => Promise.resolve({})),
    setPreference: vi.fn(() => Promise.resolve({ success: true })),
    resetPreference: vi.fn(() => Promise.resolve({ success: true })),
    getDefaultValue: vi.fn(() => undefined),
    getAffectedCommands: vi.fn(() => []),
}));

describe('handlers/commands/preferences.ts', () => {
    // The filters subcommands write to KV directly rather than through the
    // preferences service, so the KV double needs delete() as well.
    const mockEnv = {
        KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    } as unknown as Parameters<typeof handlePreferencesCommand>[1];

    const mockCtx = { waitUntil: vi.fn() } as unknown as ExecutionContext;

    function interactionFor(options: unknown[]) {
        return {
            id: '123',
            token: 'token',
            application_id: 'app',
            locale: 'en-US',
            member: { user: { id: 'user123' } },
            data: { name: 'preferences', options },
        } as unknown as Parameters<typeof handlePreferencesCommand>[0];
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('every response is ephemeral', () => {
        // Each entry is a real /preferences invocation. The production change
        // that would fail these is removing the ephemeral flag from any
        // success path in preferences.ts.
        const invocations: Array<{ name: string; options: unknown[] }> = [
            { name: 'show', options: [{ name: 'show', type: 1, options: [] }] },
            {
                name: 'set',
                options: [
                    {
                        name: 'set',
                        type: 1,
                        options: [{ name: 'language', type: 3, value: 'ja' }],
                    },
                ],
            },
            {
                name: 'reset',
                options: [
                    {
                        name: 'reset',
                        type: 1,
                        options: [{ name: 'setting', type: 3, value: 'language' }],
                    },
                ],
            },
            {
                name: 'filters show',
                options: [
                    { name: 'filters', type: 2, options: [{ name: 'show', type: 1, options: [] }] },
                ],
            },
            {
                name: 'filters set',
                options: [
                    {
                        name: 'filters',
                        type: 2,
                        options: [
                            {
                                name: 'set',
                                type: 1,
                                options: [{ name: 'metallic', type: 5, value: true }],
                            },
                        ],
                    },
                ],
            },
            {
                name: 'filters reset',
                options: [
                    { name: 'filters', type: 2, options: [{ name: 'reset', type: 1, options: [] }] },
                ],
            },
        ];

        for (const { name, options } of invocations) {
            it(`/preferences ${name} responds ephemerally`, async () => {
                const response = await handlePreferencesCommand(
                    interactionFor(options),
                    mockEnv,
                    mockCtx
                );
                const body = (await response.json()) as { data?: { flags?: number } };

                expect(body.data?.flags).toBeDefined();
                expect((body.data?.flags ?? 0) & MessageFlags.EPHEMERAL).toBe(
                    MessageFlags.EPHEMERAL
                );
            });
        }

        it('rejects a missing subcommand ephemerally', async () => {
            const response = await handlePreferencesCommand(
                interactionFor([]),
                mockEnv,
                mockCtx
            );
            const body = (await response.json()) as { data?: { flags?: number } };

            expect((body.data?.flags ?? 0) & MessageFlags.EPHEMERAL).toBe(MessageFlags.EPHEMERAL);
        });
    });
});
