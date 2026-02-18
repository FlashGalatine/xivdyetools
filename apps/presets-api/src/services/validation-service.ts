/**
 * Validation Service
 * PRESETS-REF-001 FIX: Centralized validation logic for presets and moderation.
 *
 * Provides:
 * - Generic string/array validation helpers
 * - Preset-specific validators (name, description, dyes, tags)
 * - Moderation-specific validators (status, reason)
 * - Validation rule constants for consistent error messaging
 */

// ============================================================================
// Validation Rule Constants
// ============================================================================

/**
 * Preset validation rules - exported for use in error messages and tests
 */
export const PRESET_VALIDATION_RULES = {
  name: {
    minLength: 2,
    maxLength: 50,
  },
  description: {
    minLength: 10,
    maxLength: 200,
  },
  dyes: {
    minLength: 2,
    maxLength: 5,
  },
  tags: {
    maxLength: 10,
    itemMaxLength: 30,
  },
} as const;

/**
 * Moderation validation rules
 */
export const MODERATION_VALIDATION_RULES = {
  reason: {
    minLength: 10,
    maxLength: 200,
  },
  validStatuses: ['approved', 'rejected', 'flagged', 'pending'] as const,
} as const;

// ============================================================================
// Generic Validation Helpers
// ============================================================================

/**
 * Validate a string field with length constraints
 *
 * @param value - The value to validate
 * @param fieldName - Human-readable field name for error messages
 * @param options - Validation options
 * @returns Error message or null if valid
 */
export function validateStringLength(
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number;
    maxLength?: number;
    required?: boolean;
  }
): string | null {
  const { minLength, maxLength, required = true } = options;

  // Check type
  if (typeof value !== 'string') {
    if (required) {
      return `${fieldName} must be a string`;
    }
    return null;
  }

  // Check required
  if (required && value.length === 0) {
    return `${fieldName} is required`;
  }

  // Check min length
  if (minLength !== undefined && value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }

  // Check max length
  if (maxLength !== undefined && value.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`;
  }

  return null;
}

/**
 * Validate an array field with length and element constraints
 *
 * @param value - The value to validate
 * @param fieldName - Human-readable field name for error messages
 * @param options - Validation options
 * @returns Error message or null if valid
 */
export function validateArray<T>(
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number;
    maxLength?: number;
    elementValidator?: (element: T, index: number) => string | null;
  }
): string | null {
  const { minLength, maxLength, elementValidator } = options;

  // Check type
  if (!Array.isArray(value)) {
    return `${fieldName} must be an array`;
  }

  // Check min length
  if (minLength !== undefined && value.length < minLength) {
    return `${fieldName} must have at least ${minLength} items`;
  }

  // Check max length
  if (maxLength !== undefined && value.length > maxLength) {
    return `${fieldName} must have at most ${maxLength} items`;
  }

  // Validate each element
  if (elementValidator) {
    for (let i = 0; i < value.length; i++) {
      const error = elementValidator(value[i] as T, i);
      if (error) {
        return error;
      }
    }
  }

  return null;
}

/**
 * Validate a value against an enum/list of valid values
 *
 * @param value - The value to validate
 * @param fieldName - Human-readable field name for error messages
 * @param validValues - Array of valid values
 * @returns Error message or null if valid
 */
export function validateEnum<T>(
  value: unknown,
  fieldName: string,
  validValues: readonly T[]
): string | null {
  if (!validValues.includes(value as T)) {
    return `${fieldName} must be one of: ${validValues.join(', ')}`;
  }
  return null;
}

// ============================================================================
// Preset-Specific Validators
// ============================================================================

/**
 * Validate a preset name
 *
 * @param name - The name to validate
 * @returns Error message or null if valid
 */
export function validatePresetName(name: unknown): string | null {
  const rules = PRESET_VALIDATION_RULES.name;

  // Keep original error message format for backwards compatibility
  if (typeof name !== 'string') {
    return 'Name is required';
  }

  if (name.length < rules.minLength || name.length > rules.maxLength) {
    return `Name must be ${rules.minLength}-${rules.maxLength} characters`;
  }

  return null;
}

/**
 * Validate a preset description
 *
 * @param description - The description to validate
 * @returns Error message or null if valid
 */
export function validatePresetDescription(description: unknown): string | null {
  const rules = PRESET_VALIDATION_RULES.description;

  // Keep original error message format for backwards compatibility
  if (typeof description !== 'string') {
    return 'Description is required';
  }

  if (description.length < rules.minLength || description.length > rules.maxLength) {
    return `Description must be ${rules.minLength}-${rules.maxLength} characters`;
  }

  return null;
}

/**
 * Validate preset dyes array
 *
 * @param dyes - The dyes array to validate
 * @returns Error message or null if valid
 */
export function validatePresetDyes(dyes: unknown): string | null {
  const rules = PRESET_VALIDATION_RULES.dyes;

  // Check array structure
  if (!Array.isArray(dyes) || dyes.length < rules.minLength || dyes.length > rules.maxLength) {
    return `Must include ${rules.minLength}-${rules.maxLength} dyes`;
  }

  // Check each element is a positive integer
  if (!dyes.every((id) => typeof id === 'number' && id > 0)) {
    return 'Invalid dye IDs';
  }

  return null;
}

/**
 * Validate preset tags array
 *
 * @param tags - The tags array to validate
 * @returns Error message or null if valid
 */
export function validatePresetTags(tags: unknown): string | null {
  const rules = PRESET_VALIDATION_RULES.tags;

  // Check array type
  if (!Array.isArray(tags)) {
    return 'Tags must be an array';
  }

  // Check array length
  if (tags.length > rules.maxLength) {
    return `Maximum ${rules.maxLength} tags allowed`;
  }

  // Check each tag
  if (tags.some((tag) => typeof tag !== 'string' || tag.length > rules.itemMaxLength)) {
    return `Each tag must be a string of max ${rules.itemMaxLength} characters`;
  }

  return null;
}

// ============================================================================
// Moderation-Specific Validators
// ============================================================================

/**
 * Type for moderation-allowed statuses (subset of PresetStatus)
 * Note: 'hidden' is intentionally excluded as it cannot be set via moderation
 */
export type ModerationStatus = (typeof MODERATION_VALIDATION_RULES.validStatuses)[number];

/**
 * Validate a moderation status
 *
 * @param status - The status to validate
 * @returns Error message or null if valid
 */
export function validateModerationStatus(status: unknown): string | null {
  const validStatuses = MODERATION_VALIDATION_RULES.validStatuses;

  if (!status || typeof status !== 'string' || !(validStatuses as readonly string[]).includes(status)) {
    return `Status must be one of: ${validStatuses.join(', ')}`;
  }

  return null;
}

/**
 * Validate a moderation reason
 *
 * @param reason - The reason to validate
 * @returns Error message or null if valid
 */
export function validateModerationReason(reason: unknown): string | null {
  const rules = MODERATION_VALIDATION_RULES.reason;

  if (!reason || typeof reason !== 'string') {
    return `Reason must be ${rules.minLength}-${rules.maxLength} characters`;
  }

  if (reason.length < rules.minLength || reason.length > rules.maxLength) {
    return `Reason must be ${rules.minLength}-${rules.maxLength} characters`;
  }

  return null;
}
