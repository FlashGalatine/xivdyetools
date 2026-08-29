/**
 * api-worker origin shared by every browser → data.xivdyetools.app call
 * (.chara resolution, telemetry). `VITE_API_WORKER_URL` wins (local dev
 * against a tunnel or the `-dev` worker); production builds use
 * data.xivdyetools.app, which answers every origin (`cors({ origin: '*' })`)
 * — production, beta and *.pages.dev alike.
 *
 * @module services/api-worker-origin
 */

const PROD_API_BASE = 'https://data.xivdyetools.app';
/** `wrangler dev` port from apps/api-worker/wrangler.toml */
const DEV_API_BASE = 'http://localhost:8790';

export function getApiWorkerBase(): string {
  const env = import.meta.env.VITE_API_WORKER_URL;
  if (env) return env.replace(/\/$/, '');
  return import.meta.env.PROD ? PROD_API_BASE : DEV_API_BASE;
}
