/** Cloudflare Worker bindings */
export interface Env {
  RATE_LIMIT: KVNamespace;
  ENVIRONMENT: string;
  API_VERSION: string;
}

/** Hono context variables set by middleware */
export type Variables = {
  requestId: string;
  // OPT-001 (2026-04-28 audit): set by localeMiddleware on /v1/*
  locale: 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';
};
