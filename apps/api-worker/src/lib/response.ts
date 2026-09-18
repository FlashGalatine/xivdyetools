/**
 * JSON response envelope helpers.
 * All API responses use a consistent envelope with success, data/error, and meta.
 */

import type { Context } from 'hono';
import type { Env, Variables } from '../types.js';

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export interface ResponseMeta {
  requestId: string;
  apiVersion: string;
  locale?: string;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Build the `meta` envelope shared by every success AND error response:
 * `requestId` + `apiVersion` always, `locale` only when set and non-`en`
 * (REFACTOR-004 — the error envelope in `index.ts`'s `app.onError` reuses
 * this rather than hand-rolling the same rule a second time).
 */
export function buildMeta(c: AppContext, locale?: string): ResponseMeta {
  const meta: ResponseMeta = {
    requestId: c.get('requestId') || 'unknown',
    apiVersion: c.env.API_VERSION || 'v1',
  };
  if (locale && locale !== 'en') {
    meta.locale = locale;
  }
  return meta;
}

export function successResponse<T>(c: AppContext, data: T, locale?: string) {
  return c.json({
    success: true,
    data,
    meta: buildMeta(c, locale),
  });
}

export function paginatedResponse<T>(
  c: AppContext,
  data: T[],
  pagination: PaginationMeta,
  locale?: string,
) {
  return c.json({
    success: true,
    data,
    pagination,
    meta: buildMeta(c, locale),
  });
}

/** Calculate pagination metadata from total count and params */
export function buildPagination(
  page: number,
  perPage: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
