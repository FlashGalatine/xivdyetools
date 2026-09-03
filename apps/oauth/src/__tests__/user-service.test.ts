/**
 * User Service Tests
 * Tests for user database operations: findOrCreate, find by ID / provider ID
 *
 * FINDING-001 (2026-08-29 security audit): the `storeCharacters` /
 * `getCharacters` suites went with the functions and the `xivauth_characters`
 * table — the roster is no longer persisted anywhere.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { findOrCreateUser } from '../services/user-service.js';
import type { UserRow } from '../types.js';

/**
 * Creates a mock D1Database for testing user service operations
 * This is a more complete mock than the one in cloudflare-test.ts
 */
const createTestDB = () => {
    const users = new Map<string, UserRow>();

    const createStatement = (sql: string) => {
        let boundParams: unknown[] = [];

        const statement = {
            bind: (...params: unknown[]) => {
                boundParams = params;
                return statement;
            },
            first: async <T>(): Promise<T | null> => {
                // SELECT by xivauth_id
                if (sql.includes('SELECT') && sql.includes('xivauth_id = ?')) {
                    const xivauthId = boundParams[0] as string;
                    for (const user of users.values()) {
                        if (user.xivauth_id === xivauthId) {
                            return user as T;
                        }
                    }
                    return null;
                }
                // SELECT by discord_id
                if (sql.includes('SELECT') && sql.includes('discord_id = ?')) {
                    const discordId = boundParams[0] as string;
                    for (const user of users.values()) {
                        if (user.discord_id === discordId) {
                            return user as T;
                        }
                    }
                    return null;
                }
                // SELECT by id (used in updateUser and findUserById)
                if (sql.includes('SELECT') && sql.includes('WHERE id = ?')) {
                    const userId = boundParams[boundParams.length - 1] as string;
                    return (users.get(userId) as T) || null;
                }
                return null;
            },
            run: async () => {
                // INSERT new user
                if (sql.includes('INSERT INTO users')) {
                    const [id, discord_id, xivauth_id, auth_provider, username] =
                        boundParams as [string, string | null, string | null, string, string];
                    const now = new Date().toISOString();
                    users.set(id, {
                        id,
                        discord_id,
                        xivauth_id,
                        auth_provider,
                        username,
                        created_at: now,
                        updated_at: now,
                    });
                    return { success: true, meta: {} };
                }
                // UPDATE user
                if (sql.includes('UPDATE users')) {
                    const userId = boundParams[boundParams.length - 1] as string;
                    const existing = users.get(userId);
                    if (existing) {
                        // Parse the SET clause to get field values
                        // The bound params are in order: field values, then userId
                        const setFields = sql.match(/SET (.+) WHERE/)?.[1] || '';
                        const fieldNames = setFields.split(', ').map(f => f.split(' = ')[0]);

                        let paramIndex = 0;
                        for (const field of fieldNames) {
                            if (field === "updated_at") continue; // Skip datetime('now')
                            const value = boundParams[paramIndex] as string | null;
                            (existing as unknown as Record<string, unknown>)[field] = value;
                            paramIndex++;
                        }
                        existing.updated_at = new Date().toISOString();
                    }
                    return { success: true, meta: {} };
                }
                return { success: true, meta: {} };
            },
            all: async <T>(): Promise<D1Result<T>> => {
                return { results: [] as T[], success: true, meta: {} as D1Meta & Record<string, unknown> };
            },
        };
        return statement;
    };

    return {
        _users: users,
        batch: async (stmts: { run: () => Promise<unknown> }[]) => {
            const results = [];
            for (const stmt of stmts) {
                results.push(await stmt.run());
            }
            return results;
        },
        prepare: (sql: string) => createStatement(sql),
        exec: async () => ({ count: 0, duration: 0 }),
        dump: async () => new ArrayBuffer(0),
    } as unknown as D1Database & {
        _users: Map<string, UserRow>;
    };
};

describe('User Service', () => {
    let db: ReturnType<typeof createTestDB>;

    beforeEach(() => {
        db = createTestDB();
    });

    describe('findOrCreateUser', () => {
        it('should create a new user when none exists', async () => {
            const user = await findOrCreateUser(db, {
                discord_id: '123456789',
                username: 'testuser',
                auth_provider: 'discord',
            });

            expect(user.id).toBeTruthy();
            expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            expect(user.discord_id).toBe('123456789');
            expect(user.username).toBe('testuser');
            expect(user.auth_provider).toBe('discord');
        });

        it('should find existing user by xivauth_id', async () => {
            // Create user first
            const created = await findOrCreateUser(db, {
                xivauth_id: 'xivauth-uuid',
                username: 'original',
                auth_provider: 'xivauth',
            });

            // Try to create again - should find existing
            const found = await findOrCreateUser(db, {
                xivauth_id: 'xivauth-uuid',
                username: 'updated',
                auth_provider: 'xivauth',
            });

            expect(found.id).toBe(created.id);
            expect(found.username).toBe('updated');
        });

        it('should find existing user by discord_id', async () => {
            // Create user with Discord
            const created = await findOrCreateUser(db, {
                discord_id: '987654321',
                username: 'discorduser',
                auth_provider: 'discord',
            });

            // Try to find by discord_id
            const found = await findOrCreateUser(db, {
                discord_id: '987654321',
                username: 'discorduser_updated',
                auth_provider: 'discord',
            });

            expect(found.id).toBe(created.id);
        });

        it('should merge accounts when XIVAuth user has linked Discord', async () => {
            // Create user via Discord first
            const discordUser = await findOrCreateUser(db, {
                discord_id: '111222333',
                username: 'discorduser',
                auth_provider: 'discord',
            });

            // Now login via XIVAuth with same Discord ID linked
            const mergedUser = await findOrCreateUser(db, {
                xivauth_id: 'new-xivauth-id',
                discord_id: '111222333', // Same Discord ID
                username: 'Character Name',
                auth_provider: 'xivauth',
            });

            // Should be same user
            expect(mergedUser.id).toBe(discordUser.id);
            // Should have both IDs
            expect(mergedUser.xivauth_id).toBe('new-xivauth-id');
            expect(mergedUser.discord_id).toBe('111222333');
        });

        it('should handle null optional fields', async () => {
            const user = await findOrCreateUser(db, {
                discord_id: '555666777',
                username: 'user',
                auth_provider: 'discord',
            });

            expect(user.xivauth_id).toBeNull();
        });

        it('should preserve existing xivauth_id when logging in via Discord', async () => {
            // Create user via XIVAuth first
            const xivauthUser = await findOrCreateUser(db, {
                xivauth_id: 'original-xivauth-id',
                discord_id: '444555666',
                username: 'xivauthuser',
                auth_provider: 'xivauth',
            });

            // Login via Discord with same Discord ID
            const discordLogin = await findOrCreateUser(db, {
                discord_id: '444555666',
                username: 'discordlogin',
                auth_provider: 'discord',
            });

            // Should preserve xivauth_id
            expect(discordLogin.id).toBe(xivauthUser.id);
            expect(discordLogin.xivauth_id).toBe('original-xivauth-id');
        });

        /**
         * FINDING-013 / OAUTH-9 (2026-08-21 security audit): the account merge
         * used to be driven solely by the Discord link XIVAuth asserts — it
         * deleted the other local row, kept a stale xivauth_id on re-link, and
         * handed the Discord-first account's presets identity (and moderator
         * status) to the XIVAuth login. No silent merge: linking two existing
         * local accounts needs an explicit, signed-in confirmation step, which
         * does not exist yet — so it is simply not performed.
         */
        describe('account linking (no silent merge)', () => {
            const makeLogger = () => ({ info: vi.fn(), warn: vi.fn() });

            it('does not merge or delete when another local account already owns the linked Discord ID', async () => {
                const discordFirst = await findOrCreateUser(db, {
                    discord_id: '111122223333444455',
                    username: 'discord-first',
                    auth_provider: 'discord',
                });
                const xivauthOnly = await findOrCreateUser(db, {
                    xivauth_id: 'xivauth-no-discord-yet',
                    username: 'xivauth-only',
                    auth_provider: 'xivauth',
                });
                expect(xivauthOnly.id).not.toBe(discordFirst.id);

                const logger = makeLogger();
                // XIVAuth now asserts the same Discord account is linked to this XIVAuth user
                const result = await findOrCreateUser(
                    db,
                    {
                        xivauth_id: 'xivauth-no-discord-yet',
                        discord_id: '111122223333444455',
                        username: 'Character Name',
                        auth_provider: 'xivauth',
                    },
                    logger
                );

                // Still the XIVAuth user's own row, without the other account's Discord identity
                expect(result.id).toBe(xivauthOnly.id);
                expect(result.discord_id).toBeNull();
                // The Discord-first account survives untouched
                expect(db._users.get(discordFirst.id)).toBeDefined();
                expect(db._users.get(discordFirst.id)!.discord_id).toBe('111122223333444455');
                // Audit event, without raw identifiers
                expect(logger.warn).toHaveBeenCalledTimes(1);
                const [message, context] = logger.warn.mock.calls[0];
                expect(String(message)).toMatch(/not (linked|merged)/i);
                expect(JSON.stringify([message, context])).not.toContain('111122223333444455');
                expect(JSON.stringify([message, context])).not.toContain('xivauth-no-discord-yet');
            });

            it('links the asserted Discord ID when no other local account owns it', async () => {
                const xivauthOnly = await findOrCreateUser(db, {
                    xivauth_id: 'xivauth-links-discord',
                    username: 'xivauth-only',
                    auth_provider: 'xivauth',
                });

                const logger = makeLogger();
                const result = await findOrCreateUser(
                    db,
                    {
                        xivauth_id: 'xivauth-links-discord',
                        discord_id: '555566667777888899',
                        username: 'Character Name',
                        auth_provider: 'xivauth',
                    },
                    logger
                );

                expect(result.id).toBe(xivauthOnly.id);
                expect(result.discord_id).toBe('555566667777888899');
                expect(logger.warn).not.toHaveBeenCalled();
                expect(logger.info).toHaveBeenCalledTimes(1);
                expect(JSON.stringify(logger.info.mock.calls[0])).not.toContain('555566667777888899');
            });

            it('replaces a stale xivauth_id when a different XIVAuth account is linked to the same Discord ID', async () => {
                const row = await findOrCreateUser(db, {
                    xivauth_id: 'xivauth-old-account',
                    discord_id: '999988887777666655',
                    username: 'original',
                    auth_provider: 'xivauth',
                });

                const logger = makeLogger();
                const result = await findOrCreateUser(
                    db,
                    {
                        xivauth_id: 'xivauth-new-account',
                        discord_id: '999988887777666655',
                        username: 'relinked',
                        auth_provider: 'xivauth',
                    },
                    logger
                );

                expect(result.id).toBe(row.id);
                expect(result.xivauth_id).toBe('xivauth-new-account');
                expect(result.discord_id).toBe('999988887777666655');
                expect(logger.info).toHaveBeenCalledTimes(1);
                expect(JSON.stringify(logger.info.mock.calls[0])).not.toContain('xivauth-new-account');
            });

            it('does not overwrite an existing Discord link from an XIVAuth assertion', async () => {
                const row = await findOrCreateUser(db, {
                    xivauth_id: 'xivauth-keeps-discord',
                    discord_id: '121212121212121212',
                    username: 'original',
                    auth_provider: 'xivauth',
                });

                const result = await findOrCreateUser(db, {
                    xivauth_id: 'xivauth-keeps-discord',
                    discord_id: '343434343434343434', // XIVAuth now claims a different Discord account
                    username: 'relinked',
                    auth_provider: 'xivauth',
                });

                expect(result.id).toBe(row.id);
                expect(result.discord_id).toBe('121212121212121212');
            });
        });
    });

});

/**
 * Test updateUser error handling - when user not found after update
 * This tests line 127-129 of user-service.ts
 */
describe('User Service - Error Handling', () => {
    it('should throw error if user not found after update', async () => {
        // Create a mock DB that returns null on SELECT after UPDATE
        const errorDB = {
            prepare: (sql: string) => ({
                bind: () => ({
                    first: async () => {
                        // Return user on first SELECT (by discord_id), null on second SELECT (by id)
                        if (sql.includes('discord_id = ?')) {
                            return {
                                id: 'existing-user-id',
                                discord_id: 'test-discord',
                                xivauth_id: null,
                                auth_provider: 'discord',
                                username: 'test',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            };
                        }
                        // Return null after update to trigger the error
                        return null;
                    },
                    run: async () => ({ success: true, meta: {} }),
                    all: async () => ({ results: [], success: true, meta: {} }),
                }),
            }),
            exec: async () => ({ count: 0, duration: 0 }),
            batch: async () => [],
            dump: async () => new ArrayBuffer(0),
        } as unknown as D1Database;

        // This should throw because user is not found after update
        await expect(
            findOrCreateUser(errorDB, {
                discord_id: 'test-discord',
                username: 'updated',
                auth_provider: 'discord',
            })
        ).rejects.toThrow('User existing-user-id not found after update');
    });
});

/**
 * Test race condition handling in findOrCreateUser
 * Tests lines 95-123 of user-service.ts
 */
describe('User Service - Race Condition Handling', () => {
    it('should handle UNIQUE constraint violation and retry lookup by xivauth_id', async () => {
        let insertCallCount = 0;
        let selectByXivauthCallCount = 0;

        const raceDB = {
            prepare: (sql: string) => ({
                bind: (...params: unknown[]) => ({
                    first: async () => {
                        // First lookup by xivauth_id returns null (simulating no existing user)
                        if (sql.includes('xivauth_id = ?')) {
                            selectByXivauthCallCount++;
                            // First call returns null, second call (after retry) returns user
                            if (selectByXivauthCallCount === 1) {
                                return null;
                            }
                            return {
                                id: 'race-created-user',
                                discord_id: null,
                                xivauth_id: 'race-xivauth-id',
                                auth_provider: 'xivauth',
                                username: 'race-user',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            };
                        }
                        // For SELECT by id (after update)
                        if (sql.includes('WHERE id = ?')) {
                            return {
                                id: params[params.length - 1] as string,
                                discord_id: null,
                                xivauth_id: 'race-xivauth-id',
                                auth_provider: 'xivauth',
                                username: 'updated-name',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            };
                        }
                        return null;
                    },
                    run: async () => {
                        if (sql.includes('INSERT INTO users')) {
                            insertCallCount++;
                            // First insert fails with UNIQUE constraint
                            throw new Error('UNIQUE constraint failed: users.xivauth_id');
                        }
                        return { success: true, meta: {} };
                    },
                    all: async () => ({ results: [], success: true, meta: {} as D1Meta }),
                }),
            }),
            exec: async () => ({ count: 0, duration: 0 }),
            batch: async () => [],
            dump: async () => new ArrayBuffer(0),
        } as unknown as D1Database;

        const user = await findOrCreateUser(raceDB, {
            xivauth_id: 'race-xivauth-id',
            username: 'new-user',
            auth_provider: 'xivauth',
        });

        // Should have retried the lookup and found the user
        expect(user.xivauth_id).toBe('race-xivauth-id');
        expect(insertCallCount).toBe(1);
        expect(selectByXivauthCallCount).toBe(2);
    });

    it('should handle UNIQUE constraint violation and retry lookup by discord_id', async () => {
        let insertCallCount = 0;
        let selectByDiscordCallCount = 0;

        const raceDB = {
            prepare: (sql: string) => ({
                bind: (...params: unknown[]) => ({
                    first: async () => {
                        // First lookup by discord_id returns null
                        if (sql.includes('discord_id = ?')) {
                            selectByDiscordCallCount++;
                            if (selectByDiscordCallCount === 1) {
                                return null;
                            }
                            // Second call (retry) finds the user
                            return {
                                id: 'race-discord-user',
                                discord_id: 'race-discord-id',
                                xivauth_id: null,
                                auth_provider: 'discord',
                                username: 'race-user',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            };
                        }
                        // For SELECT by id (after update)
                        if (sql.includes('WHERE id = ?')) {
                            return {
                                id: params[params.length - 1] as string,
                                discord_id: 'race-discord-id',
                                xivauth_id: null,
                                auth_provider: 'discord',
                                username: 'updated-name',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            };
                        }
                        return null;
                    },
                    run: async () => {
                        if (sql.includes('INSERT INTO users')) {
                            insertCallCount++;
                            throw new Error('UNIQUE_VIOLATION: duplicate key value');
                        }
                        return { success: true, meta: {} };
                    },
                    all: async () => ({ results: [], success: true, meta: {} as D1Meta }),
                }),
            }),
            exec: async () => ({ count: 0, duration: 0 }),
            batch: async () => [],
            dump: async () => new ArrayBuffer(0),
        } as unknown as D1Database;

        const user = await findOrCreateUser(raceDB, {
            discord_id: 'race-discord-id',
            username: 'new-user',
            auth_provider: 'discord',
        });

        // Should have retried and found the user
        expect(user.discord_id).toBe('race-discord-id');
        expect(insertCallCount).toBe(1);
        expect(selectByDiscordCallCount).toBe(2);
    });

    it('should rethrow non-constraint errors', async () => {
        const errorDB = {
            prepare: (sql: string) => ({
                bind: () => ({
                    first: async () => null,
                    run: async () => {
                        if (sql.includes('INSERT INTO users')) {
                            throw new Error('Database connection lost');
                        }
                        return { success: true, meta: {} };
                    },
                    all: async () => ({ results: [], success: true, meta: {} as D1Meta }),
                }),
            }),
            exec: async () => ({ count: 0, duration: 0 }),
            batch: async () => [],
            dump: async () => new ArrayBuffer(0),
        } as unknown as D1Database;

        await expect(
            findOrCreateUser(errorDB, {
                discord_id: 'test-discord',
                username: 'test',
                auth_provider: 'discord',
            })
        ).rejects.toThrow('Database connection lost');
    });

    it('should rethrow constraint error if user still not found after retry', async () => {
        const errorDB = {
            prepare: (sql: string) => ({
                bind: () => ({
                    first: async () => null, // Always return null - user never found
                    run: async () => {
                        if (sql.includes('INSERT INTO users')) {
                            throw new Error('UNIQUE constraint failed: users.discord_id');
                        }
                        return { success: true, meta: {} };
                    },
                    all: async () => ({ results: [], success: true, meta: {} as D1Meta }),
                }),
            }),
            exec: async () => ({ count: 0, duration: 0 }),
            batch: async () => [],
            dump: async () => new ArrayBuffer(0),
        } as unknown as D1Database;

        await expect(
            findOrCreateUser(errorDB, {
                discord_id: 'missing-discord',
                username: 'test',
                auth_provider: 'discord',
            })
        ).rejects.toThrow('UNIQUE constraint failed');
    });
});
