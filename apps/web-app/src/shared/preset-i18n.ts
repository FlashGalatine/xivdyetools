/**
 * Curated-preset text lookup.
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
 * @module shared/preset-i18n
 */

import { LanguageService } from '@services/language-service';
import type { PresetCategoryFilter } from '@shared/tool-config-types';

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
