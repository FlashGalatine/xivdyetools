/**
 * Preset Submission Service
 * Handles submitting community presets from the web app
 */
/* istanbul ignore file */

import { logger } from '@shared/logger';
import { authService } from './auth-service';
import type { PresetCategory, PresetSubmission, PresetEditRequest } from '@xivdyetools/types';
import type { CommunityPreset } from './community-preset-service';

// ============================================
// Types
// ============================================

// PresetSubmission and PresetEditRequest are the shared `@xivdyetools/types`
// contracts, re-exported here so existing `@services/preset-submission-service`
// imports keep working unchanged.
export type { PresetSubmission, PresetEditRequest };

/**
 * Why the results carry codes and not sentences.
 *
 * Every string this service used to return was English written here and
 * toasted verbatim by the forms, so a French user got an English error. The
 * service is the wrong layer to hold UI copy — it has no locale — so it now
 * names the *reason* and the caller looks up the text
 * (`@shared/preset-i18n`). `error` survives for the one string that is
 * legitimately not ours: the presets-API's own wire message, which the toast
 * shows as `details` beneath the translated headline.
 */
export type PresetValidationCode =
  | 'nameMin'
  | 'nameMax'
  | 'descMin'
  | 'descMax'
  | 'category'
  | 'dyesMin'
  | 'dyesMax'
  | 'dyesInvalid'
  | 'dyesRange'
  | 'tagsArray'
  | 'tagsMax'
  | 'tagLength';

/**
 * Transport/auth failure reasons shared by `submitPreset` and `editPreset`.
 * `validation` means "see `validationErrors`" — the per-field list, not one
 * joined sentence, so each error can be shown in the user's language.
 */
export type PresetErrorCode =
  | 'notLoggedInSubmit'
  | 'notLoggedInEdit'
  | 'validation'
  | 'submitFailed'
  | 'editFailed'
  | 'timeout'
  | 'network'
  | 'duplicate';

export interface SubmissionResult {
  success: boolean;
  preset?: CommunityPreset;
  duplicate?: CommunityPreset;
  vote_added?: boolean;
  moderation_status?: 'approved' | 'pending';
  errorCode?: PresetErrorCode;
  validationErrors?: ValidationError[];
  /** The presets-API's own message, when it sent one. Never app-authored copy. */
  error?: string;
}

export interface ValidationError {
  field: string;
  code: PresetValidationCode;
  /** The bound the value broke, for the `{n}`/`{count}` in the message. */
  limit?: number;
}

export interface MySubmissionsResponse {
  presets: CommunityPreset[];
  total: number;
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
  errorCode?: PresetErrorCode;
  validationErrors?: ValidationError[];
  /** The presets-API's own message, when it sent one. Never app-authored copy. */
  error?: string;
}

// ============================================
// Configuration
// ============================================

/**
 * Presets API URL
 */
const PRESETS_API_URL = import.meta.env.VITE_PRESETS_API_URL || 'https://api.xivdyetools.app';

/**
 * Valid categories for submissions
 */
const VALID_CATEGORIES: PresetCategory[] = [
  'jobs',
  'grand-companies',
  'seasons',
  'events',
  'aesthetics',
  'appearance',
  'zones',
  'raids-trials',
];

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 15000;

/**
 * Field limits, named so the `limit` a `ValidationError` carries and the bound
 * it was checked against can never drift apart (the message used to repeat the
 * number in prose, and the two were free to disagree).
 */
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_DESC_LENGTH = 10;
const MAX_DESC_LENGTH = 200;
const MIN_DYES = 3;
const MAX_DYES = 6;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;
/** stainIDs run 1-254; anything at or above this is a 4.x market itemID. */
const MAX_STAIN_ID = 254;
const LEGACY_ITEM_ID_FLOOR = 5000;

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
  if (!submission.name || submission.name.trim().length < MIN_NAME_LENGTH) {
    errors.push({ field: 'name', code: 'nameMin', limit: MIN_NAME_LENGTH });
  } else if (submission.name.length > MAX_NAME_LENGTH) {
    errors.push({ field: 'name', code: 'nameMax', limit: MAX_NAME_LENGTH });
  }

  // Description validation (10-200 characters)
  if (!submission.description || submission.description.trim().length < MIN_DESC_LENGTH) {
    errors.push({ field: 'description', code: 'descMin', limit: MIN_DESC_LENGTH });
  } else if (submission.description.length > MAX_DESC_LENGTH) {
    errors.push({ field: 'description', code: 'descMax', limit: MAX_DESC_LENGTH });
  }

  // Category validation
  if (!submission.category_id || !VALID_CATEGORIES.includes(submission.category_id)) {
    errors.push({ field: 'category_id', code: 'category' });
  }

  // Dyes validation (5.0: 3-6 stainIDs)
  if (!Array.isArray(submission.dyes) || submission.dyes.length < MIN_DYES) {
    errors.push({ field: 'dyes', code: 'dyesMin', limit: MIN_DYES });
  } else if (submission.dyes.length > MAX_DYES) {
    errors.push({ field: 'dyes', code: 'dyesMax', limit: MAX_DYES });
  } else if (
    !submission.dyes.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)
  ) {
    errors.push({ field: 'dyes', code: 'dyesInvalid' });
  } else if (submission.dyes.some((id) => id >= LEGACY_ITEM_ID_FLOOR)) {
    // 5.0 range guard: dyes are stainIDs (1-254); a legacy itemID means a
    // half-migrated caller — fail loudly, never submit the wrong era
    errors.push({ field: 'dyes', code: 'dyesRange' });
  } else if (submission.dyes.some((id) => id > MAX_STAIN_ID)) {
    errors.push({ field: 'dyes', code: 'dyesRange' });
  }

  // Tags validation (0-10 tags, max 30 chars each)
  if (!Array.isArray(submission.tags)) {
    errors.push({ field: 'tags', code: 'tagsArray' });
  } else if (submission.tags.length > MAX_TAGS) {
    errors.push({ field: 'tags', code: 'tagsMax', limit: MAX_TAGS });
  } else if (
    submission.tags.some((tag) => typeof tag !== 'string' || tag.length > MAX_TAG_LENGTH)
  ) {
    errors.push({ field: 'tags', code: 'tagLength', limit: MAX_TAG_LENGTH });
  }

  return errors;
}

/** Mirror of the server limit — fail locally rather than spend the upload. */
export const MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Upload a preview image for a preset the signed-in user authored.
 *
 * Sent as raw bytes, not multipart: the route takes one file and nothing else,
 * so a multipart envelope would be parsing work for no information. Can only
 * be called once the preset exists — the route is scoped to a preset id.
 */
export async function uploadPreviewImage(presetId: string, file: File): Promise<void> {
  if (file.size > MAX_PREVIEW_IMAGE_BYTES) {
    throw new Error('Image must be at most 5 MB');
  }

  const response = await fetch(
    `${PRESETS_API_URL}/api/v1/presets/${encodeURIComponent(presetId)}/preview-image`,
    {
      method: 'POST',
      headers: {
        // Declare the type only when the file actually has one. Claiming
        // application/octet-stream for a typeless file would trip the API's
        // media-type gate on bytes it would otherwise have accepted; sending
        // nothing lets the server's magic-byte sniff make the call.
        ...(file.type ? { 'Content-Type': file.type } : {}),
        ...authService.getAuthHeaders(),
      },
      body: file,
    }
  );

  if (!response.ok) {
    throw new Error('Preview image upload failed');
  }
}

/**
 * Remove the preview image from a preset the signed-in user authored.
 *
 * Idempotent server-side: removing an image that is not there is a success,
 * because the end state the caller asked for already holds.
 */
export async function removePreviewImage(presetId: string): Promise<void> {
  const response = await fetch(
    `${PRESETS_API_URL}/api/v1/presets/${encodeURIComponent(presetId)}/preview-image`,
    {
      method: 'DELETE',
      headers: {
        ...authService.getAuthHeaders(),
      },
    }
  );

  if (!response.ok) {
    throw new Error('Preview image removal failed');
  }
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
        errorCode: 'notLoggedInSubmit',
      };
    }

    // Client-side validation. The list is returned whole rather than joined
    // into one sentence: ". "-joining translated fragments builds English
    // grammar out of pieces that do not survive translation.
    const validationErrors = validateSubmission(submission);
    if (validationErrors.length > 0) {
      return {
        success: false,
        errorCode: 'validation',
        validationErrors,
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
          secondary_categories: submission.secondary_categories ?? [],
          dyes: submission.dyes,
          tags: submission.tags.map((t) => t.trim()).filter(Boolean),
          example_link: submission.example_link ?? null,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const result = await response.json();

      if (!response.ok) {
        logger.error('Preset submission failed:', result);
        return {
          success: false,
          errorCode: 'submitFailed',
          error: result.message,
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
          errorCode: 'timeout',
        };
      }

      logger.error('Preset submission error:', err);
      return {
        success: false,
        errorCode: 'network',
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
        throw new Error(`Failed to fetch user submissions (${response.status})`);
      }

      const result = await response.json();
      logger.info(`Fetched ${result.presets?.length || 0} user submissions`);

      return {
        presets: result.presets || [],
        total: result.total || result.presets?.length || 0,
      };
    } catch (err) {
      // BUG-082: this used to swallow every failure into an empty list, which
      // is indistinguishable from "you have not submitted anything". Both
      // callers already wrap the call in try/catch — the modal even raises an
      // error toast — so those handlers were dead code and an API outage
      // rendered "no submissions yet" with 0/0/0 stats. An unauthenticated
      // user still gets the empty list above; a FAILURE is now a failure.
      logger.error('Error fetching user submissions:', err);
      throw err instanceof Error ? err : new Error('Failed to fetch user submissions');
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

      const response = await fetch(
        `${PRESETS_API_URL}/api/v1/presets/${encodeURIComponent(presetId)}`,
        {
          method: 'DELETE',
          headers: {
            ...authService.getAuthHeaders(),
          },
          signal: controller.signal,
        }
      );

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
        errorCode: 'notLoggedInEdit',
      };
    }

    // Validate fields if provided
    const errors: ValidationError[] = [];

    if (updates.name !== undefined) {
      if (updates.name.trim().length < MIN_NAME_LENGTH) {
        errors.push({ field: 'name', code: 'nameMin', limit: MIN_NAME_LENGTH });
      } else if (updates.name.length > MAX_NAME_LENGTH) {
        errors.push({ field: 'name', code: 'nameMax', limit: MAX_NAME_LENGTH });
      }
    }

    if (updates.description !== undefined) {
      if (updates.description.trim().length < MIN_DESC_LENGTH) {
        errors.push({ field: 'description', code: 'descMin', limit: MIN_DESC_LENGTH });
      } else if (updates.description.length > MAX_DESC_LENGTH) {
        errors.push({ field: 'description', code: 'descMax', limit: MAX_DESC_LENGTH });
      }
    }

    if (updates.dyes !== undefined) {
      if (!Array.isArray(updates.dyes) || updates.dyes.length < MIN_DYES) {
        errors.push({ field: 'dyes', code: 'dyesMin', limit: MIN_DYES });
      } else if (updates.dyes.length > MAX_DYES) {
        errors.push({ field: 'dyes', code: 'dyesMax', limit: MAX_DYES });
      } else if (updates.dyes.some((id) => id >= LEGACY_ITEM_ID_FLOOR)) {
        errors.push({ field: 'dyes', code: 'dyesRange' });
      } else if (updates.dyes.some((id) => id < 1 || id > MAX_STAIN_ID)) {
        errors.push({ field: 'dyes', code: 'dyesRange' });
      } else if (!updates.dyes.every((id) => typeof id === 'number' && id > 0)) {
        errors.push({ field: 'dyes', code: 'dyesInvalid' });
      }
    }

    if (updates.tags !== undefined) {
      if (!Array.isArray(updates.tags)) {
        errors.push({ field: 'tags', code: 'tagsArray' });
      } else if (updates.tags.length > MAX_TAGS) {
        errors.push({ field: 'tags', code: 'tagsMax', limit: MAX_TAGS });
      } else if (
        updates.tags.some((tag) => typeof tag !== 'string' || tag.length > MAX_TAG_LENGTH)
      ) {
        errors.push({ field: 'tags', code: 'tagLength', limit: MAX_TAG_LENGTH });
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errorCode: 'validation',
        validationErrors: errors,
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
      if (updates.category_id !== undefined) body.category_id = updates.category_id;
      if (updates.secondary_categories !== undefined) {
        body.secondary_categories = updates.secondary_categories;
      }
      // example_link was already accepted by the API but never sent — the edit
      // form set it and it was silently dropped on every save.
      if (updates.example_link !== undefined) body.example_link = updates.example_link;

      const response = await fetch(
        `${PRESETS_API_URL}/api/v1/presets/${encodeURIComponent(presetId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      const result = await response.json();

      if (response.status === 409 && result.duplicate) {
        // Duplicate dye combination exists. The name goes in `duplicate`, not
        // into a prebuilt sentence — the caller owns the wording.
        return {
          success: false,
          errorCode: 'duplicate',
          duplicate: result.duplicate,
        };
      }

      if (!response.ok) {
        logger.error('Preset edit failed:', result);
        return {
          success: false,
          errorCode: 'editFailed',
          error: result.message,
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
          errorCode: 'timeout',
        };
      }

      logger.error('Preset edit error:', err);
      return {
        success: false,
        errorCode: 'network',
      };
    }
  }
}

// ============================================
// Export Singleton
// ============================================

export const presetSubmissionService = new PresetSubmissionServiceImpl();
