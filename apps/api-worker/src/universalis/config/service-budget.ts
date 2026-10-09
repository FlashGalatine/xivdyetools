/**
 * How much larger the Universalis proxy's service-binding bucket is than the
 * per-IP one (BUG-048): our own workers share ONE key, so the ceiling is
 * `RATE_LIMIT_REQUESTS * SERVICE_BINDING_BUDGET_MULTIPLIER`.
 *
 * Since the limiter moved onto native bindings (FINDING-011) this number no
 * longer enforces anything on the binding path — the
 * `UNIVERSALIS_SERVICE_RATE_LIMITER` binding's own `limit` in wrangler.toml
 * does. It feeds the reported `X-RateLimit-Limit` and the KV fallback budget,
 * so it must equal that binding's `limit / RATE_LIMIT_REQUESTS`. It lives in
 * its own module so `tests/wrangler-config.test.ts` can import it and fail on
 * drift (BUG-039) instead of keeping a second copy of the number.
 */
export const SERVICE_BINDING_BUDGET_MULTIPLIER = 20;
