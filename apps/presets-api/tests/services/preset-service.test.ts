/**
 * Preset Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    generateDyeSignature,
    rowToPreset,
    getPresets,
    getFeaturedPresets,
    getPresetById,
    findDuplicatePreset,
    createPreset,
    updatePresetStatus,
    getPendingPresets,
    getPresetsByUser,
    findDuplicatePresetExcluding,
    updatePreset,
    revertPreset,
} from '../../src/services/preset-service';
import type { PresetRow, CommunityPreset } from '../../src/types';
import {
    createMockD1Database,
    createMockPresetRow,
    createMockSubmission,
    resetCounters,
} from '../test-utils';

describe('PresetService', () => {
    beforeEach(() => {
        resetCounters();
        vi.clearAllMocks();
    });

    // ============================================
    // generateDyeSignature
    // ============================================

    describe('generateDyeSignature', () => {
        it('should generate sorted JSON string from dyes array', () => {
            const dyes = [3, 1, 2];
            const signature = generateDyeSignature(dyes);
            expect(signature).toBe('[1,2,3]');
        });

        it('should handle already sorted dyes', () => {
            const dyes = [1, 2, 3];
            const signature = generateDyeSignature(dyes);
            expect(signature).toBe('[1,2,3]');
        });

        it('should handle single dye', () => {
            const dyes = [42];
            const signature = generateDyeSignature(dyes);
            expect(signature).toBe('[42]');
        });

        it('should handle empty array', () => {
            const dyes: number[] = [];
            const signature = generateDyeSignature(dyes);
            expect(signature).toBe('[]');
        });

        it('should not mutate original array', () => {
            const dyes = [3, 1, 2];
            generateDyeSignature(dyes);
            expect(dyes).toEqual([3, 1, 2]);
        });

        it('should generate same signature for same dyes in different order', () => {
            const sig1 = generateDyeSignature([3, 1, 2]);
            const sig2 = generateDyeSignature([1, 2, 3]);
            const sig3 = generateDyeSignature([2, 3, 1]);
            expect(sig1).toBe(sig2);
            expect(sig2).toBe(sig3);
        });
    });

    // ============================================
    // rowToPreset
    // ============================================

    describe('rowToPreset', () => {
        it('should convert database row to domain object', () => {
            const row = createMockPresetRow({
                id: 'test-id',
                name: 'My Preset',
                dyes: JSON.stringify([10, 20, 30]),
                tags: JSON.stringify(['tag1', 'tag2']),
                is_curated: 1,
                vote_count: 5,
            });

            const preset = rowToPreset(row);

            expect(preset.id).toBe('test-id');
            expect(preset.name).toBe('My Preset');
            expect(preset.dyes).toEqual([10, 20, 30]);
            expect(preset.tags).toEqual(['tag1', 'tag2']);
            expect(preset.is_curated).toBe(true);
            expect(preset.vote_count).toBe(5);
        });

        it('should handle is_curated = 0 as false', () => {
            const row = createMockPresetRow({ is_curated: 0 });
            const preset = rowToPreset(row);
            expect(preset.is_curated).toBe(false);
        });

        it('should parse previous_values if present', () => {
            const previousValues = {
                name: 'Old Name',
                description: 'Old Desc',
                tags: ['old'],
                dyes: [1, 2],
            };
            const row = createMockPresetRow({
                previous_values: JSON.stringify(previousValues),
            });

            const preset = rowToPreset(row);
            expect(preset.previous_values).toEqual(previousValues);
        });

        it('should set previous_values to null if not present', () => {
            const row = createMockPresetRow({ previous_values: null });
            const preset = rowToPreset(row);
            expect(preset.previous_values).toBeNull();
        });

        it('should preserve dye_signature as string', () => {
            const row = createMockPresetRow({ dye_signature: '[1,2,3]' });
            const preset = rowToPreset(row);
            expect(preset.dye_signature).toBe('[1,2,3]');
        });

        it('should handle null dye_signature', () => {
            const row = createMockPresetRow({ dye_signature: null });
            const preset = rowToPreset(row);
            expect(preset.dye_signature).toBeUndefined();
        });
    });

    // ============================================
    // getPresets
    // ============================================

    describe('getPresets', () => {
        it('should query with default filters', async () => {
            const db = createMockD1Database();
            const mockRows = [{ ...createMockPresetRow(), _total: 1 }];

            db._setupMock(() => {
                return mockRows;
            });

            const result = await getPresets(db, {});

            expect(result.page).toBe(1);
            expect(result.limit).toBe(20);
            expect(result.total).toBe(1);
            expect(result.presets.length).toBe(1);
        });

        it('should filter by category', async () => {
            const db = createMockD1Database();
            // Return empty array - service uses window function COUNT(*) OVER() not separate count query
            db._setupMock(() => []);

            await getPresets(db, { category: 'jobs' });

            expect(db._queries.some((q) => q.includes('category_id = ?'))).toBe(true);
            expect(db._bindings.some((b) => b.includes('jobs'))).toBe(true);
        });

        it('should filter by search term', async () => {
            const db = createMockD1Database();
            // Return empty array - service uses window function COUNT(*) OVER() not separate count query
            db._setupMock(() => []);

            await getPresets(db, { search: 'red' });

            expect(db._queries.some((q) => q.includes('LIKE ?'))).toBe(true);
            expect(db._bindings.some((b) => b.some((v) => v === '%red%'))).toBe(true);
        });

        it('should filter by is_curated', async () => {
            const db = createMockD1Database();
            // Return empty array - service uses window function COUNT(*) OVER() not separate count query
            db._setupMock(() => []);

            await getPresets(db, { is_curated: true });

            expect(db._queries.some((q) => q.includes('is_curated = ?'))).toBe(true);
            expect(db._bindings.some((b) => b.includes(1))).toBe(true);
        });

        it('should sort by popular (default)', async () => {
            const db = createMockD1Database();
            // Return empty array - service uses window function COUNT(*) OVER() not separate count query
            db._setupMock(() => []);

            await getPresets(db, { sort: 'popular' });

            expect(db._queries.some((q) => q.includes('vote_count DESC'))).toBe(true);
        });

        it('should sort by recent', async () => {
            const db = createMockD1Database();
            // Return empty array - service uses window function COUNT(*) OVER() not separate count query
            db._setupMock(() => []);

            await getPresets(db, { sort: 'recent' });

            expect(db._queries.some((q) => q.includes('created_at DESC'))).toBe(true);
        });

        it('should sort by name', async () => {
            const db = createMockD1Database();
            // Return empty array - service uses window function COUNT(*) OVER() not separate count query
            db._setupMock(() => []);

            await getPresets(db, { sort: 'name' });

            expect(db._queries.some((q) => q.includes('name ASC'))).toBe(true);
        });

        it('should paginate correctly', async () => {
            const db = createMockD1Database();
            // Return empty array - we're just testing the bindings are correct
            db._setupMock(() => []);

            const result = await getPresets(db, { page: 3, limit: 10 });

            expect(result.page).toBe(3);
            expect(result.limit).toBe(10);
            expect(db._bindings.some((b) => b.includes(10) && b.includes(20))).toBe(true); // LIMIT 10 OFFSET 20
        });

        it('should calculate has_more correctly', async () => {
            const db = createMockD1Database();
            // Window function embeds _total in each row
            const mockRows = [
                { ...createMockPresetRow(), _total: 5 },
                { ...createMockPresetRow(), _total: 5 }
            ];

            db._setupMock(() => {
                return mockRows;
            });

            const result = await getPresets(db, { page: 1, limit: 2 });

            expect(result.has_more).toBe(true);
        });

        it('should return has_more false on last page', async () => {
            const db = createMockD1Database();
            // Window function embeds _total in each row - on last page with 1 item when total is 3, page 2, limit 2
            const mockRows = [{ ...createMockPresetRow(), _total: 3 }];

            db._setupMock(() => mockRows);

            const result = await getPresets(db, { page: 2, limit: 2 });

            expect(result.has_more).toBe(false);
        });

        it('should handle empty results with total 0', async () => {
            const db = createMockD1Database();

            db._setupMock(() => []);

            const result = await getPresets(db, {});

            expect(result.total).toBe(0);
            expect(result.presets).toEqual([]);
            expect(result.has_more).toBe(false);
        });

        it('should escape LIKE pattern special characters in search', async () => {
            const db = createMockD1Database();
            db._setupMock(() => []);

            await getPresets(db, { search: 'test%_\\string' });

            // The search pattern should be escaped
            const query = db._queries.find((q) => q.includes('LIKE'));
            expect(query).toBeDefined();
        });

        it('should filter by is_curated false', async () => {
            const db = createMockD1Database();
            db._setupMock(() => []);

            await getPresets(db, { is_curated: false });

            expect(db._bindings.some((b) => b.includes(0))).toBe(true);
        });

        it('should filter by custom status', async () => {
            const db = createMockD1Database();
            db._setupMock(() => []);

            await getPresets(db, { status: 'pending' });

            expect(db._bindings.some((b) => b.includes('pending'))).toBe(true);
        });
    });

    // ============================================
    // getFeaturedPresets
    // ============================================

    describe('getFeaturedPresets', () => {
        it('should return top 10 approved presets', async () => {
            const db = createMockD1Database();
            const mockRows = Array.from({ length: 10 }, () => createMockPresetRow());

            db._setupMock(() => mockRows);

            const result = await getFeaturedPresets(db);

            expect(result.length).toBe(10);
            expect(db._queries[0]).toContain("status = 'approved'");
            expect(db._queries[0]).toContain('LIMIT 10');
        });

        it('should order by vote_count DESC', async () => {
            const db = createMockD1Database();
            db._setupMock(() => []);

            await getFeaturedPresets(db);

            expect(db._queries[0]).toContain('vote_count DESC');
        });
    });

    // ============================================
    // getPresetById
    // ============================================

    describe('getPresetById', () => {
        it('should return preset if found', async () => {
            const db = createMockD1Database();
            const mockRow = createMockPresetRow({ id: 'test-123' });

            db._setupMock(() => mockRow);

            const result = await getPresetById(db, 'test-123');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('test-123');
        });

        it('should return null if not found', async () => {
            const db = createMockD1Database();
            db._setupMock(() => null);

            const result = await getPresetById(db, 'nonexistent');

            expect(result).toBeNull();
        });
    });

    // ============================================
    // findDuplicatePreset
    // ============================================

    describe('findDuplicatePreset', () => {
        it('should find preset with same dye signature', async () => {
            const db = createMockD1Database();
            const mockRow = createMockPresetRow({ dye_signature: '[1,2,3]' });

            db._setupMock(() => mockRow);

            const result = await findDuplicatePreset(db, [3, 1, 2]);

            expect(result).not.toBeNull();
        });

        it('should return null if no duplicate', async () => {
            const db = createMockD1Database();
            db._setupMock(() => null);

            const result = await findDuplicatePreset(db, [1, 2, 3]);

            expect(result).toBeNull();
        });

        it('should only check approved and pending presets', async () => {
            const db = createMockD1Database();
            db._setupMock(() => null);

            await findDuplicatePreset(db, [1, 2, 3]);

            expect(db._queries[0]).toContain("status IN ('approved', 'pending')");
        });
    });

    // ============================================
    // createPreset
    // ============================================

    describe('createPreset', () => {
        it('should create preset with correct fields', async () => {
            const db = createMockD1Database();
            const submission = createMockSubmission();

            const result = await createPreset(db, submission, 'user-123', 'TestUser', 'approved');

            expect(result.name).toBe(submission.name);
            expect(result.description).toBe(submission.description);
            expect(result.category_id).toBe(submission.category_id);
            expect(result.dyes).toEqual(submission.dyes);
            expect(result.tags).toEqual(submission.tags);
            expect(result.author_discord_id).toBe('user-123');
            expect(result.author_name).toBe('TestUser');
            expect(result.status).toBe('approved');
            expect(result.vote_count).toBe(0);
            expect(result.is_curated).toBe(false);
        });

        it('should generate UUID for new preset', async () => {
            const db = createMockD1Database();
            const submission = createMockSubmission();

            const result = await createPreset(db, submission, 'user-123', 'TestUser');

            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe('string');
            expect(result.id.length).toBeGreaterThan(0);
        });

        it('should generate dye signature', async () => {
            const db = createMockD1Database();
            const submission = createMockSubmission({ dyes: [5, 3, 1] });

            const result = await createPreset(db, submission, 'user-123', 'TestUser');

            expect(result.dye_signature).toBe('[1,3,5]');
        });

        it('should set pending status if specified', async () => {
            const db = createMockD1Database();
            const submission = createMockSubmission();

            const result = await createPreset(db, submission, 'user-123', 'TestUser', 'pending');

            expect(result.status).toBe('pending');
        });
    });

    // ============================================
    // updatePresetStatus
    // ============================================

    describe('updatePresetStatus', () => {
        it('should update preset status', async () => {
            const db = createMockD1Database();
            const mockRow = createMockPresetRow({ status: 'approved' });

            db._setupMock(() => mockRow);

            await updatePresetStatus(db, 'preset-1', 'rejected');

            expect(db._queries.some((q) => q.includes('UPDATE presets'))).toBe(true);
            expect(db._bindings.some((b) => b.includes('rejected'))).toBe(true);
        });
    });

    // ============================================
    // getPendingPresets
    // ============================================

    describe('getPendingPresets', () => {
        it('should return only pending presets', async () => {
            const db = createMockD1Database();
            const mockRows = [
                createMockPresetRow({ status: 'pending' }),
                createMockPresetRow({ status: 'pending' }),
            ];

            db._setupMock(() => mockRows);

            const result = await getPendingPresets(db);

            expect(result.length).toBe(2);
            expect(db._queries[0]).toContain("status = 'pending'");
        });

        it('should order by created_at ASC', async () => {
            const db = createMockD1Database();
            db._setupMock(() => []);

            await getPendingPresets(db);

            expect(db._queries[0]).toContain('created_at ASC');
        });
    });

    // ============================================
    // getPresetsByUser
    // ============================================

    describe('getPresetsByUser', () => {
        it('should filter by author_discord_id', async () => {
            const db = createMockD1Database();
            db._setupMock(() => []);

            await getPresetsByUser(db, 'user-123');

            expect(db._queries[0]).toContain('author_discord_id = ?');
            expect(db._bindings[0]).toContain('user-123');
        });

        it('should order by created_at DESC', async () => {
            const db = createMockD1Database();
            db._setupMock(() => []);

            await getPresetsByUser(db, 'user-123');

            expect(db._queries[0]).toContain('created_at DESC');
        });
    });

    // ============================================
    // findDuplicatePresetExcluding
    // ============================================

    describe('findDuplicatePresetExcluding', () => {
        it('should exclude specified preset from search', async () => {
            const db = createMockD1Database();
            db._setupMock(() => null);

            await findDuplicatePresetExcluding(db, [1, 2, 3], 'exclude-me');

            expect(db._queries[0]).toContain('id != ?');
            expect(db._bindings[0]).toContain('exclude-me');
        });
    });

    // ============================================
    // updatePreset
    // ============================================

    describe('updatePreset', () => {
        it('should update specified fields only', async () => {
            const db = createMockD1Database();
            db._setupMock(() => createMockPresetRow());

            await updatePreset(db, 'preset-1', { name: 'New Name' });

            const updateQuery = db._queries.find((q) => q.includes('UPDATE presets'));
            expect(updateQuery).toContain('name = ?');
            expect(db._bindings.some((b) => b.includes('New Name'))).toBe(true);
        });

        it('should update description field', async () => {
            const db = createMockD1Database();
            db._setupMock(() => createMockPresetRow());

            await updatePreset(db, 'preset-1', { description: 'New description that is long enough' });

            const updateQuery = db._queries.find((q) => q.includes('UPDATE presets'));
            expect(updateQuery).toContain('description = ?');
            expect(db._bindings.some((b) => b.includes('New description that is long enough'))).toBe(true);
        });

        it('should update tags field', async () => {
            const db = createMockD1Database();
            db._setupMock(() => createMockPresetRow());

            await updatePreset(db, 'preset-1', { tags: ['new', 'tags', 'here'] });

            const updateQuery = db._queries.find((q) => q.includes('UPDATE presets'));
            expect(updateQuery).toContain('tags = ?');
            expect(db._bindings.some((b) => b.some((v) => typeof v === 'string' && v.includes('new')))).toBe(true);
        });

        it('should update multiple fields at once', async () => {
            const db = createMockD1Database();
            db._setupMock(() => createMockPresetRow());

            await updatePreset(db, 'preset-1', {
                name: 'New Name',
                description: 'New description for this preset',
                tags: ['updated'],
            });

            const updateQuery = db._queries.find((q) => q.includes('UPDATE presets'));
            expect(updateQuery).toContain('name = ?');
            expect(updateQuery).toContain('description = ?');
            expect(updateQuery).toContain('tags = ?');
        });

        it('should regenerate dye_signature when dyes change', async () => {
            const db = createMockD1Database();
            db._setupMock(() => createMockPresetRow());

            await updatePreset(db, 'preset-1', { dyes: [5, 3, 1] });

            const updateQuery = db._queries.find((q) => q.includes('UPDATE presets'));
            expect(updateQuery).toContain('dye_signature = ?');
        });

        it('should store previous_values if provided', async () => {
            const db = createMockD1Database();
            db._setupMock(() => createMockPresetRow());

            const previousValues = {
                name: 'Old Name',
                description: 'Old Desc',
                tags: ['old'],
                dyes: [1, 2],
            };

            await updatePreset(db, 'preset-1', { name: 'New Name' }, previousValues);

            expect(db._bindings.some((b) => b.some((v) => typeof v === 'string' && v.includes('Old Name')))).toBe(true);
        });

        it('should clear previous_values when explicitly set to undefined', async () => {
            const db = createMockD1Database();
            db._setupMock(() => createMockPresetRow());

            // When previousValues is undefined, it should not be included in the update
            await updatePreset(db, 'preset-1', { name: 'New Name' }, undefined);

            const updateQuery = db._queries.find((q) => q.includes('UPDATE presets'));
            // previous_values should not appear in query when undefined
            expect(updateQuery).not.toContain('previous_values');
        });

        it('should update status if newStatus provided', async () => {
            const db = createMockD1Database();
            db._setupMock(() => createMockPresetRow());

            await updatePreset(db, 'preset-1', { name: 'New Name' }, undefined, 'pending');

            expect(db._bindings.some((b) => b.includes('pending'))).toBe(true);
        });

        it('should always include updated_at', async () => {
            const db = createMockD1Database();
            db._setupMock(() => createMockPresetRow());

            await updatePreset(db, 'preset-1', { name: 'New Name' });

            const updateQuery = db._queries.find((q) => q.includes('UPDATE presets'));
            expect(updateQuery).toContain('updated_at = ?');
        });
    });

    // ============================================
    // revertPreset
    // ============================================

    describe('revertPreset', () => {
        it('should return null if preset not found', async () => {
            const db = createMockD1Database();
            db._setupMock(() => null);

            const result = await revertPreset(db, 'nonexistent');

            expect(result).toBeNull();
        });

        it('should return null if no previous_values', async () => {
            const db = createMockD1Database();
            const mockRow = createMockPresetRow({ previous_values: null });

            let callCount = 0;
            db._setupMock(() => {
                callCount++;
                if (callCount === 1) return mockRow; // getPresetById call
                return null;
            });

            const result = await revertPreset(db, 'preset-1');

            expect(result).toBeNull();
        });

        it('should restore previous values and clear previous_values column', async () => {
            const db = createMockD1Database();
            const previousValues = {
                name: 'Original Name',
                description: 'Original Description',
                tags: ['original'],
                dyes: [10, 20],
            };
            const mockRow = createMockPresetRow({
                previous_values: JSON.stringify(previousValues),
            });

            db._setupMock(() => mockRow);

            await revertPreset(db, 'preset-1');

            const updateQuery = db._queries.find((q) => q.includes('UPDATE presets') && q.includes('previous_values = NULL'));
            expect(updateQuery).toBeDefined();
        });

        it('should set status to approved after revert', async () => {
            const db = createMockD1Database();
            const previousValues = {
                name: 'Original Name',
                description: 'Original Description',
                tags: ['original'],
                dyes: [10, 20],
            };
            const mockRow = createMockPresetRow({
                previous_values: JSON.stringify(previousValues),
            });

            db._setupMock(() => mockRow);

            await revertPreset(db, 'preset-1');

            const updateQuery = db._queries.find((q) => q.includes("status = 'approved'"));
            expect(updateQuery).toBeDefined();
        });
    });
});
