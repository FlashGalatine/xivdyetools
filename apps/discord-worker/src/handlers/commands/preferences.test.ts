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

// The KV-touching entry points are stubbed; `validatePreferenceValue` stays
// real so the world-shape guard is exercised through the handler.
vi.mock('../../services/preferences.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../services/preferences.js')>()),
    getUserPreferences: vi.fn(() => Promise.resolve({})),
    setPreference: vi.fn(() => Promise.resolve({ success: true })),
    resetPreference: vi.fn(() => Promise.resolve({ success: true })),
    getDefaultValue: vi.fn(() => undefined),
    getAffectedCommands: vi.fn(() => []),
}));

const mockValidateWorld = vi.fn();
vi.mock('../../services/budget/index.js', () => ({
    validateWorld: (...args: unknown[]) => mockValidateWorld(...args),
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

    /**
     * FINDING-019 (2026-08-29 security audit): `/preferences set world:` wrote
     * whatever the user typed into `prefs:v1:<userId>` — the same field
     * `/budget set_world` fills after a Universalis lookup — and `/budget`
     * then forwarded it to the proxy and the price-cache key. This path now
     * mirrors `set_world`: shape guard, lookup, canonical name.
     */
    describe('/preferences set world (FINDING-019)', () => {
        function setWorld(value: string) {
            return interactionFor([
                { name: 'set', type: 1, options: [{ name: 'world', type: 3, value }] },
            ]);
        }

        async function description(response: Response): Promise<string> {
            const body = (await response.json()) as {
                data?: { embeds?: Array<{ description?: string }> };
            };
            return body.data?.embeds?.[0]?.description ?? '';
        }

        it('stores the canonical name the validator returns', async () => {
            const { setPreference } = await import('../../services/preferences.js');
            mockValidateWorld.mockResolvedValue('Balmung');

            const response = await handlePreferencesCommand(setWorld('balmung'), mockEnv, mockCtx);

            expect(mockValidateWorld).toHaveBeenCalledWith(mockEnv, 'balmung', undefined);
            expect(setPreference).toHaveBeenCalledWith(
                mockEnv.KV,
                'user123',
                'world',
                'Balmung',
                undefined
            );
            expect(await description(response)).toContain('Balmung');
        });

        it('trims the typed value before looking it up', async () => {
            mockValidateWorld.mockResolvedValue('Balmung');

            await handlePreferencesCommand(setWorld('  balmung  '), mockEnv, mockCtx);

            expect(mockValidateWorld).toHaveBeenCalledWith(mockEnv, 'balmung', undefined);
        });

        it('stores nothing and answers the invalid-world reply for an unknown world', async () => {
            const { setPreference } = await import('../../services/preferences.js');
            mockValidateWorld.mockResolvedValue(null);

            const response = await handlePreferencesCommand(setWorld('Nowhere'), mockEnv, mockCtx);

            expect(setPreference).not.toHaveBeenCalled();
            expect(await description(response)).toContain('preferences.validation.invalidWorld');
        });

        it('refuses an over-long value without spending a lookup', async () => {
            const { setPreference } = await import('../../services/preferences.js');

            const response = await handlePreferencesCommand(
                setWorld('B'.repeat(33)),
                mockEnv,
                mockCtx
            );

            expect(mockValidateWorld).not.toHaveBeenCalled();
            expect(setPreference).not.toHaveBeenCalled();
            expect(await description(response)).toContain('preferences.validation.invalidWorld');
        });

        it('leaves the other preference keys on their own path', async () => {
            const { setPreference } = await import('../../services/preferences.js');

            await handlePreferencesCommand(
                interactionFor([
                    { name: 'set', type: 1, options: [{ name: 'language', type: 3, value: 'ja' }] },
                ]),
                mockEnv,
                mockCtx
            );

            expect(mockValidateWorld).not.toHaveBeenCalled();
            expect(setPreference).toHaveBeenCalledWith(
                mockEnv.KV,
                'user123',
                'language',
                'ja',
                undefined
            );
        });
    });
});
