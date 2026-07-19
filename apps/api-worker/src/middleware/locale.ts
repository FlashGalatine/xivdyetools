/**
 * Locale Middleware
 *
 * Reads `?locale=` once per request, validates it, ensures the locale's data
 * is registered (race-free — no shared-state mutation), and stores the typed
 * code at `c.var.locale`. Handlers read it via `c.get('locale')` and pass it
 * explicitly to every localization call (BUG-006 / REFACTOR-023).
 */

import type { MiddlewareHandler } from 'hono';
import { LocalizationService } from '@xivdyetools/core';
import { parseLocale } from '../lib/validation.js';

export const localeMiddleware: MiddlewareHandler = async (c, next) => {
  const locale = parseLocale(c.req.query('locale'));
  // BUG-006 (2026-07-18 audit): ensureLocaleLoaded registers the locale data
  // WITHOUT mutating the singleton's current locale. The old per-request
  // setLocale raced across concurrent requests — request A could serialize
  // dye names in request B's language, and the wrong-language body was then
  // cacheable for 24h under the correct-locale URL. Handlers now pass
  // c.get('locale') explicitly to every localization read.
  await LocalizationService.ensureLocaleLoaded(locale);
  c.set('locale', locale);
  await next();
};
