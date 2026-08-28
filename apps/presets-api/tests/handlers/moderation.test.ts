/**
 * Moderation Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext, CommunityPreset, ModerationLogEntry } from '../../src/types';
import type { MockR2Bucket } from '@xivdyetools/test-utils';
import {
    createMockEnv,
    createMockD1Database,
    createMockPresetRow,
    authHeaders,
} from '../test-utils';

type Variables = {
    auth: AuthContext;
};

describe('ModerationHandler', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;
    let mockDb: ReturnType<typeof createMockD1Database>;

    beforeEach(() => {
        mockDb = createMockD1Database();
        env = createMockEnv({ DB: mockDb as unknown as D1Database });

        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);
        app.route('/api/v1/moderation', moderationRouter);

        vi.clearAllMocks();
    });

    // ============================================
    // Authentication/Authorization
    // ============================================

    describe('Authentication Requirements', () => {
        it('should require authentication for /pending', async () => {
            const res = await app.request('/api/v1/moderation/pending', {}, env);

            expect(res.status).toBe(401);
        });

        it('should require authentication for status update', async () => {
            const res = await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'approved' }),
                },
                env
            );

            expect(res.status).toBe(401);
        });

        it('should require moderator privileges for /pending', async () => {
            const res = await app.request(
                '/api/v1/moderation/pending',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-a-moderator',
                    },
                },
                env
            );

            expect(res.status).toBe(403);
        });

        it('should allow moderator access to /pending', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request(
                '/api/v1/moderation/pending',
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
    });

    // ============================================
    // GET /api/v1/moderation/pending
    // ============================================

    describe('GET /api/v1/moderation/pending', () => {
        it('should return pending presets', async () => {
            const mockRows = [
                createMockPresetRow({ id: 'p1', status: 'pending' }),
                createMockPresetRow({ id: 'p2', status: 'pending' }),
            ];
            mockDb._setupMock(() => mockRows);

            const res = await app.request(
                '/api/v1/moderation/pending',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: CommunityPreset[]; total: number };

            expect(body.presets).toHaveLength(2);
            expect(body.total).toBe(2);
        });

        it('should return empty list when no pending presets', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request(
                '/api/v1/moderation/pending',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { presets: CommunityPreset[]; total: number };

            expect(body.presets).toEqual([]);
            expect(body.total).toBe(0);
        });

        it('includes an approved preset whose image is awaiting review', async () => {
            mockDb._setupMock(() => [
                createMockPresetRow({
                    status: 'approved',
                    preview_image_status: 'pending',
                    preview_image_key: 'p1/a.webp',
                }),
            ]);

            const res = await app.request(
                '/api/v1/moderation/pending',
                { headers: { ...authHeaders('test-bot-secret', '123456789') } },
                env
            );

            expect(res.status).toBe(200);
            expect(mockDb._queries.join(' ')).toContain("preview_image_status = 'pending'");

            const body = (await res.json()) as {
                presets: Array<{ preview_image_url: string | null; pending_preview_image_url: string | null }>;
            };
            // The gate holds: the public URL stays null for an unapproved image...
            expect(body.presets[0].preview_image_url).toBeNull();
            // ...and the moderator gets the pending URL from a separate field.
            expect(body.presets[0].pending_preview_image_url).toBe(
                'https://shots.xivdyetools.app/p1/a.webp'
            );
        });

        // Coverage gap fix: the row above pairs preview_image_status: 'pending'
        // with a non-null preview_image_key, so it can't tell "gated on status"
        // apart from "gated merely on the key being present." This row is in
        // the queue for its TEXT (status: 'pending') while its image is
        // already approved — a non-null key whose status is NOT 'pending'. If
        // the `preview_image_status === 'pending' &&` clause were ever dropped
        // from the ternary, pending_preview_image_url would wrongly become
        // non-null here and this test would catch it.
        it('keeps the pending-image field independent of an already-approved image', async () => {
            mockDb._setupMock(() => [
                createMockPresetRow({
                    id: 'p2',
                    status: 'pending',
                    preview_image_status: 'approved',
                    preview_image_key: 'p2/b.webp',
                }),
            ]);

            const res = await app.request(
                '/api/v1/moderation/pending',
                { headers: { ...authHeaders('test-bot-secret', '123456789') } },
                env
            );

            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                presets: Array<{ preview_image_url: string | null; pending_preview_image_url: string | null }>;
            };
            // Nothing image-wise to review — dies if the status check is dropped.
            expect(body.presets[0].pending_preview_image_url).toBeNull();
            // The image IS approved, so the ordinary gate correctly serves it —
            // proving the two fields are independent and the sibling field did
            // not disturb the gate.
            expect(body.presets[0].preview_image_url).toBe(
                'https://shots.xivdyetools.app/p2/b.webp'
            );
        });
    });

    // ============================================
    // PATCH /api/v1/moderation/:presetId/status
    // ============================================

    describe('PATCH /api/v1/moderation/:presetId/status', () => {
        it('should approve preset', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123', status: 'pending' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ status: 'approved' }),
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };

            expect(body.success).toBe(true);
        });

        it('should reject preset with reason', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123', status: 'pending' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({
                        status: 'rejected',
                        reason: 'Inappropriate content',
                    }),
                },
                env
            );

            expect(res.status).toBe(200);
            expect(mockDb._bindings.some((b) => b.includes('Inappropriate content'))).toBe(true);
        });

        it('should flag preset', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123', status: 'approved' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ status: 'flagged' }),
                },
                env
            );

            expect(res.status).toBe(200);
        });

        it('should return 400 for invalid status', async () => {
            const res = await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ status: 'invalid-status' }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('VALIDATION_ERROR');
        });

        it('should return 400 for missing status', async () => {
            const res = await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({}),
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid JSON', async () => {
            const res = await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: 'not valid json',
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should return 404 if preset not found', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request(
                '/api/v1/moderation/nonexistent/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ status: 'approved' }),
                },
                env
            );

            expect(res.status).toBe(404);
        });

        it('should log moderation action', async () => {
            const mockRow = createMockPresetRow({ id: 'preset-123', status: 'pending' });
            mockDb._setupMock(() => mockRow);

            await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ status: 'approved' }),
                },
                env
            );

            expect(mockDb._queries.some((q) => q.includes('INSERT INTO moderation_log'))).toBe(true);
        });
    });

    // ============================================
    // PATCH /api/v1/moderation/:presetId/revert
    // ============================================

    describe('PATCH /api/v1/moderation/:presetId/revert', () => {
        it('should require moderator privileges', async () => {
            const res = await app.request(
                '/api/v1/moderation/preset-123/revert',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-a-moderator',
                    },
                    body: JSON.stringify({ reason: 'Reverting due to policy violation issues' }),
                },
                env
            );

            expect(res.status).toBe(403);
        });

        it('should revert preset with previous values', async () => {
            const previousValues = {
                name: 'Original Name',
                description: 'Original Description',
                tags: ['original'],
                dyes: [1, 2, 3],
            };
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                previous_values: JSON.stringify(previousValues),
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/moderation/preset-123/revert',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ reason: 'Reverting because the edit was inappropriate edit' }),
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean; message: string };
            expect(body.success).toBe(true);
            expect(body.message).toBe('Preset reverted to previous values');
        });

        it('should return 400 if no previous values exist', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                previous_values: null,
            });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/moderation/preset-123/revert',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ reason: 'Trying to revert when nothing to revert' }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('no previous values');
        });

        it('should return 400 for invalid JSON body', async () => {
            const mockRow = createMockPresetRow({ previous_values: '{}' });
            mockDb._setupMock(() => mockRow);

            const res = await app.request(
                '/api/v1/moderation/preset-123/revert',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: 'not valid json',
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { error: string; message: string };
            expect(body.error).toBe('INVALID_JSON');
            expect(body.message).toContain('Invalid JSON');
        });

        it('should return 500 if revert operation fails', async () => {
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                previous_values: JSON.stringify({
                    name: 'Original',
                    description: 'Original description',
                    tags: ['original'],
                    dyes: [1, 2],
                }),
            });

            let callCount = 0;
            mockDb._setupMock((query) => {
                callCount++;
                // First call: getPresetById (returns preset with previous_values)
                if (callCount === 1) return mockRow;
                // BUG-020: revert now runs as a batch whose UPDATE uses
                // RETURNING — an empty result set simulates the write failing
                if (query.includes('UPDATE')) {
                    return { results: [], success: true, meta: { changes: 0 } };
                }
                return null;
            });

            const res = await app.request(
                '/api/v1/moderation/preset-123/revert',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ reason: 'Valid revert reason here' }),
                },
                env
            );

            expect(res.status).toBe(500);
            const body = await res.json() as { error: string; message: string };
            expect(body.error).toBe('INTERNAL_ERROR');
            expect(body.message).toBe('Failed to revert preset');
        });

        it('should return 404 if preset not found', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request(
                '/api/v1/moderation/nonexistent/revert',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ reason: 'Trying to revert nonexistent preset' }),
                },
                env
            );

            expect(res.status).toBe(404);
        });

        it('should require reason of 10-200 characters', async () => {
            const mockRow = createMockPresetRow({ previous_values: '{}' });
            mockDb._setupMock(() => mockRow);

            // Too short
            const res1 = await app.request(
                '/api/v1/moderation/preset-123/revert',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ reason: 'Short' }),
                },
                env
            );

            expect(res1.status).toBe(400);
            const body1 = await res1.json() as { message: string };
            expect(body1.message).toContain('10-200 characters');

            // Too long
            const res2 = await app.request(
                '/api/v1/moderation/preset-123/revert',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ reason: 'A'.repeat(201) }),
                },
                env
            );

            expect(res2.status).toBe(400);
        });

        it('should log revert action', async () => {
            const previousValues = {
                name: 'Original',
                description: 'Original desc',
                tags: [],
                dyes: [1, 2],
            };
            const mockRow = createMockPresetRow({
                id: 'preset-123',
                previous_values: JSON.stringify(previousValues),
            });
            mockDb._setupMock(() => mockRow);

            await app.request(
                '/api/v1/moderation/preset-123/revert',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ reason: 'Valid revert reason here' }),
                },
                env
            );

            expect(mockDb._bindings.some((b) => b.includes('revert'))).toBe(true);
        });
    });

    // ============================================
    // PATCH /api/v1/moderation/:presetId/preview-image
    // ============================================

    describe('PATCH /api/v1/moderation/:presetId/preview-image', () => {
        it('approves a pending image so the URL starts being served', async () => {
            const row = createMockPresetRow({
                id: 'preset-123',
                status: 'approved',
                preview_image_key: 'preset-123/a.webp',
                preview_image_status: 'pending',
            });
            mockDb._setupMock((query) => {
                if (query.startsWith("UPDATE presets SET preview_image_status = 'approved'")) {
                    row.preview_image_status = 'approved';
                    return { success: true };
                }
                return row;
            });

            const res = await app.request(
                '/api/v1/moderation/preset-123/preview-image',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789', // In MODERATOR_IDS
                    },
                    body: JSON.stringify({ action: 'approve' }),
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean; preview_image_status: string };
            expect(body.success).toBe(true);
            expect(body.preview_image_status).toBe('approved');
            expect(row.preview_image_status).toBe('approved');
        });

        it('rejects by clearing the image, leaving the preset status alone', async () => {
            const row = createMockPresetRow({
                id: 'preset-123',
                status: 'approved',
                preview_image_key: 'preset-123/a.webp',
                preview_image_status: 'pending',
            });
            mockDb._setupMock((query) => {
                if (query.startsWith('UPDATE presets SET preview_image_key = NULL')) {
                    row.preview_image_key = null;
                    row.preview_image_status = 'none';
                    return { success: true };
                }
                return row;
            });

            const bucket = env.THUMBNAILS as unknown as MockR2Bucket;
            await bucket.put('preset-123/a.webp', new ArrayBuffer(4));
            expect(bucket._store.has('preset-123/a.webp')).toBe(true);

            const res = await app.request(
                '/api/v1/moderation/preset-123/preview-image',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789', // In MODERATOR_IDS
                    },
                    body: JSON.stringify({ action: 'reject' }),
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean; preview_image_status: string };
            expect(body.success).toBe(true);
            expect(body.preview_image_status).toBe('none');

            expect(row.preview_image_status).toBe('none');
            expect(row.preview_image_key).toBeNull();
            expect(row.status).toBe('approved'); // the preset itself is untouched
            expect(bucket._store.has('preset-123/a.webp')).toBe(false);
        });

        // Task 4's ruling applies here too: the DB UPDATE must land before the
        // R2 delete, so a throwing UPDATE only ever orphans an object (cheap,
        // invisible) instead of leaving the row pointing at a deleted key
        // (a broken image on a live card). Assert the ordering directly by
        // observing the row's state at the moment delete() is invoked.
        it('updates the row before deleting the R2 object', async () => {
            const row = createMockPresetRow({
                id: 'preset-123',
                status: 'approved',
                preview_image_key: 'preset-123/a.webp',
                preview_image_status: 'pending',
            });
            mockDb._setupMock((query) => {
                if (query.startsWith('UPDATE presets SET preview_image_key = NULL')) {
                    row.preview_image_key = null;
                    row.preview_image_status = 'none';
                    return { success: true };
                }
                return row;
            });

            const bucket = env.THUMBNAILS as unknown as MockR2Bucket;
            await bucket.put('preset-123/a.webp', new ArrayBuffer(4));

            let statusAtDeleteTime: string | undefined;
            const originalDelete = bucket.delete.bind(bucket);
            bucket.delete = vi.fn(async (key: string | string[]) => {
                statusAtDeleteTime = row.preview_image_status;
                return originalDelete(key);
            });

            const res = await app.request(
                '/api/v1/moderation/preset-123/preview-image',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789', // In MODERATOR_IDS
                    },
                    body: JSON.stringify({ action: 'reject' }),
                },
                env
            );

            expect(res.status).toBe(200);
            expect(bucket.delete).toHaveBeenCalledTimes(1);
            // By the time delete() ran, the row had already flipped to 'none' —
            // proving the UPDATE happened first.
            expect(statusAtDeleteTime).toBe('none');
        });

        // FINDING-018 / PAPI-4: deleting the R2 object is not a takedown while the
        // edge cache still serves the URL — reject must also purge it.
        it('purges the image URL from the edge cache on reject when purge credentials are configured (FINDING-018)', async () => {
            const row = createMockPresetRow({
                id: 'preset-123',
                status: 'approved',
                preview_image_key: 'preset-123/a.webp',
                preview_image_status: 'pending',
            });
            mockDb._setupMock((query) => {
                if (query.startsWith('UPDATE presets SET preview_image_key = NULL')) {
                    row.preview_image_key = null;
                    row.preview_image_status = 'none';
                    return { success: true };
                }
                return row;
            });
            const bucket = env.THUMBNAILS as unknown as MockR2Bucket;
            await bucket.put('preset-123/a.webp', new ArrayBuffer(4));

            const fetchMock = vi.fn(
                async () => new Response(JSON.stringify({ success: true }), { status: 200 })
            );
            vi.stubGlobal('fetch', fetchMock);
            try {
                const purgeEnv: Env = {
                    ...env,
                    CACHE_PURGE_ZONE_ID: 'zone-123',
                    CACHE_PURGE_API_TOKEN: 'purge-token',
                };

                const res = await app.request(
                    '/api/v1/moderation/preset-123/preview-image',
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: 'Bearer test-bot-secret',
                            'X-User-Discord-ID': '123456789', // In MODERATOR_IDS
                        },
                        body: JSON.stringify({ action: 'reject' }),
                    },
                    purgeEnv
                );

                expect(res.status).toBe(200);
                expect(bucket._store.has('preset-123/a.webp')).toBe(false);
                expect(fetchMock).toHaveBeenCalledTimes(1);
                const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
                expect(url).toBe('https://api.cloudflare.com/client/v4/zones/zone-123/purge_cache');
                expect(init.method).toBe('POST');
                expect((init.headers as Record<string, string>).Authorization).toBe('Bearer purge-token');
                expect(JSON.parse(init.body as string)).toEqual({
                    files: ['https://shots.xivdyetools.app/preset-123/a.webp'],
                });
            } finally {
                vi.unstubAllGlobals();
            }
        });

        it('refuses a non-moderator, including the preset\'s own author', async () => {
            const row = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: 'the-author',
                preview_image_key: 'preset-123/a.webp',
                preview_image_status: 'pending',
            });
            mockDb._setupMock(() => row);

            const res = await app.request(
                '/api/v1/moderation/preset-123/preview-image',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'the-author', // author, not a moderator
                    },
                    body: JSON.stringify({ action: 'approve' }),
                },
                env
            );

            expect(res.status).toBe(403);
        });

        it('returns 400 for an action that is neither approve nor reject', async () => {
            const res = await app.request(
                '/api/v1/moderation/preset-123/preview-image',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ action: 'delete' }),
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('VALIDATION_ERROR');
        });

        it('returns 400 for invalid JSON body', async () => {
            const res = await app.request(
                '/api/v1/moderation/preset-123/preview-image',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: 'not valid json',
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('INVALID_JSON');
        });

        it('returns 404 for a nonexistent preset', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request(
                '/api/v1/moderation/nonexistent/preview-image',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ action: 'approve' }),
                },
                env
            );

            expect(res.status).toBe(404);
        });
    });

    // ============================================
    // GET /api/v1/moderation/:presetId/history
    // ============================================

    describe('GET /api/v1/moderation/:presetId/history', () => {
        it('should require moderator privileges', async () => {
            const res = await app.request(
                '/api/v1/moderation/preset-123/history',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-a-moderator',
                    },
                },
                env
            );

            expect(res.status).toBe(403);
        });

        it('should return moderation history', async () => {
            const mockHistory = [
                {
                    id: 'log-1',
                    preset_id: 'preset-123',
                    moderator_discord_id: '123456789',
                    action: 'approve',
                    reason: null,
                    created_at: '2025-06-15T12:00:00Z',
                },
                {
                    id: 'log-2',
                    preset_id: 'preset-123',
                    moderator_discord_id: '987654321',
                    action: 'flag',
                    reason: 'Suspicious content',
                    created_at: '2025-06-14T10:00:00Z',
                },
            ];
            mockDb._setupMock(() => mockHistory);

            const res = await app.request(
                '/api/v1/moderation/preset-123/history',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { history: ModerationLogEntry[] };

            expect(body.history).toHaveLength(2);
        });

        it('should return empty history for preset with no moderation actions', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request(
                '/api/v1/moderation/preset-123/history',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { history: ModerationLogEntry[] };

            expect(body.history).toEqual([]);
        });
    });

    // ============================================
    // GET /api/v1/moderation/stats
    // ============================================

    describe('GET /api/v1/moderation/stats', () => {
        it('should require moderator privileges', async () => {
            const res = await app.request(
                '/api/v1/moderation/stats',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-a-moderator',
                    },
                },
                env
            );

            expect(res.status).toBe(403);
        });

        it('should return moderation statistics', async () => {
            const mockStats = {
                pending: 5,
                approved: 100,
                rejected: 10,
                flagged: 2,
                actions_last_week: 15,
            };
            mockDb._setupMock(() => mockStats);

            const res = await app.request(
                '/api/v1/moderation/stats',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { stats: { pending: number; approved: number; rejected: number; flagged: number; actions_last_week: number } };

            expect(body.stats.pending).toBe(5);
            expect(body.stats.approved).toBe(100);
            expect(body.stats.rejected).toBe(10);
            expect(body.stats.flagged).toBe(2);
            expect(body.stats.actions_last_week).toBe(15);
        });
    });

    // ============================================
    // Action Type Determination
    // ============================================

    describe('getActionFromStatusChange', () => {
        it('should log approve action for pending->approved', async () => {
            const mockRow = createMockPresetRow({ status: 'pending' });
            mockDb._setupMock(() => mockRow);

            await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ status: 'approved' }),
                },
                env
            );

            expect(mockDb._bindings.some((b) => b.includes('approve'))).toBe(true);
        });

        it('should log unflag action for flagged->approved', async () => {
            const mockRow = createMockPresetRow({ status: 'flagged' });
            mockDb._setupMock(() => mockRow);

            await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ status: 'approved' }),
                },
                env
            );

            expect(mockDb._bindings.some((b) => b.includes('unflag'))).toBe(true);
        });

        it('should log reject action for any->rejected', async () => {
            const mockRow = createMockPresetRow({ status: 'pending' });
            mockDb._setupMock(() => mockRow);

            await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ status: 'rejected' }),
                },
                env
            );

            expect(mockDb._bindings.some((b) => b.includes('reject'))).toBe(true);
        });

        it('should log flag action for any->flagged', async () => {
            const mockRow = createMockPresetRow({ status: 'approved' });
            mockDb._setupMock(() => mockRow);

            await app.request(
                '/api/v1/moderation/preset-123/status',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                    body: JSON.stringify({ status: 'flagged' }),
                },
                env
            );

            expect(mockDb._bindings.some((b) => b.includes('flag'))).toBe(true);
        });
    });

    // ============================================
    // Failed Notifications (BUG-015)
    // ============================================

    describe('GET /api/v1/moderation/failed-notifications', () => {
        it('should require moderator privileges', async () => {
            const res = await app.request(
                '/api/v1/moderation/failed-notifications',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-a-moderator',
                    },
                },
                env
            );

            expect(res.status).toBe(403);
        });

        it('should return unresolved failed notifications', async () => {
            const mockNotifications = [
                { id: '1', payload: '{}', error: 'timeout', attempts: 3, resolved_at: null, created_at: '2026-01-01' },
                { id: '2', payload: '{}', error: 'network', attempts: 2, resolved_at: null, created_at: '2026-01-02' },
            ];
            mockDb._setupMock(() => mockNotifications);

            const res = await app.request(
                '/api/v1/moderation/failed-notifications',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { notifications: unknown[]; total: number };
            expect(body.notifications).toHaveLength(2);
            expect(body.total).toBe(2);
        });

        it('should support include_resolved parameter', async () => {
            const mockNotifications = [
                { id: '1', payload: '{}', error: 'timeout', attempts: 3, resolved_at: '2026-01-05', created_at: '2026-01-01' },
            ];
            mockDb._setupMock(() => mockNotifications);

            const res = await app.request(
                '/api/v1/moderation/failed-notifications?include_resolved=true',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { notifications: unknown[]; total: number };
            expect(body.notifications).toHaveLength(1);
        });

        it('should return empty array if table does not exist', async () => {
            mockDb._setupMock(() => { throw new Error('no such table: failed_notifications'); });

            const res = await app.request(
                '/api/v1/moderation/failed-notifications',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { notifications: unknown[]; total: number };
            expect(body.notifications).toEqual([]);
            expect(body.total).toBe(0);
        });
    });

    describe('PATCH /api/v1/moderation/failed-notifications/:id/resolve', () => {
        it('should require moderator privileges', async () => {
            const res = await app.request(
                '/api/v1/moderation/failed-notifications/1/resolve',
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'not-a-moderator',
                    },
                },
                env
            );

            expect(res.status).toBe(403);
        });

        it('should resolve a failed notification', async () => {
            mockDb._setupMock(() => ({ meta: { changes: 1 } }));

            const res = await app.request(
                '/api/v1/moderation/failed-notifications/1/resolve',
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };
            expect(body.success).toBe(true);
        });

        it('should return 404 for already resolved or nonexistent notification', async () => {
            mockDb._setupMock(() => ({ meta: { changes: 0 } }));

            const res = await app.request(
                '/api/v1/moderation/failed-notifications/999/resolve',
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(404);
        });

        it('should return 500 on database error', async () => {
            mockDb._setupMock(() => { throw new Error('Database failure'); });

            const res = await app.request(
                '/api/v1/moderation/failed-notifications/1/resolve',
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(500);
        });
    });
});
