/**
 * Preset text lookup: curated copy, category labels, and the locale keys the
 * preset services' error codes stand for.
 *
 * The fifteen shipped palettes carry translated name/description/tags under
 * `preset.<id>.*` in all six locales, but nothing read them — every surface
 * rendered the English text baked into `presets.json`. These helpers do the
 * lookup for curated presets only; community presets are user-authored in one
 * language and always render as written.
 *
 * `LanguageService.t()` echoes the key back when a translation is missing, so
 * each helper checks for that and falls back to the preset's own text.
 *
 * The error-code tables at the bottom exist because `preset-submission-service`
 * has no locale: it returns a code naming what failed, and the two forms share
 * one table here rather than each carrying their own English.
 *
 * @module shared/preset-i18n
 */

import { LanguageService } from '@services/language-service';
import type { PresetCategoryFilter } from '@shared/tool-config-types';
import type {
  PresetErrorCode,
  PresetValidationCode,
  ValidationError,
} from '@services/preset-submission-service';

interface CuratedTextSource {
  id: string;
  name: string;
  description: string;
  isCurated?: boolean;
}

/** Resolve `preset.<id>.<field>`, or null when the key is absent. */
function lookup(id: string, field: 'name' | 'description'): string | null {
  const key = `preset.${id}.${field}`;
  const value = LanguageService.t(key);
  return value && value !== key ? value : null;
}

/** Localized curated name, else the preset's own. */
export function presetName(preset: CuratedTextSource): string {
  if (!preset.isCurated) return preset.name;
  return lookup(preset.id, 'name') ?? preset.name;
}

/** Localized curated description, else the preset's own. */
export function presetDescription(preset: CuratedTextSource): string {
  if (!preset.isCurated) return preset.description;
  return lookup(preset.id, 'description') ?? preset.description;
}

/**
 * Category slug -> locale key.
 *
 * The slugs are kebab-case because they are the API's wire values; the locale
 * keys are camelCase because that is the convention inside the locale files.
 * That mismatch is why this map has to exist, and why it must exist exactly
 * once -- it was previously written out in three components, one of which
 * (`preset-edit-form`) had drifted to hardcoded English labels, and one of
 * which (`preset-detail`) rendered the raw slug.
 *
 * Typed as a total `Record` so dropping a `PresetCategory` member is a compile
 * error here rather than a `preset.categories.undefined` string in the UI.
 */
const CATEGORY_LABEL_KEYS: Record<PresetCategoryFilter, string> = {
  all: 'preset.categories.all',
  jobs: 'preset.categories.jobs',
  'grand-companies': 'preset.categories.grandCompanies',
  seasons: 'preset.categories.seasons',
  events: 'preset.categories.events',
  aesthetics: 'preset.categories.aesthetics',
  appearance: 'preset.categories.appearance',
  zones: 'preset.categories.zones',
  'raids-trials': 'preset.categories.raidsTrials',
};

/**
 * Localized category label. Falls back to the slug itself for a value the
 * backend introduces before the frontend knows about it -- ugly, but a visible
 * slug beats a blank badge.
 */
export function presetCategoryLabel(category: PresetCategoryFilter): string {
  const key = CATEGORY_LABEL_KEYS[category];
  return key ? LanguageService.t(key) : category;
}

// ============================================================================
// Service error codes -> locale keys
// ============================================================================

/**
 * Validation code -> locale key.
 *
 * `preset-submission-service` reports *which rule* broke; the text lives here,
 * once, for both forms. Two codes are developer guards rather than things a
 * user can do (`dyesRange` — a caller passed 4.x itemIDs; `tagsArray` — a
 * caller passed a non-array), so they land on the generic unexpected-error
 * string instead of getting copy that would only ever confuse.
 *
 * Total `Record`, so adding a `PresetValidationCode` without a key is a
 * compile error rather than a raw dot-path in a toast.
 */
const VALIDATION_KEYS: Record<PresetValidationCode, string> = {
  nameMin: 'preset.validation.nameMin',
  nameMax: 'preset.validation.nameMax',
  descMin: 'preset.validation.descMin',
  descMax: 'preset.validation.descMax',
  category: 'preset.validation.category',
  dyesMin: 'preset.validation.dyesMin',
  dyesMax: 'preset.maxDyesAllowed',
  dyesInvalid: 'preset.validation.dyesInvalid',
  dyesRange: 'errors.unexpectedError',
  tagsArray: 'errors.unexpectedError',
  tagsMax: 'preset.validation.tagsMax',
  tagLength: 'preset.validation.tagLength',
};

/**
 * `preset.maxDyesAllowed` predates the `preset.validation.*` set and spells its
 * placeholder `{count}`; everything else uses `{n}`. Renaming the older key
 * would touch its other callers, so the difference is recorded here.
 */
const COUNT_PLACEHOLDER_CODES = new Set<PresetValidationCode>(['dyesMax']);

/** Localized text for one validation failure. */
export function presetValidationMessage(error: ValidationError): string {
  const key = VALIDATION_KEYS[error.code];
  if (error.limit === undefined) return LanguageService.t(key);
  const param = COUNT_PLACEHOLDER_CODES.has(error.code) ? 'count' : 'n';
  return LanguageService.tInterpolate(key, { [param]: error.limit });
}

/**
 * Transport/auth code -> locale key. `duplicate` and `validation` are absent on
 * purpose: both carry payload the caller already has in hand (the duplicate's
 * name, the per-field list), so they are handled in `presetErrorMessage` and by
 * the callers' own branches rather than by a bare lookup.
 */
const PRESET_ERROR_KEYS: Record<Exclude<PresetErrorCode, 'duplicate' | 'validation'>, string> = {
  notLoggedInSubmit: 'preset.loginToSubmit',
  notLoggedInEdit: 'preset.loginToEdit',
  submitFailed: 'errors.submitPresetFailed',
  editFailed: 'errors.saveChangesFailed',
  timeout: 'errors.requestTimeout',
  network: 'errors.networkError',
  // I18N-005: terminal and actionable — the generic "failed to submit" headline
  // named the wrong cause and the real one was English-only.
  banned: 'preset.bannedFromPresets',
};

/**
 * Localized text for a submit/edit failure.
 *
 * @param code - the service's reason, or undefined if it reported none
 * @param fallbackKey - what to say when there is no code: `errors.submitPresetFailed`
 *   on the submit path, `errors.saveChangesFailed` on the edit path
 */
export function presetErrorMessage(code: PresetErrorCode | undefined, fallbackKey: string): string {
  if (!code || code === 'validation') return LanguageService.t(fallbackKey);
  if (code === 'duplicate') {
    // Callers with the duplicate's name interpolate it themselves; this is the
    // wording for a 409 that arrived without one.
    return LanguageService.tInterpolate('preset.duplicateFound', {
      name: LanguageService.t('preset.anotherPreset'),
    });
  }
  return LanguageService.t(PRESET_ERROR_KEYS[code]);
}
