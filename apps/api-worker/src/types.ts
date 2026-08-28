/** Cloudflare Worker bindings */
export interface Env {
  RATE_LIMIT: KVNamespace;
  /**
   * FINDING-003: native Workers Rate Limiting binding (`[[ratelimits]]`,
   * limit 65 / 60 s) — the /v1/* per-IP limiter when bound; KV is the fallback.
   */
  API_RATE_LIMITER?: RateLimit;
  ENVIRONMENT: string;
  API_VERSION: string;
  /** Universalis proxy routes (absorbed from apps/universalis-proxy) */
  UNIVERSALIS_API_BASE: string;
  /** Static docs site (absorbed from apps/api-docs) — production env only */
  ASSETS?: Fetcher;
  /** Per-IP memory rate limit for /universalis aggregated route */
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  /** XIVAPI v2 origin for /v1/chara/* (default https://v2.xivapi.com) */
  XIVAPI_BASE?: string;
  /**
   * XIVAPI game-version key the chara resolver is pinned to — `latest` or a
   * key from `/api/version`. Also namespaces the row cache. After a patch,
   * search 503s on the new key until ingested: keep the old key until a
   * probe succeeds, then roll forward.
   */
  XIVAPI_VERSION?: string;
  /** Optional `exdschema@2:rev:<sha>` pin so an upstream field rename cannot break parsing */
  XIVAPI_SCHEMA?: string;
}

/** Hono context variables set by middleware */
export type Variables = {
  requestId: string;
  // OPT-001 (2026-04-28 audit): set by localeMiddleware on /v1/*
  locale: 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';
};
