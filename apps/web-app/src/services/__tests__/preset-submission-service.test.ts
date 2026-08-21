/**
 * Tests for preset-submission-service pure functions
 * These functions can be tested without mocking API calls
 */
import { describe, it, expect, vi } from 'vitest';
import { validateSubmission, uploadPreviewImage } from '../preset-submission-service';

describe('PresetSubmissionService - validateSubmission', () => {
  // ============================================
  // Valid Submissions
  // ============================================

  describe('valid submissions', () => {
    it('should return empty array for valid submission', () => {
      const submission = {
        name: 'My Preset',
        description: 'A beautiful color palette for warriors',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: ['warrior', 'red'],
      };

      const errors = validateSubmission(submission);
      expect(errors).toEqual([]);
    });

    it('should accept minimum valid values', () => {
      const submission = {
        name: 'AB',
        description: 'Exactly ten',
        category_id: 'events' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toEqual([]);
    });

    it('should accept maximum valid values', () => {
      const submission = {
        name: 'A'.repeat(50),
        description: 'A'.repeat(200),
        category_id: 'aesthetics' as const,
        dyes: [1, 2, 3, 4, 5],
        tags: Array(10).fill('tag'),
      };

      const errors = validateSubmission(submission);
      expect(errors).toEqual([]);
    });
  });

  // ============================================
  // Name Validation
  // ============================================

  describe('name validation', () => {
    it('should reject empty name', () => {
      const submission = {
        name: '',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'name',
        code: 'nameMin',
        limit: 2,
      });
    });

    it('should reject name with only whitespace', () => {
      const submission = {
        name: '   ',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'name',
        code: 'nameMin',
        limit: 2,
      });
    });

    it('should reject single character name', () => {
      const submission = {
        name: 'A',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'name',
        code: 'nameMin',
        limit: 2,
      });
    });

    it('should reject name over 50 characters', () => {
      const submission = {
        name: 'A'.repeat(51),
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'name',
        code: 'nameMax',
        limit: 50,
      });
    });
  });

  // ============================================
  // Description Validation
  // ============================================

  describe('description validation', () => {
    it('should reject empty description', () => {
      const submission = {
        name: 'Valid Name',
        description: '',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'description',
        code: 'descMin',
        limit: 10,
      });
    });

    it('should reject description with only whitespace', () => {
      const submission = {
        name: 'Valid Name',
        description: '         ',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'description',
        code: 'descMin',
        limit: 10,
      });
    });

    it('should reject description under 10 characters', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Too short',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'description',
        code: 'descMin',
        limit: 10,
      });
    });

    it('should reject description over 200 characters', () => {
      const submission = {
        name: 'Valid Name',
        description: 'A'.repeat(201),
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'description',
        code: 'descMax',
        limit: 200,
      });
    });
  });

  // ============================================
  // Category Validation
  // ============================================

  describe('category validation', () => {
    it('should reject empty category', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: '' as never,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'category_id',
        code: 'category',
      });
    });

    it('should reject invalid category', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'invalid-category' as never,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'category_id',
        code: 'category',
      });
    });

    it('should accept all valid categories', () => {
      const validCategories = [
        'jobs',
        'grand-companies',
        'seasons',
        'events',
        'aesthetics',
      ] as const;

      for (const category of validCategories) {
        const submission = {
          name: 'Valid Name',
          description: 'Valid description here',
          category_id: category,
          dyes: [1, 2, 3],
          tags: [],
        };

        const errors = validateSubmission(submission);
        const categoryError = errors.find((e) => e.field === 'category_id');
        expect(categoryError).toBeUndefined();
      }
    });
  });

  // ============================================
  // Dyes Validation
  // ============================================

  describe('dyes validation', () => {
    it('should reject empty dyes array', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'dyes',
        code: 'dyesMin',
        limit: 3,
      });
    });

    it('should reject single dye', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'dyes',
        code: 'dyesMin',
        limit: 3,
      });
    });

    it('should reject more than 6 dyes', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3, 4, 5, 6, 7],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'dyes',
        code: 'dyesMax',
        limit: 6,
      });
    });

    it('should reject non-array dyes', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: 'not an array' as never,
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'dyes',
        code: 'dyesMin',
        limit: 3,
      });
    });

    it('should reject zero or negative dye IDs', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 0],
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'dyes',
        code: 'dyesInvalid',
      });
    });

    it('should reject non-number dye IDs', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 'two'] as never,
        tags: [],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'dyes',
        code: 'dyesInvalid',
      });
    });
  });

  // ============================================
  // Tags Validation
  // ============================================

  describe('tags validation', () => {
    it('should accept empty tags array', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: [],
      };

      const errors = validateSubmission(submission);
      const tagError = errors.find((e) => e.field === 'tags');
      expect(tagError).toBeUndefined();
    });

    it('should reject non-array tags', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: 'not an array' as never,
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'tags',
        code: 'tagsArray',
      });
    });

    it('should reject more than 10 tags', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: Array(11).fill('tag'),
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'tags',
        code: 'tagsMax',
        limit: 10,
      });
    });

    it('should reject tags longer than 30 characters', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: ['valid', 'A'.repeat(31)],
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'tags',
        code: 'tagLength',
        limit: 30,
      });
    });

    it('should reject non-string tags', () => {
      const submission = {
        name: 'Valid Name',
        description: 'Valid description here',
        category_id: 'jobs' as const,
        dyes: [1, 2, 3],
        tags: ['valid', 123] as never,
      };

      const errors = validateSubmission(submission);
      expect(errors).toContainEqual({
        field: 'tags',
        code: 'tagLength',
        limit: 30,
      });
    });
  });

  // ============================================
  // Multiple Errors
  // ============================================

  describe('multiple validation errors', () => {
    it('should return all errors for completely invalid submission', () => {
      const submission = {
        name: '',
        description: 'short',
        category_id: 'invalid' as never,
        dyes: [],
        tags: 'not-array' as never,
      };

      const errors = validateSubmission(submission);

      expect(errors.length).toBe(5);
      expect(errors.map((e) => e.field)).toContain('name');
      expect(errors.map((e) => e.field)).toContain('description');
      expect(errors.map((e) => e.field)).toContain('category_id');
      expect(errors.map((e) => e.field)).toContain('dyes');
      expect(errors.map((e) => e.field)).toContain('tags');
    });
  });
});

// ============================================
// uploadPreviewImage
// ============================================

describe('PresetSubmissionService - uploadPreviewImage', () => {
  it('POSTs the raw file bytes to the preview-image route', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shot.png', {
      type: 'image/png',
    });

    await uploadPreviewImage('preset-1', file);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/presets/preset-1/preview-image');
    expect((init as RequestInit).method).toBe('POST');

    fetchSpy.mockRestore();
  });

  it('rejects a file over 5 MB before any request is made', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });

    await expect(uploadPreviewImage('preset-1', big)).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
