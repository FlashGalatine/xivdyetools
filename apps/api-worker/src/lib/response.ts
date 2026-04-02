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

function buildMeta(c: AppContext, locale?: string): ResponseMeta {
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

export function errorResponse(
  c: AppContext,
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return c.json(
    {
      success: false,
      error: code,
      message,
      ...(details !== undefined && { details }),
      meta: buildMeta(c),
    },
    status as 400,
  );
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
