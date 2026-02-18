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
    createMockPresetRow,
    resetCounters,
} from '../test-utils';

type Variables = {
    auth: AuthContext;
};

describe('VotesHandler', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;
    let mockDb: ReturnType<typeof createMockD1Database>;

    beforeEach(() => {
        resetCounters();
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
                // Get vote count
                if (query.includes('vote_count FROM presets')) {
                    return { vote_count: 5 };
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
                // Get current vote count
                if (query.includes('vote_count FROM presets')) {
                    return { vote_count: 5 };
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
            mockDb._setupMock((query) => {
                if (query.includes('SELECT 1 FROM votes')) {
                    return null;
                }
                if (query.includes('vote_count FROM presets')) {
                    return { vote_count: 1 };
                }
                return { success: true };
            });

            await addVote(mockDb, 'preset-123', 'user-456');

            // Should have INSERT vote and UPDATE preset with vote_count + 1
            expect(mockDb._queries.some((q) => q.includes('INSERT INTO votes'))).toBe(true);
            expect(mockDb._queries.some((q) => q.includes('vote_count + 1'))).toBe(true);
        });

        it('should use batch operations for vote remove', async () => {
            mockDb._setupMock((query) => {
                if (query.includes('SELECT 1 FROM votes')) {
                    return { 1: 1 };
                }
                if (query.includes('vote_count FROM presets')) {
                    return { vote_count: 4 };
                }
                return { success: true };
            });

            await removeVote(mockDb, 'preset-123', 'user-456');

            // Should have DELETE vote and UPDATE preset with vote_count - 1
            expect(mockDb._queries.some((q) => q.includes('DELETE FROM votes'))).toBe(true);
            expect(mockDb._queries.some((q) => q.includes('vote_count - 1'))).toBe(true);
        });

        it('should use MAX(0, vote_count - 1) to prevent negative votes', async () => {
            mockDb._setupMock((query) => {
                if (query.includes('SELECT 1 FROM votes')) {
                    return { 1: 1 };
                }
                if (query.includes('vote_count FROM presets')) {
                    return { vote_count: 0 };
                }
                return { success: true };
            });

            await removeVote(mockDb, 'preset-123', 'user-456');

            expect(mockDb._queries.some((q) => q.includes('MAX(0, vote_count - 1)'))).toBe(true);
        });
    });
});
