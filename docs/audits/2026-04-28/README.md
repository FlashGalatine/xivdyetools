# i18n Audit — 2026-04-28

Comprehensive internationalization audit of the xivdyetools monorepo across all 6 supported languages (en, ja, de, fr, ko, zh).

## Reports

- **[I18N_AUDIT.md](./I18N_AUDIT.md)** — Main report with executive summary and prioritized recommendations
- **[LOCALE_PARITY.md](./LOCALE_PARITY.md)** — Key/path parity comparison across all 18 locale files
- **[FONT_SUBSET_AUDIT.md](./FONT_SUBSET_AUDIT.md)** — CJK font subsetting status, including a critical bug
- **[HARDCODED_STRINGS.md](./HARDCODED_STRINGS.md)** — Hardcoded English strings outside the i18n system

## TL;DR

| Finding | Severity |
|---------|----------|
| **All 18 locale files have perfect structural parity** (605/1119/243 paths matched across all 6 languages) | OK |
| **Subset script `subset-cjk-fonts.py` has stale path** — silently skips core dye-name characters since the monorepo restructure | **HIGH** |
| KR subset is 814 KiB (5× larger than documented 155 KiB); likely contains stale glyphs and unnecessary layout features | MED |
| og-worker hardcodes English `TOOL_NAMES`/`HARMONY_NAMES`/`VISION_NAMES`/`SHEET_NAMES` — every social-media link preview is English regardless of `?lang=` | MED |
| og-worker bundles no CJK fonts; future OG localization will need them | DEFERRED |
| **2 confirmed defects**: `themes.sugarRiot` in web-app/de.json (`Sugar Riot` → `Zuckerschock`) and web-app/ko.json (`슈가` → `슈거` spelling) — verified via Garland Tools BNpcName lookup and SE Korea official FB | LOW |
| `themes.sugarRiot` in zh.json kept English correctly — patch 7.2 not yet on CN client; do not fan-translate | DEFERRED |
| `labels.metallic` in core/de.json — verify against FFXIV German client | LOW |

## Top 3 Actions

1. Fix path bug in [`apps/discord-worker/scripts/subset-cjk-fonts.py:46`](../../../apps/discord-worker/scripts/subset-cjk-fonts.py#L46) (`xivdyetools-core` → `packages/core`) and replace silent skip with a hard error
2. Re-run subsetter, verify with the script in [I18N_AUDIT §9](./I18N_AUDIT.md#9-verification-script-run-after-fix-1), commit refreshed font subsets
3. Localize og-worker hardcoded display names by sourcing from existing locale JSON

---

# Deep-Dive Audit — 2026-04-28 (added later)

Companion deep-dive code analysis appended to this folder after the i18n audit. **Delta-focused** since [2026-04-07](../2026-04-07/DEEP_DIVE_REPORT.md): verifies still-open prior findings and surfaces what's new.

## Reports

- **[DEEP_DIVE_REPORT.md](./DEEP_DIVE_REPORT.md)** — Executive summary, prior-findings status, new findings tables, top recommended actions
- **[ANALYSIS_MANIFEST.md](./ANALYSIS_MANIFEST.md)** — Scope, methodology, packages analyzed, prior audit cross-references
- Per-finding files in [`bugs/`](./bugs/), [`refactoring/`](./refactoring/), [`optimization/`](./optimization/), [`architecture/`](./architecture/)

## TL;DR

| Finding | Severity |
|---------|----------|
| [BUG-001](bugs/BUG-001.md) — api-worker uses bare `console.error` for unhandled errors instead of the structured logger pattern from `@xivdyetools/worker-middleware` | **MED** |
| [BUG-002](bugs/BUG-002.md) — Latent: `TranslationProvider.getDyeName()` returns `null` for Patch 7.5 consolidated itemIDs (52254/52255/52256). No caller currently triggers it; defensive hardening recommended. | LOW |
| [BUG-003](bugs/BUG-003.md) — 8 test fixtures use stale `acquisition: 'Crafting'` after `colors_xiv.json` rename; will silently mask future filter regressions | **MED** |
| [BUG-004](bugs/BUG-004.md) — api-worker `kvLimiter` cached at module scope; harmless today but inconsistent with sibling-worker patterns | LOW |
| [REFACTOR-001](refactoring/REFACTOR-001.md) — og-worker hardcodes English display names; cross-references this folder's [I18N_AUDIT](./I18N_AUDIT.md) | **MED** |
| [REFACTOR-002](refactoring/REFACTOR-002.md) — og-worker and universalis-proxy lack the standard middleware stack (request ID, logger) | **MED** |
| [REFACTOR-003](refactoring/REFACTOR-003.md) — `getLogger`/`getRequestId` use `Context<any, any, any>` instead of Hono module augmentation | LOW |
| [OPT-001](optimization/OPT-001.md) — api-worker calls `LocalizationService.setLocale()` per-request without memoization | LOW |
| [ARCH-001](architecture/ARCH-001.md) — api-worker CORS `maxAge: 86400` (24h) — long for an evolving public API; presets-api/oauth precedent is 3600 | LOW |
| [ARCH-002](architecture/ARCH-002.md) — No end-to-end tests for Patch 7.5 consolidation flow or Facewear synthetic-ID invariant | **MED** |

**Summary:** 0 critical/high, 4 MED, 6 LOW. See [DEEP_DIVE_REPORT.md §Top Recommended Actions](./DEEP_DIVE_REPORT.md#top-recommended-actions) for prioritization.

---

# Security Audit — 2026-04-28 (added later)

Third audit appended to this folder, after the i18n and deep-dive reports. **Delta-focused** since the [2026-04-07 baseline](../2026-04-07/SECURITY_AUDIT_REPORT.md): verifies prior-finding status, audits the new `apps/api-worker` + `packages/worker-middleware` attack surfaces, and sweeps for regressions across the rest of the monorepo.

## Reports

- **[SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)** — Executive summary, prior-finding closures, new attack surface analysis, dependency posture, threat model delta, recommendations
- Per-finding files in [`security/`](./security/)

## TL;DR

| Finding | Severity |
|---------|----------|
| [SEC-001](security/SEC-001.md) — `auth-button.ts:222` interpolates XIVAuth `primary_character.name` and `.server` into `innerHTML`; violates the project's own documented "use textContent for user-controlled data" rule from web-app/CLAUDE.md | **LOW** |
| [SEC-002](security/SEC-002.md) — `worker-middleware` rate-limit `keyExtractor` is an arbitrary callback; a future worker that derives keys from `X-Forwarded-For` would silently re-introduce `BUG-018`. Today every caller is correct | **INFO** |
| [SEC-003](security/SEC-003.md) — Dev-only vulns in `apps/api-docs > vitepress > vite/esbuild`; rollup arm of prior SEC-006 is closed via `pnpm.overrides`. STANDING until VitePress 2.x | **LOW** (dev) |
| ~~`2026-04-07/SEC-002`~~ (modal-container `innerHTML`) | **FIXED** — verified via `content.appendChild` at `modal-container.ts:241-242` |
| ~~`2026-04-07/SEC-006` rollup arm~~ | **FIXED** — `pnpm audit` no longer reports rollup |

**Summary:** 0 critical/high, 0 medium, 2 LOW, 1 INFO. Posture remains **STRONG**; no production-impacting issues. The new `api-worker` is well-built (whitelisted input validation, hardened IP extractor, no service bindings, JSON-only responses).

## Top 3 Actions

1. **[SEC-001]** Replace the `innerHTML` template at [`apps/web-app/src/components/auth-button.ts:222`](../../apps/web-app/src/components/auth-button.ts#L222) with `createElement` + `textContent` — ~10 lines, aligns with documented project policy
2. **[SEC-002]** Add a "do not use `X-Forwarded-For`" JSDoc warning to `keyExtractor` in [`packages/worker-middleware/src/rate-limit.ts`](../../packages/worker-middleware/src/rate-limit.ts), or default it to `(c) => getClientIp(c.req.raw)` — prevents future regressions of `BUG-018`
3. **[SEC-003]** No action; re-check VitePress 2.x quarterly

## Cross-References to Companion Audits

- [`architecture/ARCH-001`](architecture/ARCH-001.md) — api-worker CORS `maxAge: 86400` (deep-dive finding, not a security vuln)
- [`refactoring/REFACTOR-002`](refactoring/REFACTOR-002.md) — api-worker missing `loggerMiddleware` (deep-dive finding, observability not security)
