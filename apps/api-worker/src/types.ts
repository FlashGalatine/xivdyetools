/** Cloudflare Worker bindings */
export interface Env {
  RATE_LIMIT: KVNamespace;
  ENVIRONMENT: string;
  API_VERSION: string;
  /** Universalis proxy routes (absorbed from apps/universalis-proxy) */
  UNIVERSALIS_API_BASE: string;
  /** Per-IP memory rate limit for /universalis aggregated route */
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
}

/** Hono context variables set by middleware */
export type Variables = {
  requestId: string;
  // OPT-001 (2026-04-28 audit): set by localeMiddleware on /v1/*
  locale: 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';
};
