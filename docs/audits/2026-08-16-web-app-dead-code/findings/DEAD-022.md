# [DEAD-022]: 472 dead i18n keys across all six locales (~131 KB / 26 % of every locale file)

## Category
Legacy Data (i18n)

## Location
- `apps/web-app/src/locales/{en,ja,de,fr,ko,zh}.json` — 1,526 keys each (excl. `meta.*`)
- Full key list: `evidence/agent-report-i18n.md` §D; tiered raw dump: `evidence/i18n-unused-keys-full.txt`

## Evidence
Three passes, each stricter than the last:
1. The repo's own `scripts/analyze-unused-keys.js` (only knows `LanguageService.t('literal')` and `labelKey:`) → 507 candidates.
2. Main-session dump: for each key, exact-literal match, dynamic-prefix detection (`` `ns.${…}` ``), and last-segment presence → 632 candidates in four confidence tiers.
3. Agent verification: enumerated **every** key-construction pattern in the app (11 patterns — `LanguageService.t`, `tInterpolate`, 6 prefixed/suffixed/infix templates, `${tool.translationKey}.title`, `preset.${id}.${field}`, static `*Key` maps), resolved the *actual value set* of every dynamic template (e.g. `HARMONY_TYPE_IDS`, `TIER_KEYS`, `METHOD_STEM`, `VISION_TYPES`, the 15 curated preset ids, `THEME_NAMES`), and re-ran an exact-literal regex for **all 472** surviving keys over every `.ts/.js/.mjs/.html` in `apps/web-app` incl. `e2e/` and `scripts/` → **0 hits**.

Result: **472 DEAD**, **160 false positives** (all documented with their consumer — notably `mixer.model{Rgb,…}` via `` `mixer.model${Model}` `` and every `tools.<x>.{title,shortName,description}` via `v4-app-header.ts:533-588`).

Dead keys by namespace: `preset` 85 (58 are `preset.<id>.tags.N` — no `tags` field is ever requested; 27 are a removed pre-5.0 preset browser UI: `featured`, `loadMore`, `browse`, `sortBy`, …) · `mixer` 67 (the *old* gradient-mixer vocabulary: `interpolationSteps`, `saveGradient`, `savedGradients`, …) · `matcher` 43 (**the entire legacy namespace** — the tool was renamed extractor; `tools.matcher.*` survived via `translationKey`, the body did not) · `config` 33 (all duplicates of live keys in other namespaces) · `comparison` 30 (the removed HSV charts/matrix — cf. DEAD-015 `dyesWithHSV`) · `budget` 29 · `common` 26 · `tools` 23 (all 9 `tools.*.subtitle` + presets leftovers) · `accessibility` 22 · `gradient` 16 (flat `gradient.modeRgb` shape; live shape is nested `gradient.mode.rgb`) · `palette` 15 · `harmony` 14 · `errors` 12 (`error-handler.ts` has no `errors.*` lookups at all) · `filters` 12 · `swatch` 12 · `marketBoard` 8 · `auth` 5 · `collections` 5 · `app` 5 · `success` 3 · 7 singletons.

**Not dead (previously mis-reported):** the entire `tutorial.*` namespace (47 keys) is live via `tutorial-service.ts` `titleKey`/`descriptionKey` literals and `tutorial-spotlight.ts`; the prior "36 unused tutorial keys" note is stale.

No consumer of these JSON files exists outside `apps/web-app` (core and bot-logic have their own locale sets; og-worker does not read them).

## Why It Exists
Every UI rewrite (v3 → v4 → 5.0) added keys for the new UI and left the old namespace in place; the validator only checks *missing* keys, never *orphaned* ones.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — 0 literal hits for all 472; every dynamic template's value set enumerated |
| **Blast Radius** | LOW — 6 JSON files; no test asserts on key counts; `validate:i18n` passes when keys are removed from all six |
| **Reversibility** | EASY (git) |
| **Hidden Consumers** | The failure mode of a mistaken deletion is visible and loud (raw dot-path renders in the UI + `logger.warn`), not silent. Remove from **all six** locales in one commit — removing from `en.json` alone would leave invisible orphans in the other five (`validate-i18n.js` only iterates en's keys). |

## Recommendation
**REMOVE**

### Rationale
131 KB of source (26 % of every locale), ~20 KB raw per English visitor / ~44 KB per non-English visitor (locale + en fallback) before gzip. More importantly, 472 orphaned strings are 472 things translators are asked to maintain for nothing.

### If Removing
1. Script the deletion from the list in `evidence/agent-report-i18n.md` §D against all six files (a small Node script: load JSON, delete each dot-path, re-serialise with 2-space indent, preserve key order)
2. `pnpm --filter xivdyetools-web-app run validate:i18n && pnpm --filter xivdyetools-web-app run test`
3. Smoke every tool in `vite preview` in `en` and one CJK locale; grep the console for `Missing translation`
4. Consider extending `scripts/validate-i18n.js` (or `analyze-unused-keys.js`, DEAD-026) with the 11 lookup patterns so orphan detection becomes a CI gate
