/**
 * Preset Submission Service
 * Handles submitting community presets from the web app
 */
/* istanbul ignore file */

import { logger } from '@shared/logger';
import { authService } from './auth-service';
import type { PresetCategory } from '@xivdyetools/core';
import type { CommunityPreset, PresetStatus } from './community-preset-service';

// ============================================
// Types
// ============================================

export interface PresetSubmission {
  name: string;
  description: string;
  category_id: PresetCategory;
  dyes: number[];
  tags: string[];
}

export interface SubmissionResult {
  success: boolean;
  preset?: CommunityPreset;
  duplicate?: CommunityPreset;
  vote_added?: boolean;
  moderation_status?: 'approved' | 'pending';
  error?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface MySubmissionsResponse {
  presets: CommunityPreset[];
  total: number;
}

export interface PresetEditRequest {
  name?: string;
  description?: string;
  dyes?: number[];
  tags?: string[];
}

export interface EditResult {
  success: boolean;
  preset?: CommunityPreset;
  moderation_status?: 'approved' | 'pending';
  duplicate?: {
    id: string;
    name: string;
    author_name: string | null;
  };
  error?: string;
}

// ============================================
// Configuration
// ============================================

/**
 * Presets API URL
 */
const PRESETS_API_URL =
  import.meta.env.VITE_PRESETS_API_URL || 'https://api.xivdyetools.app';

/**
 * Valid categories for submissions
 */
const VALID_CATEGORIES: PresetCategory[] = [
  'jobs',
  'grand-companies',
  'seasons',
  'events',
  'aesthetics',
  'community',
];

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 15000;

// ============================================
// Validation
// ============================================

/**
 * Validate preset submission before sending to API
 * Returns array of validation errors (empty if valid)
 */
export function validateSubmission(submission: PresetSubmission): ValidationError[] {
  const errors: ValidationError[] = [];

  // Name validation (2-50 characters)
  if (!submission.name || submission.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  } else if (submission.name.length > 50) {
    errors.push({ field: 'name', message: 'Name must be 50 characters or less' });
  }

  // Description validation (10-200 characters)
  if (!submission.description || submission.description.trim().length < 10) {
    errors.push({ field: 'description', message: 'Description must be at least 10 characters' });
  } else if (submission.description.length > 200) {
    errors.push({ field: 'description', message: 'Description must be 200 characters or less' });
  }

  // Category validation
  if (!submission.category_id || !VALID_CATEGORIES.includes(submission.category_id)) {
    errors.push({ field: 'category_id', message: 'Please select a valid category' });
  }

  // Dyes validation (2-5 dyes)
  if (!Array.isArray(submission.dyes) || submission.dyes.length < 2) {
    errors.push({ field: 'dyes', message: 'Must include at least 2 dyes' });
  } else if (submission.dyes.length > 5) {
    errors.push({ field: 'dyes', message: 'Maximum 5 dyes allowed' });
  } else if (!submission.dyes.every((id) => typeof id === 'number' && id > 0)) {
    errors.push({ field: 'dyes', message: 'Invalid dye selection' });
  }

  // Tags validation (0-10 tags, max 30 chars each)
  if (!Array.isArray(submission.tags)) {
    errors.push({ field: 'tags', message: 'Tags must be an array' });
  } else if (submission.tags.length > 10) {
    errors.push({ field: 'tags', message: 'Maximum 10 tags allowed' });
  } else if (submission.tags.some((tag) => typeof tag !== 'string' || tag.length > 30)) {
    errors.push({ field: 'tags', message: 'Each tag must be 30 characters or less' });
  }

  return errors;
}

// ============================================
// Service
// ============================================

class PresetSubmissionServiceImpl {
  /**
   * Submit a new preset
   * Requires authentication
   */
  async submitPreset(submission: PresetSubmission): Promise<SubmissionResult> {
    if (!authService.isAuthenticated()) {
      return {
        success: false,
        error: 'You must be logged in to submit presets',
      };
    }

    // Client-side validation
    const validationErrors = validateSubmission(submission);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: validationErrors.map((e) => e.message).join('. '),
      };
    }

    logger.info('Submitting preset:', submission.name);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(`${PRESETS_API_URL}/api/v1/presets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          name: submission.name.trim(),
          description: submission.description.trim(),
          category_id: submission.category_id,
          dyes: submission.dyes,
          tags: submission.tags.map((t) => t.trim()).filter(Boolean),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const result = await response.json();

      if (!response.ok) {
        logger.error('Preset submission failed:', result);
        return {
          success: false,
          error: result.message || 'Submission failed',
        };
      }

      logger.info('Preset submitted successfully:', result);

      // Handle duplicate detection
      if (result.duplicate) {
        return {
          success: true,
          duplicate: result.duplicate,
          vote_added: result.vote_added,
        };
      }

      return {
        success: true,
        preset: result.preset,
        moderation_status: result.moderation_status,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.error('Preset submission timed out');
        return {
          success: false,
          error: 'Request timed out. Please try again.',
        };
      }

      logger.error('Preset submission error:', err);
      return {
        success: false,
        error: 'Failed to submit preset. Please try again.',
      };
    }
  }

  /**
   * Get user's own submissions
   * Requires authentication
   */
  async getMySubmissions(): Promise<MySubmissionsResponse> {
    if (!authService.isAuthenticated()) {
      return { presets: [], total: 0 };
    }

    logger.info('Fetching user submissions...');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(`${PRESETS_API_URL}/api/v1/presets/mine`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        logger.error('Failed to fetch user submissions:', response.status);
        return { presets: [], total: 0 };
      }

      const result = await response.json();
      logger.info(`Fetched ${result.presets?.length || 0} user submissions`);

      return {
        presets: result.presets || [],
        total: result.total || result.presets?.length || 0,
      };
    } catch (err) {
      logger.error('Error fetching user submissions:', err);
      return { presets: [], total: 0 };
    }
  }

  /**
   * Get submission status label and styling
   * Uses Tailwind classes for consistent theming across light/dark modes
   */
  getStatusInfo(status: PresetStatus): { label: string; colorClass: string; icon: string } {
    switch (status) {
      case 'approved':
        return {
          label: 'Approved',
          colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          icon: '✓',
        };
      case 'pending':
        return {
          label: 'Pending Review',
          colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
          icon: '⏳',
        };
      case 'rejected':
        return {
          label: 'Rejected',
          colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          icon: '✗',
        };
      case 'flagged':
        return {
          label: 'Flagged',
          colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
          icon: '⚠',
        };
      default:
        return {
          label: 'Unknown',
          colorClass: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
          icon: '?',
        };
    }
  }

  /**
   * Get remaining submissions for today
   */
  async getRemainingSubmissions(): Promise<{
    remaining: number;
    limit: number;
    resetAt: Date | null;
  }> {
    if (!authService.isAuthenticated()) {
      return { remaining: 10, limit: 10, resetAt: null };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(`${PRESETS_API_URL}/api/v1/presets/rate-limit`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn('Failed to fetch rate limit:', response.status);
        return { remaining: 10, limit: 10, resetAt: null };
      }

      const result = await response.json();
      return {
        remaining: result.remaining,
        limit: result.limit,
        resetAt: result.reset_at ? new Date(result.reset_at) : null,
      };
    } catch (err) {
      logger.error('Error fetching rate limit:', err);
      return { remaining: 10, limit: 10, resetAt: null };
    }
  }

  /**
   * Delete a preset by ID
   * Only the owner or a moderator can delete presets
   */
  async deletePreset(presetId: string): Promise<{ success: boolean; error?: string }> {
    if (!authService.isAuthenticated()) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(`${PRESETS_API_URL}/api/v1/presets/${presetId}`, {
        method: 'DELETE',
        headers: {
          ...authService.getAuthHeaders(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, error: data.message || `Failed to delete (${response.status})` };
      }

      return { success: true };
    } catch (err) {
      logger.error('Error deleting preset:', err);
      return { success: false, error: 'Network error - please try again' };
    }
  }

  /**
   * Edit an existing preset
   * Only the owner can edit their presets
   * @param presetId - The preset to edit
   * @param updates - Fields to update (name, description, dyes, tags)
   */
  async editPreset(presetId: string, updates: PresetEditRequest): Promise<EditResult> {
    if (!authService.isAuthenticated()) {
      return {
        success: false,
        error: 'You must be logged in to edit presets',
      };
    }

    // Validate fields if provided
    const errors: ValidationError[] = [];

    if (updates.name !== undefined) {
      if (updates.name.trim().length < 2) {
        errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
      } else if (updates.name.length > 50) {
        errors.push({ field: 'name', message: 'Name must be 50 characters or less' });
      }
    }

    if (updates.description !== undefined) {
      if (updates.description.trim().length < 10) {
        errors.push({
          field: 'description',
          message: 'Description must be at least 10 characters',
        });
      } else if (updates.description.length > 200) {
        errors.push({
          field: 'description',
          message: 'Description must be 200 characters or less',
        });
      }
    }

    if (updates.dyes !== undefined) {
      if (!Array.isArray(updates.dyes) || updates.dyes.length < 2) {
        errors.push({ field: 'dyes', message: 'Must include at least 2 dyes' });
      } else if (updates.dyes.length > 5) {
        errors.push({ field: 'dyes', message: 'Maximum 5 dyes allowed' });
      } else if (!updates.dyes.every((id) => typeof id === 'number' && id > 0)) {
        errors.push({ field: 'dyes', message: 'Invalid dye selection' });
      }
    }

    if (updates.tags !== undefined) {
      if (!Array.isArray(updates.tags)) {
        errors.push({ field: 'tags', message: 'Tags must be an array' });
      } else if (updates.tags.length > 10) {
        errors.push({ field: 'tags', message: 'Maximum 10 tags allowed' });
      } else if (updates.tags.some((tag) => typeof tag !== 'string' || tag.length > 30)) {
        errors.push({ field: 'tags', message: 'Each tag must be 30 characters or less' });
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: errors.map((e) => e.message).join('. '),
      };
    }

    logger.info('Editing preset:', presetId, updates);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      // Build request body with only provided fields
      const body: Record<string, unknown> = {};
      if (updates.name !== undefined) body.name = updates.name.trim();
      if (updates.description !== undefined) body.description = updates.description.trim();
      if (updates.dyes !== undefined) body.dyes = updates.dyes;
      if (updates.tags !== undefined) body.tags = updates.tags.map((t) => t.trim()).filter(Boolean);

      const response = await fetch(`${PRESETS_API_URL}/api/v1/presets/${presetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const result = await response.json();

      if (response.status === 409 && result.duplicate) {
        // Duplicate dye combination exists
        return {
          success: false,
          duplicate: result.duplicate,
          error: `This dye combination already exists as "${result.duplicate.name}"`,
        };
      }

      if (!response.ok) {
        logger.error('Preset edit failed:', result);
        return {
          success: false,
          error: result.message || 'Edit failed',
        };
      }

      logger.info('Preset edited successfully:', result);

      return {
        success: true,
        preset: result.preset,
        moderation_status: result.moderation_status,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.error('Preset edit timed out');
        return {
          success: false,
          error: 'Request timed out. Please try again.',
        };
      }

      logger.error('Preset edit error:', err);
      return {
        success: false,
        error: 'Failed to edit preset. Please try again.',
      };
    }
  }
}

// ============================================
// Export Singleton
// ============================================

export const presetSubmissionService = new PresetSubmissionServiceImpl();
export { PresetSubmissionServiceImpl as PresetSubmissionService };
