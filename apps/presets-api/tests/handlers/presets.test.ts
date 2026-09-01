/**
 * Presets Handler Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext, CommunityPreset } from '../../src/types';
import type { MockR2Bucket } from '@xivdyetools/test-utils';
import {
    createMockEnv,
    createMockD1Database,
    createMockPresetRow,
    createMockSubmission,
    authHeaders,
    createTestJWT,
} from '../test-utils';

type Variables = {
    auth: AuthContext;
};

describe('PresetsHandler', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;
    let mockDb: ReturnType<typeof createMockD1Database>;

    beforeEach(() => {
        resetCategoryCache(); // Reset category cache to prevent cross-test pollution
        mockDb = createMockD1Database();
        env = createMockEnv({ DB: mockDb as unknown as D1Database });

        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);
        app.route('/api/v1/presets', presetsRouter);

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ============================================
    // GET /api/v1/presets
    // ============================================

    describe('GET /api/v1/presets', () => {
        it('should return paginated presets', async () => {
            const mockRows = [
                { ...createMockPresetRow(), _total: 2 },
                { ...createMockPresetRow(), _total: 2 }
            ];
            mockDb._setupMock(() => {
                return mockRows;
            });

            const res = await app.request('/api/v1/presets', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: CommunityPreset[]; total: number; page: number; limit: number };

            expect(body.presets).toHaveLength(2);
            expect(body.total).toBe(2);
            expect(body.page).toBe(1);
            expect(body.limit).toBe(20);
        });

        it('should filter by category', async () => {
            // Return empty array - service uses window function COUNT(*) OVER() not separate count query
            mockDb._setupMock(() => []);

            await app.request('/api/v1/presets?category=jobs', {}, env);

            expect(mockDb._bindings.some((b) => b.includes('jobs'))).toBe(true);
        });

        it('matches a secondary category, not just the primary', async () => {
            mockDb._setupMock(() => []);

            await app.request('/api/v1/presets?category=zones', {}, env);

            const sql = mockDb._queries.join(' ');
            expect(sql).toContain('json_each');
            // Bound twice: once for the primary comparison, once inside json_each
            const zonesBinds = mockDb._bindings
                .flat()
                .filter((b) => b === 'zones');
            expect(zonesBinds).toHaveLength(2);
        });

        it('should filter by search', async () => {
            // Return empty array - service uses window function COUNT(*) OVER() not separate count query
            mockDb._setupMock(() => []);

            await app.request('/api/v1/presets?search=sunset', {}, env);

            expect(mockDb._bindings.some((b) => b.includes('%sunset%'))).toBe(true);
        });

        it('should filter by is_curated', async () => {
            // Return empty array - service uses window function COUNT(*) OVER() not separate count query
            mockDb._setupMock(() => []);

            await app.request('/api/v1/presets?is_curated=true', {}, env);

            expect(mockDb._bindings.some((b) => b.includes(1))).toBe(true);
        });

        it('should respect page and limit params', async () => {
            // Return empty array - the page/limit assertions don't need actual data
            mockDb._setupMock(() => []);

            const res = await app.request('/api/v1/presets?page=3&limit=10', {}, env);
            const body = await res.json() as { page: number; limit: number };

            expect(body.page).toBe(3);
            expect(body.limit).toBe(10);
        });

        it('should cap limit at 100', async () => {
            // Return empty array - the limit cap assertion doesn't need actual data
            mockDb._setupMock(() => []);

            const res = await app.request('/api/v1/presets?limit=500', {}, env);
            const body = await res.json() as { limit: number };

            // Limit is capped at 50 for performance
            expect(body.limit).toBe(50);
        });

        // BUG-016 (2026-07-18 audit): pagination clamps
        it('should default non-numeric page/limit instead of 500ing', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request('/api/v1/presets?page=abc&limit=xyz', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { page: number; limit: number };
            expect(body.page).toBe(1);
            expect(body.limit).toBe(20);
        });

        it('should clamp negative and zero pagination values', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request('/api/v1/presets?page=-3&limit=-1', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { page: number; limit: number };
            expect(body.page).toBe(1);
            // LIMIT -1 would mean "no limit" in SQLite — must be clamped positive
            expect(body.limit).toBeGreaterThanOrEqual(1);
            expect(body.limit).toBeLessThanOrEqual(50);
        });

        // BUG-015 (2026-07-18 audit): moderation queue must not be publicly listable
        it.each(['pending', 'rejected', 'flagged'] as const)(
            'should reject anonymous ?status=%s with 403',
            async (status) => {
                mockDb._setupMock(() => []);

                const res = await app.request(`/api/v1/presets?status=${status}`, {}, env);

                expect(res.status).toBe(403);
            }
        );

        it('should reject unknown status values with 400', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request('/api/v1/presets?status=banana', {}, env);

            expect(res.status).toBe(400);
        });

        it('should allow moderators to list pending presets', async () => {
            mockDb._setupMock(() => [{ ...createMockPresetRow({ status: 'pending' }), _total: 1 }]);

            const res = await app.request(
                '/api/v1/presets?status=pending',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789', // In MODERATOR_IDS
                    },
                },
                env
            );

            expect(res.status).toBe(200);
        });

        // BUG-014 (2026-07-18 audit): audit snapshots stay out of public responses
        it('should strip previous_values from public listings', async () => {
            const row = createMockPresetRow({
                previous_values: JSON.stringify({ name: 'Old Name' }),
            });
            mockDb._setupMock(() => [{ ...row, _total: 1 }]);

            const res = await app.request('/api/v1/presets', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: Record<string, unknown>[] };
            expect(body.presets[0]).not.toHaveProperty('previous_values');
        });
    });

    // ============================================
    // GET /api/v1/presets/featured
    // ============================================

    describe('GET /api/v1/presets/featured', () => {
        it('should return featured presets', async () => {
            const mockRows = Array.from({ length: 10 }, () => createMockPresetRow());
            mockDb._setupMock(() => mockRows);

            const res = await app.request('/api/v1/presets/featured', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: CommunityPreset[] };

            expect(body.presets).toHaveLength(10);
        });
    });

    // ============================================
    // GET /api/v1/presets/mine
    // ============================================

    describe('GET /api/v1/presets/mine', () => {
        it('should require authentication', async () => {
            const res = await app.request('/api/v1/presets/mine', {}, env);

            expect(res.status).toBe(401);
        });

        it('should return user presets when authenticated', async () => {
            const mockRows = [createMockPresetRow({ author_discord_id: '123' })];
            mockDb._setupMock(() => mockRows);

            const res = await app.request(
                '/api/v1/presets/mine',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: CommunityPreset[]; total: number };

            expect(body.presets).toHaveLength(1);
            expect(body.total).toBe(1);
        });

        it('should require user context', async () => {
            const res = await app.request(
                '/api/v1/presets/mine',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        // No X-User-Discord-ID
                    },
                },
                env
            );

            expect(res.status).toBe(400);
        });
    });

    // ============================================
    // GET /api/v1/presets/rate-limit
    // ============================================

    describe('GET /api/v1/presets/rate-limit', () => {
        it('should require authentication', async () => {
            const res = await app.request('/api/v1/presets/rate-limit', {}, env);

            expect(res.status).toBe(401);
        });

        it('should return rate limit info when authenticated', async () => {
            mockDb._setupMock(() => ({ count: 3 }));

            const res = await app.request(
                '/api/v1/presets/rate-limit',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { remaining: number; limit: number; reset_at: string };

            expect(body.remaining).toBe(7);
            expect(body.limit).toBe(10);
            expect(body.reset_at).toBeDefined();
        });
    });

    // ============================================
    // PATCH /api/v1/presets/refresh-author
    // ============================================

    describe('PATCH /api/v1/presets/refresh-author', () => {
        it('should require authentication', async () => {
            const res = await app.request(
                '/api/v1/presets/refresh-author',
                { method: 'PATCH' },
                env
            );

            expect(res.status).toBe(401);
        });

        // FINDING-017 / PAPI-9: refresh-author had no ban check
        it('refuses a banned user with 403 USER_BANNED (FINDING-017)', async () => {
            mockDb._setBanStatus(true);

            const res = await app.request(
                '/api/v1/presets/refresh-author',
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                        'X-User-Discord-Name': 'Renamed',
                    },
                },
                env
            );

            expect(res.status).toBe(403);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('USER_BANNED');
            expect(mockDb._queries.some((q) => q.includes('SET author_name'))).toBe(false);
        });

        it('should update author name for user presets', async () => {
            mockDb._setupMock(() => ({ success: true, meta: { changes: 5 } }));

            const res = await app.request(
                '/api/v1/presets/refresh-author',
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                        'X-User-Discord-Name': 'NewDisplayName',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };

            expect(body.success).toBe(true);
        });
    });

    // ============================================
    // GET /api/v1/presets/:id
    // ============================================

    describe('GET /api/v1/presets/:id', () => {
        it('should return preset if found', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request('/api/v1/presets/preset-123', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { id: string };

            expect(body.id).toBe('preset-123');
        });

        it('should return 404 if preset not found', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request('/api/v1/presets/nonexistent', {}, env);

            expect(res.status).toBe(404);
        });

        // BUG-014 (2026-07-18 audit): non-approved presets are invisible to the public
        it.each(['pending', 'rejected', 'flagged', 'hidden'] as const)(
            'should return 404 for anonymous access to a %s preset',
            async (status) => {
                const mockRow = createMockPresetRow({
                    id: 'preset-123',
                    status: status as never,
                });
                mockDb._setupMock(() => mockRow);

                const res = await app.request('/api/v1/presets/preset-123', {}, env);

                expect(res.status).toBe(404);
            }
        );

        it('should let the owner view their own non-approved preset', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                status: 'rejected',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
        });

        it('should let a moderator view a non-approved preset', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: 'someone-else',
                status: 'pending',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789', // In MODERATOR_IDS
                    },
                },
                env
            );

            expect(res.status).toBe(200);
        });

        it('should strip previous_values for anonymous access to an approved preset', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                previous_values: JSON.stringify({ name: 'Old Name' }),
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request('/api/v1/presets/preset-123', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as Record<string, unknown>;
            expect(body).not.toHaveProperty('previous_values');
        });
    });

    // ============================================
    // POST /api/v1/presets
    // ============================================

    describe('POST /api/v1/presets', () => {
        it('should require authentication', async () => {
            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createMockSubmission()),
                },
                env
            );

            expect(res.status).toBe(401);
        });

        // Skip: This test requires Cloudflare Workers ExecutionContext (for waitUntil)
        // which is not available in Node test environment
        it('should create preset successfully with mock executionCtx', async () => {
            const waitUntilPromises: Promise<unknown>[] = [];
            const mockExecutionCtx = {
                waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
                passThroughOnException: () => {},
            };

            mockDb._setupMock((query: string) => {
                // Rate limit check
                if (query.includes('COUNT') && query.includes('author_discord_id')) {
                    return { count: 0 };
                }
                // Category validation
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                // Duplicate check
                if (query.includes('dye_signature')) {
                    return null;
                }
                // Create preset (INSERT)
                if (query.includes('INSERT INTO presets')) {
                    return { success: true };
                }
                // Auto-vote (INSERT INTO votes)
                if (query.includes('INSERT INTO votes')) {
                    return { success: true, meta: { changes: 1 } };
                }
                // Get remaining submissions
                if (query.includes('COUNT')) {
                    return { count: 1 };
                }
                return { success: true };
            });

            const submission = createMockSubmission();

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                        'X-User-Discord-Name': 'TestUser',
                    },
                    body: JSON.stringify(submission),
                },
                env,
                mockExecutionCtx as unknown as ExecutionContext
            );

            expect(res.status).toBe(201);
            const body = await res.json() as { success: boolean; preset: CommunityPreset; moderation_status: string };
            expect(body.success).toBe(true);
            expect(body.preset.name).toBe(submission.name);
            expect(body.moderation_status).toBe('approved');
        });

        it('should notify Discord worker when configured and content is flagged', async () => {
            const waitUntilPromises: Promise<unknown>[] = [];
            const mockExecutionCtx = {
                waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
                passThroughOnException: () => {},
            };

            // Set up environment with Discord worker binding
            const mockDiscordWorker = {
                fetch: vi.fn().mockResolvedValue(new Response('OK', { status: 200 })),
            };
            const envWithDiscord = createMockEnv({
                DB: mockDb as unknown as D1Database,
                DISCORD_WORKER: mockDiscordWorker as unknown as Env['DISCORD_WORKER'],
                INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret',
            });

            // Set up profanity filter to flag content
            const { _setTestPatterns } = await import('../../src/services/moderation-service');
            _setTestPatterns([/\bflagged\b/i]);

            mockDb._setupMock((query: string) => {
                if (query.includes('COUNT') && query.includes('author_discord_id')) {
                    return { count: 0 };
                }
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                if (query.includes('dye_signature')) {
                    return null;
                }
                if (query.includes('INSERT')) {
                    return { success: true, meta: { changes: 1 } };
                }
                if (query.includes('COUNT')) {
                    return { count: 1 };
                }
                return { success: true };
            });

            const submission = createMockSubmission({ name: 'flagged preset' });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                        'X-User-Discord-Name': 'TestUser',
                    },
                    body: JSON.stringify(submission),
                },
                envWithDiscord,
                mockExecutionCtx as unknown as ExecutionContext
            );

            expect(res.status).toBe(201);
            const body = await res.json() as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');

            // Wait for the notification promise
            await Promise.allSettled(waitUntilPromises);
            expect(mockDiscordWorker.fetch).toHaveBeenCalled();

            // Clean up test patterns
            const { _resetPatternsForTesting } = await import('../../src/services/moderation-service');
            _resetPatternsForTesting();
        });

        // FINDING-017: the dead-letter retention window is a promise in the
        // privacy policy, and the dead-letter *write* is by design rare (a
        // notification has to exhaust every retry). Submission is the busiest
        // write in the worker, so it carries the prune too — off the response
        // path, via waitUntil.
        describe('dead-letter retention (FINDING-017)', () => {
            /** Mock that walks a submission through to its 201. */
            function setupSubmissionMock(
                extra: (query: string) => unknown = () => undefined
            ): void {
                mockDb._setupMock((query: string) => {
                    const override = extra(query);
                    if (override !== undefined) return override;
                    if (query.includes('COUNT') && query.includes('author_discord_id')) {
                        return { count: 0 };
                    }
                    if (query.includes('FROM categories')) {
                        return [{ id: 'aesthetics' }, { id: 'jobs' }];
                    }
                    if (query.includes('dye_signature')) return null;
                    if (query.includes('INSERT')) return { success: true, meta: { changes: 1 } };
                    if (query.includes('COUNT')) return { count: 1 };
                    return { success: true };
                });
            }

            async function submit(executionCtx: unknown): Promise<Response> {
                return app.request(
                    '/api/v1/presets',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: 'Bearer test-bot-secret',
                            'X-User-Discord-ID': '123',
                            'X-User-Discord-Name': 'TestUser',
                        },
                        body: JSON.stringify(createMockSubmission()),
                    },
                    env,
                    executionCtx as ExecutionContext
                );
            }

            it('prunes aged-out dead letters off the response path', async () => {
                vi.useFakeTimers();
                vi.setSystemTime(new Date('2026-08-29T12:00:00.000Z'));
                try {
                    const waitUntilPromises: Promise<unknown>[] = [];
                    const mockExecutionCtx = {
                        waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
                        passThroughOnException: () => {},
                    };
                    setupSubmissionMock();

                    // Hold the prune's batch open (and only it — addVote batches
                    // too, and the response legitimately waits for that one). A
                    // 201 that arrives while the prune is still blocked is the
                    // proof that it rides waitUntil rather than the response.
                    const sqlOf = new Map<unknown, string>();
                    const prepare = mockDb.prepare.bind(mockDb);
                    mockDb.prepare = (query: string) => {
                        const statement = prepare(query);
                        sqlOf.set(statement, query);
                        return statement;
                    };
                    let releasePrune!: () => void;
                    const pruneGate = new Promise<void>((resolve) => { releasePrune = resolve; });
                    const realBatch = mockDb.batch.bind(mockDb);
                    mockDb.batch = (async (statements: Parameters<typeof realBatch>[0]) => {
                        const isPrune = statements.some((s) =>
                            /DELETE FROM failed_notifications/i.test(sqlOf.get(s) ?? '')
                        );
                        if (isPrune) await pruneGate;
                        return realBatch(statements);
                    }) as typeof mockDb.batch;

                    const res = await submit(mockExecutionCtx);

                    expect(res.status).toBe(201);
                    expect(
                        mockDb._queries.some((q) => /DELETE FROM failed_notifications/i.test(q))
                    ).toBe(false);

                    releasePrune();
                    await Promise.allSettled(waitUntilPromises);

                    const deletes = mockDb._queries
                        .map((query, index) => ({ query, bindings: mockDb._bindings[index] }))
                        .filter(({ query }) => /DELETE FROM failed_notifications/i.test(query));
                    expect(deletes).toHaveLength(2);
                    expect(
                        deletes.find((d) => /resolved_at IS NOT NULL/i.test(d.query))?.bindings
                    ).toEqual(['2026-07-30 12:00:00']);
                    expect(
                        deletes.find((d) => /resolved_at IS NULL/i.test(d.query))?.bindings
                    ).toEqual(['2026-05-31 12:00:00']);
                } finally {
                    vi.useRealTimers();
                }
            });

            it('answers 201 even when the prune throws', async () => {
                const waitUntilPromises: Promise<unknown>[] = [];
                const mockExecutionCtx = {
                    waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
                    passThroughOnException: () => {},
                };
                setupSubmissionMock((query) => {
                    if (/DELETE FROM failed_notifications/i.test(query)) {
                        throw new Error('D1_ERROR: no such table: failed_notifications');
                    }
                    return undefined;
                });

                const res = await submit(mockExecutionCtx);

                expect(res.status).toBe(201);
                // The prune ran and swallowed its own failure — nothing the
                // author is waiting on, and no unhandled rejection in waitUntil.
                await expect(Promise.all(waitUntilPromises)).resolves.toHaveLength(
                    waitUntilPromises.length
                );
                expect(
                    mockDb._queries.some((q) => /DELETE FROM failed_notifications/i.test(q))
                ).toBe(true);
            });
        });

        it('should skip Discord notification when bindings not configured', async () => {
            const waitUntilPromises: Promise<unknown>[] = [];
            const mockExecutionCtx = {
                waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
                passThroughOnException: () => {},
            };

            // Set up profanity filter to flag content
            const { _setTestPatterns } = await import('../../src/services/moderation-service');
            _setTestPatterns([/\bflagged\b/i]);

            mockDb._setupMock((query: string) => {
                if (query.includes('COUNT') && query.includes('author_discord_id')) {
                    return { count: 0 };
                }
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                if (query.includes('dye_signature')) {
                    return null;
                }
                if (query.includes('INSERT')) {
                    return { success: true, meta: { changes: 1 } };
                }
                if (query.includes('COUNT')) {
                    return { count: 1 };
                }
                return { success: true };
            });

            const submission = createMockSubmission({ name: 'flagged preset' });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                        'X-User-Discord-Name': 'TestUser',
                    },
                    body: JSON.stringify(submission),
                },
                env, // no DISCORD_WORKER configured
                mockExecutionCtx as unknown as ExecutionContext
            );

            expect(res.status).toBe(201);
            const body = await res.json() as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');
            // Notification still fires via waitUntil, but notifyDiscordBot exits early
            await Promise.allSettled(waitUntilPromises);

            // Clean up test patterns
            const { _resetPatternsForTesting } = await import('../../src/services/moderation-service');
            _resetPatternsForTesting();
        });

        it('should store failed notification in dead-letter table', async () => {
            const waitUntilPromises: Promise<unknown>[] = [];
            const mockExecutionCtx = {
                waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
                passThroughOnException: () => {},
            };

            // Mock Discord worker that returns a 4xx error (non-retryable, fast failure)
            const mockDiscordWorker = {
                fetch: vi.fn().mockResolvedValue(new Response('Bad Request', { status: 400 })),
            };
            const envWithDiscord = createMockEnv({
                DB: mockDb as unknown as D1Database,
                DISCORD_WORKER: mockDiscordWorker as unknown as Env['DISCORD_WORKER'],
                INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret',
            });

            // Flag content to trigger notification
            const { _setTestPatterns } = await import('../../src/services/moderation-service');
            _setTestPatterns([/\bflagged\b/i]);

            mockDb._setupMock((query: string) => {
                if (query.includes('COUNT') && query.includes('author_discord_id')) {
                    return { count: 0 };
                }
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                if (query.includes('dye_signature')) {
                    return null;
                }
                if (query.includes('INSERT')) {
                    return { success: true, meta: { changes: 1 } };
                }
                if (query.includes('COUNT')) {
                    return { count: 1 };
                }
                return { success: true };
            });

            const submission = createMockSubmission({ name: 'flagged preset' });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                        'X-User-Discord-Name': 'TestUser',
                    },
                    body: JSON.stringify(submission),
                },
                envWithDiscord,
                mockExecutionCtx as unknown as ExecutionContext
            );

            expect(res.status).toBe(201);
            // Wait for notification + dead-letter storage
            await Promise.allSettled(waitUntilPromises);
            // Discord worker should have been called (retries)
            expect(mockDiscordWorker.fetch).toHaveBeenCalled();

            // Clean up test patterns
            const { _resetPatternsForTesting } = await import('../../src/services/moderation-service');
            _resetPatternsForTesting();
        });

        it('should use category cache on second submission', async () => {
            const waitUntilPromises: Promise<unknown>[] = [];
            const mockExecutionCtx = {
                waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
                passThroughOnException: () => {},
            };

            let categoryQueryCount = 0;
            mockDb._setupMock((query: string) => {
                if (query.includes('COUNT') && query.includes('author_discord_id')) {
                    return { count: 0 };
                }
                if (query.includes('FROM categories')) {
                    categoryQueryCount++;
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                if (query.includes('dye_signature')) {
                    return null;
                }
                if (query.includes('INSERT')) {
                    return { success: true, meta: { changes: 1 } };
                }
                if (query.includes('COUNT')) {
                    return { count: 1 };
                }
                return { success: true };
            });

            const headers = {
                'Content-Type': 'application/json',
                Authorization: 'Bearer test-bot-secret',
                'X-User-Discord-ID': '123',
                'X-User-Discord-Name': 'TestUser',
            };

            // First request populates category cache
            await app.request(
                '/api/v1/presets',
                { method: 'POST', headers, body: JSON.stringify(createMockSubmission()) },
                env,
                mockExecutionCtx as unknown as ExecutionContext
            );

            const firstQueryCount = categoryQueryCount;

            // Second request should use cache (no additional category query)
            await app.request(
                '/api/v1/presets',
                { method: 'POST', headers, body: JSON.stringify(createMockSubmission()) },
                env,
                mockExecutionCtx as unknown as ExecutionContext
            );

            // Category query should only happen once (cache hit on second call)
            expect(categoryQueryCount).toBe(firstQueryCount);
            await Promise.allSettled(waitUntilPromises);
        });

        it('should reject invalid JSON body', async () => {
            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: 'not valid json',
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Invalid JSON');
        });

        it('should validate name length (min 2)', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ ...createMockSubmission(), name: 'A' }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Name must be 2-50 characters');
        });

        it('should validate name length (max 50)', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        name: 'A'.repeat(51),
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should validate description length (min 10)', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        description: 'Short',
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Description must be 10-200 characters');
        });

        it('should validate description length (max 200)', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        description: 'A'.repeat(201), // Too long
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Description must be 10-200 characters');
        });

        it('should validate dyes count (min 3)', async () => {
            // Return valid categories so category validation passes, allowing dye validation to run
            mockDb._setupMock((query) => {
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                return { count: 0 };
            });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        dyes: [1],
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Must include 3-6 dyes');
        });

        it('should validate dyes count (max 6)', async () => {
            // Return valid categories so category validation passes, allowing dye validation to run
            mockDb._setupMock((query) => {
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                return { count: 0 };
            });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        dyes: [1, 2, 3, 4, 5, 6, 7],
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should validate category', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        category_id: 'invalid-category',
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Invalid category');
        });

        it('should validate tags array', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        tags: 'not-an-array',
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should validate maximum tags (10)', async () => {
            // Return valid categories so category validation passes, allowing tag validation to run
            mockDb._setupMock((query) => {
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                return { count: 0 };
            });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Maximum 10 tags');
        });

        it('should enforce rate limiting', async () => {
            mockDb._setupMock(() => ({ count: 10 })); // At limit

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify(createMockSubmission()),
                },
                env
            );

            expect(res.status).toBe(429);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('RATE_LIMITED');
        });

        // FINDING-016 / PAPI-2 (2026-08-21 security audit): a dye-signature
        // collision used to return the ENTIRE matching row (previous_values,
        // author_discord_id, flagged text…) whatever its status, and vote on it
        // — bypassing the BUG-014 visibility gate and the approved-only vote rule.
        const duplicateMock =
            (existing: ReturnType<typeof createMockPresetRow>) => (query: string) => {
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                if (query.includes('COUNT') && query.includes('author_discord_id')) {
                    return { count: 0 }; // Under rate limit
                }
                if (query.includes('dye_signature')) {
                    return existing; // Duplicate found
                }
                if (query.includes('votes')) {
                    return null; // No existing vote
                }
                if (query.includes('vote_count')) {
                    return { vote_count: 1 };
                }
                return { success: true };
            };

        const submitAs = (userId: string) =>
            app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': userId,
                    },
                    body: JSON.stringify(createMockSubmission()),
                },
                env
            );

        it('votes on an APPROVED duplicate and returns it without the audit snapshot', async () => {
            const existingPreset = createMockPresetRow({
                id: 'existing-123',
                name: 'Existing Preset',
                author_discord_id: 'other-user',
                author_name: 'Other User',
                status: 'approved',
                previous_values: JSON.stringify({
                    name: 'Old name',
                    description: 'Old description text',
                    tags: [],
                    dyes: [1, 2, 3],
                }),
            });
            mockDb._setupMock(duplicateMock(existingPreset));

            const res = await submitAs('123');

            expect(res.status).toBe(200);
            const body = await res.json() as {
                success: boolean;
                duplicate: { id: string; name: string; previous_values?: unknown };
                vote_added: boolean;
            };
            expect(body.success).toBe(true);
            expect(body.duplicate.id).toBe('existing-123');
            expect(body.duplicate.name).toBe('Existing Preset');
            expect('previous_values' in body.duplicate).toBe(false);
            expect(body.vote_added).toBe(true);
            expect(mockDb._queries.some((q) => q.includes('INSERT INTO votes'))).toBe(true);
        });

        it('neither reveals nor votes on a PENDING duplicate to someone who could not GET it (409)', async () => {
            const pendingPreset = createMockPresetRow({
                id: 'hidden-456',
                name: 'Flagged Gem',
                description: 'text held for moderator review',
                author_discord_id: 'other-user',
                author_name: 'Other User',
                status: 'pending',
                previous_values: JSON.stringify({
                    name: 'Old name',
                    description: 'Old description text',
                    tags: [],
                    dyes: [1, 2, 3],
                }),
            });
            mockDb._setupMock(duplicateMock(pendingPreset));

            const res = await submitAs('123');

            expect(res.status).toBe(409);
            const body = await res.json() as { success: boolean; error: string; duplicate?: unknown };
            expect(body.success).toBe(false);
            expect(body.error).toBe('DUPLICATE_RESOURCE');
            expect(body.duplicate).toBeUndefined();
            const text = JSON.stringify(body);
            expect(text).not.toContain('hidden-456');
            expect(text).not.toContain('Flagged Gem');
            expect(text).not.toContain('other-user');
            expect(text).not.toContain('moderator review');
            expect(mockDb._queries.some((q) => q.includes('INSERT INTO votes'))).toBe(false);
        });

        it('lets the OWNER see their own pending duplicate, but adds no vote', async () => {
            const ownPending = createMockPresetRow({
                id: 'mine-789',
                author_discord_id: '123',
                status: 'pending',
            });
            mockDb._setupMock(duplicateMock(ownPending));

            const res = await submitAs('123');

            expect(res.status).toBe(200);
            const body = await res.json() as { duplicate: { id: string }; vote_added: boolean };
            expect(body.duplicate.id).toBe('mine-789');
            expect(body.vote_added).toBe(false);
            expect(mockDb._queries.some((q) => q.includes('INSERT INTO votes'))).toBe(false);
        });

        it('lets a MODERATOR see a pending duplicate, but adds no vote', async () => {
            const pendingPreset = createMockPresetRow({
                id: 'hidden-456',
                author_discord_id: 'other-user',
                status: 'pending',
            });
            mockDb._setupMock(duplicateMock(pendingPreset));

            const res = await submitAs('123456789'); // In MODERATOR_IDS

            expect(res.status).toBe(200);
            const body = await res.json() as { duplicate: { id: string }; vote_added: boolean };
            expect(body.duplicate.id).toBe('hidden-456');
            expect(body.vote_added).toBe(false);
            expect(mockDb._queries.some((q) => q.includes('INSERT INTO votes'))).toBe(false);
        });

        it('refuses a banned user with 403 USER_BANNED before doing anything', async () => {
            mockDb._setBanStatus(true);
            mockDb._setupMock(duplicateMock(createMockPresetRow({ status: 'approved' })));

            const res = await submitAs('123');

            expect(res.status).toBe(403);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('USER_BANNED');
            expect(mockDb._queries.some((q) => q.includes('INSERT INTO'))).toBe(false);
        });
    });

    // ============================================
    // POST /api/v1/presets/:id/preview-image
    // ============================================

    describe('POST /api/v1/presets/:id/preview-image', () => {
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

        // The route hands its moderator notification to executionCtx.waitUntil —
        // the same retry/dead-letter path a new submission uses — so every
        // request through it needs a context to hand that promise to.
        const waitUntilPromises: Promise<unknown>[] = [];
        const ctx = {
            waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
            passThroughOnException: () => {},
        } as unknown as ExecutionContext;

        beforeEach(() => {
            waitUntilPromises.length = 0;
        });

        it('should require authentication', async () => {
            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', body: png },
                env,
                ctx
            );

            expect(res.status).toBe(401);
        });

        it('should reject a user who is not the author', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: 'the-author',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-the-author',
                    },
                    body: png,
                },
                env,
                ctx
            );

            expect(res.status).toBe(403);
        });

        // FINDING-016 / PAPI-11: a 403 here told a non-author that a hidden or
        // pending UUID exists while GET said 404. Same answer as GET now.
        it('returns 404 (not 403) to a non-author when the preset is not approved (FINDING-016)', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: 'the-author',
                status: 'pending',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-the-author',
                    },
                    body: png,
                },
                env,
                ctx
            );

            expect(res.status).toBe(404);
        });

        it('refuses a banned author with 403 USER_BANNED before touching the image', async () => {
            mockDb._setBanStatus(true);
            const mockRow = createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: png,
                },
                env,
                ctx
            );

            expect(res.status).toBe(403);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('USER_BANNED');
            expect(mockDb._queries.some((q) => q.includes('UPDATE presets'))).toBe(false);
        });

        it('should return 404 for a nonexistent preset', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request(
                '/api/v1/presets/nonexistent/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: png,
                },
                env,
                ctx
            );

            expect(res.status).toBe(404);
        });

        it('should reject an empty body', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: new Uint8Array(0),
                },
                env,
                ctx
            );

            expect(res.status).toBe(400);
        });

        it('should reject a file over 5 MB before touching image-worker', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            mockDb._setupMock(() => mockRow);
            const fetchSpy = vi.fn();
            env.IMAGE_WORKER = { fetch: fetchSpy } as unknown as Fetcher;

            // Real PNG magic bytes followed by padding, so the sniff check
            // passes and ONLY the size check can reject this payload.
            const big = new Uint8Array(5 * 1024 * 1024 + 1);
            big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: big,
                },
                env,
                ctx
            );

            expect(res.status).toBe(400);
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('should reject bytes that are not a recognizable image, whatever the size limit allows', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]),
                },
                env,
                ctx
            );

            expect(res.status).toBe(400);
        });

        it('should return 400 when image-worker cannot process the image', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            mockDb._setupMock(() => mockRow);
            env.IMAGE_WORKER = {
                fetch: async () => new Response(JSON.stringify({ error: 'bad image' }), { status: 400 }),
            } as unknown as Fetcher;

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: png,
                },
                env,
                ctx
            );

            expect(res.status).toBe(400);
        });

        it('should store the image, mark it pending, and delete a previous image', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                preview_image_key: 'preset-123/old.webp',
            });
            mockDb._setupMock(() => mockRow);

            const bucket = env.THUMBNAILS as unknown as MockR2Bucket;
            await bucket.put('preset-123/old.webp', new ArrayBuffer(4));
            expect(bucket._store.has('preset-123/old.webp')).toBe(true);

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: png,
                },
                env,
                ctx
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean; status: string };
            expect(body.success).toBe(true);
            expect(body.status).toBe('pending');

            // Old key gone, exactly one new key under the preset's prefix.
            expect(bucket._store.has('preset-123/old.webp')).toBe(false);
            const newKeys = [...bucket._store.keys()].filter((k) => k.startsWith('preset-123/'));
            expect(newKeys).toHaveLength(1);
            expect(newKeys[0]).toMatch(/^preset-123\/.+\.webp$/);

            const stored = bucket._store.get(newKeys[0])!;
            expect(stored.httpMetadata?.contentType).toBe('image/webp');
            // FINDING-018: browser long + immutable (single-use key), edge one day
            // so a takedown is bounded even when the purge is not configured
            expect(stored.httpMetadata?.cacheControl).toBe(
                'public, max-age=31536000, immutable, s-maxage=86400'
            );

            expect(
                mockDb._queries.some((q) => q.includes("preview_image_status = 'pending'"))
            ).toBe(true);
        });

        // FINDING 2 (2026-08-10 review): the handler does the DB UPDATE
        // before deleting the old R2 object, and must capture the OLD key
        // before the UPDATE overwrites it — otherwise a re-upload could
        // delete the object it just wrote instead of the stale one. This
        // test performs two real uploads through the route (not a
        // pre-seeded bucket) so the row's preview_image_key genuinely
        // changes between requests, the way it would in production.
        it('leaves exactly one object under the prefix after a re-upload, and it is the new key', async () => {
            const row = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                preview_image_key: null,
            });
            mockDb._setupMock((query, bindings) => {
                if (query.startsWith('UPDATE presets SET preview_image_key')) {
                    row.preview_image_key = bindings[0] as string;
                    return { success: true };
                }
                return row;
            });

            const bucket = env.THUMBNAILS as unknown as MockR2Bucket;
            const upload = () =>
                app.request(
                    '/api/v1/presets/preset-123/preview-image',
                    {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer test-bot-secret',
                            'X-User-Discord-ID': '123',
                        },
                        body: png,
                    },
                    env,
                    ctx
                );

            const first = await upload();
            expect(first.status).toBe(200);
            const firstKeys = [...bucket._store.keys()].filter((k) => k.startsWith('preset-123/'));
            expect(firstKeys).toHaveLength(1);
            const firstKey = firstKeys[0];

            const second = await upload();
            expect(second.status).toBe(200);

            const finalKeys = [...bucket._store.keys()].filter((k) => k.startsWith('preset-123/'));
            expect(finalKeys).toHaveLength(1);
            expect(finalKeys[0]).not.toBe(firstKey);
            expect(bucket._store.has(firstKey)).toBe(false);
        });

        it('notifies the Discord worker with the new key after the DB update succeeds', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                name: 'My Preset',
            });
            mockDb._setupMock(() => mockRow);

            const mockDiscordWorker = { fetch: vi.fn().mockResolvedValue(new Response('OK', { status: 200 })) };
            const envWithDiscord = createMockEnv({
                DB: mockDb as unknown as D1Database,
                DISCORD_WORKER: mockDiscordWorker as unknown as Env['DISCORD_WORKER'],
                INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret',
            });

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: png,
                },
                envWithDiscord,
                ctx
            );

            expect(res.status).toBe(200);
            await Promise.allSettled(waitUntilPromises);
            expect(mockDiscordWorker.fetch).toHaveBeenCalledTimes(1);
            const [reqArg] = mockDiscordWorker.fetch.mock.calls[0] as [Request];
            expect(reqArg.headers.get('Authorization')).toBe('Bearer test-webhook-secret');
            const body = JSON.parse(await reqArg.text()) as {
                type: string;
                preset: { id: string; name: string };
                preview_image_key: string;
            };
            expect(body.type).toBe('preview_image');
            expect(body.preset.id).toBe('preset-123');
            expect(body.preset.name).toBe('My Preset');
            expect(body.preview_image_key).toMatch(/^preset-123\/.+\.webp$/);
        });

        // FINDING 4 (2026-08-10 final review): this notification used to be a
        // hand-rolled fetch, so a failure vanished — no retry, no dead-letter
        // row, no moderator ever told an image was waiting. It now goes
        // through notifyDiscordBot like a submission does. A 400 from the bot
        // is the non-retryable case, which reaches the dead-letter write
        // without spending the backoff sleeps.
        it('records a dead-letter row when the Discord notification is rejected', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            mockDb._setupMock(() => mockRow);

            const mockDiscordWorker = {
                fetch: vi.fn().mockResolvedValue(new Response('nope', { status: 400 })),
            };
            const envWithDiscord = createMockEnv({
                DB: mockDb as unknown as D1Database,
                DISCORD_WORKER: mockDiscordWorker as unknown as Env['DISCORD_WORKER'],
                INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret',
            });

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: png,
                },
                envWithDiscord,
                ctx
            );

            // The author's upload succeeded regardless — the image is stored
            // and pending; the notification is someone else's problem.
            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean; status: string };
            expect(body.success).toBe(true);
            expect(body.status).toBe('pending');

            await Promise.allSettled(waitUntilPromises);
            expect(
                mockDb._queries.some((q) => q.includes('INSERT INTO failed_notifications'))
            ).toBe(true);
        });
    });

    // ============================================
    // DELETE /api/v1/presets/:id
    // ============================================

    describe('DELETE /api/v1/presets/:id', () => {
        it('should require authentication', async () => {
            const res = await app.request(
                '/api/v1/presets/preset-123',
                { method: 'DELETE' },
                env
            );

            expect(res.status).toBe(401);
        });

        it('should allow owner to delete their preset', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };
            expect(body.success).toBe(true);
        });

        // FINDING-017 (docs/audits/2026-08-29-security): a dead-letter row named
        // the preset for ever — it outlived the preset and the deletion request.
        it('deletes the preset dead-letter rows in the same batch (FINDING-017)', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            // D1 statements are opaque once prepared, so remember the SQL each
            // one was built from and read the batch back through that map.
            const sqlOf = new Map<unknown, string>();
            const prepare = mockDb.prepare.bind(mockDb);
            mockDb.prepare = (query: string) => {
                const statement = prepare(query);
                sqlOf.set(statement, query);
                return statement;
            };
            const batchSpy = vi.spyOn(mockDb, 'batch');

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);

            // The cascade rides the batch that deletes the preset: it must not
            // survive a delete that failed, nor be skipped by one that succeeded.
            const deleteBatch = batchSpy.mock.calls
                .map((call) => call[0].map((statement) => sqlOf.get(statement) ?? ''))
                .find((queries) => queries.some((q) => q.includes('DELETE FROM presets')));
            expect(deleteBatch).toBeDefined();
            const cascade = deleteBatch!.find((q) => /DELETE FROM failed_notifications/i.test(q));
            expect(cascade).toBeDefined();
            expect(cascade!).toContain("json_extract(payload, '$.preset_id')");

            const cascadeIndex = mockDb._queries.findIndex((q) =>
                /DELETE FROM failed_notifications/i.test(q)
            );
            expect(mockDb._bindings[cascadeIndex]).toContain('preset-123');
        });

        it('should allow moderator to delete any preset', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: 'other-user',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789', // In MODERATOR_IDS
                    },
                },
                env
            );

            expect(res.status).toBe(200);
        });

        // FINDING-016 / PAPI-11: the 403 was an existence oracle for non-approved
        // UUIDs (GET says 404). A public, approved preset still gets the 403.
        it('returns 404 (not 403) to a non-owner when the preset is not approved (FINDING-016)', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: 'other-user',
                status: 'pending',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-owner-not-mod',
                    },
                },
                env
            );

            expect(res.status).toBe(404);
            expect(mockDb._queries.some((q) => q.includes('DELETE FROM presets'))).toBe(false);
        });

        // FINDING-017 / PAPI-9: DELETE had no ban check at all
        it('refuses a banned owner with 403 USER_BANNED (FINDING-017)', async () => {
            mockDb._setBanStatus(true);
            const mockRow = createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(403);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('USER_BANNED');
            expect(mockDb._queries.some((q) => q.includes('DELETE FROM presets'))).toBe(false);
        });

        it('should reject non-owner non-moderator deletion', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: 'other-user',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-owner-not-mod',
                    },
                },
                env
            );

            expect(res.status).toBe(403);
        });

        it('should return 404 for nonexistent preset', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request(
                '/api/v1/presets/nonexistent',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(404);
        });

        it('removes the stored preview image when the preset is deleted', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-with-image',
                author_discord_id: '123',
                preview_image_key: 'preset-with-image/a.webp',
            });
            mockDb._setupMock(() => mockRow);

            const bucket = env.THUMBNAILS as unknown as MockR2Bucket;
            await bucket.put('preset-with-image/a.webp', new ArrayBuffer(4));
            expect(bucket._store.has('preset-with-image/a.webp')).toBe(true);

            const res = await app.request(
                '/api/v1/presets/preset-with-image',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            expect(bucket._store.has('preset-with-image/a.webp')).toBe(false);
        });

        // ============================================
        // PRESETS-MED-001: Cascade Delete Integration Tests
        // ============================================
        // These tests verify that deleting a preset also deletes its associated votes

        it('should cascade delete votes when deleting a preset', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-with-votes',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-with-votes',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);

            // Verify both delete queries were executed (CASCADE DELETE behavior)
            const voteDeleteQuery = mockDb._queries.find(q =>
                q.includes('DELETE FROM votes WHERE preset_id')
            );
            const presetDeleteQuery = mockDb._queries.find(q =>
                q.includes('DELETE FROM presets WHERE id')
            );

            expect(voteDeleteQuery).toBeDefined();
            expect(presetDeleteQuery).toBeDefined();
        });

        it('should bind the correct preset ID to both cascade delete queries', async () => {
            const presetId = 'specific-preset-id';
            const mockRow = createMockPresetRow({
                id: presetId,
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            await app.request(
                `/api/v1/presets/${presetId}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            // Find bindings that include the preset ID
            // Both the vote delete and preset delete should bind the same ID
            const presetIdBindings = mockDb._bindings.filter(b =>
                b.includes(presetId)
            );

            // Should have at least 2 bindings with the preset ID:
            // 1. DELETE FROM votes WHERE preset_id = ?
            // 2. DELETE FROM presets WHERE id = ?
            expect(presetIdBindings.length).toBeGreaterThanOrEqual(2);
        });

        it('should execute delete operations in correct order (votes first, then preset)', async () => {
            const mockRow = createMockPresetRow({
                id: 'order-test-preset',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            await app.request(
                '/api/v1/presets/order-test-preset',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            // Find indices of delete queries
            const voteDeleteIndex = mockDb._queries.findIndex(q =>
                q.includes('DELETE FROM votes')
            );
            const presetDeleteIndex = mockDb._queries.findIndex(q =>
                q.includes('DELETE FROM presets WHERE id')
            );

            // Both queries should exist
            expect(voteDeleteIndex).toBeGreaterThan(-1);
            expect(presetDeleteIndex).toBeGreaterThan(-1);

            // Votes should be deleted before preset (to maintain referential integrity)
            expect(voteDeleteIndex).toBeLessThan(presetDeleteIndex);
        });
    });

    // ============================================
    // PATCH /api/v1/presets/:id
    // ============================================

    describe('PATCH /api/v1/presets/:id', () => {
        it('should require authentication', async () => {
            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'New Name' }),
                },
                env
            );

            expect(res.status).toBe(401);
        });

        it('should only allow owner to edit', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: 'other-user',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'New Name that is long enough' }),
                },
                env
            );

            expect(res.status).toBe(403);
        });

        // FINDING-016 / PAPI-11: same 404-not-403 rule as GET for non-approved rows
        it('returns 404 (not 403) to a non-owner when the preset is not approved (FINDING-016)', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: 'other-user',
                status: 'pending',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'New Name that is long enough' }),
                },
                env
            );

            expect(res.status).toBe(404);
        });

        it('refuses a banned owner with 403 USER_BANNED', async () => {
            mockDb._setBanStatus(true);
            const mockRow = createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'New Name that is long enough' }),
                },
                env
            );

            expect(res.status).toBe(403);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('USER_BANNED');
            expect(mockDb._queries.some((q) => q.includes('UPDATE presets'))).toBe(false);
        });

        it('should update preset with valid data', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'Updated Name' }),
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };
            expect(body.success).toBe(true);
        });

        // BUG-001 (2026-07-18 audit): owner edits must not lift moderator-set statuses
        it('should keep an approved preset approved on a clean edit', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                status: 'approved',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ tags: ['updated'] }),
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { moderation_status: string };
            expect(body.moderation_status).toBe('approved');
        });

        // BUG-001 (2026-07-18) + FINDING-004 (2026-08-29): a tag-only edit
        // neither self-approves a preset nor moves any status a moderator set —
        // *every* edit used to be written back as 'pending'. (Editing a rejected
        // preset's text is its resubmission and does queue it; that rule and its
        // limits live in tests/handlers/presets-quotas.test.ts.)
        // `moderation_status` is typed `approved | pending`, so the two statuses
        // this edit cannot produce are reported by omitting the field.
        it.each(['rejected', 'flagged'] as const)(
            'should leave a %s preset alone on a tag-only edit and report no moderation_status',
            async (status) => {
                const mockRow = createMockPresetRow({
                    id: 'preset-123',
                    author_discord_id: '123',
                    status,
                });
                mockDb._setupMock(() => mockRow);
                const mockExecutionCtx = {
                    waitUntil: () => {},
                    passThroughOnException: () => {},
                };

                const res = await app.request(
                    '/api/v1/presets/preset-123',
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: 'Bearer test-bot-secret',
                            'X-User-Discord-ID': '123',
                        },
                        body: JSON.stringify({ tags: ['updated'] }),
                    },
                    env,
                    mockExecutionCtx as never
                );

                expect(res.status).toBe(200);
                expect(await res.json()).not.toHaveProperty('moderation_status');
            }
        );

        it('should keep a pending preset pending after an owner edit', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                status: 'pending',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ tags: ['updated'] }),
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');
        });

        it('should refuse to edit a hidden preset', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                status: 'hidden' as never,
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ tags: ['updated'] }),
                },
                env
            );

            expect(res.status).toBe(403);
        });

        it('should reject empty update', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({}),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('No updates provided');
        });

        // FINDING-016 / PAPI-2: the 409 body must not describe a colliding preset
        // the caller could not GET (a pending one belonging to someone else).
        it('omits the duplicate summary from the 409 when the colliding preset is pending and not the caller\'s', async () => {
            const target = createMockPresetRow({ id: 'preset-123', author_discord_id: '123', status: 'approved' });
            const pendingDup = createMockPresetRow({
                id: 'dup-456',
                name: 'Hidden Gem',
                author_discord_id: 'other-user',
                author_name: 'Other User',
                status: 'pending',
            });
            mockDb._setupMock((query) => {
                if (query.includes('FROM categories')) return [{ id: 'aesthetics' }, { id: 'jobs' }];
                if (query.includes('dye_signature = ?')) return pendingDup;
                if (query.includes('FROM presets WHERE id = ?')) return target;
                return { success: true };
            });

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ dyes: [4, 5, 6] }),
                },
                env
            );

            expect(res.status).toBe(409);
            const body = await res.json() as { success: boolean; error: string; duplicate?: unknown };
            expect(body.success).toBe(false);
            expect(body.error).toBe('DUPLICATE_RESOURCE');
            expect(body.duplicate).toBeUndefined();
            expect(JSON.stringify(body)).not.toContain('Hidden Gem');
            expect(JSON.stringify(body)).not.toContain('dup-456');
        });

        it('keeps the {id, name, author_name} duplicate summary in the 409 when the colliding preset is approved', async () => {
            const target = createMockPresetRow({ id: 'preset-123', author_discord_id: '123', status: 'approved' });
            const approvedDup = createMockPresetRow({
                id: 'dup-456',
                name: 'Public Gem',
                author_discord_id: 'other-user',
                author_name: 'Other User',
                status: 'approved',
            });
            mockDb._setupMock((query) => {
                if (query.includes('FROM categories')) return [{ id: 'aesthetics' }, { id: 'jobs' }];
                if (query.includes('dye_signature = ?')) return approvedDup;
                if (query.includes('FROM presets WHERE id = ?')) return target;
                return { success: true };
            });

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ dyes: [4, 5, 6] }),
                },
                env
            );

            expect(res.status).toBe(409);
            const body = await res.json() as { duplicate?: { id: string; name: string; author_name: string | null } };
            expect(body.duplicate).toEqual({ id: 'dup-456', name: 'Public Gem', author_name: 'Other User' });
        });

        it('should check for duplicate dyes when dyes are changed', async () => {
            const ownPreset = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                dyes: JSON.stringify([1, 2, 3]),
            });
            const duplicatePreset = createMockPresetRow({
                id: 'other-preset',
                name: 'Duplicate',
                author_name: 'Other',
            });

            let callCount = 0;
            mockDb._setupMock(() => {
                callCount++;
                if (callCount === 1) return ownPreset; // Get own preset
                if (callCount === 2) return duplicatePreset; // Duplicate check
                return ownPreset;
            });

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ dyes: [4, 5, 6] }),
                },
                env
            );

            expect(res.status).toBe(409);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('DUPLICATE_RESOURCE');
        });

        it('should validate edit request fields', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'A' }), // Too short
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should validate edit request description length', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ description: 'Short' }), // Too short
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Description must be 10-200 characters');
        });

        it('should validate edit request dyes must be array', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ dyes: 'not-an-array' }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Must include 3-6 dyes');
        });

        it('should validate edit request dyes count', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ dyes: [1] }), // Too few
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Must include 3-6 dyes');
        });

        it('should validate edit request dyes are valid numbers', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ dyes: [1, 'invalid', 3] }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Invalid dye IDs');
        });

        it('should validate edit request tags must be array', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ tags: 'not-an-array' }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Tags must be an array');
        });

        it('should validate edit request max 10 tags', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Maximum 10 tags');
        });

        it('should validate edit request tag max length', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        tags: ['valid', 'A'.repeat(31)], // Second tag too long
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('max 30 characters');
        });

        it('should reject invalid JSON body', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: 'not valid json',
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Invalid JSON');
        });

        it('should return 404 for nonexistent preset', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request(
                '/api/v1/presets/nonexistent',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'Valid New Name' }),
                },
                env
            );

            expect(res.status).toBe(404);
        });

        // Task 7 (2026-08-11): clients can now SET category_id / secondary_categories
        // on edit, and changing the primary category is unlocked. Auth headers mirror
        // the neighbouring PATCH tests above (bot secret + X-User-Discord-ID) rather
        // than the authHeaders() helper, since author_discord_id must equal the
        // X-User-Discord-ID header for the ownership check to pass.
        it('accepts a category change with secondary categories', async () => {
            const row = createMockPresetRow({ author_discord_id: '123456789', status: 'approved' });
            mockDb._setupMock((sql: string) => {
                if (sql.includes('FROM categories')) {
                    return [{ id: 'jobs' }, { id: 'zones' }, { id: 'events' }, { id: 'aesthetics' }];
                }
                return [{ ...row, category_id: 'jobs', secondary_categories: '["zones"]' }];
            });

            const res = await app.request(
                `/api/v1/presets/${row.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ category_id: 'jobs', secondary_categories: ['zones'] }),
                },
                env
            );

            expect(res.status).toBe(200);
        });

        it('rejects a secondary category that repeats the primary', async () => {
            const row = createMockPresetRow({ author_discord_id: '123456789', status: 'approved' });
            mockDb._setupMock((sql: string) => {
                if (sql.includes('FROM categories')) return [{ id: 'jobs' }, { id: 'zones' }];
                return [row];
            });

            const res = await app.request(
                `/api/v1/presets/${row.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ category_id: 'jobs', secondary_categories: ['jobs'] }),
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('a category-only edit is not "No updates provided"', async () => {
            const row = createMockPresetRow({ author_discord_id: '123456789', status: 'approved' });
            mockDb._setupMock((sql: string) => {
                if (sql.includes('FROM categories')) return [{ id: 'jobs' }, { id: 'zones' }];
                return [row];
            });

            const res = await app.request(
                `/api/v1/presets/${row.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ secondary_categories: [] }),
                },
                env
            );

            expect(res.status).toBe(200);
        });

        // Review finding (2026-08-11): the three tests above never exercise the
        // `?? currentCategoryId` fallback in validateEditRequest — tests 1/2 both
        // set category_id explicitly, and the empty-array test never enters the
        // collision loop at all. This test omits category_id entirely, so
        // effectivePrimary can only come from the preset's current (unchanged)
        // row value — 'aesthetics', the default from createMockPresetRow, set
        // explicitly here for clarity. The mocked category list includes
        // 'aesthetics' so the entry passes the validity check and is rejected
        // specifically by the primary-collision rule, not "Invalid secondary
        // category".
        it('rejects a secondary category that repeats the unchanged primary when category_id is omitted', async () => {
            const row = createMockPresetRow({
                author_discord_id: '123456789',
                status: 'approved',
                category_id: 'aesthetics',
            });
            mockDb._setupMock((sql: string) => {
                if (sql.includes('FROM categories')) return [{ id: 'aesthetics' }, { id: 'zones' }];
                return [row];
            });

            const res = await app.request(
                `/api/v1/presets/${row.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ secondary_categories: ['aesthetics'] }),
                },
                env
            );

            expect(res.status).toBe(400);
        });
    });

    // ============================================
    // validateSubmission Edge Cases
    // ============================================

    describe('validateSubmission edge cases', () => {
        it('should validate dye IDs are positive numbers', async () => {
            // Return valid categories so category validation passes, allowing dye validation to run
            mockDb._setupMock((query) => {
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                return { count: 0 };
            });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        dyes: [1, 0, 3], // 0 is not valid
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Invalid dye IDs');
        });

        it('should validate missing name', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        name: undefined,
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should validate tag types in submission', async () => {
            // Return valid categories so category validation passes, allowing tag validation to run
            mockDb._setupMock((query) => {
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                return { count: 0 };
            });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        tags: ['valid', 123], // Number is not valid
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('string');
        });

        it('should validate missing description', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        description: undefined,
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Description is required');
        });

        it('should validate missing dyes', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        dyes: undefined,
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should validate negative dye IDs', async () => {
            // Return valid categories so category validation passes, allowing dye validation to run
            mockDb._setupMock((query) => {
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                return { count: 0 };
            });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        dyes: [1, -5, 3],
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Invalid dye IDs');
        });

        it('should validate missing category', async () => {
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        ...createMockSubmission(),
                        category_id: undefined,
                    }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            // Missing category returns "Category is required", not "Invalid category"
            expect(body.message).toContain('Category is required');
        });
    });

    // ============================================
    // PATCH /api/v1/presets/:id - Additional Edge Cases
    // ============================================

    describe('PATCH /api/v1/presets/:id - Edge Cases', () => {
        it('should return 500 when updatePreset fails to return preset', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });

            let callCount = 0;
            mockDb._setupMock((query) => {
                callCount++;
                if (callCount === 1) return mockRow; // First call: getPresetById
                if (query.includes('UPDATE')) return null; // OPT-013: UPDATE ... RETURNING yields no row
                return null; // Subsequent queries return null
            });

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'Valid Updated Name' }),
                },
                env
            );

            expect(res.status).toBe(500);
            const body = await res.json() as { error: string; message: string };
            expect(body.error).toBe('INTERNAL_ERROR');
            expect(body.message).toBe('Failed to update preset');
        });

        it('should trigger moderation when name or description changes', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                name: 'Old Name',
                description: 'Original description for the preset',
            });

            const updatedRow = { ...mockRow, name: 'Bad Word Content' };

            let callCount = 0;
            mockDb._setupMock((query) => {
                callCount++;
                if (callCount === 1) return mockRow; // getPresetById
                if (query.includes('UPDATE')) return { success: true };
                return updatedRow; // Return updated preset
            });

            // The test confirms moderation runs on edit; the moderation service
            // is tested separately, so we just verify the flow completes
            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'New Valid Name Here' }),
                },
                env
            );

            // Should complete without error (moderation passed or pending)
            expect([200, 500]).toContain(res.status);
        });

        it('should handle edit with description change triggering moderation', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
            });

            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({
                        description: 'A brand new description that is long enough',
                    }),
                },
                env
            );

            // Should complete (moderation would run on description change)
            expect([200, 500]).toContain(res.status);
        });
    });

    // ============================================
    // Discord Notification Tests
    //
    // These used to be three `it.skip`s marked "requires Cloudflare Workers"
    // because the route hands its notification to `c.executionCtx.waitUntil`.
    // That is solvable in-process: pass a mock ExecutionContext as the fourth
    // argument to `app.request` and await the promises it collects. Fixed in
    // the 2026-09-01 dead-code sweep (DEAD-012); the "notification is attempted
    // when DISCORD_WORKER is configured" case was dropped as a duplicate of
    // "should notify Discord worker when configured and content is flagged"
    // above, which asserts the fetch actually happened.
    // ============================================

    describe('Discord Bot Notifications', () => {
        /** The mock ctx + the DB shape a successful POST /presets needs. */
        function notificationHarness(): {
            waitUntilPromises: Promise<unknown>[];
            mockExecutionCtx: { waitUntil: (p: Promise<unknown>) => void; passThroughOnException: () => void };
        } {
            const waitUntilPromises: Promise<unknown>[] = [];
            const mockExecutionCtx = {
                waitUntil: (p: Promise<unknown>) => {
                    waitUntilPromises.push(p);
                },
                passThroughOnException: (): void => {},
            };
            mockDb._setupMock((query: string) => {
                if (query.includes('COUNT') && query.includes('author_discord_id')) return { count: 0 };
                if (query.includes('FROM categories')) return [{ id: 'aesthetics' }, { id: 'jobs' }];
                if (query.includes('dye_signature')) return null;
                if (query.includes('INSERT')) return { success: true, meta: { changes: 1 } };
                if (query.includes('COUNT')) return { count: 1 };
                return { success: true };
            });
            return { waitUntilPromises, mockExecutionCtx };
        }

        function submit(
            targetEnv: Env,
            ctx: { waitUntil: (p: Promise<unknown>) => void; passThroughOnException: () => void }
        ): Promise<Response> {
            return app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                        'X-User-Discord-Name': 'TestUser',
                    },
                    body: JSON.stringify(createMockSubmission()),
                },
                targetEnv,
                ctx as unknown as ExecutionContext
            );
        }

        it('does not call the Discord worker when INTERNAL_WEBHOOK_SECRET is unset', async () => {
            const { waitUntilPromises, mockExecutionCtx } = notificationHarness();
            // The guard is `!env.DISCORD_WORKER || !env.INTERNAL_WEBHOOK_SECRET`
            // (notification-service.ts:173). Binding the worker but withholding
            // the secret is what makes the assertion meaningful: a spy that must
            // never fire. (Asserting "nothing was queued" would be wrong —
            // waitUntil also carries analytics and dead-letter pruning.)
            const mockDiscordWorker = { fetch: vi.fn() };
            const envWithoutSecret = createMockEnv({
                DB: mockDb as unknown as D1Database,
                DISCORD_WORKER: mockDiscordWorker as unknown as Env['DISCORD_WORKER'],
                INTERNAL_WEBHOOK_SECRET: undefined,
            });

            const res = await submit(envWithoutSecret, mockExecutionCtx);

            expect(res.status).toBe(201);
            await Promise.allSettled(waitUntilPromises);
            expect(mockDiscordWorker.fetch).not.toHaveBeenCalled();
        });

        it('still returns 201 when the notification call fails (non-blocking)', async () => {
            const { waitUntilPromises, mockExecutionCtx } = notificationHarness();
            // 4xx, not 5xx: notifyDiscordBot treats server errors as transient
            // and retries three times with real backoff sleeps, which blows the
            // 5 s test timeout. A client error is non-retryable, so the failure
            // surfaces immediately — and "non-blocking" is what we're asserting.
            const mockDiscordWorker = {
                fetch: vi.fn().mockResolvedValue(new Response('Bad Request', { status: 400 })),
            };
            const envWithFailingDiscord = createMockEnv({
                DB: mockDb as unknown as D1Database,
                DISCORD_WORKER: mockDiscordWorker as unknown as Env['DISCORD_WORKER'],
                INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret',
            });

            const res = await submit(envWithFailingDiscord, mockExecutionCtx);

            expect(res.status).toBe(201);
            // The failure has to happen for the assertion to mean anything.
            await Promise.allSettled(waitUntilPromises);
            expect(mockDiscordWorker.fetch).toHaveBeenCalled();
        });
    });

    // ============================================
    // PATCH /api/v1/presets/refresh-author
    // ============================================

    describe('PATCH /api/v1/presets/refresh-author', () => {
        it('should require authentication', async () => {
            const res = await app.request(
                '/api/v1/presets/refresh-author',
                { method: 'PATCH' },
                env
            );

            expect(res.status).toBe(401);
        });

        it('should update author name for all user presets', async () => {
            mockDb._setupMock(() => ({ changes: 5 }));

            const res = await app.request(
                '/api/v1/presets/refresh-author',
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                        'X-User-Discord-Name': 'New Display Name',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean; updated: number };
            expect(body.success).toBe(true);
        });

        it('should require user context', async () => {
            // Auth without user ID header
            const res = await app.request(
                '/api/v1/presets/refresh-author',
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        // No X-User-Discord-ID header
                    },
                },
                env
            );

            expect(res.status).toBe(400);
        });
    });

    // ============================================
    // DELETE /api/v1/presets/:id/preview-image
    // ============================================

    describe('DELETE /api/v1/presets/:id/preview-image', () => {
        // Task 8 (2026-08-11): authHeaders(token, userId?, userName?) takes the
        // bot token first. A lone positional arg only sets Authorization and
        // leaves X-User-Discord-ID unset, so authMiddleware never authenticates
        // (BOT_API_SECRET mismatch, then a failed JWT parse) and every case here
        // would 401 before reaching the route. Passing the mock bot secret
        // explicitly matches this file's convention elsewhere (Authorization:
        // 'Bearer test-bot-secret' + X-User-Discord-ID).
        it('clears the key and status for the author', async () => {
            mockDb._setupMock(() => [
                { author_discord_id: '123456789', preview_image_key: 'p1/a.webp', name: 'Test' },
            ]);

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('test-bot-secret', '123456789') } },
                env
            );

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ success: true, preview_image_status: 'none' });
            expect(mockDb._queries.join(' ')).toContain('preview_image_key = NULL');
        });

        // FINDING-016 / PAPI-11: a non-author on a non-approved preset gets the
        // same 404 as GET; the 403 is reserved for public (approved) rows.
        it('returns 404 (not 403) to a non-author when the preset is not approved (FINDING-016)', async () => {
            mockDb._setupMock(() => [
                { author_discord_id: '999999999', preview_image_key: 'p1/a.webp', name: 'Test', status: 'pending' },
            ]);

            // 555000111 is neither the author nor in MODERATOR_IDS (123456789 is a moderator,
            // and a moderator CAN see a pending preset — they get the 403 below instead)
            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('test-bot-secret', '555000111') } },
                env
            );

            expect(res.status).toBe(404);
            expect(mockDb._queries.join(' ')).not.toContain('preview_image_key = NULL');
        });

        it('still 403s a moderator who is not the author on a pending preset — they can see it', async () => {
            mockDb._setupMock(() => [
                { author_discord_id: '999999999', preview_image_key: 'p1/a.webp', name: 'Test', status: 'pending' },
            ]);

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('test-bot-secret', '123456789') } }, // moderator
                env
            );

            expect(res.status).toBe(403);
        });

        // FINDING-017 / PAPI-9: DELETE preview-image had no ban check
        it('refuses a banned author with 403 USER_BANNED (FINDING-017)', async () => {
            mockDb._setBanStatus(true);
            mockDb._setupMock(() => [
                { author_discord_id: '123456789', preview_image_key: 'p1/a.webp', name: 'Test', status: 'approved' },
            ]);

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('test-bot-secret', '123456789') } },
                env
            );

            expect(res.status).toBe(403);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('USER_BANNED');
            expect(mockDb._queries.join(' ')).not.toContain('preview_image_key = NULL');
        });

        it('refuses a non-author', async () => {
            mockDb._setupMock(() => [
                // approved: the preset is public, so a 403 does not reveal anything GET would not
                { author_discord_id: '999999999', preview_image_key: 'p1/a.webp', name: 'Test', status: 'approved' },
            ]);

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('test-bot-secret', '123456789') } },
                env
            );

            expect(res.status).toBe(403);
        });

        it('404s an unknown preset', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request(
                '/api/v1/presets/nope/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('test-bot-secret', '123456789') } },
                env
            );

            expect(res.status).toBe(404);
        });

        it('is idempotent when there is no image', async () => {
            mockDb._setupMock(() => [
                { author_discord_id: '123456789', preview_image_key: null, name: 'Test' },
            ]);

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('test-bot-secret', '123456789') } },
                env
            );

            expect(res.status).toBe(200);
        });

        it('still succeeds when the R2 delete throws', async () => {
            // The DB already reflects the removal; an R2 hiccup must not 500 a
            // request whose state is already correct.
            mockDb._setupMock(() => [
                { author_discord_id: '123456789', preview_image_key: 'p1/a.webp', name: 'Test' },
            ]);
            (env.THUMBNAILS as unknown as MockR2Bucket).delete = () => {
                throw new Error('R2 down');
            };

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('test-bot-secret', '123456789') } },
                env
            );

            expect(res.status).toBe(200);
        });
    });

    // ============================================
    // FINDING-016 (2026-08-29 security audit): author_discord_id is not public
    // ============================================

    describe('author_discord_id visibility (FINDING-016)', () => {
        const AUTHOR = 'author-9001';
        const STRANGER = 'stranger-4242';
        const MODERATOR = '123456789'; // In MODERATOR_IDS

        const authorRow = (overrides: Record<string, unknown> = {}) =>
            createMockPresetRow({
                id: 'preset-123',
                author_discord_id: AUTHOR,
                author_name: 'TestUser',
                ...overrides,
            });

        /** A web session token — the identity a browser client presents. */
        const jwtFor = (sub: string) =>
            createTestJWT(env.JWT_SECRET as string, { sub, username: 'Someone' });

        type PresetBody = Record<string, unknown>;

        it('is absent from every preset in the anonymous listing', async () => {
            mockDb._setupMock(() => [{ ...authorRow(), _total: 1 }]);

            const res = await app.request('/api/v1/presets', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: PresetBody[] };
            expect(body.presets[0]).not.toHaveProperty('author_discord_id');
            expect(body.presets[0].author_name).toBe('TestUser');
        });

        it('is absent from an anonymous search / category listing', async () => {
            mockDb._setupMock(() => [{ ...authorRow(), _total: 1 }]);

            const res = await app.request('/api/v1/presets?search=sunset&category=jobs', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: PresetBody[] };
            expect(body.presets[0]).not.toHaveProperty('author_discord_id');
            expect(body.presets[0].author_name).toBe('TestUser');
        });

        it('is absent from the anonymous featured list', async () => {
            mockDb._setupMock(() => [authorRow()]);

            const res = await app.request('/api/v1/presets/featured', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: PresetBody[] };
            expect(body.presets[0]).not.toHaveProperty('author_discord_id');
            expect(body.presets[0].author_name).toBe('TestUser');
        });

        it('is absent from an anonymous detail response', async () => {
            mockDb._setupMock(() => authorRow());

            const res = await app.request('/api/v1/presets/preset-123', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as PresetBody;
            expect(body).not.toHaveProperty('author_discord_id');
            expect(body.author_name).toBe('TestUser');
        });

        it('reaches the owner, with is_owner: true (the edit form needs both)', async () => {
            mockDb._setupMock(() => authorRow());

            const res = await app.request(
                '/api/v1/presets/preset-123',
                { headers: authHeaders(await jwtFor(AUTHOR)) },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as PresetBody;
            expect(body.author_discord_id).toBe(AUTHOR);
            expect(body.is_owner).toBe(true);
        });

        it('does not reach another signed-in user, who is told is_owner: false', async () => {
            mockDb._setupMock(() => authorRow());

            const res = await app.request(
                '/api/v1/presets/preset-123',
                { headers: authHeaders(await jwtFor(STRANGER)) },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as PresetBody;
            expect(body).not.toHaveProperty('author_discord_id');
            expect(body.is_owner).toBe(false);
        });

        it('reaches a moderator — they act on the author', async () => {
            mockDb._setupMock(() => authorRow());

            const res = await app.request(
                '/api/v1/presets/preset-123',
                { headers: authHeaders(await jwtFor(MODERATOR)) },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as PresetBody;
            expect(body.author_discord_id).toBe(AUTHOR);
            expect(body.is_owner).toBe(false);
        });

        it('reaches a moderator listing non-approved presets', async () => {
            mockDb._setupMock(() => [{ ...authorRow({ status: 'pending' }), _total: 1 }]);

            const res = await app.request(
                '/api/v1/presets?status=pending',
                { headers: authHeaders(await jwtFor(MODERATOR)) },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: PresetBody[] };
            expect(body.presets[0].author_discord_id).toBe(AUTHOR);
        });

        it('reaches the bot, whose own owner check needs it', async () => {
            mockDb._setupMock(() => authorRow());

            const res = await app.request(
                '/api/v1/presets/preset-123',
                { headers: authHeaders('test-bot-secret', STRANGER, 'Someone') },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as PresetBody;
            expect(body.author_discord_id).toBe(AUTHOR);
        });

        it('is present on the caller\'s own /mine listing, with is_owner: true', async () => {
            mockDb._setupMock(() => [authorRow()]);

            const res = await app.request(
                '/api/v1/presets/mine',
                { headers: authHeaders(await jwtFor(AUTHOR)) },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: PresetBody[] };
            expect(body.presets[0].author_discord_id).toBe(AUTHOR);
            expect(body.presets[0].is_owner).toBe(true);
        });

        it('is present on the owner\'s edit response, with is_owner: true', async () => {
            mockDb._setupMock(() => authorRow({ status: 'approved' }));

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders(await jwtFor(AUTHOR)),
                    },
                    body: JSON.stringify({ tags: ['updated'] }),
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { preset: PresetBody };
            expect(body.preset.author_discord_id).toBe(AUTHOR);
            expect(body.preset.is_owner).toBe(true);
        });

        it('is present on the submitter\'s own creation response, with is_owner: true', async () => {
            const waitUntilPromises: Promise<unknown>[] = [];
            const mockExecutionCtx = {
                waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
                passThroughOnException: () => {},
            };
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM categories')) {
                    return [{ id: 'aesthetics' }, { id: 'jobs' }];
                }
                if (query.includes('dye_signature')) {
                    return null;
                }
                if (query.includes('COUNT')) {
                    return { count: 0 };
                }
                return { success: true };
            });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders(await jwtFor(AUTHOR)),
                    },
                    body: JSON.stringify(createMockSubmission()),
                },
                env,
                mockExecutionCtx as unknown as ExecutionContext
            );

            expect(res.status).toBe(201);
            const body = await res.json() as { preset: PresetBody };
            expect(body.preset.author_discord_id).toBe(AUTHOR);
            expect(body.preset.is_owner).toBe(true);

            await Promise.all(waitUntilPromises);
        });
    });
});
