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
    setPreferences: vi.fn((_kv: unknown, _u: unknown, entries: unknown[]) =>
        Promise.resolve(entries.map(() => ({ success: true })))
    ),
    resetPreference: vi.fn(() => Promise.resolve({ success: true })),
    getDefaultValue: vi.fn(() => undefined),
    getAffectedCommands: vi.fn(() => []),
}));

const mockValidateWorld = vi.fn();
vi.mock('../../services/budget/index.js', () => ({
    validateWorld: (...args: unknown[]) => mockValidateWorld(...args),
}));

vi.mock('../../utils/discord-api.js', () => ({
    safeEditOriginalResponse: vi.fn(() => Promise.resolve(true)),
}));

describe('handlers/commands/preferences.ts', () => {
    // The filters subcommands write to KV directly rather than through the
    // preferences service, so the KV double needs delete() as well.
    const mockEnv = {
        DISCORD_CLIENT_ID: 'app',
        KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    } as unknown as Parameters<typeof handlePreferencesCommand>[1];

    let pending: Promise<unknown>[] = [];
    const mockCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
            pending.push(p);
        }),
    } as unknown as ExecutionContext;
    const settle = () => Promise.all(pending);

    /** The embed the handler last wrote over its deferred ack. */
    async function editedEmbed(): Promise<{ title?: string; description?: string }> {
        const { safeEditOriginalResponse } = await import('../../utils/discord-api.js');
        const calls = vi.mocked(safeEditOriginalResponse).mock.calls;
        expect(calls.length, 'the deferred ack was never edited').toBeGreaterThan(0);
        const options = calls[calls.length - 1][2] as {
            embeds?: Array<{ title?: string; description?: string }>;
        };
        return options.embeds?.[0] ?? {};
    }

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
        pending = [];
        mockValidateWorld.mockResolvedValue({ ok: true, name: 'Balmung' });
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
                // BUG-002: deferred for the world lookup — and still private
                name: 'set world',
                options: [
                    {
                        name: 'set',
                        type: 1,
                        options: [{ name: 'world', type: 3, value: 'balmung' }],
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
            const { setPreferences } = await import('../../services/preferences.js');
            mockValidateWorld.mockResolvedValue({ ok: true, name: 'Balmung' });

            await handlePreferencesCommand(setWorld('balmung'), mockEnv, mockCtx);
            await settle();

            expect(mockValidateWorld).toHaveBeenCalledWith(mockEnv, 'balmung', undefined);
            // BUG-029: every option in one `/preferences set` is now written
            // in a single read-modify-write, so the handler queues entries and
            // calls `setPreferences` once instead of `setPreference` per key.
            expect(setPreferences).toHaveBeenCalledWith(
                mockEnv.KV,
                'user123',
                [{ key: 'world', value: 'Balmung' }],
                undefined
            );
            expect((await editedEmbed()).description).toContain('Balmung');
        });

        it('trims the typed value before looking it up', async () => {
            mockValidateWorld.mockResolvedValue({ ok: true, name: 'Balmung' });

            await handlePreferencesCommand(setWorld('  balmung  '), mockEnv, mockCtx);
            await settle();

            expect(mockValidateWorld).toHaveBeenCalledWith(mockEnv, 'balmung', undefined);
        });

        it('stores nothing and answers the invalid-world reply for an unknown world', async () => {
            const { setPreferences } = await import('../../services/preferences.js');
            mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

            await handlePreferencesCommand(setWorld('Nowhere'), mockEnv, mockCtx);
            await settle();

            expect(setPreferences).not.toHaveBeenCalled();
            expect((await editedEmbed()).description).toContain(
                'preferences.validation.invalidWorld'
            );
        });

        /**
         * BUG-002 (2026-10-04 deep dive): the lookup is up to two sequential
         * service-binding fetches on a cold cache. It used to be awaited
         * before the handler answered at all, so a slow Universalis became
         * Discord's "The application did not respond".
         */
        it('acks privately before the world lookup settles (BUG-002)', async () => {
            const { setPreferences } = await import('../../services/preferences.js');
            let release!: (value: unknown) => void;
            mockValidateWorld.mockReturnValue(new Promise((resolve) => (release = resolve)));

            const response = await Promise.race([
                handlePreferencesCommand(setWorld('balmung'), mockEnv, mockCtx),
                new Promise<'no ack'>((resolve) => setTimeout(() => resolve('no ack'), 100)),
            ]);

            expect(response, 'the handler waited on the world lookup before acking').not.toBe(
                'no ack'
            );
            const body = (await (response as Response).json()) as {
                type: number;
                data?: { flags?: number };
            };
            expect(body.type).toBe(5);
            expect(body.data?.flags).toBe(MessageFlags.EPHEMERAL);
            expect(setPreferences).not.toHaveBeenCalled();

            release({ ok: true, name: 'Balmung' });
            await settle();
            expect(setPreferences).toHaveBeenCalledTimes(1);
            expect((await editedEmbed()).description).toContain('Balmung');
        });

        it('writes a world and the other options together after the defer', async () => {
            const { setPreferences } = await import('../../services/preferences.js');

            await handlePreferencesCommand(
                interactionFor([
                    {
                        name: 'set',
                        type: 1,
                        options: [
                            { name: 'language', type: 3, value: 'ja' },
                            { name: 'world', type: 3, value: 'balmung' },
                        ],
                    },
                ]),
                mockEnv,
                mockCtx
            );
            await settle();

            expect(setPreferences).toHaveBeenCalledTimes(1);
            expect(setPreferences).toHaveBeenCalledWith(
                mockEnv.KV,
                'user123',
                [
                    { key: 'language', value: 'ja' },
                    { key: 'world', value: 'Balmung' },
                ],
                undefined
            );
        });

        it('still edits the ack when the background work throws', async () => {
            mockValidateWorld.mockRejectedValue(new Error('binding exploded'));

            await handlePreferencesCommand(setWorld('balmung'), mockEnv, mockCtx);
            await settle();

            expect((await editedEmbed()).description).toBe('preferences.validation.error');
        });

        it('refuses an over-long value without spending a lookup — or a defer', async () => {
            const { setPreferences } = await import('../../services/preferences.js');

            const response = await handlePreferencesCommand(
                setWorld('B'.repeat(33)),
                mockEnv,
                mockCtx
            );

            expect(mockValidateWorld).not.toHaveBeenCalled();
            expect(setPreferences).not.toHaveBeenCalled();
            expect(mockCtx.waitUntil).not.toHaveBeenCalled();
            expect(await description(response)).toContain('preferences.validation.invalidWorld');
        });

        it('leaves the other preference keys on their own path', async () => {
            const { setPreferences } = await import('../../services/preferences.js');

            await handlePreferencesCommand(
                interactionFor([
                    { name: 'set', type: 1, options: [{ name: 'language', type: 3, value: 'ja' }] },
                ]),
                mockEnv,
                mockCtx
            );

            expect(mockValidateWorld).not.toHaveBeenCalled();
            expect(setPreferences).toHaveBeenCalledWith(
                mockEnv.KV,
                'user123',
                [{ key: 'language', value: 'ja' }],
                undefined
            );
            // No lookup, so no reason to defer: answered in the ack itself
            expect(mockCtx.waitUntil).not.toHaveBeenCalled();
        });

        /**
         * BUG-029: the write used to be one `setPreference` per option, each a
         * full get → mutate → put of the SAME `prefs:v1:{userId}` key. KV
         * allows one write per second per key and its reads are eventually
         * consistent, so a later iteration could read the pre-update object
         * and write back a version missing an earlier key — while the embed
         * still reported all of them saved. `/preferences set` advertises this
         * exact multi-option usage in its own docstring.
         *
         * The mock has no per-key write throttle and no shared document, so
         * the lost write itself can never be reproduced in this suite. What
         * CAN be pinned is the shape that makes it impossible: one call,
         * carrying every option.
         */
        it('writes every option in a single call, not one per option', async () => {
            const { setPreferences } = await import('../../services/preferences.js');

            await handlePreferencesCommand(
                interactionFor([
                    {
                        name: 'set',
                        type: 1,
                        options: [
                            { name: 'language', type: 3, value: 'ja' },
                            { name: 'matching', type: 3, value: 'oklab' },
                            { name: 'theme', type: 3, value: 'light' },
                        ],
                    },
                ]),
                mockEnv,
                mockCtx
            );

            expect(setPreferences).toHaveBeenCalledTimes(1);
            expect(setPreferences).toHaveBeenCalledWith(
                mockEnv.KV,
                'user123',
                [
                    { key: 'language', value: 'ja' },
                    { key: 'matching', value: 'oklab' },
                    { key: 'theme', value: 'light' },
                ],
                undefined
            );
        });
    });

    /**
     * BUG-048 (2026-10-04 deep dive): the filters writers read the blob with
     * the lenient `getUserPreferences`, which answers a failed read with
     * `{}` — so `filters set` then put `{ dyeFilters }` over every other
     * preference, and `filters reset` deleted the whole blob, both reporting
     * success.
     */
    describe('a failed read never becomes a write (BUG-048)', () => {
        const filtersSet = interactionFor([
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
        ]);
        const filtersReset = interactionFor([
            { name: 'filters', type: 2, options: [{ name: 'reset', type: 1, options: [] }] },
        ]);
        const resetFiltersKey = interactionFor([
            { name: 'reset', type: 1, options: [{ name: 'key', type: 3, value: 'filters' }] },
        ]);

        async function body(response: Response) {
            return (await response.json()) as {
                data?: { flags?: number; embeds?: Array<{ title?: string; description?: string }> };
            };
        }

        it('filters set writes nothing when the read fails', async () => {
            vi.mocked(mockEnv.KV.get).mockRejectedValueOnce(new Error('KV down'));

            const reply = await body(await handlePreferencesCommand(filtersSet, mockEnv, mockCtx));

            expect(mockEnv.KV.put).not.toHaveBeenCalled();
            expect(mockEnv.KV.delete).not.toHaveBeenCalled();
            expect(reply.data?.embeds?.[0]?.description).toBe('preferences.validation.error');
            expect((reply.data?.flags ?? 0) & MessageFlags.EPHEMERAL).toBe(MessageFlags.EPHEMERAL);
        });

        it('filters reset deletes nothing when the read fails', async () => {
            vi.mocked(mockEnv.KV.get).mockRejectedValueOnce(new Error('KV down'));

            const reply = await body(await handlePreferencesCommand(filtersReset, mockEnv, mockCtx));

            expect(mockEnv.KV.put).not.toHaveBeenCalled();
            expect(mockEnv.KV.delete).not.toHaveBeenCalled();
            expect(reply.data?.embeds?.[0]?.description).toBe('preferences.reset.failed');
        });

        it('reset key:filters takes the same guarded path', async () => {
            vi.mocked(mockEnv.KV.get).mockRejectedValueOnce(new Error('KV down'));

            await handlePreferencesCommand(resetFiltersKey, mockEnv, mockCtx);

            expect(mockEnv.KV.delete).not.toHaveBeenCalled();
        });

        it('filters set keeps the other preferences on a clean read', async () => {
            vi.mocked(mockEnv.KV.get).mockResolvedValueOnce(
                JSON.stringify({ theme: 'light', world: 'Balmung' }) as never
            );

            await handlePreferencesCommand(filtersSet, mockEnv, mockCtx);

            const written = JSON.parse(vi.mocked(mockEnv.KV.put).mock.calls[0][1] as string);
            expect(written).toMatchObject({
                theme: 'light',
                world: 'Balmung',
                dyeFilters: { excludeMetallic: true },
            });
        });

        it('filters set reports a failed write instead of throwing', async () => {
            vi.mocked(mockEnv.KV.get).mockResolvedValueOnce(JSON.stringify({ theme: 'light' }) as never);
            vi.mocked(mockEnv.KV.put).mockRejectedValueOnce(new Error('KV down'));

            const reply = await body(await handlePreferencesCommand(filtersSet, mockEnv, mockCtx));

            expect(reply.data?.embeds?.[0]?.description).toBe('preferences.validation.error');
        });

        // The other kind of failed read: a blob that does not parse is
        // nothing to preserve, and refusing to write over it would refuse
        // forever. The write replaces it.
        it('filters set replaces an unreadable blob instead of refusing forever', async () => {
            vi.mocked(mockEnv.KV.get).mockResolvedValueOnce('{not json' as never);

            const reply = await body(await handlePreferencesCommand(filtersSet, mockEnv, mockCtx));

            const written = JSON.parse(vi.mocked(mockEnv.KV.put).mock.calls[0][1] as string);
            expect(written).toMatchObject({ dyeFilters: { excludeMetallic: true } });
            expect(reply.data?.embeds?.[0]?.description).not.toBe('preferences.validation.error');
        });
    });

    /**
     * Sprint 9 review: the BUG-048 guards answer a failed read or write with
     * an error embed — and, unmarked, the trace then recorded it as `ok`.
     * Before them the KV rejection reached the dispatcher's catch, which
     * marked it; catching it here took that mark away. Every error embed for
     * something of ours that broke now marks the outcome itself.
     */
    describe('a failed read or write is recorded as a failure', () => {
        const filtersSet = interactionFor([
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
        ]);
        const filtersReset = interactionFor([
            { name: 'filters', type: 2, options: [{ name: 'reset', type: 1, options: [] }] },
        ]);
        const resetFiltersKey = interactionFor([
            { name: 'reset', type: 1, options: [{ name: 'key', type: 3, value: 'filters' }] },
        ]);

        async function traced(interaction: Parameters<typeof handlePreferencesCommand>[0]) {
            const { startCommandTrace } = await import('../../services/command-trace.js');
            return startCommandTrace(interaction, {
                command: 'preferences',
                subcommand: 'filters',
                userId: 'user123',
                locale: 'en',
            });
        }

        it.each([
            ['filters set', filtersSet],
            ['filters reset', filtersReset],
            ['reset key:filters', resetFiltersKey],
        ])('%s: a failed read', async (_name, interaction) => {
            const trace = await traced(interaction);
            vi.mocked(mockEnv.KV.get).mockRejectedValueOnce(new Error('KV down'));

            await handlePreferencesCommand(interaction, mockEnv, mockCtx);

            expect(trace.outcome).toBe('unknown');
        });

        it('filters set: a failed write', async () => {
            const trace = await traced(filtersSet);
            vi.mocked(mockEnv.KV.get).mockResolvedValueOnce(JSON.stringify({ theme: 'light' }) as never);
            vi.mocked(mockEnv.KV.put).mockRejectedValueOnce(new Error('KV down'));

            await handlePreferencesCommand(filtersSet, mockEnv, mockCtx);

            expect(trace.outcome).toBe('unknown');
        });

        it('filters reset: a failed write over other preferences', async () => {
            const trace = await traced(filtersReset);
            vi.mocked(mockEnv.KV.get).mockResolvedValueOnce(
                JSON.stringify({ theme: 'light', dyeFilters: { excludeMetallic: true } }) as never
            );
            vi.mocked(mockEnv.KV.put).mockRejectedValueOnce(new Error('KV down'));

            await handlePreferencesCommand(filtersReset, mockEnv, mockCtx);

            expect(trace.outcome).toBe('unknown');
        });

        it('filters reset: a failed delete of the last preference', async () => {
            const trace = await traced(filtersReset);
            vi.mocked(mockEnv.KV.get).mockResolvedValueOnce(
                JSON.stringify({ dyeFilters: { excludeMetallic: true } }) as never
            );
            vi.mocked(mockEnv.KV.delete).mockRejectedValueOnce(new Error('KV down'));

            await handlePreferencesCommand(filtersReset, mockEnv, mockCtx);

            expect(trace.outcome).toBe('unknown');
        });

        it('a clean filters set leaves the outcome unmarked (ok)', async () => {
            const trace = await traced(filtersSet);
            vi.mocked(mockEnv.KV.get).mockResolvedValueOnce(JSON.stringify({ theme: 'light' }) as never);

            await handlePreferencesCommand(filtersSet, mockEnv, mockCtx);

            expect(trace.outcome).toBeNull();
        });

        // The same guards made these two report failure where they used to
        // overwrite the blob and report success — so they are marked too.
        it('reset key: a failed reset', async () => {
            const { resetPreference } = await import('../../services/preferences.js');
            vi.mocked(resetPreference).mockResolvedValueOnce(false);
            const resetTheme = interactionFor([
                { name: 'reset', type: 1, options: [{ name: 'key', type: 3, value: 'theme' }] },
            ]);
            const trace = await traced(resetTheme);

            await handlePreferencesCommand(resetTheme, mockEnv, mockCtx);

            expect(trace.outcome).toBe('unknown');
        });

        it('set: a failed write', async () => {
            const { setPreferences } = await import('../../services/preferences.js');
            vi.mocked(setPreferences).mockResolvedValueOnce([{ success: false, reason: 'error' }]);
            const setTheme = interactionFor([
                { name: 'set', type: 1, options: [{ name: 'theme', type: 3, value: 'light' }] },
            ]);
            const trace = await traced(setTheme);

            await handlePreferencesCommand(setTheme, mockEnv, mockCtx);

            expect(trace.outcome).toBe('unknown');
        });

        it('set: a failed write after the world defer', async () => {
            const { setPreferences } = await import('../../services/preferences.js');
            vi.mocked(setPreferences).mockResolvedValueOnce([{ success: false, reason: 'error' }]);
            const setWorld = interactionFor([
                { name: 'set', type: 1, options: [{ name: 'world', type: 3, value: 'balmung' }] },
            ]);
            const trace = await traced(setWorld);

            await handlePreferencesCommand(setWorld, mockEnv, mockCtx);
            await settle();

            expect(trace.outcome).toBe('unknown');
        });

        it('set: a value the user got wrong is answered, not a failure', async () => {
            const { setPreferences } = await import('../../services/preferences.js');
            vi.mocked(setPreferences).mockResolvedValueOnce([
                { success: false, reason: 'invalidTheme' },
            ]);
            const setTheme = interactionFor([
                { name: 'set', type: 1, options: [{ name: 'theme', type: 3, value: 'neon' }] },
            ]);
            const trace = await traced(setTheme);

            await handlePreferencesCommand(setTheme, mockEnv, mockCtx);

            expect(trace.outcome).toBeNull();
        });
    });
});
