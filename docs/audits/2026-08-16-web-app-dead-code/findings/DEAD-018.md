# [DEAD-018]: ~24 `console.info` debug-trace calls that bypass the dev-gated logger and ship to production

## Category
Legacy Code (debug residue) — REFACTOR, not delete

## Location
`evidence/agent-report-ts-symbols.md` §E5. `src/shared/logger.ts` gates `logger.info/debug` on `isDev()`; these calls use `console.*` directly and therefore fire in production:

| file | lines | count | pattern |
|---|---|---|---|
| `src/services/auth-service.ts` | 240, 258, 268, 277, 296, 410, 557 | 7 | `🔐` OAuth-flow tracing — **logs `window.location.href` and URL params during the auth-code exchange** |
| `src/components/extractor-tool.ts` | 842, 856, 2301, 2389, 2406 | 5 | `🔔` / `💰` price-fetch tracing |
| `src/components/market-board.ts` | 292, 311, 447, 471 | 4 | `📣` event-emit tracing |
| `src/components/preset-submission-form.ts` | 698, 700, 731, 733 | 4 | modal-dismiss tracing |
| `src/services/pricing-mixin.ts` | 64, 72, 82 | 3 | `📡` listener tracing |
| `src/services/api-service-wrapper.ts` | 222 | 1 | |
| `src/components/v4/preset-detail.ts` 658, 692, 778 · `src/components/base-component.ts` 139, 592, 613 | | 6 | `console.error` — arguably legitimate; route through `logger.error` (not dev-gated) for consistency |

`eslint.config.js` sets `no-console: warn` with `allow: ['warn','error','info']` — which is exactly why `console.info` slipped through.

## Why It Exists
Emoji-tagged tracing added while debugging price fetching and OAuth; never downgraded to the logger.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM (dead as *product* code; the messages have no consumer) |
| **Blast Radius** | NONE functionally |
| **Reversibility** | EASY |
| **Hidden Consumers** | Support workflows that ask users for console output? — none documented. |

## Recommendation
**REFACTOR FIRST** — convert to `logger.info(...)` (dev-gated) or delete; **`auth-service.ts` first** (it echoes request context into every user's console during sign-in). Then tighten ESLint: drop `'info'` from the `no-console` allow list so the class cannot regrow.

### If Removing
1. Replace each `console.info(...)` with `logger.info(...)` (or delete the pure-trace ones)
2. `eslint.config.js`: `no-console: ['warn', { allow: ['warn', 'error'] }]`
3. `pnpm --filter xivdyetools-web-app run lint`
