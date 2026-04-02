import type { ExtendedLogger } from '@xivdyetools/logger';

/** Cloudflare Worker bindings */
export interface Env {
  RATE_LIMIT: KVNamespace;
  ENVIRONMENT: string;
  API_VERSION: string;
}

/** Hono context variables set by middleware */
export type Variables = {
  requestId: string;
  logger: ExtendedLogger;
};
