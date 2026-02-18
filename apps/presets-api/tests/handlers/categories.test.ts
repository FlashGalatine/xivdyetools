/**
 * Categories Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { categoriesRouter } from '../../src/handlers/categories';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext, CategoryMeta } from '../../src/types';
import {
    createMockEnv,
    createMockD1Database,
    createMockCategoryRow,
    resetCounters,
} from '../test-utils';

type Variables = {
    auth: AuthContext;
};

describe('CategoriesHandler', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;
    let mockDb: ReturnType<typeof createMockD1Database>;

    beforeEach(() => {
        resetCounters();
        mockDb = createMockD1Database();
        env = createMockEnv({ DB: mockDb as unknown as D1Database });

        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);
        app.route('/api/v1/categories', categoriesRouter);

        vi.clearAllMocks();
    });

    // ============================================
    // GET /api/v1/categories
    // ============================================

    describe('GET /api/v1/categories', () => {
        it('should return all categories with preset counts', async () => {
            const mockRows = [
                { ...createMockCategoryRow({ id: 'jobs', name: 'Jobs' }), preset_count: 15 },
                { ...createMockCategoryRow({ id: 'aesthetics', name: 'Aesthetics' }), preset_count: 30 },
                { ...createMockCategoryRow({ id: 'seasons', name: 'Seasons' }), preset_count: 10 },
            ];
            mockDb._setupMock(() => mockRows);

            const res = await app.request('/api/v1/categories', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { categories: CategoryMeta[] };

            expect(body.categories).toHaveLength(3);
            expect(body.categories[0].preset_count).toBe(15);
            expect(body.categories[1].preset_count).toBe(30);
        });

        it('should include all category fields', async () => {
            const mockRows = [
                {
                    id: 'jobs',
                    name: 'Jobs',
                    description: 'Job-themed palettes',
                    icon: '⚔️',
                    is_curated: 1,
                    display_order: 1,
                    preset_count: 25,
                },
            ];
            mockDb._setupMock(() => mockRows);

            const res = await app.request('/api/v1/categories', {}, env);
            const body = await res.json() as { categories: CategoryMeta[] };

            expect(body.categories[0]).toEqual({
                id: 'jobs',
                name: 'Jobs',
                description: 'Job-themed palettes',
                icon: '⚔️',
                is_curated: true,
                display_order: 1,
                preset_count: 25,
            });
        });

        it('should convert is_curated from number to boolean', async () => {
            const mockRows = [
                { ...createMockCategoryRow({ is_curated: 0 }), preset_count: 0 },
                { ...createMockCategoryRow({ is_curated: 1 }), preset_count: 0 },
            ];
            mockDb._setupMock(() => mockRows);

            const res = await app.request('/api/v1/categories', {}, env);
            const body = await res.json() as { categories: CategoryMeta[] };

            expect(body.categories[0].is_curated).toBe(false);
            expect(body.categories[1].is_curated).toBe(true);
        });

        it('should handle empty categories list', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request('/api/v1/categories', {}, env);
            const body = await res.json() as { categories: CategoryMeta[] };

            expect(body.categories).toEqual([]);
        });

        it('should handle undefined results from database', async () => {
            // Simulate database returning undefined results
            mockDb._setupMock(() => undefined);

            const res = await app.request('/api/v1/categories', {}, env);
            const body = await res.json() as { categories: unknown[] };

            // Should fall back to empty array
            expect(body.categories).toEqual([]);
        });

        it('should handle null preset_count', async () => {
            const mockRows = [
                { ...createMockCategoryRow(), preset_count: null },
            ];
            mockDb._setupMock(() => mockRows);

            const res = await app.request('/api/v1/categories', {}, env);
            const body = await res.json() as { categories: CategoryMeta[] };

            expect(body.categories[0].preset_count).toBe(0);
        });

        it('should order by display_order', async () => {
            mockDb._setupMock(() => []);

            await app.request('/api/v1/categories', {}, env);

            expect(mockDb._queries[0]).toContain('ORDER BY c.display_order ASC');
        });

        it('should only count approved presets', async () => {
            mockDb._setupMock(() => []);

            await app.request('/api/v1/categories', {}, env);

            expect(mockDb._queries[0]).toContain("status = 'approved'");
        });

        it('should allow unauthenticated access (public endpoint)', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request('/api/v1/categories', {}, env);

            expect(res.status).toBe(200);
        });
    });

    // ============================================
    // GET /api/v1/categories/:id
    // ============================================

    describe('GET /api/v1/categories/:id', () => {
        it('should return single category with preset count', async () => {
            const mockRow = {
                id: 'jobs',
                name: 'Jobs',
                description: 'Job-themed palettes',
                icon: '⚔️',
                is_curated: 1,
                display_order: 1,
                preset_count: 25,
            };
            mockDb._setupMock(() => mockRow);

            const res = await app.request('/api/v1/categories/jobs', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as CategoryMeta;

            expect(body.id).toBe('jobs');
            expect(body.name).toBe('Jobs');
            expect(body.preset_count).toBe(25);
        });

        it('should return 404 if category not found', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request('/api/v1/categories/nonexistent', {}, env);

            expect(res.status).toBe(404);
            const body = await res.json() as { error: string; message: string };

            expect(body.error).toBe('NOT_FOUND');
            expect(body.message).toBe('Category not found');
        });

        it('should convert is_curated from number to boolean', async () => {
            const mockRow = {
                ...createMockCategoryRow({ id: 'test', is_curated: 1 }),
                preset_count: 0,
            };
            mockDb._setupMock(() => mockRow);

            const res = await app.request('/api/v1/categories/test', {}, env);
            const body = await res.json() as CategoryMeta;

            expect(body.is_curated).toBe(true);
        });

        it('should handle null preset_count', async () => {
            const mockRow = {
                ...createMockCategoryRow({ id: 'test' }),
                preset_count: null,
            };
            mockDb._setupMock(() => mockRow);

            const res = await app.request('/api/v1/categories/test', {}, env);
            const body = await res.json() as CategoryMeta;

            expect(body.preset_count).toBe(0);
        });

        it('should handle null icon', async () => {
            const mockRow = {
                ...createMockCategoryRow({ id: 'test', icon: null }),
                preset_count: 5,
            };
            mockDb._setupMock(() => mockRow);

            const res = await app.request('/api/v1/categories/test', {}, env);
            const body = await res.json() as CategoryMeta;

            expect(body.icon).toBeNull();
        });

        it('should query with correct category id', async () => {
            mockDb._setupMock(() => null);

            await app.request('/api/v1/categories/jobs', {}, env);

            expect(mockDb._bindings[0]).toContain('jobs');
        });

        it('should allow unauthenticated access (public endpoint)', async () => {
            mockDb._setupMock(() => null);

            const res = await app.request('/api/v1/categories/test', {}, env);

            // Should get 404 (not 401), proving auth is not required
            expect(res.status).toBe(404);
        });
    });

    // ============================================
    // Query Structure
    // ============================================

    describe('Query Structure', () => {
        it('should use LEFT JOIN for categories list', async () => {
            mockDb._setupMock(() => []);

            await app.request('/api/v1/categories', {}, env);

            expect(mockDb._queries[0]).toContain('LEFT JOIN presets');
        });

        it('should use GROUP BY for categories list', async () => {
            mockDb._setupMock(() => []);

            await app.request('/api/v1/categories', {}, env);

            expect(mockDb._queries[0]).toContain('GROUP BY c.id');
        });

        it('should use COUNT with CASE for approved presets only', async () => {
            mockDb._setupMock(() => []);

            await app.request('/api/v1/categories', {}, env);

            expect(mockDb._queries[0]).toContain('COUNT(CASE WHEN');
        });
    });

    // ============================================
    // Expected Category IDs
    // ============================================

    describe('Category ID Validation', () => {
        const validCategories = ['jobs', 'grand-companies', 'seasons', 'events', 'aesthetics', 'community'];

        validCategories.forEach((categoryId) => {
            it(`should accept valid category ID: ${categoryId}`, async () => {
                const mockRow = {
                    ...createMockCategoryRow({ id: categoryId }),
                    preset_count: 0,
                };
                mockDb._setupMock(() => mockRow);

                const res = await app.request(`/api/v1/categories/${categoryId}`, {}, env);

                // Should get 200 if found
                expect(res.status).toBe(200);
            });
        });

        it('should handle category IDs with hyphens correctly', async () => {
            const mockRow = {
                id: 'grand-companies',
                name: 'Grand Companies',
                description: 'Grand Company themed palettes',
                icon: '🏛️',
                is_curated: 0,
                display_order: 2,
                preset_count: 5,
            };
            mockDb._setupMock(() => mockRow);

            const res = await app.request('/api/v1/categories/grand-companies', {}, env);
            const body = await res.json() as CategoryMeta;

            expect(body.id).toBe('grand-companies');
        });
    });
});
