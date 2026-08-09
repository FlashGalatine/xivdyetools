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
