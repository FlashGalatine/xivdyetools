/**
 * Locale-aware number, date, and gil formatting.
 *
 * Thin wrappers around `Intl`-backed `toLocaleString` that default to the
 * app's current locale, plus a gil formatter that routes the unit label
 * through `LanguageService` so "1,234 Gil" reads correctly in every
 * supported language (e.g. ja has no space before ギル).
 *
 * @module shared/format
 */

import { LanguageService } from '@services/language-service';
import type { LocaleCode } from '@shared/i18n-types';

/** Format a number with locale-appropriate grouping/decimal separators. */
export function formatNumber(
  n: number,
  locale: LocaleCode = LanguageService.getCurrentLocale()
): string {
  return n.toLocaleString(locale);
}

/** Format a date with locale-appropriate ordering/separators. */
export function formatDate(
  d: Date | string | number,
  locale: LocaleCode = LanguageService.getCurrentLocale()
): string {
  return new Date(d).toLocaleDateString(locale);
}

/** Format a gil amount as "{n} {unit}" (no space in ja), localized. */
export function formatGil(n: number): string {
  return LanguageService.tInterpolate('common.gilAmount', {
    n: formatNumber(n),
    unit: LanguageService.getCurrency('Gil'),
  });
}
