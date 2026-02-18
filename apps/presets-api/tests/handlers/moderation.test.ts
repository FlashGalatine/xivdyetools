/**
 * Moderation Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext, CommunityPreset, ModerationLogEntry } from '../../src/types';
import {
    createMockEnv,
    createMockD1Database,
    createMockPresetRow,
    resetCounters,
} from '../test-utils';

type Variables = {
    auth: AuthContext;
};

describe('ModerationHandler', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;
    let mockDb: ReturnType<typeof createMockD1Database>;

    beforeEach(() => {
        resetCounters();
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
                previous_values: JSON.stringify({ name: 'Original' }),
            });

            let callCount = 0;
            mockDb._setupMock((query) => {
                callCount++;
                // First call: getPresetById (returns preset with previous_values)
                if (callCount === 1) return mockRow;
                // Second call: revertPreset UPDATE
                if (query.includes('UPDATE')) return { success: true };
                // Third call: fetch reverted preset returns null (simulating failure)
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
});
