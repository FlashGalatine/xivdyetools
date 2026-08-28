/**
 * Votes Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { votesRouter, addVote, removeVote } from '../../src/handlers/votes';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext } from '../../src/types';
import {
    createMockEnv,
    createMockD1Database,
} from '../test-utils';

type Variables = {
    auth: AuthContext;
};

describe('VotesHandler', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;
    let mockDb: ReturnType<typeof createMockD1Database>;

    beforeEach(() => {
        mockDb = createMockD1Database();
        env = createMockEnv({ DB: mockDb as unknown as D1Database });

        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);
        app.route('/api/v1/votes', votesRouter);

        vi.clearAllMocks();
    });

    // ============================================
    // addVote (internal function)
    // ============================================

    describe('addVote', () => {
        it('should add vote successfully when no existing vote', async () => {
            mockDb._setupMock((query) => {
                // Insert vote
                if (query.includes('INSERT INTO votes')) {
                    return { success: true, meta: { changes: 1 } };
                }
                // Update vote count
                if (query.includes('UPDATE presets')) {
                    return { vote_count: 1 };
                }
                return { success: true };
            });

            const result = await addVote(mockDb, 'preset-123', 'user-456');

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.new_vote_count).toBe(1);
            expect(result.already_voted).toBeUndefined();
        });

        it('should return already_voted when user already voted', async () => {
            mockDb._setupMock((query) => {
                // Attempt insert
                if (query.includes('INSERT INTO votes')) {
                    return { success: true, meta: { changes: 0 } };
                }
                // BUG-019: counter update runs in the same batch and RETURNING
                // reports the recomputed count
                if (query.includes('UPDATE presets')) {
                    return [{ vote_count: 5 }];
                }
                return null;
            });

            const result = await addVote(mockDb, 'preset-123', 'user-456');

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.already_voted).toBe(true);
            expect(result.new_vote_count).toBe(5);
        });

        it('should handle errors gracefully', async () => {
            mockDb._setupMock((query) => {
                if (query.includes('INSERT INTO votes')) {
                    throw new Error('Database error');
                }
                return null;
            });

            const result = await addVote(mockDb, 'preset-123', 'user-456');

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error).toBe('Failed to add vote');
        });
    });

    // ============================================
    // removeVote (internal function)
    // ============================================

    describe('removeVote', () => {
        it('should remove vote successfully when vote exists', async () => {
            mockDb._setupMock((query) => {
                // Delete vote
                if (query.includes('DELETE FROM votes')) {
                    return { success: true, meta: { changes: 1 } };
                }
                // Update vote count
                if (query.includes('UPDATE presets')) {
                    return { vote_count: 4 };
                }
                return { success: true };
            });

            const result = await removeVote(mockDb, 'preset-123', 'user-456');

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.new_vote_count).toBe(4);
        });

        it('should return already_voted=false when no vote to remove', async () => {
            mockDb._setupMock((query) => {
                // Delete vote
                if (query.includes('DELETE FROM votes')) {
                    return { success: true, meta: { changes: 0 } };
                }
                // BUG-019: batched counter update returns the recomputed count
                if (query.includes('UPDATE presets')) {
                    return [{ vote_count: 5 }];
                }
                return null;
            });

            const result = await removeVote(mockDb, 'preset-123', 'user-456');

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.already_voted).toBe(false);
            expect(result.new_vote_count).toBe(5);
        });

        it('should handle errors gracefully', async () => {
            mockDb._setupMock((query) => {
                if (query.includes('DELETE FROM votes')) {
                    throw new Error('Database error');
                }
                return null;
            });

            const result = await removeVote(mockDb, 'preset-123', 'user-456');

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error).toBe('Failed to remove vote');
        });
    });

    // ============================================
    // POST /api/v1/votes/:presetId
    // ============================================

    describe('POST /api/v1/votes/:presetId', () => {
        it('should require authentication', async () => {
            const res = await app.request(
                '/api/v1/votes/preset-123',
                { method: 'POST' },
                env
            );

            expect(res.status).toBe(401);
        });

        it('should require user context', async () => {
            const res = await app.request(
                '/api/v1/votes/preset-123',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        // No X-User-Discord-ID
                    },
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should return 404 if preset does not exist', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request(
                '/api/v1/votes/nonexistent',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(404);
        });

        it('refuses a banned user with 403 USER_BANNED', async () => {
            mockDb._setBanStatus(true);
            mockDb._setupMock(() => ({ id: 'preset-123' }));

            const res = await app.request(
                '/api/v1/votes/preset-123',
                {
                    method: 'POST',
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
            expect(mockDb._queries.some((q) => q.includes('INSERT INTO votes'))).toBe(false);
        });

        it('should add vote successfully', async () => {
            mockDb._setupMock((query) => {
                // Check preset exists
                if (query.includes('SELECT id FROM presets')) {
                    return { id: 'preset-123' };
                }
                // Insert vote
                if (query.includes('INSERT INTO votes')) {
                    return { success: true, meta: { changes: 1 } };
                }
                // Update vote count
                if (query.includes('UPDATE presets')) {
                    return { vote_count: 1 };
                }
                return { success: true };
            });

            const res = await app.request(
                '/api/v1/votes/preset-123',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean; new_vote_count: number };

            expect(body.success).toBe(true);
            expect(body.new_vote_count).toBe(1);
        });

        // FINDING-016 / PAPI-5 (2026-08-21 security audit): the existence check
        // had no status predicate, so pending / rejected / flagged / hidden
        // presets accumulated votes from anyone who kept the URL.
        it('only lets approved presets be voted on — the gate query filters on status (FINDING-016)', async () => {
            mockDb._setupMock((query) => {
                if (query.includes('FROM presets') && query.includes("status = 'approved'")) {
                    return { id: 'preset-123' };
                }
                if (query.includes('INSERT INTO votes')) {
                    return { success: true, meta: { changes: 1 } };
                }
                if (query.includes('UPDATE presets')) {
                    return [{ vote_count: 1 }];
                }
                return null;
            });

            const res = await app.request(
                '/api/v1/votes/preset-123',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const gate = mockDb._queries.find((q) => q.includes('FROM presets') && q.includes('WHERE id = ?'));
            expect(gate).toBeDefined();
            expect(gate).toContain("status = 'approved'");
        });

        it('returns 404 (not 200/409) for a preset that is not approved, and records no vote', async () => {
            // The status-gated lookup finds nothing for a pending/rejected/hidden row
            mockDb._setupMock((query) => {
                if (query.includes('FROM presets')) return null;
                return { success: true };
            });

            const res = await app.request(
                '/api/v1/votes/pending-preset',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(404);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('NOT_FOUND');
            expect(mockDb._queries.some((q) => q.includes('INSERT INTO votes'))).toBe(false);
        });

        it('should return 409 conflict if already voted', async () => {
            mockDb._setupMock((query) => {
                // Check preset exists
                if (query.includes('SELECT id FROM presets')) {
                    return { id: 'preset-123' };
                }
                // Attempt insert (duplicate)
                if (query.includes('INSERT INTO votes')) {
                    return { success: true, meta: { changes: 0 } };
                }
                // Get vote count
                if (query.includes('vote_count FROM presets')) {
                    return { vote_count: 5 };
                }
                return null;
            });

            const res = await app.request(
                '/api/v1/votes/preset-123',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(409);
            const body = await res.json() as { already_voted: boolean };

            expect(body.already_voted).toBe(true);
        });
    });

    // ============================================
    // DELETE /api/v1/votes/:presetId
    // ============================================

    describe('DELETE /api/v1/votes/:presetId', () => {
        it('should require authentication', async () => {
            const res = await app.request(
                '/api/v1/votes/preset-123',
                { method: 'DELETE' },
                env
            );

            expect(res.status).toBe(401);
        });

        it('should require user context', async () => {
            const res = await app.request(
                '/api/v1/votes/preset-123',
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        // No X-User-Discord-ID
                    },
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('should return 404 if preset does not exist', async () => {
            mockDb._setupMock((query) => {
                if (query.includes('SELECT id FROM presets')) {
                    return null;
                }
                return null;
            });

            const res = await app.request(
                '/api/v1/votes/nonexistent',
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

        it('gates vote removal on an approved preset too — a hidden preset is a 404 (FINDING-016)', async () => {
            mockDb._setupMock((query) => {
                if (query.includes('FROM presets')) return null; // status-gated lookup finds nothing
                return { success: true };
            });

            const res = await app.request(
                '/api/v1/votes/hidden-preset',
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
            const gate = mockDb._queries.find((q) => q.includes('FROM presets') && q.includes('WHERE id = ?'));
            expect(gate).toContain("status = 'approved'");
            expect(mockDb._queries.some((q) => q.includes('DELETE FROM votes'))).toBe(false);
        });

        it('refuses a banned user with 403 USER_BANNED (FINDING-017 — DELETE vote had no ban check)', async () => {
            mockDb._setBanStatus(true);
            mockDb._setupMock(() => ({ id: 'preset-123' }));

            const res = await app.request(
                '/api/v1/votes/preset-123',
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
            expect(mockDb._queries.some((q) => q.includes('DELETE FROM votes'))).toBe(false);
        });

        it('should remove vote successfully', async () => {
            mockDb._setupMock((query) => {
                // Check preset exists
                if (query.includes('SELECT id FROM presets')) {
                    return { id: 'preset-123' };
                }
                // Delete vote
                if (query.includes('DELETE FROM votes')) {
                    return { success: true, meta: { changes: 1 } };
                }
                // Update vote count
                if (query.includes('UPDATE presets')) {
                    return { vote_count: 4 };
                }
                return { success: true };
            });

            const res = await app.request(
                '/api/v1/votes/preset-123',
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
            const body = await res.json() as { success: boolean; new_vote_count: number };

            expect(body.success).toBe(true);
            expect(body.new_vote_count).toBe(4);
        });

        it('should handle removing non-existent vote', async () => {
            mockDb._setupMock((query) => {
                // Check preset exists
                if (query.includes('SELECT id FROM presets')) {
                    return { id: 'preset-123' };
                }
                // Delete vote (no row removed)
                if (query.includes('DELETE FROM votes')) {
                    return { success: true, meta: { changes: 0 } };
                }
                // Get vote count
                if (query.includes('vote_count FROM presets')) {
                    return { vote_count: 5 };
                }
                return null;
            });

            const res = await app.request(
                '/api/v1/votes/preset-123',
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
            const body = await res.json() as { success: boolean; already_voted: boolean };

            expect(body.success).toBe(true);
            expect(body.already_voted).toBe(false);
        });
    });

    // ============================================
    // GET /api/v1/votes/:presetId/check
    // ============================================

    describe('GET /api/v1/votes/:presetId/check', () => {
        it('should require authentication', async () => {
            const res = await app.request('/api/v1/votes/preset-123/check', {}, env);

            expect(res.status).toBe(401);
        });

        it('should require user context', async () => {
            const res = await app.request(
                '/api/v1/votes/preset-123/check',
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

        it('should return has_voted=true when user has voted', async () => {
            mockDb._setupMock(() => ({ 1: 1 })); // Vote exists

            const res = await app.request(
                '/api/v1/votes/preset-123/check',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { has_voted: boolean };

            expect(body.has_voted).toBe(true);
        });

        it('should return has_voted=false when user has not voted', async () => {
            mockDb._setupMock(() => null); // No vote

            const res = await app.request(
                '/api/v1/votes/preset-123/check',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { has_voted: boolean };

            expect(body.has_voted).toBe(false);
        });
    });

    // ============================================
    // Vote Count Updates
    // ============================================

    describe('Vote Count Consistency', () => {
        it('should use batch operations for vote add', async () => {
            mockDb._setupMock(() => ({ success: true }));

            await addVote(mockDb, 'preset-123', 'user-456');

            // BUG-019: insert + recompute-from-truth counter update in one batch
            expect(mockDb._queries.some((q) => q.includes('INSERT INTO votes'))).toBe(true);
            expect(mockDb._queries.some((q) => q.includes('SELECT COUNT(*) FROM votes'))).toBe(true);
        });

        it('should use batch operations for vote remove', async () => {
            mockDb._setupMock(() => ({ success: true }));

            await removeVote(mockDb, 'preset-123', 'user-456');

            // BUG-019: delete + recompute-from-truth counter update in one batch
            expect(mockDb._queries.some((q) => q.includes('DELETE FROM votes'))).toBe(true);
            expect(mockDb._queries.some((q) => q.includes('SELECT COUNT(*) FROM votes'))).toBe(true);
        });

        it('should recompute the counter from the votes table (cannot go negative)', async () => {
            mockDb._setupMock((query) => {
                if (query.includes('UPDATE presets')) {
                    return [{ vote_count: 0 }];
                }
                return { success: true };
            });

            const result = await removeVote(mockDb, 'preset-123', 'user-456');

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.new_vote_count).toBe(0);
        });
    });
});
