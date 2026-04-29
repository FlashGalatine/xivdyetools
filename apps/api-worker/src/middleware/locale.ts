/**
 * Locale Middleware
 *
 * Reads `?locale=` once per request, validates it, and sets the
 * LocalizationService locale state. Handlers downstream can call
 * `LocalizationService.getDyeName(...)` directly without a per-handler
 * `await LocalizationService.setLocale(...)`.
 *
 * Resolved locale is stored at `c.var.locale` for handlers that need
 * the typed code (e.g., to gate "skip getDyeName when 'en'" logic).
 *
 * OPT-001 (2026-04-28 audit): Replaces 7 ad-hoc `await setLocale` call
 * sites in routes/dyes.ts and routes/match.ts with one call per request.
 */

import type { MiddlewareHandler } from 'hono';
import { LocalizationService } from '@xivdyetools/core';
import { parseLocale } from '../lib/validation.js';

export const localeMiddleware: MiddlewareHandler = async (c, next) => {
  const locale = parseLocale(c.req.query('locale'));
  await LocalizationService.setLocale(locale);
  c.set('locale', locale);
  await next();
};
