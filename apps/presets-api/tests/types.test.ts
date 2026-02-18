/**
 * Types Tests
 * Tests to ensure type definitions are correct and usable
 */

import { describe, it, expect } from 'vitest';
import type {
    Env,
    PresetStatus,
    PresetCategory,
    CategoryMeta,
    CommunityPreset,
    PresetPreviousValues,
    PresetSubmission,
    PresetEditRequest,
    PresetEditResponse,
    PresetFilters,
    PresetListResponse,
    PresetSubmitResponse,
    VoteResponse,
    ModerationResponse,
    CategoryListResponse,
    ModerationResult,
    ModerationLogEntry,
    PresetRow,
    CategoryRow,
    VoteRow,
    AuthSource,
    AuthContext,
    RateLimitResult,
} from '../src/types';

describe('Types', () => {
    // ============================================
    // PresetStatus
    // ============================================

    describe('PresetStatus', () => {
        it('should allow valid status values', () => {
            const statuses: PresetStatus[] = ['pending', 'approved', 'rejected', 'flagged'];

            statuses.forEach((status) => {
                expect(['pending', 'approved', 'rejected', 'flagged']).toContain(status);
            });
        });
    });

    // ============================================
    // PresetCategory
    // ============================================

    describe('PresetCategory', () => {
        it('should allow valid category values', () => {
            const categories: PresetCategory[] = [
                'jobs',
                'grand-companies',
                'seasons',
                'events',
                'aesthetics',
                'community',
            ];

            expect(categories).toHaveLength(6);
        });
    });

    // ============================================
    // AuthSource
    // ============================================

    describe('AuthSource', () => {
        it('should allow valid auth source values', () => {
            const sources: AuthSource[] = ['none', 'bot', 'web'];

            expect(sources).toHaveLength(3);
        });
    });

    // ============================================
    // CommunityPreset
    // ============================================

    describe('CommunityPreset', () => {
        it('should have all required fields', () => {
            const preset: CommunityPreset = {
                id: 'test-id',
                name: 'Test Preset',
                description: 'Test Description',
                category_id: 'aesthetics',
                dyes: [1, 2, 3],
                tags: ['tag1', 'tag2'],
                author_discord_id: '123',
                author_name: 'TestUser',
                vote_count: 5,
                status: 'approved',
                is_curated: false,
                created_at: '2025-06-15T12:00:00Z',
                updated_at: '2025-06-15T12:00:00Z',
            };

            expect(preset.id).toBeDefined();
            expect(preset.name).toBeDefined();
            expect(preset.dyes).toBeInstanceOf(Array);
            expect(preset.tags).toBeInstanceOf(Array);
        });

        it('should allow optional fields', () => {
            const preset: CommunityPreset = {
                id: 'test-id',
                name: 'Test Preset',
                description: 'Test Description',
                category_id: 'aesthetics',
                dyes: [1, 2, 3],
                tags: [],
                author_discord_id: null,
                author_name: null,
                vote_count: 0,
                status: 'pending',
                is_curated: false,
                created_at: '2025-06-15T12:00:00Z',
                updated_at: '2025-06-15T12:00:00Z',
                dye_signature: '[1,2,3]',
                previous_values: {
                    name: 'Old Name',
                    description: 'Old Desc',
                    tags: [],
                    dyes: [1, 2],
                },
            };

            expect(preset.author_discord_id).toBeNull();
            expect(preset.dye_signature).toBe('[1,2,3]');
            expect(preset.previous_values).toBeDefined();
        });
    });

    // ============================================
    // PresetSubmission
    // ============================================

    describe('PresetSubmission', () => {
        it('should have required submission fields', () => {
            const submission: PresetSubmission = {
                name: 'My Preset',
                description: 'A description of my preset',
                category_id: 'jobs',
                dyes: [1, 2, 3],
                tags: ['tag1'],
            };

            expect(submission.name).toBe('My Preset');
            expect(submission.category_id).toBe('jobs');
        });
    });

    // ============================================
    // PresetEditRequest
    // ============================================

    describe('PresetEditRequest', () => {
        it('should allow partial updates', () => {
            const editName: PresetEditRequest = {
                name: 'New Name',
            };

            const editDyes: PresetEditRequest = {
                dyes: [1, 2, 3, 4],
            };

            const editMultiple: PresetEditRequest = {
                name: 'New Name',
                description: 'New Description',
                tags: ['new-tag'],
            };

            expect(editName.name).toBe('New Name');
            expect(editName.description).toBeUndefined();
            expect(editDyes.dyes).toHaveLength(4);
            expect(editMultiple.tags).toContain('new-tag');
        });
    });

    // ============================================
    // PresetFilters
    // ============================================

    describe('PresetFilters', () => {
        it('should allow all optional filter fields', () => {
            const filters: PresetFilters = {
                category: 'jobs',
                search: 'red',
                status: 'approved',
                sort: 'popular',
                page: 1,
                limit: 20,
                is_curated: true,
            };

            expect(filters.category).toBe('jobs');
            expect(filters.sort).toBe('popular');
        });

        it('should allow empty filters', () => {
            const filters: PresetFilters = {};

            expect(Object.keys(filters)).toHaveLength(0);
        });
    });

    // ============================================
    // Response Types
    // ============================================

    describe('Response Types', () => {
        it('PresetListResponse should have pagination fields', () => {
            const response: PresetListResponse = {
                presets: [],
                total: 0,
                page: 1,
                limit: 20,
                has_more: false,
            };

            expect(response.has_more).toBe(false);
            expect(response.presets).toBeInstanceOf(Array);
        });

        it('VoteResponse should have vote result fields', () => {
            const success: VoteResponse = {
                success: true,
                new_vote_count: 5,
            };

            const alreadyVoted: VoteResponse = {
                success: true,
                new_vote_count: 5,
                already_voted: true,
            };

            const error: VoteResponse = {
                success: false,
                error: 'Failed to add vote',
            };

            expect(success.success).toBe(true);
            if (alreadyVoted.success) {
                expect(alreadyVoted.already_voted).toBe(true);
            }
            if (!error.success) {
                expect(error.error).toBe('Failed to add vote');
            }
        });

        it('ModerationResult should have moderation outcome fields', () => {
            const passed: ModerationResult = {
                passed: true,
                method: 'all',
                scores: { toxicity: 0.1 },
            };

            const failed: ModerationResult = {
                passed: false,
                flaggedField: 'name',
                flaggedReason: 'Contains prohibited content',
                method: 'local',
            };

            expect(passed.passed).toBe(true);
            expect(failed.flaggedField).toBe('name');
        });
    });

    // ============================================
    // Row Types
    // ============================================

    describe('Row Types', () => {
        it('PresetRow should store JSON as strings', () => {
            const row: PresetRow = {
                id: 'test-id',
                name: 'Test',
                description: 'Test Description',
                category_id: 'aesthetics',
                dyes: '[1,2,3]',
                tags: '["tag1"]',
                author_discord_id: '123',
                author_name: 'User',
                vote_count: 0,
                status: 'approved',
                is_curated: 1,
                created_at: '2025-06-15T12:00:00Z',
                updated_at: '2025-06-15T12:00:00Z',
                dye_signature: '[1,2,3]',
                previous_values: null,
            };

            expect(typeof row.dyes).toBe('string');
            expect(typeof row.tags).toBe('string');
            expect(row.is_curated).toBe(1); // SQLite boolean as number
        });

        it('CategoryRow should have display ordering', () => {
            const row: CategoryRow = {
                id: 'jobs',
                name: 'Jobs',
                description: 'Job-themed palettes',
                icon: '⚔️',
                is_curated: 0,
                display_order: 1,
            };

            expect(row.display_order).toBe(1);
            expect(row.is_curated).toBe(0);
        });

        it('VoteRow should track vote timestamps', () => {
            const row: VoteRow = {
                preset_id: 'preset-123',
                user_discord_id: 'user-456',
                created_at: '2025-06-15T12:00:00Z',
            };

            expect(row.created_at).toBeDefined();
        });
    });

    // ============================================
    // AuthContext
    // ============================================

    describe('AuthContext', () => {
        it('should represent unauthenticated state', () => {
            const unauth: AuthContext = {
                isAuthenticated: false,
                isModerator: false,
                authSource: 'none',
            };

            expect(unauth.isAuthenticated).toBe(false);
            expect(unauth.userDiscordId).toBeUndefined();
        });

        it('should represent authenticated user', () => {
            const auth: AuthContext = {
                isAuthenticated: true,
                isModerator: false,
                userDiscordId: '123',
                userName: 'TestUser',
                authSource: 'bot',
            };

            expect(auth.isAuthenticated).toBe(true);
            expect(auth.userDiscordId).toBe('123');
        });

        it('should represent moderator', () => {
            const mod: AuthContext = {
                isAuthenticated: true,
                isModerator: true,
                userDiscordId: '123',
                userName: 'ModUser',
                authSource: 'web',
            };

            expect(mod.isModerator).toBe(true);
        });
    });

    // ============================================
    // RateLimitResult
    // ============================================

    describe('RateLimitResult', () => {
        it('should indicate allowed submission', () => {
            const allowed: RateLimitResult = {
                allowed: true,
                remaining: 5,
                resetAt: new Date('2025-06-16T00:00:00Z'),
            };

            expect(allowed.allowed).toBe(true);
            expect(allowed.remaining).toBe(5);
            expect(allowed.resetAt instanceof Date).toBe(true);
        });

        it('should indicate rate limited', () => {
            const limited: RateLimitResult = {
                allowed: false,
                remaining: 0,
                resetAt: new Date('2025-06-16T00:00:00Z'),
            };

            expect(limited.allowed).toBe(false);
            expect(limited.remaining).toBe(0);
        });
    });

    // ============================================
    // ModerationLogEntry
    // ============================================

    describe('ModerationLogEntry', () => {
        it('should have all moderation action details', () => {
            const entry: ModerationLogEntry = {
                id: 'log-123',
                preset_id: 'preset-456',
                moderator_discord_id: '123456789',
                action: 'approve',
                reason: null,
                created_at: '2025-06-15T12:00:00Z',
            };

            expect(entry.action).toBe('approve');
            expect(entry.reason).toBeNull();
        });

        it('should allow all action types', () => {
            const actions: ModerationLogEntry['action'][] = ['approve', 'reject', 'flag', 'unflag', 'revert'];

            actions.forEach((action) => {
                const entry: ModerationLogEntry = {
                    id: 'log',
                    preset_id: 'preset',
                    moderator_discord_id: '123',
                    action,
                    reason: 'Some reason',
                    created_at: '2025-06-15T12:00:00Z',
                };

                expect(entry.action).toBe(action);
            });
        });
    });

    // ============================================
    // CategoryMeta
    // ============================================

    describe('CategoryMeta', () => {
        it('should have optional preset_count', () => {
            const withCount: CategoryMeta = {
                id: 'jobs',
                name: 'Jobs',
                description: 'Job palettes',
                icon: '⚔️',
                is_curated: true,
                display_order: 1,
                preset_count: 25,
            };

            const withoutCount: CategoryMeta = {
                id: 'jobs',
                name: 'Jobs',
                description: 'Job palettes',
                icon: null,
                is_curated: false,
                display_order: 1,
            };

            expect(withCount.preset_count).toBe(25);
            expect(withoutCount.preset_count).toBeUndefined();
        });
    });
});
