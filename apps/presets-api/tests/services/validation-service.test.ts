import { describe, it, expect } from 'vitest';
import {
  validateSecondaryCategories,
  SECONDARY_CATEGORY_MAX,
} from '../../src/services/validation-service';

const VALID = ['jobs', 'seasons', 'events', 'aesthetics', 'appearance', 'zones', 'raids-trials'];

describe('validateSecondaryCategories', () => {
  it('accepts undefined — the field is optional', () => {
    expect(validateSecondaryCategories(undefined, 'jobs', VALID)).toBeNull();
  });

  it('accepts an empty array — that is how a caller clears the list', () => {
    expect(validateSecondaryCategories([], 'jobs', VALID)).toBeNull();
  });

  it('accepts up to the cap', () => {
    expect(validateSecondaryCategories(['seasons', 'zones'], 'jobs', VALID)).toBeNull();
    expect(SECONDARY_CATEGORY_MAX).toBe(2);
  });

  it('rejects more than the cap', () => {
    const error = validateSecondaryCategories(['seasons', 'zones', 'events'], 'jobs', VALID);
    expect(error).toContain('at most 2');
  });

  it('rejects a non-array', () => {
    expect(validateSecondaryCategories('seasons', 'jobs', VALID)).toContain('must be an array');
  });

  it('rejects an unknown category id', () => {
    expect(validateSecondaryCategories(['dungeons'], 'jobs', VALID)).toContain('Invalid');
  });

  it('rejects duplicates within the list', () => {
    expect(validateSecondaryCategories(['zones', 'zones'], 'jobs', VALID)).toContain('duplicate');
  });

  it('rejects the primary appearing as a secondary', () => {
    expect(validateSecondaryCategories(['jobs'], 'jobs', VALID)).toContain('primary');
  });
});
